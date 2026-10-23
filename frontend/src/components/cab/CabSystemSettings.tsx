import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Save,
  Smartphone,
  Users,
  Plus,
  Trash2,
  RefreshCw,
  Sparkles,
  Check,
  Car,
  Package,
  Clock,
  Radio,
  Store,
  Bike
} from "lucide-react";

export interface DriverGroup {
  id: string;
  name: string;
  chat_id: string;
}

export type ServiceGroupType = "hire" | "rent_a_car" | "delivery_shop" | "delivery_riders";

export interface SystemSettingsConfig {
  admin_whatsapp_number: string;
  hire_admin_number?: string;
  rent_admin_number?: string;
  delivery_admin_number?: string;
  broadcast_delay_seconds: number;
  hire_driver_groups: DriverGroup[];
  rent_a_car_groups: DriverGroup[];
  delivery_driver_groups: DriverGroup[]; // Delivery Shop Groups
  delivery_rider_groups: DriverGroup[];  // Delivery Riders Groups
  target_driver_groups?: DriverGroup[];
}

export interface WahaGroup {
  id: string;
  name: string;
}

export default function CabSystemSettings() {
  const [adminPhone, setAdminPhone] = useState("");
  const [hireAdminPhone, setHireAdminPhone] = useState("");
  const [rentAdminPhone, setRentAdminPhone] = useState("");
  const [deliveryAdminPhone, setDeliveryAdminPhone] = useState("");
  const [broadcastDelay, setBroadcastDelay] = useState<number>(3);
  const [activeGroupTab, setActiveGroupTab] = useState<ServiceGroupType>("hire");

  // Separate group states for the 4 service tabs
  const [hireGroups, setHireGroups] = useState<DriverGroup[]>([]);
  const [rentCarGroups, setRentCarGroups] = useState<DriverGroup[]>([]);
  const [deliveryShopGroups, setDeliveryShopGroups] = useState<DriverGroup[]>([]);
  const [deliveryRiderGroups, setDeliveryRiderGroups] = useState<DriverGroup[]>([]);

  const [whatsappGroups, setWhatsappGroups] = useState<WahaGroup[]>([]);
  const [fetchingGroups, setFetchingGroups] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadSystemSettings();
      fetchWhatsAppGroups(false);
    }
  }, [user]);

  const fetchWhatsAppGroups = async (showToast = true) => {
    try {
      setFetchingGroups(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";

      let sessionIdParam = "";
      try {
        const { data: userSessions } = await supabase
          .from("user_wsender_sessions" as any)
          .select("session_id")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (userSessions?.session_id) {
          sessionIdParam = `&sessionId=${encodeURIComponent(userSessions.session_id)}`;
        }
      } catch (e) {
        console.warn("Could not query user_wsender_sessions:", e);
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wsender-sessions-central_cab?action=list-groups${sessionIdParam}&_t=${Date.now()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to fetch groups from WhatsApp");
      }

      const result = await res.json();
      const rawList: any[] = Array.isArray(result?.data)
        ? result.data
        : (result?.data && typeof result.data === "object" ? Object.values(result.data) : []);
      const list: WahaGroup[] = rawList
        .map((g: any) => {
          const idStr = typeof g?.id === "object"
            ? (g.id?._serialized || (g.id?.user && g.id?.server ? `${g.id.user}@${g.id.server}` : "") || "")
            : String(g?.id || "");
          const nameStr = typeof g?.name === "string" && g.name.trim()
            ? g.name.trim()
            : typeof g?.subject === "string" && g.subject.trim()
              ? g.subject.trim()
              : typeof g?.groupMetadata?.subject === "string" && g.groupMetadata.subject.trim()
                ? g.groupMetadata.subject.trim()
                : (idStr ? `Group (${idStr.replace("@g.us", "")})` : "WhatsApp Group");
          return {
            id: String(idStr),
            name: String(nameStr),
          };
        })
        .filter((g) => Boolean(g.id));

      setWhatsappGroups(list);

      if (showToast) {
        if (list.length === 0) {
          toast({
            title: "No WhatsApp Groups Found",
            description: "Connected WhatsApp has no active group chats, or session is not linked yet.",
          });
        } else {
          toast({
            title: "WhatsApp Groups Loaded",
            description: `Found ${list.length} group(s) from your connected WhatsApp account.`,
          });
        }
      }
    } catch (err: any) {
      console.warn("fetchWhatsAppGroups error:", err);
      if (showToast) {
        toast({
          title: "Could not load WhatsApp groups",
          description: err.message || "Please make sure your WhatsApp session is connected in the WhatsApp tab.",
          variant: "destructive",
        });
      }
    } finally {
      setFetchingGroups(false);
    }
  };

  const parseDriverGroups = (raw: any): DriverGroup[] => {
    if (!Array.isArray(raw)) return [];
    return raw.map((g: any, i: number) => ({
      id: String(g.id || `grp_${Date.now()}_${i}`),
      name: typeof g.name === "string" ? g.name : String(g.name || ""),
      chat_id: typeof g.chat_id === "object"
        ? String(g.chat_id?._serialized || "")
        : String(g.chat_id || ""),
    }));
  };

  const loadSystemSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema("central_cab")
        .from("settings")
        .select("value")
        .eq("user_id", user?.id)
        .eq("key", "cab_system_settings")
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error("Failed to load cab system settings:", error);
      }

      if (data?.value) {
        const val = data.value;
        setAdminPhone(typeof val.admin_whatsapp_number === "string" ? val.admin_whatsapp_number : "");
        setHireAdminPhone(typeof val.hire_admin_number === "string" ? val.hire_admin_number : "");
        setRentAdminPhone(typeof val.rent_admin_number === "string" ? val.rent_admin_number : "");
        setDeliveryAdminPhone(typeof val.delivery_admin_number === "string" ? val.delivery_admin_number : "");
        setBroadcastDelay(Number(val.broadcast_delay_seconds) > 0 ? Number(val.broadcast_delay_seconds) : 3);

        const legacyGroups = parseDriverGroups(val.target_driver_groups);
        const parsedHire = parseDriverGroups(val.hire_driver_groups);
        const parsedRent = parseDriverGroups(val.rent_a_car_groups);
        const parsedDeliveryShop = parseDriverGroups(val.delivery_driver_groups);
        const parsedDeliveryRider = parseDriverGroups(val.delivery_rider_groups);

        setHireGroups(parsedHire.length > 0 ? parsedHire : legacyGroups);
        setRentCarGroups(parsedRent);
        setDeliveryShopGroups(parsedDeliveryShop);
        setDeliveryRiderGroups(parsedDeliveryRider);
      }
    } catch (err) {
      console.error("Load system settings error:", err);
    } finally {
      setLoading(false);
    }
  };

  const safeGenerateId = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      try {
        return crypto.randomUUID();
      } catch {
        // Fallback
      }
    }
    return `grp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  };

  // Helpers to get and set current active tab's groups
  const getCurrentGroups = (): DriverGroup[] => {
    if (activeGroupTab === "hire") return hireGroups;
    if (activeGroupTab === "rent_a_car") return rentCarGroups;
    if (activeGroupTab === "delivery_shop") return deliveryShopGroups;
    return deliveryRiderGroups;
  };

  const setCurrentGroups = (updater: (prev: DriverGroup[]) => DriverGroup[]) => {
    if (activeGroupTab === "hire") setHireGroups(updater);
    else if (activeGroupTab === "rent_a_car") setRentCarGroups(updater);
    else if (activeGroupTab === "delivery_shop") setDeliveryShopGroups(updater);
    else setDeliveryRiderGroups(updater);
  };

  const handleAddGroup = () => {
    const serviceName =
      activeGroupTab === "hire"
        ? "Hire Driver"
        : activeGroupTab === "rent_a_car"
          ? "Rent a Car"
          : activeGroupTab === "delivery_shop"
            ? "Delivery Shop"
            : "Delivery Rider";
    const current = getCurrentGroups();
    const newGroup: DriverGroup = {
      id: safeGenerateId(),
      name: `${serviceName} Group ${current.length + 1}`,
      chat_id: "",
    };
    setCurrentGroups((prev) => [...prev, newGroup]);
  };

  const handleRemoveGroup = (id: string) => {
    setCurrentGroups((prev) => prev.filter((g) => g.id !== id));
  };

  const handleGroupChange = (id: string, field: "name" | "chat_id", val: string) => {
    setCurrentGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, [field]: val } : g))
    );
  };

  const handleAddDiscoveredGroup = (wg: WahaGroup) => {
    const current = getCurrentGroups();
    const alreadyExists = current.some((g) => g.chat_id === wg.id);
    if (alreadyExists) {
      toast({
        title: "Already Added",
        description: `"${wg.name || wg.id}" is already added to this tab.`,
      });
      return;
    }
    const newGroup: DriverGroup = {
      id: safeGenerateId(),
      name: wg.name || `Group ${current.length + 1}`,
      chat_id: wg.id,
    };
    setCurrentGroups((prev) => [...prev, newGroup]);
    toast({
      title: "Group Added",
      description: `Added "${wg.name || wg.id}" to ${getTabLabel(activeGroupTab)}. Click "Save System Settings" to persist.`,
    });
  };

  const handleAddAllDiscoveredGroups = () => {
    const current = getCurrentGroups();
    const toAdd = whatsappGroups.filter(
      (wg) => wg && wg.id && !current.some((g) => g.chat_id === wg.id)
    );
    if (toAdd.length === 0) {
      toast({
        title: "All Groups Already Added",
        description: `All detected WhatsApp groups are already in ${getTabLabel(activeGroupTab)}.`,
      });
      return;
    }
    const newItems: DriverGroup[] = toAdd.map((wg, idx) => ({
      id: safeGenerateId() + `_${idx}`,
      name: wg.name || `Group ${current.length + idx + 1}`,
      chat_id: wg.id,
    }));
    setCurrentGroups((prev) => [...prev, ...newItems]);
    toast({
      title: "All Groups Added",
      description: `Added ${newItems.length} group(s) to ${getTabLabel(activeGroupTab)}.`,
    });
  };

  const handleSave = async () => {
    if (!user) return;
    try {
      setSaving(true);
      const cleanFilter = (list: DriverGroup[]) => list.filter((g) => g.name.trim() || g.chat_id.trim());

      const cleanHire = cleanFilter(hireGroups);
      const cleanRent = cleanFilter(rentCarGroups);
      const cleanDeliveryShop = cleanFilter(deliveryShopGroups);
      const cleanDeliveryRider = cleanFilter(deliveryRiderGroups);
      const delay = Math.max(1, Number(broadcastDelay) || 3);

      const { error } = await supabase
        .schema("central_cab")
        .from("settings")
        .upsert(
          {
            user_id: user.id,
            key: "cab_system_settings",
            value: {
              admin_whatsapp_number: adminPhone.trim(),
              hire_admin_number: hireAdminPhone.trim(),
              rent_admin_number: rentAdminPhone.trim(),
              delivery_admin_number: deliveryAdminPhone.trim(),
              broadcast_delay_seconds: delay,
              hire_driver_groups: cleanHire,
              rent_a_car_groups: cleanRent,
              delivery_driver_groups: cleanDeliveryShop, // Delivery Shop Groups
              delivery_rider_groups: cleanDeliveryRider, // Delivery Riders Groups
              target_driver_groups: cleanHire, // Legacy fallback
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,key" }
        );

      if (error) throw error;

      toast({
        title: "System Settings Saved",
        description: "Admin numbers, Shop groups, Rider groups, and anti-ban delay have been successfully updated.",
      });
    } catch (err: any) {
      toast({
        title: "Error Saving Settings",
        description: err.message || "Failed to save system settings.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getTabLabel = (tab: ServiceGroupType) => {
    switch (tab) {
      case "hire": return "Hire Driver Groups";
      case "rent_a_car": return "Rent a Car Groups";
      case "delivery_shop": return "Delivery Shop Groups";
      case "delivery_riders": return "Delivery Riders Groups";
    }
  };

  const currentGroups = getCurrentGroups();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">System & Broadcast Settings</h2>
          <p className="text-sm text-muted-foreground">
            Configure Admin voice dispatch credentials, anti-ban forwarding delays, and service-specific WhatsApp Driver Groups.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2 shadow-sm">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save System Settings
        </Button>
      </div>

      {/* Grid: Admin WhatsApp Number & Anti-Ban Delay */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Admin WhatsApp Number Card */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Admin WhatsApp Numbers</CardTitle>
                <CardDescription className="text-xs">
                  Configure Master Admin and dedicated Service Admins for Hire, Rent a Car, and Delivery.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3.5 pt-1">
            <div>
              <Label className="text-xs font-medium text-foreground mb-1 block">
                👑 Main Admin WhatsApp Number (Master)
              </Label>
              <Input
                type="text"
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
                placeholder="94771234567"
                className="font-mono font-medium"
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Receives all bookings, authorizes dispatch, and can confirm/book any service.
              </p>
            </div>

            <div className="pt-2 border-t space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  Service-Specific Admin Numbers (Tags)
                </span>
                <Badge variant="outline" className="text-[10px] py-0">Direct Routing</Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <Label className="text-[11px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
                    <Car className="h-3 w-3 text-amber-500" /> Hire Admin
                  </Label>
                  <Input
                    type="text"
                    value={hireAdminPhone}
                    onChange={(e) => setHireAdminPhone(e.target.value)}
                    placeholder="9477..."
                    className="font-mono text-xs h-8"
                  />
                </div>

                <div>
                  <Label className="text-[11px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
                    <Car className="h-3 w-3 text-blue-500" /> Rent Admin
                  </Label>
                  <Input
                    type="text"
                    value={rentAdminPhone}
                    onChange={(e) => setRentAdminPhone(e.target.value)}
                    placeholder="9477..."
                    className="font-mono text-xs h-8"
                  />
                </div>

                <div>
                  <Label className="text-[11px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
                    <Package className="h-3 w-3 text-emerald-500" /> Delivery Admin
                  </Label>
                  <Input
                    type="text"
                    value={deliveryAdminPhone}
                    onChange={(e) => setDeliveryAdminPhone(e.target.value)}
                    placeholder="9477..."
                    className="font-mono text-xs h-8"
                  />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                When specified, orders are also delivered directly to that specific service admin. Delivery Admin can confirm orders and assign shop pickup locations.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Anti-Ban Group Forwarding Delay */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 border border-amber-500/20">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Anti-Ban Broadcast Delays</CardTitle>
                <CardDescription className="text-xs">
                  Prevents WhatsApp number bans by spacing out consecutive group broadcast messages.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-1">
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1 flex items-center justify-between">
                <span>Delay Between Groups (Seconds)</span>
                <span className="font-semibold text-foreground text-xs">{broadcastDelay}s + jitter</span>
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min="1"
                  max="30"
                  step="1"
                  value={broadcastDelay}
                  onChange={(e) => setBroadcastDelay(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-28 font-mono font-bold"
                />
                <span className="text-xs text-muted-foreground">seconds gap per group</span>
              </div>
            </div>

            <div className="rounded-lg bg-amber-500/5 border border-amber-200 p-2.5 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
              <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-tight">
                <strong>Recommended: 3 to 5 seconds.</strong> Staggers outbound messages with random micro-jitter so WhatsApp won't detect automated rapid bulk firing.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Target Driver WhatsApp Groups by Service */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Service-Specific WhatsApp Groups</CardTitle>
                <CardDescription className="text-xs">
                  Configure WhatsApp groups for Hire Drivers, Rent a Car providers, Delivery Shops, and Delivery Riders.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => fetchWhatsAppGroups(true)}
                variant="outline"
                size="sm"
                disabled={fetchingGroups}
                className="gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${fetchingGroups ? "animate-spin" : ""}`} />
                {fetchingGroups ? "Loading..." : "Scan Phone Groups"}
              </Button>
              <Button onClick={handleAddGroup} variant="outline" size="sm" className="gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Add Group
              </Button>
            </div>
          </div>

          {/* Service Group Sub-Tabs (4 Tabs) */}
          <div className="pt-3">
            <Tabs value={activeGroupTab} onValueChange={(val) => setActiveGroupTab(val as ServiceGroupType)} className="w-full">
              <TabsList className="grid grid-cols-2 lg:grid-cols-4 h-auto p-1.5 sm:p-2 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 gap-2 sm:gap-2.5 shadow-inner">
                {/* 1. Hire Cab Tab */}
                <TabsTrigger
                  value="hire"
                  className={`py-2.5 sm:py-3 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 flex items-center justify-center gap-1.5 sm:gap-2 border cursor-pointer ${activeGroupTab === "hire"
                      ? "!bg-gradient-to-r !from-amber-400 !via-amber-500 !to-yellow-500 !text-slate-950 !border-amber-400 !shadow-lg shadow-amber-500/30 ring-2 ring-amber-400/60 scale-[1.01]"
                      : "bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-amber-500/15 hover:text-amber-900 dark:hover:text-amber-300 hover:border-amber-300/60"
                    }`}
                >
                  <span className="text-base sm:text-lg">🚖</span>
                  <span className="truncate">Hire Drivers</span>
                  <Badge
                    className={`ml-1 h-5 px-1.5 text-[10px] font-black rounded-full transition-colors border ${activeGroupTab === "hire"
                        ? "bg-slate-950 text-amber-300 border-slate-950 shadow-xs"
                        : "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
                      }`}
                  >
                    {hireGroups.length}
                  </Badge>
                </TabsTrigger>

                {/* 2. Rent a Car Tab */}
                <TabsTrigger
                  value="rent_a_car"
                  className={`py-2.5 sm:py-3 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 flex items-center justify-center gap-1.5 sm:gap-2 border cursor-pointer ${activeGroupTab === "rent_a_car"
                      ? "!bg-gradient-to-r !from-blue-600 !via-indigo-600 !to-blue-700 !text-white !border-blue-400 !shadow-lg shadow-blue-500/30 ring-2 ring-blue-400/60 scale-[1.01]"
                      : "bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-blue-500/15 hover:text-blue-900 dark:hover:text-blue-300 hover:border-blue-300/60"
                    }`}
                >
                  <span className="text-base sm:text-lg">🚗</span>
                  <span className="truncate">Rent a Car</span>
                  <Badge
                    className={`ml-1 h-5 px-1.5 text-[10px] font-black rounded-full transition-colors border ${activeGroupTab === "rent_a_car"
                        ? "bg-white text-blue-700 border-white shadow-xs"
                        : "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
                      }`}
                  >
                    {rentCarGroups.length}
                  </Badge>
                </TabsTrigger>

                {/* 3. Delivery Shop Tab (Previously Delivery) */}
                <TabsTrigger
                  value="delivery_shop"
                  className={`py-2.5 sm:py-3 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 flex items-center justify-center gap-1.5 sm:gap-2 border cursor-pointer ${activeGroupTab === "delivery_shop"
                      ? "!bg-gradient-to-r !from-emerald-600 !via-teal-600 !to-emerald-700 !text-white !border-emerald-400 !shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-400/60 scale-[1.01]"
                      : "bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-emerald-500/15 hover:text-emerald-900 dark:hover:text-emerald-300 hover:border-emerald-300/60"
                    }`}
                >
                  <span className="text-base sm:text-lg">🏪</span>
                  <span className="truncate">Delivery Shops</span>
                  <Badge
                    className={`ml-1 h-5 px-1.5 text-[10px] font-black rounded-full transition-colors border ${activeGroupTab === "delivery_shop"
                        ? "bg-white text-emerald-700 border-white shadow-xs"
                        : "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                      }`}
                  >
                    {deliveryShopGroups.length}
                  </Badge>
                </TabsTrigger>

                {/* 4. Delivery Riders Tab (NEW) */}
                <TabsTrigger
                  value="delivery_riders"
                  className={`py-2.5 sm:py-3 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 flex items-center justify-center gap-1.5 sm:gap-2 border cursor-pointer ${activeGroupTab === "delivery_riders"
                      ? "!bg-gradient-to-r !from-purple-600 !via-violet-600 !to-fuchsia-700 !text-white !border-purple-400 !shadow-lg shadow-purple-500/30 ring-2 ring-purple-400/60 scale-[1.01]"
                      : "bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-purple-500/15 hover:text-purple-900 dark:hover:text-purple-300 hover:border-purple-300/60"
                    }`}
                >
                  <span className="text-base sm:text-lg">🛵</span>
                  <span className="truncate">Delivery Riders</span>
                  <Badge
                    className={`ml-1 h-5 px-1.5 text-[10px] font-black rounded-full transition-colors border ${activeGroupTab === "delivery_riders"
                        ? "bg-white text-purple-700 border-white shadow-xs"
                        : "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800"
                      }`}
                  >
                    {deliveryRiderGroups.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-1">
          {/* Tab Description Guide */}
          <div
            className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 transition-all ${activeGroupTab === "hire"
                ? "bg-amber-500/5 border-amber-300/60 text-amber-950 dark:text-amber-200"
                : activeGroupTab === "rent_a_car"
                  ? "bg-blue-500/5 border-blue-300/60 text-blue-950 dark:text-blue-200"
                  : activeGroupTab === "delivery_shop"
                    ? "bg-emerald-500/5 border-emerald-300/60 text-emerald-950 dark:text-emerald-200"
                    : "bg-purple-500/5 border-purple-300/60 text-purple-950 dark:text-purple-200"
              }`}
          >
            {activeGroupTab === "hire" && <Car className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />}
            {activeGroupTab === "rent_a_car" && <Car className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />}
            {activeGroupTab === "delivery_shop" && <Store className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />}
            {activeGroupTab === "delivery_riders" && <Bike className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />}
            <div>
              <p className="font-semibold">
                {activeGroupTab === "hire" && "🚖 Hire Driver Groups (Cab / Tuk / Bike):"}
                {activeGroupTab === "rent_a_car" && "🚗 Rent a Car Groups (Self-Drive / Vehicle Rentals):"}
                {activeGroupTab === "delivery_shop" && "🏪 Delivery Shop Groups (Merchants & Outlets):"}
                {activeGroupTab === "delivery_riders" && "🛵 Delivery Riders Groups (Dispatch & Courier Riders):"}
              </p>
              <p className="text-[11px] opacity-90 mt-0.5">
                {activeGroupTab === "hire" && "Transport bookings (Ride Now & Schedule) are broadcast here for cab/tuk/bike drivers."}
                {activeGroupTab === "rent_a_car" && "Rental inquiries are broadcast here (customer phone numbers hidden for privacy)."}
                {activeGroupTab === "delivery_shop" && "Customer product orders and drop-off locations are sent here. Shops confirm the order and specify pickup location."}
                {activeGroupTab === "delivery_riders" && "When a shop confirms an order, ride jobs with shop pickup and customer delivery drop-off are automatically dispatched here."}
              </p>
            </div>
          </div>

          {/* Discovered WhatsApp Groups Box */}
          {whatsappGroups.length > 0 && (
            <div
              className={`p-4 rounded-xl border-2 transition-all duration-200 space-y-3 ${activeGroupTab === "hire"
                  ? "border-amber-400/80 bg-amber-50/70 dark:bg-amber-950/20 shadow-xs"
                  : activeGroupTab === "rent_a_car"
                    ? "border-blue-400/80 bg-blue-50/70 dark:bg-blue-950/20 shadow-xs"
                    : activeGroupTab === "delivery_shop"
                      ? "border-emerald-400/80 bg-emerald-50/70 dark:bg-emerald-950/20 shadow-xs"
                      : "border-purple-400/80 bg-purple-50/70 dark:bg-purple-950/20 shadow-xs"
                }`}
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`p-1.5 rounded-lg ${activeGroupTab === "hire"
                        ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                        : activeGroupTab === "rent_a_car"
                          ? "bg-blue-500/20 text-blue-700 dark:text-blue-300"
                          : activeGroupTab === "delivery_shop"
                            ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                            : "bg-purple-500/20 text-purple-700 dark:text-purple-300"
                      }`}
                  >
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">
                      Discovered WhatsApp Groups ({whatsappGroups.length} Found on Phone)
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Add to active tab:{" "}
                      <strong
                        className={`font-bold ${activeGroupTab === "hire"
                            ? "text-amber-700 dark:text-amber-400"
                            : activeGroupTab === "rent_a_car"
                              ? "text-blue-700 dark:text-blue-400"
                              : activeGroupTab === "delivery_shop"
                                ? "text-emerald-700 dark:text-emerald-400"
                                : "text-purple-700 dark:text-purple-400"
                          }`}
                      >
                        {getTabLabel(activeGroupTab)}
                      </strong>
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleAddAllDiscoveredGroups}
                  size="sm"
                  className={`text-xs h-7 gap-1.5 font-bold transition-all shadow-xs ${activeGroupTab === "hire"
                      ? "!bg-amber-500 hover:!bg-amber-600 !text-slate-950 border border-amber-600/30"
                      : activeGroupTab === "rent_a_car"
                        ? "!bg-blue-600 hover:!bg-blue-700 !text-white border border-blue-700/30"
                        : activeGroupTab === "delivery_shop"
                          ? "!bg-emerald-600 hover:!bg-emerald-700 !text-white border border-emerald-700/30"
                          : "!bg-purple-600 hover:!bg-purple-700 !text-white border border-purple-700/30"
                    }`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add All to {getTabLabel(activeGroupTab)}
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {whatsappGroups.map((wg) => {
                  const isAddedToCurrent = currentGroups.some((dg) => dg.chat_id === wg.id);
                  const isAddedToHire = hireGroups.some((dg) => dg.chat_id === wg.id);
                  const isAddedToRent = rentCarGroups.some((dg) => dg.chat_id === wg.id);
                  const isAddedToShop = deliveryShopGroups.some((dg) => dg.chat_id === wg.id);
                  const isAddedToRider = deliveryRiderGroups.some((dg) => dg.chat_id === wg.id);

                  return (
                    <div
                      key={wg.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border bg-background text-xs shadow-2xs hover:border-primary/50 transition-all gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground truncate text-xs">
                          {String(wg.name || "Unnamed WhatsApp Group")}
                        </p>
                        <p className="font-mono text-[10px] text-muted-foreground truncate">
                          {String(wg.id || "")}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {isAddedToHire && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-amber-50 text-amber-700 border-amber-300">🚖 Hire</Badge>}
                          {isAddedToRent && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-blue-50 text-blue-700 border-blue-300">🚗 Rent</Badge>}
                          {isAddedToShop && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-emerald-50 text-emerald-700 border-emerald-300">🏪 Shop</Badge>}
                          {isAddedToRider && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-purple-50 text-purple-700 border-purple-300">🛵 Rider</Badge>}
                        </div>
                      </div>
                      {isAddedToCurrent ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 shrink-0">
                          <Check className="h-3 w-3" /> Added
                        </span>
                      ) : (
                        <Button
                          onClick={() => handleAddDiscoveredGroup(wg)}
                          size="sm"
                          className="text-xs h-7 px-2.5 gap-1 shrink-0"
                        >
                          <Plus className="h-3 w-3" /> Add
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Configured Service Driver Groups List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border shadow-2xs ${activeGroupTab === "hire"
                      ? "bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800"
                      : activeGroupTab === "rent_a_car"
                        ? "bg-blue-100 text-blue-950 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800"
                        : activeGroupTab === "delivery_shop"
                          ? "bg-emerald-100 text-emerald-950 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800"
                          : "bg-purple-100 text-purple-950 border-purple-300 dark:bg-purple-950 dark:text-purple-200 dark:border-purple-800"
                    }`}
                >
                  {activeGroupTab === "hire" && "🚖 Hire Driver"}
                  {activeGroupTab === "rent_a_car" && "🚗 Rent a Car"}
                  {activeGroupTab === "delivery_shop" && "🏪 Delivery Shop"}
                  {activeGroupTab === "delivery_riders" && "🛵 Delivery Rider"} Broadcast Groups ({currentGroups.length})
                </span>
              </div>
              <Button onClick={handleAddGroup} variant="outline" size="sm" className="gap-1.5 text-xs h-7 font-medium">
                <Plus className="h-3 w-3" />
                Add Custom Group
              </Button>
            </div>

            {currentGroups.length === 0 ? (
              <div className="text-center py-8 border border-dashed rounded-lg bg-muted/20 space-y-3">
                <Users className="h-8 w-8 mx-auto text-muted-foreground/50" />
                <div>
                  <p className="text-sm font-medium">No Groups Configured for {getTabLabel(activeGroupTab)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 max-w-sm mx-auto">
                    {whatsappGroups.length > 0
                      ? `Click "Add" next to any detected group above to add it to ${getTabLabel(activeGroupTab)}.`
                      : "Click \"Scan Phone Groups\" above or add group credentials manually below."}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-1">
                  {whatsappGroups.length === 0 && (
                    <Button onClick={() => fetchWhatsAppGroups(true)} variant="outline" size="sm" className="gap-1.5 text-xs">
                      <RefreshCw className={`h-3.5 w-3.5 ${fetchingGroups ? "animate-spin" : ""}`} />
                      Scan Phone Groups
                    </Button>
                  )}
                  <Button onClick={handleAddGroup} variant="secondary" size="sm" className="gap-1.5 text-xs">
                    <Plus className="h-3.5 w-3.5" />
                    Add Custom Group
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {currentGroups.map((group, idx) => (
                  <div
                    key={group.id}
                    className={`p-3.5 rounded-xl border-l-4 border bg-card/80 space-y-3 shadow-xs transition-all ${activeGroupTab === "hire"
                        ? "border-l-amber-500 border-amber-200/70 dark:border-amber-800/50 bg-amber-500/[0.02]"
                        : activeGroupTab === "rent_a_car"
                          ? "border-l-blue-500 border-blue-200/70 dark:border-blue-800/50 bg-blue-500/[0.02]"
                          : activeGroupTab === "delivery_shop"
                            ? "border-l-emerald-500 border-emerald-200/70 dark:border-emerald-800/50 bg-emerald-500/[0.02]"
                            : "border-l-purple-500 border-purple-200/70 dark:border-purple-800/50 bg-purple-500/[0.02]"
                      }`}
                  >
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        Group #{idx + 1}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-bold px-2 py-0.5 border ${activeGroupTab === "hire"
                            ? "bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200"
                            : activeGroupTab === "rent_a_car"
                              ? "bg-blue-50 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-200"
                              : activeGroupTab === "delivery_shop"
                                ? "bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200"
                                : "bg-purple-50 text-purple-900 border-purple-300 dark:bg-purple-950/60 dark:text-purple-200"
                          }`}
                      >
                        {activeGroupTab === "hire" && "🚖 Hire Driver Group"}
                        {activeGroupTab === "rent_a_car" && "🚗 Rent a Car Group"}
                        {activeGroupTab === "delivery_shop" && "🏪 Delivery Shop Group"}
                        {activeGroupTab === "delivery_riders" && "🛵 Delivery Rider Group"}
                      </Badge>
                    </div>

                    {/* WhatsApp Groups dropdown if fetched from connected phone */}
                    {whatsappGroups.length > 0 && (
                      <div className="space-y-1 pb-2 border-b border-border/40">
                        <Label className="text-[11px] font-semibold text-primary flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-primary" />
                            Select from Connected WhatsApp:
                          </span>
                          <span className="text-[10px] text-muted-foreground font-normal">
                            Auto-syncs Name & Chat ID
                          </span>
                        </Label>
                        <select
                          aria-label="Select WhatsApp Group"
                          value={group.chat_id || ""}
                          onChange={(e) => {
                            const selectedChatId = e.target.value;
                            if (!selectedChatId) {
                              handleGroupChange(group.id, "chat_id", "");
                              return;
                            }
                            const found = whatsappGroups.find((g) => g.id === selectedChatId);
                            if (found) {
                              handleGroupChange(group.id, "name", found.name);
                              handleGroupChange(group.id, "chat_id", found.id);
                              toast({
                                title: "Group Linked",
                                description: `Linked to "${found.name}" (${found.id})`,
                              });
                            } else {
                              handleGroupChange(group.id, "chat_id", selectedChatId);
                            }
                          }}
                          className="flex h-9 w-full rounded-md border border-input bg-background/80 px-3 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground cursor-pointer"
                        >
                          <option value="">-- Choose a WhatsApp Group from your phone --</option>
                          {whatsappGroups
                            .filter((wg) => wg && wg.id)
                            .map((wg) => (
                              <option key={String(wg.id)} value={String(wg.id)}>
                                {String(wg.name || "Unnamed Group")} ({String(wg.id)})
                              </option>
                            ))}
                        </select>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      <div className="w-full sm:w-1/3">
                        <Label className="text-[11px] text-muted-foreground block mb-1">
                          Group Name {idx + 1}
                        </Label>
                        <Input
                          type="text"
                          value={group.name}
                          onChange={(e) => handleGroupChange(group.id, "name", e.target.value)}
                          placeholder="e.g. Kandy Central Drivers"
                          className="text-sm font-medium"
                        />
                      </div>

                      <div className="w-full sm:w-1/2">
                        <Label className="text-[11px] text-muted-foreground block mb-1">
                          WhatsApp Group Chat ID (@g.us)
                        </Label>
                        <Input
                          type="text"
                          value={group.chat_id}
                          onChange={(e) => handleGroupChange(group.id, "chat_id", e.target.value)}
                          placeholder="e.g. 120363012345678901@g.us"
                          className="text-sm font-mono"
                        />
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center mt-2 sm:mt-5">
                        <Button
                          onClick={() => handleRemoveGroup(group.id)}
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10 h-9 w-9"
                          title="Remove Group"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Group Isolation & Anti-Ban Notice */}
          <div className="rounded-lg bg-emerald-500/5 border border-emerald-200 p-3 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2">
            <Radio className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Strict Group Isolation:</span>
              <p className="mt-0.5">
                Delivery customer inquiries are sent to <strong>Delivery Shop groups</strong>. Once confirmed by the shop, pickup & delivery jobs are sent to <strong>Delivery Riders groups</strong>. Hire rides are sent to <strong>Hire driver groups</strong>. Rental requests are sent to <strong>Rent a car groups</strong>. All alerts also route to the respective Admin WhatsApp numbers.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
