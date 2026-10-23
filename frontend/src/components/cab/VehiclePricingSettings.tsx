import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Save,
  Car,
  Bike,
  Truck,
  Bus,
  CheckCircle2,
  Percent,
  DollarSign,
  Navigation,
  Plus,
  Trash2,
  Zap,
  Calendar,
  Sparkles,
  Info,
} from "lucide-react";

export interface VehicleModel {
  id: string;
  name: string;
  description: string;
  base_price: number;
  per_km_rate: number;
  coverage_km: number;
  discount_percentage: number;
}

export interface VehiclePricing {
  base_price: number;
  per_km_rate: number;
  coverage_km: number;
  discount_percentage: number;
  models?: VehicleModel[];
}

export type PricingConfigMap = Record<string, VehiclePricing>;

const RIDE_NOW_VEHICLES = [
  { key: "motorbike", label: "Motorbike", icon: Bike, badgeColor: "bg-amber-500/10 text-amber-600 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300" },
  { key: "three_wheeler", label: "Three-wheeler (Tuk-Tuk)", icon: Car, badgeColor: "bg-yellow-500/10 text-yellow-600 border-yellow-300 dark:bg-yellow-950/40 dark:text-yellow-300" },
];

const SCHEDULE_CATEGORIES = [
  { key: "car", label: "Car (Sedan / Hatchback)", icon: Car, badgeColor: "bg-blue-500/10 text-blue-600 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300", accentColor: "border-l-blue-500" },
  { key: "van", label: "Van", icon: Truck, badgeColor: "bg-purple-500/10 text-purple-600 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300", accentColor: "border-l-purple-500" },
  { key: "lorry", label: "Lorry / Truck", icon: Truck, badgeColor: "bg-orange-500/10 text-orange-600 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300", accentColor: "border-l-orange-500" },
  { key: "bus", label: "Bus", icon: Bus, badgeColor: "bg-red-500/10 text-red-600 border-red-300 dark:bg-red-950/40 dark:text-red-300", accentColor: "border-l-red-500" },
];

export const DEFAULT_PRICING: PricingConfigMap = {
  motorbike: { base_price: 200, per_km_rate: 80, coverage_km: 2, discount_percentage: 10 },
  three_wheeler: { base_price: 300, per_km_rate: 100, coverage_km: 2, discount_percentage: 10 },
  car: {
    base_price: 600,
    per_km_rate: 150,
    coverage_km: 3,
    discount_percentage: 15,
    models: [
      { id: "car_1", name: "Alto", description: "Budget A/C, 3 Pax", base_price: 500, per_km_rate: 120, coverage_km: 2, discount_percentage: 10 },
      { id: "car_2", name: "Wagon R", description: "Comfort A/C, 4 Pax", base_price: 600, per_km_rate: 140, coverage_km: 2, discount_percentage: 12 },
      { id: "car_3", name: "Prius / Sedan", description: "Luxury Hybrid, 4 Pax", base_price: 750, per_km_rate: 175, coverage_km: 3, discount_percentage: 15 },
    ],
  },
  van: {
    base_price: 900,
    per_km_rate: 200,
    coverage_km: 3,
    discount_percentage: 15,
    models: [
      { id: "van_1", name: "KDH Flat Roof", description: "Dual A/C, 9-10 Pax", base_price: 900, per_km_rate: 190, coverage_km: 3, discount_percentage: 15 },
      { id: "van_2", name: "KDH High Roof", description: "Luxury Dual A/C, 14 Pax", base_price: 1200, per_km_rate: 240, coverage_km: 3, discount_percentage: 15 },
    ],
  },
  lorry: {
    base_price: 1500,
    per_km_rate: 300,
    coverage_km: 5,
    discount_percentage: 10,
    models: [
      { id: "lorry_1", name: "Dimo Batta", description: "1 Ton Open/Closed Cargo", base_price: 1500, per_km_rate: 260, coverage_km: 5, discount_percentage: 10 },
    ],
  },
  bus: {
    base_price: 3000,
    per_km_rate: 500,
    coverage_km: 10,
    discount_percentage: 10,
    models: [
      { id: "bus_1", name: "Rosa Mini Bus", description: "A/C, 29-33 Seats", base_price: 3000, per_km_rate: 450, coverage_km: 10, discount_percentage: 10 },
    ],
  },
};

export default function VehiclePricingSettings() {
  const [pricing, setPricing] = useState<PricingConfigMap>(DEFAULT_PRICING);
  const [activeTab, setActiveTab] = useState<"ride_now" | "ride_later">("ride_now");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadPricing();
    }
  }, [user]);

  const loadPricing = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema("central_cab")
        .from("settings")
        .select("value")
        .eq("user_id", user?.id)
        .eq("key", "cab_pricing")
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error("Failed to load cab pricing:", error);
      }

      if (data?.value) {
        // Deep merge with defaults so default models exist if not set yet
        const merged: PricingConfigMap = { ...DEFAULT_PRICING };
        for (const k of Object.keys(DEFAULT_PRICING)) {
          if (data.value[k]) {
            merged[k] = {
              ...DEFAULT_PRICING[k],
              ...data.value[k],
              models: data.value[k].models && Array.isArray(data.value[k].models)
                ? data.value[k].models
                : (DEFAULT_PRICING[k].models || []),
            };
          }
        }
        setPricing(merged);
      }
    } catch (err) {
      console.error("Load error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Field change for top-level category parameters (Ride Now or Category Fallbacks)
  const handleFieldChange = (vehicleKey: string, field: keyof VehiclePricing, val: string) => {
    const num = Number(val) >= 0 ? Number(val) : 0;
    setPricing((prev) => ({
      ...prev,
      [vehicleKey]: {
        ...(prev[vehicleKey] || DEFAULT_PRICING[vehicleKey]),
        [field]: num,
      },
    }));
  };

  // Add specific model under a category (Car, Van, Lorry, Bus)
  const handleAddModel = (categoryKey: string) => {
    const categoryDefaults = pricing[categoryKey] || DEFAULT_PRICING[categoryKey];
    const newId = `model_${categoryKey}_${Date.now()}`;
    const newModel: VehicleModel = {
      id: newId,
      name: `New ${categoryKey.toUpperCase()} Model`,
      description: "A/C, Standard Seats",
      base_price: categoryDefaults.base_price,
      per_km_rate: categoryDefaults.per_km_rate,
      coverage_km: categoryDefaults.coverage_km,
      discount_percentage: categoryDefaults.discount_percentage,
    };

    setPricing((prev) => {
      const currentModels = prev[categoryKey]?.models || [];
      return {
        ...prev,
        [categoryKey]: {
          ...prev[categoryKey],
          models: [...currentModels, newModel],
        },
      };
    });

    toast({
      title: "Model Added",
      description: `Added new model to ${categoryKey.toUpperCase()}. Remember to Save Pricing Settings.`,
    });
  };

  // Remove specific model
  const handleRemoveModel = (categoryKey: string, modelId: string) => {
    setPricing((prev) => {
      const currentModels = prev[categoryKey]?.models || [];
      return {
        ...prev,
        [categoryKey]: {
          ...prev[categoryKey],
          models: currentModels.filter((m) => m.id !== modelId),
        },
      };
    });
  };

  // Update specific model field
  const handleModelFieldChange = (
    categoryKey: string,
    modelId: string,
    field: keyof VehicleModel,
    val: string
  ) => {
    setPricing((prev) => {
      const currentModels = prev[categoryKey]?.models || [];
      const updatedModels = currentModels.map((m) => {
        if (m.id !== modelId) return m;
        if (field === "name" || field === "description") {
          return { ...m, [field]: val };
        }
        const num = Number(val) >= 0 ? Number(val) : 0;
        return { ...m, [field]: num };
      });

      return {
        ...prev,
        [categoryKey]: {
          ...prev[categoryKey],
          models: updatedModels,
        },
      };
    });
  };

  const handleSave = async () => {
    if (!user) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .schema("central_cab")
        .from("settings")
        .upsert(
          {
            user_id: user.id,
            key: "cab_pricing",
            value: pricing,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,key" }
        );

      if (error) throw error;

      toast({
        title: "Pricing Updated Successfully",
        description: "Dynamic pricing and vehicle models are now live on the WhatsApp bot.",
      });
    } catch (err: any) {
      toast({
        title: "Error Saving Pricing",
        description: err.message || "Failed to update pricing settings.",
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

  const rideLaterTotalModels = SCHEDULE_CATEGORIES.reduce(
    (acc, cat) => acc + (pricing[cat.key]?.models?.length || 0),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Vehicle Pricing & Model Configuration</h2>
          <p className="text-sm text-muted-foreground">
            Configure dynamic fare calculations for Ride Now and scheduled Ride Later vehicle categories.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2 shadow-sm font-semibold">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Pricing Settings
        </Button>
      </div>

      {/* 2 Sub-Tabs: Ride Now vs Ride Later */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid grid-cols-2 h-auto p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 gap-2 shadow-inner max-w-xl">
          {/* 1. Ride Now Sub-Tab */}
          <TabsTrigger
            value="ride_now"
            className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 border cursor-pointer ${
              activeTab === "ride_now"
                ? "!bg-gradient-to-r !from-amber-400 !via-amber-500 !to-yellow-500 !text-slate-950 !border-amber-400 !shadow-lg shadow-amber-500/30 ring-2 ring-amber-400/60 scale-[1.01]"
                : "bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-amber-500/15 hover:text-amber-900"
            }`}
          >
            <Zap className="h-4 w-4" />
            <span>⚡ Ride Now (Instant)</span>
            <Badge
              className={`ml-1 h-5 px-2 text-[10px] font-black rounded-full transition-colors border ${
                activeTab === "ride_now"
                  ? "bg-slate-950 text-amber-300 border-slate-950"
                  : "bg-amber-100 text-amber-800 border-amber-300"
              }`}
            >
              2 Vehicles
            </Badge>
          </TabsTrigger>

          {/* 2. Ride Later / Schedule Sub-Tab */}
          <TabsTrigger
            value="ride_later"
            className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 border cursor-pointer ${
              activeTab === "ride_later"
                ? "!bg-gradient-to-r !from-blue-600 !via-indigo-600 !to-blue-700 !text-white !border-blue-400 !shadow-lg shadow-blue-500/30 ring-2 ring-blue-400/60 scale-[1.01]"
                : "bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-blue-500/15 hover:text-blue-900"
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>📅 Ride Later (Schedule)</span>
            <Badge
              className={`ml-1 h-5 px-2 text-[10px] font-black rounded-full transition-colors border ${
                activeTab === "ride_later"
                  ? "bg-white text-blue-700 border-white"
                  : "bg-blue-100 text-blue-800 border-blue-300"
              }`}
            >
              {rideLaterTotalModels} Models
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* ========================================================================= */}
        {/* SUB-TAB 1: RIDE NOW (Motorbike & Three-Wheeler) */}
        {/* ========================================================================= */}
        <TabsContent value="ride_now" className="space-y-4 pt-4">
          <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50/70 dark:bg-amber-950/20 text-xs text-amber-950 dark:text-amber-200 flex items-start gap-2 shadow-2xs">
            <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Ride Now Rules:</span> When a customer selects <strong>Ride Now</strong>, the WhatsApp bot exclusively offers <strong>Motorbike 🏍️</strong> and <strong>Three-wheeler 🛺</strong> for immediate pickup. Configure their dynamic pricing parameters below.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {RIDE_NOW_VEHICLES.map(({ key, label, icon: Icon, badgeColor }) => {
              const item = pricing[key] || DEFAULT_PRICING[key];

              return (
                <Card key={key} className="border-2 border-amber-200/80 dark:border-amber-900/60 shadow-sm hover:border-amber-400 transition-all">
                  <CardHeader className="pb-3 bg-amber-50/40 dark:bg-amber-950/10 border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl border ${badgeColor}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base font-bold">{label}</CardTitle>
                          <CardDescription className="text-xs">Immediate Ride Option</CardDescription>
                        </div>
                      </div>
                      <Badge className="bg-amber-500 text-slate-950 font-bold border-amber-600">Ride Now</Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* 1. Base Price */}
                      <div>
                        <Label className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground mb-1">
                          <DollarSign className="h-3.5 w-3.5 text-amber-600" />
                          Base Price (LKR)
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          step="10"
                          value={item.base_price}
                          onChange={(e) => handleFieldChange(key, "base_price", e.target.value)}
                          className="font-semibold text-sm"
                          placeholder="e.g. 200"
                        />
                      </div>

                      {/* 2. Per KM Rate */}
                      <div>
                        <Label className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground mb-1">
                          <Navigation className="h-3.5 w-3.5 text-amber-600" />
                          Per KM Rate (LKR)
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          step="5"
                          value={item.per_km_rate}
                          onChange={(e) => handleFieldChange(key, "per_km_rate", e.target.value)}
                          className="font-semibold text-sm"
                          placeholder="e.g. 80"
                        />
                      </div>

                      {/* 3. Coverage KM */}
                      <div>
                        <Label className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground mb-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-amber-600" />
                          Coverage Distance (KM)
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          value={item.coverage_km}
                          onChange={(e) => handleFieldChange(key, "coverage_km", e.target.value)}
                          className="font-semibold text-sm"
                          placeholder="e.g. 2"
                        />
                        <span className="text-[10px] text-muted-foreground block mt-0.5">
                          Distance included in Base Price
                        </span>
                      </div>

                      {/* 4. Round Trip Discount */}
                      <div>
                        <Label className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground mb-1">
                          <Percent className="h-3.5 w-3.5 text-amber-600" />
                          Round Trip Discount (%)
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={item.discount_percentage}
                          onChange={(e) => handleFieldChange(key, "discount_percentage", e.target.value)}
                          className="font-semibold text-sm"
                          placeholder="e.g. 10"
                        />
                        <span className="text-[10px] text-muted-foreground block mt-0.5">
                          Applied for return trips
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* SUB-TAB 2: RIDE LATER / SCHEDULE (Car, Van, Lorry, Bus with custom models) */}
        {/* ========================================================================= */}
        <TabsContent value="ride_later" className="space-y-6 pt-4">
          <div className="p-3.5 rounded-xl border border-blue-300 bg-blue-50/70 dark:bg-blue-950/20 text-xs text-blue-950 dark:text-blue-200 flex items-start gap-2 shadow-2xs">
            <Sparkles className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Schedule Ride & Sub-Models:</span> When a customer selects <strong>Schedule Ride</strong>, the bot displays the 4 main categories (Car, Van, Lorry, Bus). Once a category is chosen, the bot prompts a poll listing the <strong>exact vehicle models</strong> configured below with their description and calculates the fare using that model&apos;s specific pricing!
            </div>
          </div>

          <div className="space-y-6">
            {SCHEDULE_CATEGORIES.map(({ key, label, icon: Icon, badgeColor, accentColor }) => {
              const categoryConfig = pricing[key] || DEFAULT_PRICING[key];
              const models = categoryConfig.models || [];

              return (
                <Card key={key} className={`border-l-4 ${accentColor} border shadow-sm`}>
                  <CardHeader className="pb-3 border-b bg-muted/20">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl border ${badgeColor}`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base sm:text-lg font-bold">{label}</CardTitle>
                            <Badge variant="outline" className="text-xs font-bold px-2 py-0.5">
                              {models.length} Model{models.length === 1 ? "" : "s"}
                            </Badge>
                          </div>
                          <CardDescription className="text-xs mt-0.5">
                            Category Code: <code className="font-mono">{key}</code> (Base rate: LKR {categoryConfig.base_price} | Per KM: LKR {categoryConfig.per_km_rate})
                          </CardDescription>
                        </div>
                      </div>

                      <Button
                        onClick={() => handleAddModel(key)}
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs font-bold border-primary/40 hover:bg-primary/10 text-primary"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Vehicle Model to {key.toUpperCase()}
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-4">
                    {models.length === 0 ? (
                      <div className="text-center py-6 border border-dashed rounded-xl bg-muted/20 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          No specific models added yet for {label}.
                        </p>
                        <Button
                          onClick={() => handleAddModel(key)}
                          size="sm"
                          variant="secondary"
                          className="gap-1 text-xs"
                        >
                          <Plus className="h-3 w-3" />
                          Add First Model
                        </Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {models.map((model, idx) => (
                          <div
                            key={model.id}
                            className="p-4 rounded-xl border bg-background/90 shadow-2xs space-y-3 relative hover:border-primary/50 transition-all"
                          >
                            <div className="flex items-center justify-between gap-2 border-b pb-2">
                              <span className="text-xs font-bold text-primary uppercase tracking-wider">
                                Model #{idx + 1}
                              </span>
                              <Button
                                onClick={() => handleRemoveModel(key, model.id)}
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                title="Remove model"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>

                            {/* Model Name & Short Description */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <div>
                                <Label className="text-[11px] font-semibold text-foreground block mb-1">
                                  Model Name
                                </Label>
                                <Input
                                  value={model.name}
                                  onChange={(e) =>
                                    handleModelFieldChange(key, model.id, "name", e.target.value)
                                  }
                                  placeholder="e.g. Alto 800 / Wagon R"
                                  className="h-8 text-xs font-semibold"
                                />
                              </div>

                              <div>
                                <Label className="text-[11px] font-semibold text-foreground block mb-1">
                                  Short Description (Shown on Poll)
                                </Label>
                                <Input
                                  value={model.description}
                                  onChange={(e) =>
                                    handleModelFieldChange(key, model.id, "description", e.target.value)
                                  }
                                  placeholder="e.g. 3 Pax, Budget A/C"
                                  className="h-8 text-xs"
                                />
                              </div>
                            </div>

                            {/* 4 Pricing Inputs */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                              <div>
                                <Label className="text-[10px] font-medium text-muted-foreground block mb-0.5">
                                  Base Fare (LKR)
                                </Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="10"
                                  value={model.base_price}
                                  onChange={(e) =>
                                    handleModelFieldChange(key, model.id, "base_price", e.target.value)
                                  }
                                  className="h-8 text-xs font-medium"
                                />
                              </div>

                              <div>
                                <Label className="text-[10px] font-medium text-muted-foreground block mb-0.5">
                                  Per KM (LKR)
                                </Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="5"
                                  value={model.per_km_rate}
                                  onChange={(e) =>
                                    handleModelFieldChange(key, model.id, "per_km_rate", e.target.value)
                                  }
                                  className="h-8 text-xs font-medium"
                                />
                              </div>

                              <div>
                                <Label className="text-[10px] font-medium text-muted-foreground block mb-0.5">
                                  Coverage (KM)
                                </Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={model.coverage_km}
                                  onChange={(e) =>
                                    handleModelFieldChange(key, model.id, "coverage_km", e.target.value)
                                  }
                                  className="h-8 text-xs font-medium"
                                />
                              </div>

                              <div>
                                <Label className="text-[10px] font-medium text-muted-foreground block mb-0.5">
                                  Discount (%)
                                </Label>
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="1"
                                  value={model.discount_percentage}
                                  onChange={(e) =>
                                    handleModelFieldChange(key, model.id, "discount_percentage", e.target.value)
                                  }
                                  className="h-8 text-xs font-medium"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end pt-4 border-t">
        <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2 shadow-md font-bold">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Pricing Settings
        </Button>
      </div>
    </div>
  );
}
