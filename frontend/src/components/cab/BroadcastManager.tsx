import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Radio,
  Car,
  Store,
  Bike,
  Users,
  Send,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Shuffle,
  Hash,
  Pause,
  Play,
  Square,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  ExternalLink,
  History,
  Copy,
  Info,
  Check,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Trash2,
  FolderPlus,
  ArrowRightLeft,
  ChevronDown,
  Plus,
  X,
  UploadCloud,
} from "lucide-react";
import { uploadMedia } from "@/lib/mediaStorage";
import { DriverGroup, ServiceGroupType } from "./CabSystemSettings";

export interface GroupItemWithCategory extends DriverGroup {
  category: ServiceGroupType;
  categoryLabel: string;
}

export interface BroadcastGroupStatus {
  id: string;
  name: string;
  chat_id: string;
  category: ServiceGroupType;
  categoryLabel: string;
  status: "pending" | "waiting" | "sending" | "sent" | "failed";
  sentAt?: string;
  error?: string;
}

export interface BroadcastCampaignRecord {
  id: string;
  title: string;
  message: string;
  total_count: number;
  sent_count: number;
  failed_count: number;
  status: string;
  created_at: string;
}

export default function BroadcastManager() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Loading & Group States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allGroups, setAllGroups] = useState<GroupItemWithCategory[]>([]);
  const [sessionApiKey, setSessionApiKey] = useState("");

  // Filtering & Selection
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<"all" | ServiceGroupType>("all");
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());

  // Message Composer
  const [campaignTitle, setCampaignTitle] = useState("Driver Announcement");
  const [messageText, setMessageText] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaFileName, setMediaFileName] = useState("");
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [showManualUrlInput, setShowManualUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewSpintaxText, setPreviewSpintaxText] = useState("");

  // Discovered WhatsApp Groups from WAHA account
  const [discoveredWahaGroups, setDiscoveredWahaGroups] = useState<{ id: string; name: string }[]>([]);

  // Anti-Ban Strategies
  const [delaySeconds, setDelaySeconds] = useState(8);
  const [enableJitter, setEnableJitter] = useState(true);
  const [enableUniqueHash, setEnableUniqueHash] = useState(true);
  const [enableBatchCooldown, setEnableBatchCooldown] = useState(true);
  const [batchSize, setBatchSize] = useState(5);
  const [batchCooldownSeconds, setBatchCooldownSeconds] = useState(20);

  // Active Broadcast Runner State
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState(0);
  const [currentSendingIdx, setCurrentSendingIdx] = useState(-1);
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const [groupStatuses, setGroupStatuses] = useState<BroadcastGroupStatus[]>([]);
  const [sentCount, setSentCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [testSendingGroupId, setTestSendingGroupId] = useState<string | null>(null);

  // Broadcast History
  const [campaignHistory, setCampaignHistory] = useState<BroadcastCampaignRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Abort / Pause references
  const abortBroadcastRef = useRef(false);
  const isPausedRef = useRef(false);
  isPausedRef.current = isPaused;

  // ---------------------------------------------------------------------------
  // Load Groups and Session on Mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (user) {
      loadGroupsAndSettings();
      loadCampaignHistory();
    }
  }, [user]);

  const loadGroupsAndSettings = async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);
      else setLoading(true);

      // 1. Fetch saved groups from central_cab.settings
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

      let combined: GroupItemWithCategory[] = [];
      if (data?.value) {
        const val = data.value;
        const parse = (raw: any[], cat: ServiceGroupType, label: string) => {
          if (!Array.isArray(raw)) return;
          raw.forEach((g: any, i: number) => {
            if (g && (g.chat_id || g.name)) {
              combined.push({
                id: String(g.id || `${cat}_${i}`),
                name: String(g.name || `${label} ${i + 1}`),
                chat_id: String(g.chat_id || ""),
                category: cat,
                categoryLabel: label,
              });
            }
          });
        };

        parse(val.hire_driver_groups, "hire", "Hire Driver");
        parse(val.rent_a_car_groups, "rent_a_car", "Rent a Car");
        parse(val.delivery_driver_groups, "delivery_shop", "Delivery Shop");
        parse(val.delivery_rider_groups, "delivery_riders", "Delivery Rider");
      }

      // 2. Query active WhatsApp session
      let activeSessionId = sessionApiKey;
      try {
        const { data: userSessions } = await supabase
          .schema("central_cab")
          .from("user_wsender_sessions" as any)
          .select("session_id, session_api_key")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (userSessions) {
          activeSessionId = userSessions.session_api_key || userSessions.session_id || "";
          setSessionApiKey(activeSessionId);
        }
      } catch (sessErr) {
        console.warn("Could not query user_wsender_sessions:", sessErr);
      }

      // 3. Fetch live groups directly from the currently connected WhatsApp account via WAHA
      try {
        const { data: authSession } = await supabase.auth.getSession();
        const token = authSession?.session?.access_token || "";
        const sessionIdParam = activeSessionId ? `&sessionId=${encodeURIComponent(activeSessionId)}` : "";

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

        if (res.ok) {
          const result = await res.json();
          const rawList: any[] = Array.isArray(result?.data)
            ? result.data
            : (result?.data && typeof result.data === "object" ? Object.values(result.data) : []);
          
          const liveWahaGroups: { id: string; name: string }[] = rawList
            .map((g: any) => ({
              id: String(g.id || ""),
              name: String(g.name || ""),
            }))
            .filter((g) => Boolean(g.id));

          setDiscoveredWahaGroups(liveWahaGroups);

          if (liveWahaGroups.length > 0) {
            if (combined.length === 0) {
              // Initial population if no groups existed in settings
              combined = liveWahaGroups.map((lg, i) => ({
                id: `hire_${lg.id}`,
                name: lg.name || `Hire Driver Group ${i + 1}`,
                chat_id: lg.id,
                category: "hire" as ServiceGroupType,
                categoryLabel: "Hire Driver",
              }));
            } else {
              // Update names of existing groups from fresh live data
              combined = combined.map((cg) => {
                const liveMatch = liveWahaGroups.find((lg) => lg.id === cg.chat_id);
                return liveMatch && liveMatch.name ? { ...cg, name: liveMatch.name } : cg;
              });

              // Add newly discovered groups that are not in ANY category yet
              liveWahaGroups.forEach((lg) => {
                const exists = combined.some((cg) => cg.chat_id === lg.id);
                if (!exists) {
                  combined.push({
                    id: `hire_${lg.id}`,
                    name: lg.name || "New Group",
                    chat_id: lg.id,
                    category: "hire",
                    categoryLabel: "Hire Driver",
                  });
                }
              });
            }

            // Persist the synced groups
            await persistGroupsToSettings(combined);
          }
        }
      } catch (wahaErr) {
        console.warn("Live WAHA groups fetch warning:", wahaErr);
      }

      setAllGroups(combined);

      // Select all groups by default if none selected yet, or on refresh
      if (showToast || selectedGroupIds.size === 0) {
        setSelectedGroupIds(new Set(combined.map((g) => g.id)));
      }

      if (showToast) {
        toast({
          title: "Groups Refreshed from WhatsApp",
          description: `Loaded ${combined.length} live service group(s) across all 4 categories from connected account.`,
        });
      }
    } catch (err: any) {
      console.error("loadGroupsAndSettings error:", err);
      toast({
        title: "Error Loading Groups",
        description: err.message || "Failed to load groups from settings.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const persistGroupsToSettings = async (groupsList: GroupItemWithCategory[]) => {
    if (!user) return;
    try {
      const hireGroups = groupsList.filter((g) => g.category === "hire").map((g) => ({ id: g.id, name: g.name, chat_id: g.chat_id }));
      const rentGroups = groupsList.filter((g) => g.category === "rent_a_car").map((g) => ({ id: g.id, name: g.name, chat_id: g.chat_id }));
      const shopGroups = groupsList.filter((g) => g.category === "delivery_shop").map((g) => ({ id: g.id, name: g.name, chat_id: g.chat_id }));
      const riderGroups = groupsList.filter((g) => g.category === "delivery_riders").map((g) => ({ id: g.id, name: g.name, chat_id: g.chat_id }));

      const { data: existingData } = await supabase
        .schema("central_cab")
        .from("settings")
        .select("value")
        .eq("user_id", user.id)
        .eq("key", "cab_system_settings")
        .maybeSingle();

      const updatedVal = {
        ...(existingData?.value || {}),
        hire_driver_groups: hireGroups,
        rent_a_car_groups: rentGroups,
        delivery_driver_groups: shopGroups,
        delivery_rider_groups: riderGroups,
        target_driver_groups: hireGroups,
      };

      await supabase
        .schema("central_cab")
        .from("settings")
        .upsert(
          {
            user_id: user.id,
            key: "cab_system_settings",
            value: updatedVal,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,key" }
        );
    } catch (err) {
      console.error("Failed to persist groups to settings:", err);
    }
  };

  const handleMoveGroupCategory = async (groupId: string, newCategory: ServiceGroupType) => {
    const targetGroup = allGroups.find((g) => g.id === groupId);
    if (!targetGroup) return;
    if (targetGroup.category === newCategory) return;

    const newLabel =
      newCategory === "hire" ? "Hire Driver" :
      newCategory === "rent_a_car" ? "Rent a Car" :
      newCategory === "delivery_shop" ? "Delivery Shop" : "Delivery Rider";

    const newId = `${newCategory}_${targetGroup.chat_id || Date.now()}`;
    const updatedList = allGroups.map((g) => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        id: newId,
        category: newCategory,
        categoryLabel: newLabel,
      };
    });

    setAllGroups(updatedList);
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
        next.add(newId);
      }
      return next;
    });

    await persistGroupsToSettings(updatedList);

    toast({
      title: "Group Moved",
      description: `Moved "${targetGroup.name}" to ${newLabel}.`,
    });
  };

  const handleCopyGroupToCategory = async (group: GroupItemWithCategory, targetCategory: ServiceGroupType) => {
    const targetLabel =
      targetCategory === "hire" ? "Hire Driver" :
      targetCategory === "rent_a_car" ? "Rent a Car" :
      targetCategory === "delivery_shop" ? "Delivery Shop" : "Delivery Rider";

    const newId = `${targetCategory}_${group.chat_id}`;
    if (allGroups.some((g) => g.chat_id === group.chat_id && g.category === targetCategory)) {
      toast({
        title: "Already in Category",
        description: `"${group.name}" is already in ${targetLabel}.`,
      });
      return;
    }

    const newItem: GroupItemWithCategory = {
      id: newId,
      name: group.name,
      chat_id: group.chat_id,
      category: targetCategory,
      categoryLabel: targetLabel,
    };

    const updatedList = [...allGroups, newItem];
    setAllGroups(updatedList);
    setSelectedGroupIds((prev) => new Set([...prev, newId]));

    await persistGroupsToSettings(updatedList);

    toast({
      title: "Group Added to " + targetLabel,
      description: `"${group.name}" is now available in ${targetLabel}.`,
    });
  };

  const handleCopyGroupToAllCategories = async (group: GroupItemWithCategory) => {
    const cats: ServiceGroupType[] = ["hire", "rent_a_car", "delivery_shop", "delivery_riders"];
    const additions: GroupItemWithCategory[] = [];

    for (const cat of cats) {
      if (!allGroups.some((g) => g.chat_id === group.chat_id && g.category === cat)) {
        const catLabel =
          cat === "hire" ? "Hire Driver" :
          cat === "rent_a_car" ? "Rent a Car" :
          cat === "delivery_shop" ? "Delivery Shop" : "Delivery Rider";
        additions.push({
          id: `${cat}_${group.chat_id}`,
          name: group.name,
          chat_id: group.chat_id,
          category: cat,
          categoryLabel: catLabel,
        });
      }
    }

    if (additions.length === 0) {
      toast({ title: "Already in All Categories", description: `"${group.name}" is already added across all 4 categories.` });
      return;
    }

    const updatedList = [...allGroups, ...additions];
    setAllGroups(updatedList);
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      additions.forEach((a) => next.add(a.id));
      return next;
    });

    await persistGroupsToSettings(updatedList);

    toast({
      title: "Added to All Categories",
      description: `"${group.name}" is now available across all 4 service categories.`,
    });
  };

  const handleRemoveGroupFromCategory = async (groupId: string) => {
    const targetGroup = allGroups.find((g) => g.id === groupId);
    if (!targetGroup) return;

    const updatedList = allGroups.filter((g) => g.id !== groupId);
    setAllGroups(updatedList);
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      next.delete(groupId);
      return next;
    });

    await persistGroupsToSettings(updatedList);

    toast({
      title: "Group Removed",
      description: `Removed "${targetGroup.name}" from ${targetGroup.categoryLabel}.`,
    });
  };

  const handleQuickAddWahaGroup = async (wahaGroup: { id: string; name: string }, targetCat: ServiceGroupType) => {
    const targetLabel =
      targetCat === "hire" ? "Hire Driver" :
      targetCat === "rent_a_car" ? "Rent a Car" :
      targetCat === "delivery_shop" ? "Delivery Shop" : "Delivery Rider";

    const newId = `${targetCat}_${wahaGroup.id}`;
    if (allGroups.some((g) => g.chat_id === wahaGroup.id && g.category === targetCat)) {
      toast({
        title: "Already Added",
        description: `"${wahaGroup.name}" is already in ${targetLabel}.`,
      });
      return;
    }

    const newItem: GroupItemWithCategory = {
      id: newId,
      name: wahaGroup.name,
      chat_id: wahaGroup.id,
      category: targetCat,
      categoryLabel: targetLabel,
    };

    const updatedList = [...allGroups, newItem];
    setAllGroups(updatedList);
    setSelectedGroupIds((prev) => new Set([...prev, newId]));

    await persistGroupsToSettings(updatedList);

    toast({
      title: `Added to ${targetLabel}`,
      description: `Added "${wahaGroup.name}" to ${targetLabel}.`,
    });
  };

  const handleAddAllWahaGroupsToCategory = async (targetCat: ServiceGroupType) => {
    const targetLabel =
      targetCat === "hire" ? "Hire Driver" :
      targetCat === "rent_a_car" ? "Rent a Car" :
      targetCat === "delivery_shop" ? "Delivery Shop" : "Delivery Rider";

    const groupsPool = discoveredWahaGroups.length > 0
      ? discoveredWahaGroups
      : Array.from(new Map(allGroups.map((g) => [g.chat_id, { id: g.chat_id, name: g.name }])).values());

    const toAdd = groupsPool.filter(
      (wg) => !allGroups.some((g) => g.chat_id === wg.id && g.category === targetCat)
    );

    if (toAdd.length === 0) {
      toast({
        title: "All Groups Present",
        description: `All connected WhatsApp groups are already added to ${targetLabel}.`,
      });
      return;
    }

    const newItems: GroupItemWithCategory[] = toAdd.map((wg) => ({
      id: `${targetCat}_${wg.id}`,
      name: wg.name,
      chat_id: wg.id,
      category: targetCat,
      categoryLabel: targetLabel,
    }));

    const updatedList = [...allGroups, ...newItems];
    setAllGroups(updatedList);
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      newItems.forEach((item) => next.add(item.id));
      return next;
    });

    await persistGroupsToSettings(updatedList);

    toast({
      title: `Added ${newItems.length} Group(s) to ${targetLabel}`,
      description: `All connected WhatsApp groups are now available in ${targetLabel}.`,
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Maximum file size is 50MB.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUploadingMedia(true);
      const url = await uploadMedia(file, "broadcast");
      setMediaUrl(url);
      setMediaFileName(file.name);
      toast({
        title: "Media Uploaded Successfully! ✅",
        description: `Attached ${file.name} to this broadcast.`,
      });
    } catch (err: any) {
      console.error("Upload error:", err);
      toast({
        title: "Upload Failed",
        description: err.message || "Failed to upload file.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingMedia(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const loadCampaignHistory = async () => {
    try {
      setLoadingHistory(true);
      const { data, error } = await supabase
        .from("broadcast_campaigns")
        .select("id, title, message, total_count, sent_count, failed_count, status, created_at")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!error && data) {
        setCampaignHistory(data as BroadcastCampaignRecord[]);
      }
    } catch (e) {
      console.warn("Could not load broadcast history:", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Category Color & Badge Styling Config
  // ---------------------------------------------------------------------------
  const getCategoryMeta = (cat: ServiceGroupType) => {
    switch (cat) {
      case "hire":
        return {
          label: "Hire Drivers",
          icon: Car,
          badgeColor: "bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-700",
          cardSelected: "border-amber-500 ring-2 ring-amber-400/40 bg-amber-50/50 dark:bg-amber-950/20",
          accentColor: "text-amber-600 dark:text-amber-400",
          buttonColor: "hover:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300",
        };
      case "rent_a_car":
        return {
          label: "Rent a Car",
          icon: Car,
          badgeColor: "bg-blue-100 text-blue-950 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-700",
          cardSelected: "border-blue-500 ring-2 ring-blue-400/40 bg-blue-50/50 dark:bg-blue-950/20",
          accentColor: "text-blue-600 dark:text-blue-400",
          buttonColor: "hover:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-300",
        };
      case "delivery_shop":
        return {
          label: "Delivery Shops",
          icon: Store,
          badgeColor: "bg-emerald-100 text-emerald-950 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-700",
          cardSelected: "border-emerald-500 ring-2 ring-emerald-400/40 bg-emerald-50/50 dark:bg-emerald-950/20",
          accentColor: "text-emerald-600 dark:text-emerald-400",
          buttonColor: "hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300",
        };
      case "delivery_riders":
        return {
          label: "Delivery Riders",
          icon: Bike,
          badgeColor: "bg-purple-100 text-purple-950 border-purple-300 dark:bg-purple-950 dark:text-purple-200 dark:border-purple-700",
          cardSelected: "border-purple-500 ring-2 ring-purple-400/40 bg-purple-50/50 dark:bg-purple-950/20",
          accentColor: "text-purple-600 dark:text-purple-400",
          buttonColor: "hover:bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-300",
        };
    }
  };

  // ---------------------------------------------------------------------------
  // Spintax & Dynamic Content Resolver
  // ---------------------------------------------------------------------------
  const resolveSpintax = (text: string): string => {
    if (!text) return "";
    let spun = text;
    // Replace {a|b|c} recursively
    const spintaxRegex = /\{([^{}]+)\}/g;
    while (spintaxRegex.test(spun)) {
      spun = spun.replace(spintaxRegex, (_, match) => {
        const parts = match.split("|");
        return parts[Math.floor(Math.random() * parts.length)] || "";
      });
    }
    return spun;
  };

  const generateUniqueFingerprint = (): string => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const formatFinalMessage = (rawText: string, groupName: string): string => {
    let resolved = resolveSpintax(rawText);
    // Replace dynamic placeholders if any
    resolved = resolved.replace(/\{group_name\}/gi, groupName);

    if (enableUniqueHash) {
      const code = generateUniqueFingerprint();
      resolved = `${resolved.trim()}\n\n[Ref: #${code}]`;
    }
    return resolved;
  };

  const handleTestSpintaxPreview = () => {
    if (!messageText.trim()) {
      setPreviewSpintaxText("Please type a message first to preview.");
      return;
    }
    const sample = formatFinalMessage(messageText, "Sample Group");
    setPreviewSpintaxText(sample);
  };

  // ---------------------------------------------------------------------------
  // Selection Logic
  // ---------------------------------------------------------------------------
  const filteredGroups = allGroups.filter((g) => {
    if (activeCategoryFilter === "all") return true;
    return g.category === activeCategoryFilter;
  });

  const handleToggleGroup = (groupId: string) => {
    const next = new Set(selectedGroupIds);
    if (next.has(groupId)) {
      next.delete(groupId);
    } else {
      next.add(groupId);
    }
    setSelectedGroupIds(next);
  };

  const handleSelectAll = () => {
    setSelectedGroupIds(new Set(allGroups.map((g) => g.id)));
  };

  const handleDeselectAll = () => {
    setSelectedGroupIds(new Set());
  };

  const handleSelectCurrentCategoryOnly = () => {
    if (activeCategoryFilter === "all") {
      handleSelectAll();
      return;
    }
    const catGroupIds = allGroups.filter((g) => g.category === activeCategoryFilter).map((g) => g.id);
    setSelectedGroupIds(new Set(catGroupIds));
  };

  const getSelectedCountByCategory = (cat: ServiceGroupType) => {
    return allGroups.filter((g) => g.category === cat && selectedGroupIds.has(g.id)).length;
  };

  // ---------------------------------------------------------------------------
  // Single Test Send
  // ---------------------------------------------------------------------------
  const handleTestSendSingle = async (group: GroupItemWithCategory) => {
    if (!messageText.trim()) {
      toast({
        title: "Message Required",
        description: "Please enter a message before sending a test.",
        variant: "destructive",
      });
      return;
    }

    if (!group.chat_id) {
      toast({
        title: "Invalid Group",
        description: "This group does not have a valid WhatsApp Chat ID (@g.us).",
        variant: "destructive",
      });
      return;
    }

    try {
      setTestSendingGroupId(group.id);
      const finalMsg = formatFinalMessage(messageText, group.name);

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp-central_cab`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: group.chat_id,
          message: finalMsg,
          imageUrl: mediaUrl.trim() || undefined,
          sessionApiKey: sessionApiKey || undefined,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server responded with status ${res.status}`);
      }

      toast({
        title: "Test Message Sent! ✅",
        description: `Successfully delivered test message to "${group.name}". Check WhatsApp to verify.`,
      });
    } catch (err: any) {
      toast({
        title: "Test Send Failed",
        description: err.message || "Failed to dispatch WhatsApp message.",
        variant: "destructive",
      });
    } finally {
      setTestSendingGroupId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Anti-Ban Sleep with Countdown and Pause/Abort Support
  // ---------------------------------------------------------------------------
  const safeSleepWithCountdown = async (seconds: number): Promise<boolean> => {
    let remaining = seconds;
    setCountdownSeconds(remaining);

    while (remaining > 0) {
      if (abortBroadcastRef.current) return false;

      // Handle pause loop
      while (isPausedRef.current) {
        if (abortBroadcastRef.current) return false;
        await new Promise((r) => setTimeout(r, 500));
      }

      await new Promise((r) => setTimeout(r, 1000));
      remaining -= 1;
      setCountdownSeconds(remaining);
    }

    setCountdownSeconds(0);
    return !abortBroadcastRef.current;
  };

  // ---------------------------------------------------------------------------
  // Full Broadcast Dispatcher
  // ---------------------------------------------------------------------------
  const handleStartBroadcast = async () => {
    setShowConfirmModal(false);

    if (!messageText.trim()) {
      toast({
        title: "Message Required",
        description: "Please enter your broadcast message text.",
        variant: "destructive",
      });
      return;
    }

    const selectedGroups = allGroups.filter((g) => selectedGroupIds.has(g.id) && g.chat_id);
    if (selectedGroups.length === 0) {
      toast({
        title: "No Groups Selected",
        description: "Please select at least one WhatsApp group with a valid Chat ID.",
        variant: "destructive",
      });
      return;
    }

    // Initialize Broadcast Run State
    setIsBroadcasting(true);
    setIsPaused(false);
    abortBroadcastRef.current = false;
    setSentCount(0);
    setFailedCount(0);
    setBroadcastProgress(0);

    const initialStatuses: BroadcastGroupStatus[] = selectedGroups.map((g) => ({
      id: g.id,
      name: g.name,
      chat_id: g.chat_id,
      category: g.category,
      categoryLabel: g.categoryLabel,
      status: "pending",
    }));
    setGroupStatuses(initialStatuses);

    // Create Campaign Record in Supabase
    let campaignId: string | null = null;
    try {
      const { data: campaignData, error: campaignErr } = await supabase
        .from("broadcast_campaigns")
        .insert({
          user_id: user?.id,
          name: campaignTitle.trim() || "Driver Broadcast",
          title: campaignTitle.trim() || "Driver Broadcast",
          message: messageText.trim(),
          media_url: mediaUrl.trim() || null,
          total_recipients: selectedGroups.length,
          total_count: selectedGroups.length,
          status: "in_progress",
          delay_seconds: delaySeconds,
          delay_seconds_min: delaySeconds,
          delay_seconds_max: delaySeconds + (enableJitter ? 4 : 0),
          batch_size: batchSize,
          batch_cooldown_seconds: batchCooldownSeconds,
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (!campaignErr && campaignData?.id) {
        campaignId = campaignData.id;
      }
    } catch (cErr) {
      console.warn("Could not insert campaign record:", cErr);
    }

    let localSent = 0;
    let localFailed = 0;

    toast({
      title: "Broadcast Started 🚀",
      description: `Broadcasting to ${selectedGroups.length} groups with Anti-Ban protection active.`,
    });

    for (let i = 0; i < selectedGroups.length; i++) {
      if (abortBroadcastRef.current) {
        toast({ title: "Broadcast Aborted", description: "Stopped by user.", variant: "destructive" });
        break;
      }

      setCurrentSendingIdx(i);
      const targetGroup = selectedGroups[i];

      // Mark current group as Sending
      setGroupStatuses((prev) =>
        prev.map((item, idx) => (idx === i ? { ...item, status: "sending" } : item))
      );

      // Generate unique message variation
      const formattedMsg = formatFinalMessage(messageText, targetGroup.name);

      let sendSuccess = false;
      let errorMsg = "";

      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp-central_cab`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: targetGroup.chat_id,
            message: formattedMsg,
            imageUrl: mediaUrl.trim() || undefined,
            sessionApiKey: sessionApiKey || undefined,
          }),
        });

        if (res.ok) {
          sendSuccess = true;
        } else {
          const errRes = await res.json().catch(() => ({}));
          errorMsg = errRes.error || `HTTP ${res.status}`;
        }
      } catch (err: any) {
        errorMsg = err.message || "Network / Function call failed";
      }

      if (sendSuccess) {
        localSent += 1;
        setSentCount(localSent);
        setGroupStatuses((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: "sent", sentAt: new Date().toLocaleTimeString() } : item
          )
        );

        // Record queue item if campaign exists
        if (campaignId) {
          supabase
            .from("broadcast_queue")
            .insert({
              campaign_id: campaignId,
              user_id: user?.id,
              phone_number: targetGroup.chat_id,
              recipient_name: `[${targetGroup.categoryLabel}] ${targetGroup.name}`,
              status: "sent",
              sent_at: new Date().toISOString(),
            })
            .then(() => {});
        }
      } else {
        localFailed += 1;
        setFailedCount(localFailed);
        setGroupStatuses((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: "failed", error: errorMsg } : item
          )
        );

        if (campaignId) {
          supabase
            .from("broadcast_queue")
            .insert({
              campaign_id: campaignId,
              user_id: user?.id,
              phone_number: targetGroup.chat_id,
              recipient_name: `[${targetGroup.categoryLabel}] ${targetGroup.name}`,
              status: "failed",
              error_message: errorMsg,
            })
            .then(() => {});
        }
      }

      const currentProgress = Math.round(((i + 1) / selectedGroups.length) * 100);
      setBroadcastProgress(currentProgress);

      // Check if not the last item -> Apply Anti-Ban Sleep & Jitter
      if (i < selectedGroups.length - 1) {
        let sleepTime = Math.max(3, delaySeconds);
        if (enableJitter) {
          // Add random jitter between 1 and 4 seconds
          const jitter = Math.floor(Math.random() * 4) + 1;
          sleepTime += jitter;
        }

        // Check if Batch Cooldown applies
        if (enableBatchCooldown && (i + 1) % batchSize === 0) {
          sleepTime += batchCooldownSeconds;
        }

        // Mark remaining groups as waiting
        setGroupStatuses((prev) =>
          prev.map((item, idx) => (idx > i ? { ...item, status: "waiting" } : item))
        );

        const ok = await safeSleepWithCountdown(sleepTime);
        if (!ok) break;
      }
    }

    // Complete Campaign in DB
    if (campaignId) {
      supabase
        .from("broadcast_campaigns")
        .update({
          sent_count: localSent,
          failed_count: localFailed,
          status: abortBroadcastRef.current ? "cancelled" : localFailed > 0 && localSent === 0 ? "failed" : "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", campaignId)
        .then(() => {
          loadCampaignHistory();
        });
    }

    setIsBroadcasting(false);
    setCurrentSendingIdx(-1);
    setCountdownSeconds(0);

    toast({
      title: localFailed === 0 ? "Broadcast Completed! 🎉" : "Broadcast Finished with Alerts",
      description: `Sent: ${localSent} groups | Failed: ${localFailed} groups.`,
      variant: localFailed === 0 ? "default" : "destructive",
    });
  };

  const handlePauseResume = () => {
    setIsPaused((prev) => !prev);
  };

  const handleAbort = () => {
    abortBroadcastRef.current = true;
    setIsPaused(false);
  };

  // Anti-Ban Safety Score
  const getAntiBanScore = () => {
    let score = 0;
    if (delaySeconds >= 6) score += 30;
    if (delaySeconds >= 10) score += 15;
    if (enableJitter) score += 25;
    if (enableUniqueHash) score += 15;
    if (enableBatchCooldown) score += 15;
    return score;
  };

  const antiBanScore = getAntiBanScore();

  // Estimated Duration Calculation
  const estimatedSeconds = (() => {
    const count = selectedGroupIds.size;
    if (count <= 1) return 2;
    const avgDelay = delaySeconds + (enableJitter ? 2 : 0);
    let total = (count - 1) * avgDelay;
    if (enableBatchCooldown && count > batchSize) {
      const batches = Math.floor((count - 1) / batchSize);
      total += batches * batchCooldownSeconds;
    }
    return total;
  })();

  const formatDuration = (secs: number) => {
    if (secs < 60) return `~${secs} seconds`;
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `~${mins} min ${rem > 0 ? `${rem}s` : ""}`;
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-3">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading service groups and broadcast settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="h-6 w-6 text-purple-600 animate-pulse" />
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">WhatsApp Group Broadcast Hub</h2>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Manual group selection across 4 service categories with built-in WhatsApp Anti-Ban Protection Suite.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadGroupsAndSettings(true)}
            disabled={refreshing || isBroadcasting}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh Groups
          </Button>
        </div>
      </div>

      {/* Main Broadcast Tabs: Composer & Groups vs Broadcast History */}
      <Tabs defaultValue="broadcast" className="space-y-6">
        <TabsList className="bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
          <TabsTrigger value="broadcast" className="gap-2 text-xs sm:text-sm font-semibold">
            <Send className="h-4 w-4" />
            Compose & Send
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 text-xs sm:text-sm font-semibold">
            <History className="h-4 w-4" />
            Broadcast History ({campaignHistory.length})
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------------- */}
        {/* TAB 1: COMPOSE & BROADCAST */}
        {/* ------------------------------------------------------------------- */}
        <TabsContent value="broadcast" className="space-y-6">
          {/* Active Broadcast Progress Banner (Sticky when running) */}
          {isBroadcasting && (
            <Card className="border-2 border-purple-500 shadow-xl bg-purple-50/50 dark:bg-purple-950/40 animate-in fade-in slide-in-from-top-4 duration-300">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-600"></span>
                      </span>
                      <CardTitle className="text-base font-bold text-purple-900 dark:text-purple-200">
                        {isPaused ? "⏸️ Broadcast Paused" : "🚀 Broadcasting to WhatsApp Groups..."}
                      </CardTitle>
                    </div>
                    <CardDescription className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                      {currentSendingIdx >= 0 && groupStatuses[currentSendingIdx]
                        ? `Sending to: ${groupStatuses[currentSendingIdx].name} (${groupStatuses[currentSendingIdx].categoryLabel})`
                        : "Preparing message dispatch..."}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={isPaused ? "default" : "secondary"}
                      onClick={handlePauseResume}
                      className="gap-1.5 text-xs"
                    >
                      {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                      {isPaused ? "Resume" : "Pause"}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={handleAbort} className="gap-1.5 text-xs">
                      <Square className="h-3.5 w-3.5" />
                      Stop
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>
                      Progress: {currentSendingIdx + 1} of {groupStatuses.length} groups ({broadcastProgress}%)
                    </span>
                    <span className="flex items-center gap-2 text-muted-foreground font-mono">
                      <span className="text-emerald-600 font-bold">✓ {sentCount} sent</span>
                      {failedCount > 0 && <span className="text-red-500 font-bold">✗ {failedCount} failed</span>}
                      {countdownSeconds > 0 && (
                        <span className="text-purple-700 dark:text-purple-300 font-bold animate-pulse">
                          ⏳ Next in {countdownSeconds}s
                        </span>
                      )}
                    </span>
                  </div>
                  <Progress value={broadcastProgress} className="h-3 bg-purple-200 dark:bg-purple-900" />
                </div>

                {/* Real-time Group Status Chips */}
                <div className="max-h-40 overflow-y-auto space-y-1.5 border rounded-lg p-2 bg-white/70 dark:bg-slate-900/70">
                  {groupStatuses.map((item, idx) => {
                    const meta = getCategoryMeta(item.category);
                    return (
                      <div
                        key={item.id}
                        className={`text-xs flex items-center justify-between p-1.5 rounded border transition-colors ${
                          idx === currentSendingIdx
                            ? "bg-purple-100 dark:bg-purple-950 border-purple-400 font-bold"
                            : "bg-background/80"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Badge className={`text-[10px] px-1.5 py-0 border ${meta.badgeColor}`}>
                            {item.categoryLabel}
                          </Badge>
                          <span className="truncate">{item.name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono truncate">
                            ({item.chat_id})
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.status === "sent" && (
                            <span className="text-emerald-600 flex items-center gap-1 font-semibold text-[11px]">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Sent {item.sentAt}
                            </span>
                          )}
                          {item.status === "failed" && (
                            <span className="text-red-500 flex items-center gap-1 font-semibold text-[11px]">
                              <XCircle className="h-3.5 w-3.5" /> Failed
                            </span>
                          )}
                          {item.status === "sending" && (
                            <span className="text-purple-600 flex items-center gap-1 font-semibold text-[11px] animate-pulse">
                              <RefreshCw className="h-3 w-3 animate-spin" /> Dispatching...
                            </span>
                          )}
                          {(item.status === "pending" || item.status === "waiting") && (
                            <span className="text-muted-foreground text-[10px]">Queued</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top 4 Service Category Summary Cards with Colors */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* 1. Hire Drivers */}
            <Card
              onClick={() => setActiveCategoryFilter("hire")}
              className={`cursor-pointer transition-all duration-200 border-2 ${
                activeCategoryFilter === "hire"
                  ? "border-amber-500 shadow-md ring-2 ring-amber-400/40 bg-amber-50/60 dark:bg-amber-950/30 scale-[1.01]"
                  : "border-slate-200 dark:border-slate-800 hover:border-amber-300"
              }`}
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 border border-amber-400/30">
                    <Car className="h-5 w-5" />
                  </div>
                  <Badge className="bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200">
                    {getSelectedCountByCategory("hire")} / {allGroups.filter((g) => g.category === "hire").length}{" "}
                    Selected
                  </Badge>
                </div>
                <div className="mt-2.5">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">🚖 Category 1</p>
                  <h3 className="text-sm sm:text-base font-bold text-foreground">Hire Drivers</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Cabs, Three-wheelers & Vans</p>
                </div>
              </CardContent>
            </Card>

            {/* 2. Rent a Car */}
            <Card
              onClick={() => setActiveCategoryFilter("rent_a_car")}
              className={`cursor-pointer transition-all duration-200 border-2 ${
                activeCategoryFilter === "rent_a_car"
                  ? "border-blue-500 shadow-md ring-2 ring-blue-400/40 bg-blue-50/60 dark:bg-blue-950/30 scale-[1.01]"
                  : "border-slate-200 dark:border-slate-800 hover:border-blue-300"
              }`}
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 border border-blue-400/30">
                    <Car className="h-5 w-5" />
                  </div>
                  <Badge className="bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-200">
                    {getSelectedCountByCategory("rent_a_car")} /{" "}
                    {allGroups.filter((g) => g.category === "rent_a_car").length} Selected
                  </Badge>
                </div>
                <div className="mt-2.5">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">🚗 Category 2</p>
                  <h3 className="text-sm sm:text-base font-bold text-foreground">Rent a Car</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Rental Fleet Providers</p>
                </div>
              </CardContent>
            </Card>

            {/* 3. Delivery Shops */}
            <Card
              onClick={() => setActiveCategoryFilter("delivery_shop")}
              className={`cursor-pointer transition-all duration-200 border-2 ${
                activeCategoryFilter === "delivery_shop"
                  ? "border-emerald-500 shadow-md ring-2 ring-emerald-400/40 bg-emerald-50/60 dark:bg-emerald-950/30 scale-[1.01]"
                  : "border-slate-200 dark:border-slate-800 hover:border-emerald-300"
              }`}
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-400/30">
                    <Store className="h-5 w-5" />
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200">
                    {getSelectedCountByCategory("delivery_shop")} /{" "}
                    {allGroups.filter((g) => g.category === "delivery_shop").length} Selected
                  </Badge>
                </div>
                <div className="mt-2.5">
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">🏪 Category 3</p>
                  <h3 className="text-sm sm:text-base font-bold text-foreground">Delivery Shops</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Partner Stores & Merchants</p>
                </div>
              </CardContent>
            </Card>

            {/* 4. Delivery Riders */}
            <Card
              onClick={() => setActiveCategoryFilter("delivery_riders")}
              className={`cursor-pointer transition-all duration-200 border-2 ${
                activeCategoryFilter === "delivery_riders"
                  ? "border-purple-500 shadow-md ring-2 ring-purple-400/40 bg-purple-50/60 dark:bg-purple-950/30 scale-[1.01]"
                  : "border-slate-200 dark:border-slate-800 hover:border-purple-300"
              }`}
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 border border-purple-400/30">
                    <Bike className="h-5 w-5" />
                  </div>
                  <Badge className="bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950 dark:text-purple-200">
                    {getSelectedCountByCategory("delivery_riders")} /{" "}
                    {allGroups.filter((g) => g.category === "delivery_riders").length} Selected
                  </Badge>
                </div>
                <div className="mt-2.5">
                  <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">🛵 Category 4</p>
                  <h3 className="text-sm sm:text-base font-bold text-foreground">Delivery Riders</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Parcel & Food Couriers</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Group Selection Controls & Grid */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base font-semibold">Select Target WhatsApp Groups</CardTitle>
                  </div>
                  <CardDescription className="text-xs mt-0.5">
                    Choose individual groups or entire categories to receive your broadcast message.
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Button variant="outline" size="sm" onClick={handleSelectAll} className="text-xs h-8">
                    Select All ({allGroups.length})
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDeselectAll} className="text-xs h-8">
                    Clear Selection
                  </Button>
                  {activeCategoryFilter !== "all" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleSelectCurrentCategoryOnly}
                      className="text-xs h-8"
                    >
                      Select Only {getCategoryMeta(activeCategoryFilter).label}
                    </Button>
                  )}
                  {activeCategoryFilter !== "all" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveCategoryFilter("all")}
                      className="text-xs h-8 text-muted-foreground"
                    >
                      Show All Categories
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-2 pb-2 border-b">
                <span className="text-xs font-medium text-muted-foreground mr-1">Filter View:</span>
                <Button
                  size="sm"
                  variant={activeCategoryFilter === "all" ? "default" : "outline"}
                  onClick={() => setActiveCategoryFilter("all")}
                  className="text-xs h-7 rounded-full"
                >
                  All ({allGroups.length})
                </Button>
                <Button
                  size="sm"
                  variant={activeCategoryFilter === "hire" ? "default" : "outline"}
                  onClick={() => setActiveCategoryFilter("hire")}
                  className={`text-xs h-7 rounded-full ${
                    activeCategoryFilter === "hire"
                      ? "bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
                      : "hover:border-amber-400 text-amber-800 dark:text-amber-300"
                  }`}
                >
                  🚖 Hire ({allGroups.filter((g) => g.category === "hire").length})
                </Button>
                <Button
                  size="sm"
                  variant={activeCategoryFilter === "rent_a_car" ? "default" : "outline"}
                  onClick={() => setActiveCategoryFilter("rent_a_car")}
                  className={`text-xs h-7 rounded-full ${
                    activeCategoryFilter === "rent_a_car"
                      ? "bg-blue-600 hover:bg-blue-700 text-white font-bold"
                      : "hover:border-blue-400 text-blue-800 dark:text-blue-300"
                  }`}
                >
                  🚗 Rent a Car ({allGroups.filter((g) => g.category === "rent_a_car").length})
                </Button>
                <Button
                  size="sm"
                  variant={activeCategoryFilter === "delivery_shop" ? "default" : "outline"}
                  onClick={() => setActiveCategoryFilter("delivery_shop")}
                  className={`text-xs h-7 rounded-full ${
                    activeCategoryFilter === "delivery_shop"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                      : "hover:border-emerald-400 text-emerald-800 dark:text-emerald-300"
                  }`}
                >
                  🏪 Delivery Shops ({allGroups.filter((g) => g.category === "delivery_shop").length})
                </Button>
                <Button
                  size="sm"
                  variant={activeCategoryFilter === "delivery_riders" ? "default" : "outline"}
                  onClick={() => setActiveCategoryFilter("delivery_riders")}
                  className={`text-xs h-7 rounded-full ${
                    activeCategoryFilter === "delivery_riders"
                      ? "bg-purple-600 hover:bg-purple-700 text-white font-bold"
                      : "hover:border-purple-400 text-purple-800 dark:text-purple-300"
                  }`}
                >
                  🛵 Delivery Riders ({allGroups.filter((g) => g.category === "delivery_riders").length})
                </Button>

                <div className="ml-auto text-xs font-semibold text-primary">
                  {selectedGroupIds.size} of {allGroups.length} groups selected
                </div>
              </div>

              {/* Group Cards Grid */}
              {filteredGroups.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed rounded-xl bg-slate-50 dark:bg-slate-900/50 space-y-3">
                  <div className="flex items-center justify-center gap-2 font-bold text-sm text-foreground">
                    {activeCategoryFilter === "hire" && <Radio className="h-5 w-5 text-amber-500" />}
                    {activeCategoryFilter === "rent_a_car" && <Car className="h-5 w-5 text-blue-500" />}
                    {activeCategoryFilter === "delivery_shop" && <Store className="h-5 w-5 text-emerald-500" />}
                    {activeCategoryFilter === "delivery_riders" && <Bike className="h-5 w-5 text-purple-500" />}
                    <span>No WhatsApp groups configured in {activeCategoryFilter === "all" ? "this view" : getCategoryMeta(activeCategoryFilter).label} yet</span>
                  </div>

                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    {discoveredWahaGroups.length > 0 || allGroups.length > 0
                      ? `Your connected WhatsApp account has ${discoveredWahaGroups.length || allGroups.length} group(s) available. You can add them with one click below:`
                      : "Go to Driver Groups & Admin tab or click Refresh Groups to detect your WhatsApp groups."}
                  </p>

                  {activeCategoryFilter !== "all" && (
                    <div className="flex flex-col items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={() => handleAddAllWahaGroupsToCategory(activeCategoryFilter)}
                        className={`text-xs font-bold gap-1.5 shadow-sm ${
                          activeCategoryFilter === "hire" ? "bg-amber-500 hover:bg-amber-600 text-slate-950" :
                          activeCategoryFilter === "rent_a_car" ? "bg-blue-600 hover:bg-blue-700 text-white" :
                          activeCategoryFilter === "delivery_shop" ? "bg-emerald-600 hover:bg-emerald-700 text-white" :
                          "bg-purple-600 hover:bg-purple-700 text-white"
                        }`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add All Connected WhatsApp Groups to {getCategoryMeta(activeCategoryFilter).label}
                      </Button>

                      {/* Individual discovered group pills */}
                      {(discoveredWahaGroups.length > 0
                        ? discoveredWahaGroups
                        : Array.from(new Map(allGroups.map((g) => [g.chat_id, { id: g.chat_id, name: g.name }])).values())
                      ).length > 0 && (
                        <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
                          <span className="text-[11px] text-muted-foreground mr-1">Or add individually:</span>
                          {(discoveredWahaGroups.length > 0
                            ? discoveredWahaGroups
                            : Array.from(new Map(allGroups.map((g) => [g.chat_id, { id: g.chat_id, name: g.name }])).values())
                          ).map((wg) => (
                            <Button
                              key={wg.id}
                              size="sm"
                              variant="outline"
                              onClick={() => handleQuickAddWahaGroup(wg, activeCategoryFilter)}
                              className="text-xs h-7 hover:border-primary"
                            >
                              + {wg.name}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredGroups.map((group) => {
                    const meta = getCategoryMeta(group.category);
                    const isChecked = selectedGroupIds.has(group.id);
                    const hasValidChatId = Boolean(group.chat_id);
                    const isTestSending = testSendingGroupId === group.id;

                    return (
                      <div
                        key={group.id}
                        onClick={() => handleToggleGroup(group.id)}
                        className={`group p-3 rounded-xl border transition-all cursor-pointer select-none relative ${
                          isChecked
                            ? `${meta.cardSelected} shadow-sm`
                            : "bg-card border-border hover:border-slate-300 dark:hover:border-slate-700 opacity-80"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => handleToggleGroup(group.id)}
                              className="mt-0.5"
                            />
                            <div>
                              <div className="flex items-center gap-1.5">
                                {/* Interactive Category Switcher Dropdown */}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 transition-colors cursor-pointer ${meta.badgeColor} hover:opacity-80`}
                                      title="Click to move or copy group across service categories"
                                    >
                                      <span>{group.categoryLabel}</span>
                                      <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="start" className="w-56 text-xs" onClick={(e) => e.stopPropagation()}>
                                    <DropdownMenuLabel className="text-[11px] text-muted-foreground">
                                      Move to Category:
                                    </DropdownMenuLabel>
                                    <DropdownMenuItem
                                      disabled={group.category === "hire"}
                                      onClick={() => handleMoveGroupCategory(group.id, "hire")}
                                      className="text-xs gap-2"
                                    >
                                      <Radio className="h-3.5 w-3.5 text-amber-500" />
                                      <span>🚖 Hire Drivers</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      disabled={group.category === "rent_a_car"}
                                      onClick={() => handleMoveGroupCategory(group.id, "rent_a_car")}
                                      className="text-xs gap-2"
                                    >
                                      <Car className="h-3.5 w-3.5 text-blue-500" />
                                      <span>🚗 Rent a Car</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      disabled={group.category === "delivery_shop"}
                                      onClick={() => handleMoveGroupCategory(group.id, "delivery_shop")}
                                      className="text-xs gap-2"
                                    >
                                      <Store className="h-3.5 w-3.5 text-emerald-500" />
                                      <span>🏪 Delivery Shops</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      disabled={group.category === "delivery_riders"}
                                      onClick={() => handleMoveGroupCategory(group.id, "delivery_riders")}
                                      className="text-xs gap-2"
                                    >
                                      <Bike className="h-3.5 w-3.5 text-purple-500" />
                                      <span>🛵 Delivery Riders</span>
                                    </DropdownMenuItem>

                                    <DropdownMenuSeparator />
                                    <DropdownMenuLabel className="text-[11px] text-muted-foreground">
                                      Copy or Remove:
                                    </DropdownMenuLabel>
                                    <DropdownMenuItem
                                      onClick={() => handleCopyGroupToAllCategories(group)}
                                      className="text-xs gap-2 font-semibold text-primary"
                                    >
                                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                                      <span>Copy to All 4 Categories 🌐</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleRemoveGroupFromCategory(group.id)}
                                      className="text-xs gap-2 text-destructive hover:!text-destructive"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      <span>Remove from {group.categoryLabel}</span>
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>

                              <h4 className="text-sm font-bold text-foreground mt-1 leading-snug">
                                {group.name || "Unnamed Group"}
                              </h4>
                              <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate max-w-[200px]">
                                {group.chat_id || "⚠️ No Chat ID"}
                              </p>
                            </div>
                          </div>

                          {/* Quick single-group test button */}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 opacity-60 group-hover:opacity-100 transition-opacity hover:bg-primary/10"
                            title="Send single test message to this group"
                            disabled={isTestSending || isBroadcasting}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTestSendSingle(group);
                            }}
                          >
                            {isTestSending ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                            ) : (
                              <Send className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                            )}
                          </Button>
                        </div>

                        {!hasValidChatId && (
                          <div className="mt-2 text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/40 p-1 rounded">
                            ⚠️ Missing chat ID — update in Driver Groups tab
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Anti-Ban Strategy Controls Card */}
          <Card className="border-2 border-emerald-500/40 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-semibold">WhatsApp Anti-Ban Protection Suite</CardTitle>
                      <Badge
                        className={`text-[10px] font-bold ${
                          antiBanScore >= 75
                            ? "bg-emerald-600 text-white"
                            : antiBanScore >= 50
                            ? "bg-amber-500 text-slate-950"
                            : "bg-red-500 text-white"
                        }`}
                      >
                        {antiBanScore >= 75 ? "🛡️ High Safety (Optimal)" : "⚠️ Moderate Safety"}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      Prevents WhatsApp number bans using non-linear delays, jitter pacing, and message spintax variation.
                    </CardDescription>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground bg-background/80 px-2.5 py-1 rounded-lg border font-mono">
                  Estimated Run: <span className="font-bold text-foreground">{formatDuration(estimatedSeconds)}</span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Delay Slider */}
                <div className="space-y-2 p-3 bg-background rounded-xl border">
                  <div className="flex justify-between items-center text-xs">
                    <Label className="font-semibold flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      Inter-Message Delay (Seconds)
                    </Label>
                    <span className="font-mono font-bold text-primary">{delaySeconds}s base</span>
                  </div>
                  <Slider
                    value={[delaySeconds]}
                    onValueChange={(val) => setDelaySeconds(val[0])}
                    min={4}
                    max={25}
                    step={1}
                    className="py-1"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>4s (Faster)</span>
                    <span className="text-emerald-600 font-semibold">8s - 15s (Recommended Safe)</span>
                    <span>25s (Extra Safe)</span>
                  </div>
                </div>

                {/* 2. Jitter Toggle */}
                <div className="p-3 bg-background rounded-xl border flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Shuffle className="h-3.5 w-3.5 text-blue-500" />
                      Random Interval Jitter (+1s to +4s)
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Adds random fluctuation to each interval to simulate human typing behavior.
                    </p>
                  </div>
                  <Switch checked={enableJitter} onCheckedChange={setEnableJitter} />
                </div>

                {/* 3. Unique Fingerprint Tag */}
                <div className="p-3 bg-background rounded-xl border flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Hash className="h-3.5 w-3.5 text-purple-500" />
                      Append Unique Message Fingerprint
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Appends a random reference tag (e.g. <code>[Ref: #K8F2]</code>) to ensure content hash uniqueness.
                    </p>
                  </div>
                  <Switch checked={enableUniqueHash} onCheckedChange={setEnableUniqueHash} />
                </div>

                {/* 4. Batch Cooldown Pause */}
                <div className="p-3 bg-background rounded-xl border flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Pause className="h-3.5 w-3.5 text-amber-500" />
                      Batch Rest Pause (20s Cooldown)
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Pauses for 20s after every 5 groups to prevent high-frequency automated triggers.
                    </p>
                  </div>
                  <Switch checked={enableBatchCooldown} onCheckedChange={setEnableBatchCooldown} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Message Composer Card */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <CardTitle className="text-base font-semibold">Message Composer</CardTitle>
                  <CardDescription className="text-xs">
                    Write your broadcast text to send across selected WhatsApp driver and partner groups.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3.5">
              {/* Campaign Title */}
              <div>
                <Label className="text-xs font-semibold">Campaign Title (Internal Reference)</Label>
                <Input
                  value={campaignTitle}
                  onChange={(e) => setCampaignTitle(e.target.value)}
                  placeholder="e.g. Driver Announcement"
                  className="mt-1"
                />
              </div>

              {/* Media Attachment (Image or PDF) */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                    <Paperclip className="h-3.5 w-3.5 text-primary" />
                    Attach Media (Image or PDF Document)
                  </Label>
                  {mediaUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setMediaUrl("");
                        setMediaFileName("");
                      }}
                      className="h-6 text-[11px] text-destructive hover:bg-destructive/10 px-2"
                    >
                      <X className="h-3 w-3 mr-1" /> Remove Attachment
                    </Button>
                  )}
                </div>

                {/* If Media is Uploaded / Set */}
                {mediaUrl ? (
                  <div className="p-3 rounded-xl border bg-slate-50 dark:bg-slate-900/60 flex items-center gap-3">
                    {/* Icon / Thumbnail */}
                    {mediaUrl.toLowerCase().endsWith(".pdf") || mediaFileName.toLowerCase().endsWith(".pdf") ? (
                      <div className="h-14 w-14 rounded-lg bg-red-100 dark:bg-red-950/60 border border-red-300 flex flex-col items-center justify-center text-red-600 shrink-0">
                        <FileText className="h-6 w-6" />
                        <span className="text-[9px] font-bold mt-0.5">PDF</span>
                      </div>
                    ) : (
                      <div className="h-14 w-14 rounded-lg overflow-hidden border bg-muted shrink-0 relative">
                        <img
                          src={mediaUrl}
                          alt="Preview"
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/10 -z-10">
                          <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                      </div>
                    )}

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={
                            mediaUrl.toLowerCase().endsWith(".pdf") || mediaFileName.toLowerCase().endsWith(".pdf")
                              ? "bg-red-100 text-red-800 border-red-300 text-[10px]"
                              : "bg-blue-100 text-blue-800 border-blue-300 text-[10px]"
                          }
                        >
                          {mediaUrl.toLowerCase().endsWith(".pdf") || mediaFileName.toLowerCase().endsWith(".pdf")
                            ? "📄 PDF Document"
                            : "🖼️ Image Banner"}
                        </Badge>
                        <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Attached
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-foreground truncate mt-1">
                        {mediaFileName || mediaUrl.split("/").pop() || "Uploaded File"}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">
                        {mediaUrl}
                      </p>
                    </div>

                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setMediaUrl("");
                        setMediaFileName("");
                      }}
                      className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0"
                      title="Remove file"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  /* Upload Dropzone */
                  <div className="space-y-2">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all hover:border-primary/60 hover:bg-primary/5 ${
                        isUploadingMedia ? "opacity-50 pointer-events-none" : "border-slate-300 dark:border-slate-700 bg-background"
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/jpg,application/pdf,.pdf"
                        className="hidden"
                        onChange={handleFileUpload}
                      />

                      {isUploadingMedia ? (
                        <div className="flex flex-col items-center justify-center py-2 space-y-2">
                          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                          <p className="text-xs font-semibold text-foreground">Uploading file to media cloud...</p>
                          <p className="text-[11px] text-muted-foreground">Please wait a moment</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <div className="flex items-center gap-2 text-primary">
                            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                              <ImageIcon className="h-5 w-5" />
                            </div>
                            <span className="text-muted-foreground text-xs font-bold">+</span>
                            <div className="p-2 rounded-lg bg-red-500/10 text-red-600">
                              <FileText className="h-5 w-5" />
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-foreground">
                              Click to Upload Image or PDF Document
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Supports PNG, JPG, WEBP banners or PDF brochures & rate cards (up to 50MB)
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Manual URL toggle fallback */}
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setShowManualUrlInput(!showManualUrlInput)}
                        className="text-[11px] text-primary hover:underline font-medium"
                      >
                        {showManualUrlInput ? "Hide manual URL input" : "Or enter external media URL manually"}
                      </button>
                    </div>

                    {showManualUrlInput && (
                      <Input
                        value={mediaUrl}
                        onChange={(e) => {
                          setMediaUrl(e.target.value);
                          setMediaFileName(e.target.value.split("/").pop() || "External Media");
                        }}
                        placeholder="https://example.com/banner.jpg or https://example.com/rates.pdf"
                        className="font-mono text-xs mt-1"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Message Textarea */}
              <div>
                <div className="flex justify-between items-center mb-1 text-xs">
                  <Label className="font-semibold">Message Content</Label>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {messageText.length} chars | {messageText.split(/\s+/).filter(Boolean).length} words
                  </span>
                </div>
                <Textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type your WhatsApp broadcast message here..."
                  rows={6}
                  className="font-sans text-sm leading-relaxed"
                />
              </div>

              {/* Spintax Test Preview */}
              <div className="flex items-center justify-between pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleTestSpintaxPreview}
                  className="text-xs text-primary gap-1.5 h-7 px-2"
                >
                  <Shuffle className="h-3 w-3" />
                  Preview Random Spintax Variation
                </Button>
              </div>

              {previewSpintaxText && (
                <div className="p-3 bg-purple-50/60 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-800 text-xs space-y-1">
                  <div className="flex justify-between font-bold text-purple-900 dark:text-purple-300 text-[11px]">
                    <span>📱 How it looks to a recipient:</span>
                    <button
                      onClick={() => setPreviewSpintaxText("")}
                      className="text-muted-foreground hover:text-foreground text-[10px]"
                    >
                      Close
                    </button>
                  </div>
                  <pre className="font-sans whitespace-pre-wrap text-foreground">{previewSpintaxText}</pre>
                </div>
              )}
            </CardContent>

            <CardFooter className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-slate-50 dark:bg-slate-900/40 p-4 border-t rounded-b-xl">
              <div className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{selectedGroupIds.size}</span> groups selected.
                Estimated run time: <span className="font-semibold text-foreground">{formatDuration(estimatedSeconds)}</span>.
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="default"
                  onClick={() => setShowConfirmModal(true)}
                  disabled={isBroadcasting || selectedGroupIds.size === 0 || !messageText.trim()}
                  className="gap-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:to-indigo-800 text-white shadow-md font-bold px-6"
                >
                  <Send className="h-4 w-4" />
                  Broadcast to {selectedGroupIds.size} Groups 📢
                </Button>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------------- */}
        {/* TAB 2: BROADCAST HISTORY */}
        {/* ------------------------------------------------------------------- */}
        <TabsContent value="history" className="space-y-4">
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-base font-semibold">Previous Broadcast Campaigns</CardTitle>
                  <CardDescription className="text-xs">
                    Audit log of messages dispatched to driver groups.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadCampaignHistory}
                  disabled={loadingHistory}
                  className="gap-1.5 text-xs"
                >
                  <RefreshCw className={`h-3 w-3 ${loadingHistory ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {campaignHistory.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground border-2 border-dashed rounded-xl">
                  No broadcast campaigns logged yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {campaignHistory.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl border bg-card hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors space-y-2"
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-foreground">{item.title || "Driver Broadcast"}</h4>
                          <Badge
                            className={`text-[10px] font-bold ${
                              item.status === "completed"
                                ? "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200"
                                : item.status === "cancelled"
                                ? "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200"
                                : "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-200"
                            }`}
                          >
                            {item.status.toUpperCase()}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {new Date(item.created_at).toLocaleString()}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-2 bg-slate-50 dark:bg-slate-900/60 p-2 rounded border font-sans">
                        {item.message}
                      </p>

                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                        <div className="flex items-center gap-3 font-mono">
                          <span className="text-foreground font-bold">Total: {item.total_count}</span>
                          <span className="text-emerald-600 font-bold">✓ {item.sent_count} sent</span>
                          {item.failed_count > 0 && (
                            <span className="text-red-500 font-bold">✗ {item.failed_count} failed</span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setMessageText(item.message);
                            setCampaignTitle(item.title);
                            toast({ title: "Loaded", description: "Message loaded into composer." });
                          }}
                          className="h-6 text-xs text-primary gap-1"
                        >
                          <Copy className="h-3 w-3" /> Reuse
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog Before Launching */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600">
                <Radio className="h-5 w-5" />
              </div>
              <DialogTitle className="text-base font-bold">Confirm Broadcast Launch</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Please review the campaign details before dispatching to WhatsApp groups.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Campaign:</span>
                <span className="font-bold text-foreground">{campaignTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Target Recipients:</span>
                <span className="font-bold text-purple-600 dark:text-purple-400">
                  {selectedGroupIds.size} WhatsApp Groups
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimated Duration:</span>
                <span className="font-bold text-foreground">{formatDuration(estimatedSeconds)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Anti-Ban Delay:</span>
                <span className="font-bold text-emerald-600">
                  {delaySeconds}s {enableJitter ? "+ Jitter (up to 4s)" : ""}
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg border border-amber-300 bg-amber-50/60 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-[11px] flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <span>
                Make sure your connected WhatsApp number is an active member/admin of all selected groups.
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setShowConfirmModal(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleStartBroadcast}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              Start Safe Broadcast
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
