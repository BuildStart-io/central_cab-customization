import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

import { Loader2, Save, Smartphone, Users, Plus, Trash2, Mic, Info, RefreshCw, Sparkles, Check } from "lucide-react";

export interface DriverGroup {
  id: string;
  name: string;
  chat_id: string;
}

export interface SystemSettingsConfig {
  admin_whatsapp_number: string;
  target_driver_groups: DriverGroup[];
}

export interface WahaGroup {
  id: string;
  name: string;
}

export default function CabSystemSettings() {
  const [adminPhone, setAdminPhone] = useState("");
  const [driverGroups, setDriverGroups] = useState<DriverGroup[]>([]);
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

      // Also get user's active session name from user_wsender_sessions if available
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
        setAdminPhone(typeof data.value.admin_whatsapp_number === "string" ? data.value.admin_whatsapp_number : "");
        const rawGroups = Array.isArray(data.value.target_driver_groups) ? data.value.target_driver_groups : [];
        setDriverGroups(
          rawGroups.map((g: any, i: number) => ({
            id: String(g.id || `grp_${i}`),
            name: typeof g.name === "string" ? g.name : String(g.name || ""),
            chat_id: typeof g.chat_id === "object"
              ? String(g.chat_id?._serialized || "")
              : String(g.chat_id || ""),
          }))
        );
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
        // Fallback if randomUUID fails
      }
    }
    return `grp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  };

  const handleAddGroup = () => {
    const newGroup: DriverGroup = {
      id: safeGenerateId(),
      name: `Driver Group ${driverGroups.length + 1}`,
      chat_id: "",
    };
    setDriverGroups((prev) => [...prev, newGroup]);
  };

  const handleRemoveGroup = (id: string) => {
    setDriverGroups((prev) => prev.filter((g) => g.id !== id));
  };

  const handleGroupChange = (id: string, field: "name" | "chat_id", val: string) => {
    setDriverGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, [field]: val } : g))
    );
  };

  const handleAddDiscoveredGroup = (wg: WahaGroup) => {
    const alreadyExists = driverGroups.some((g) => g.chat_id === wg.id);
    if (alreadyExists) {
      toast({
        title: "Already Added",
        description: `"${wg.name || wg.id}" is already in your driver broadcast list.`,
      });
      return;
    }
    const newGroup: DriverGroup = {
      id: safeGenerateId(),
      name: wg.name || `Driver Group ${driverGroups.length + 1}`,
      chat_id: wg.id,
    };
    setDriverGroups((prev) => [...prev, newGroup]);
    toast({
      title: "Group Added",
      description: `Added "${wg.name || wg.id}". Remember to click "Save System Settings" to save.`,
    });
  };

  const handleAddAllDiscoveredGroups = () => {
    const toAdd = whatsappGroups.filter(
      (wg) => wg && wg.id && !driverGroups.some((g) => g.chat_id === wg.id)
    );
    if (toAdd.length === 0) {
      toast({
        title: "All Groups Already Added",
        description: "All detected WhatsApp groups are already added to your driver broadcast list.",
      });
      return;
    }
    const newItems: DriverGroup[] = toAdd.map((wg, idx) => ({
      id: safeGenerateId() + `_${idx}`,
      name: wg.name || `Driver Group ${driverGroups.length + idx + 1}`,
      chat_id: wg.id,
    }));
    setDriverGroups((prev) => [...prev, ...newItems]);
    toast({
      title: "All Groups Added",
      description: `Added ${newItems.length} group(s). Click "Save System Settings" to save.`,
    });
  };

  const handleSave = async () => {
    if (!user) return;
    try {
      setSaving(true);
      const cleanGroups = driverGroups.filter(
        (g) => g.name.trim() || g.chat_id.trim()
      );

      const { error } = await supabase
        .schema("central_cab")
        .from("settings")
        .upsert(
          {
            user_id: user.id,
            key: "cab_system_settings",
            value: {
              admin_whatsapp_number: adminPhone.trim(),
              target_driver_groups: cleanGroups,
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,key" }
        );

      if (error) throw error;

      toast({
        title: "System Settings Saved",
        description: "Admin number and target driver groups have been successfully updated.",
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">System & Broadcast Settings</h2>
          <p className="text-sm text-muted-foreground">
            Configure Admin voice dispatch credentials and target WhatsApp Driver Groups.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save System Settings
        </Button>
      </div>

      {/* Admin WhatsApp Number Card */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Admin WhatsApp Number</CardTitle>
              <CardDescription className="text-xs">
                Receives order booking alerts and authorizes Admin Voice Notes for driver dispatch.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-1">
          <div className="max-w-md">
            <Label className="text-xs font-medium text-muted-foreground mb-1 block">
              Phone Number (with country code, e.g., 94771234567)
            </Label>
            <Input
              type="text"
              value={adminPhone}
              onChange={(e) => setAdminPhone(e.target.value)}
              placeholder="94771234567"
              className="font-mono font-medium"
            />
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground flex items-start gap-2 border">
            <Mic className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-foreground">How Admin Voice Commands Work:</span>
              <p className="mt-0.5">
                When the Admin sends an Order ID (e.g. <code>#ORD845</code>) + a Voice Note to the bot, the bot automatically forwards the voice note to all Driver Groups tagged with <code>Update for Order #ORD845</code> and alerts the customer that their order is confirmed.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Target Driver WhatsApp Groups Card */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Target Driver WhatsApp Groups</CardTitle>
                <CardDescription className="text-xs">
                  All new confirmed bookings and Admin voice notes are broadcasted to these group chatIDs.
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
                {fetchingGroups ? "Loading..." : "Load WhatsApp Groups"}
              </Button>
              <Button onClick={handleAddGroup} variant="outline" size="sm" className="gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Add Driver Group
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-1">
          {/* Discovered WhatsApp Groups Box - Visible immediately when groups are fetched */}
          {whatsappGroups.length > 0 && (
            <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">
                      Discovered WhatsApp Groups ({whatsappGroups.length} Found)
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Select groups from your connected WhatsApp to broadcast ride requests:
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleAddAllDiscoveredGroups}
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 text-primary border-primary/40 hover:bg-primary/10 gap-1.5 font-medium"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add All Groups ({whatsappGroups.length})
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {whatsappGroups.map((wg) => {
                  const isAdded = driverGroups.some((dg) => dg.chat_id === wg.id);
                  return (
                    <div
                      key={wg.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-background/90 text-xs shadow-2xs hover:border-primary/50 transition-all gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground truncate text-xs">
                          {String(wg.name || "Unnamed WhatsApp Group")}
                        </p>
                        <p className="font-mono text-[10px] text-muted-foreground truncate">
                          {String(wg.id || "")}
                        </p>
                      </div>
                      {isAdded ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20 shrink-0">
                          <Check className="h-3 w-3" /> Added
                        </span>
                      ) : (
                        <Button
                          onClick={() => handleAddDiscoveredGroup(wg)}
                          size="sm"
                          className="text-xs h-7 px-3 gap-1 shrink-0"
                        >
                          <Plus className="h-3 w-3" /> Add Group
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Configured Driver Broadcast Groups List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground uppercase tracking-wider text-[11px]">
                Configured Driver Broadcast Groups ({driverGroups.length})
              </Label>
              <Button onClick={handleAddGroup} variant="outline" size="sm" className="gap-1.5 text-xs h-7">
                <Plus className="h-3 w-3" />
                Add Custom Group
              </Button>
            </div>

            {driverGroups.length === 0 ? (
              <div className="text-center py-8 border border-dashed rounded-lg bg-muted/20 space-y-3">
                <Users className="h-8 w-8 mx-auto text-muted-foreground/50" />
                <div>
                  <p className="text-sm font-medium">No Driver Groups Added to Broadcast Yet</p>
                  <p className="text-xs text-muted-foreground mt-0.5 max-w-sm mx-auto">
                    {whatsappGroups.length > 0
                      ? "Click \"Add Group\" or \"Add All Groups\" in the box above to add your WhatsApp groups."
                      : "Click \"Load WhatsApp Groups\" above or add a group manually below."}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-1">
                  {whatsappGroups.length === 0 && (
                    <Button onClick={() => fetchWhatsAppGroups(true)} variant="outline" size="sm" className="gap-1.5 text-xs">
                      <RefreshCw className={`h-3.5 w-3.5 ${fetchingGroups ? "animate-spin" : ""}`} />
                      Load WhatsApp Groups
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
                {driverGroups.map((group, idx) => (
                  <div
                    key={group.id}
                    className="p-3.5 rounded-lg border bg-card/60 space-y-3 shadow-xs"
                  >
                    {/* WhatsApp Groups dropdown if fetched from connected phone */}
                    {whatsappGroups.length > 0 && (
                      <div className="space-y-1 pb-2 border-b border-border/40">
                        <Label className="text-[11px] font-semibold text-primary flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-primary" />
                            Change Linked WhatsApp Group:
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
                                title: "Group Selected",
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

          <div className="rounded-lg bg-blue-500/5 border border-blue-200 p-3 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Automatic Commission Footer:</span>
              <p className="mt-0.5">
                Every broadcasted booking to these driver groups automatically appends: <code>&quot;10% commission applies to this ride.&quot;</code>
              </p>
            </div>
          </div>

          {/* English Quick Guide */}
          <div className="rounded-lg bg-muted/60 border p-3.5 text-xs text-muted-foreground space-y-2">
            <div className="font-semibold flex items-center gap-1.5 text-foreground">
              <Info className="h-4 w-4 text-primary shrink-0" />
              <span>How to configure Driver Groups:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-[11px] leading-relaxed pl-1">
              <li>
                <strong className="text-foreground">Method 1 (Automatic Dropdown - Recommended):</strong> Connect your WhatsApp account via QR code under the <strong>WhatsApp</strong> tab. Then click <strong>&quot;Load WhatsApp Groups&quot;</strong> above to pick your driver group directly from the dropdown. Both Name and Chat ID will auto-fill instantly.
              </li>
              <li>
                <strong className="text-foreground">Method 2 (WhatsApp Web DevTools):</strong> Open WhatsApp Web (<code>web.whatsapp.com</code>), click on your Driver Group, press <kbd className="px-1 py-0.5 bg-muted rounded border text-[10px]">F12</kbd> (Inspect), and search (<kbd className="px-1 py-0.5 bg-muted rounded border text-[10px]">Ctrl + F</kbd>) for <code className="font-mono text-primary">@g.us</code> in the Elements tab to copy the group ID (e.g. <code>120363xxxxxxxxx@g.us</code>).
              </li>
              <li>
                <strong className="text-foreground">Method 3 (Via Bot Message):</strong> Add your bot's WhatsApp phone number to the Driver Group and send any message (e.g., <code>Hi</code>). The group ID will appear in your server logs.
              </li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
