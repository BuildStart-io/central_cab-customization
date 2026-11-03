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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export interface DistanceDiscountSlab {
  id: string;
  from_km: number;
  to_km?: number | null;
  discount_percentage: number;
}

export interface VehicleModel {
  id: string;
  name: string;
  description: string;
  base_price: number;
  per_km_rate: number;
  coverage_km: number;
  discount_percentage?: number;
  discount_slabs?: DistanceDiscountSlab[];
}

export interface VehiclePricing {
  label?: string;
  icon?: string;
  badge_color?: string;
  accent_color?: string;
  is_ride_now?: boolean;
  base_price: number;
  per_km_rate: number;
  coverage_km: number;
  discount_percentage?: number;
  discount_slabs?: DistanceDiscountSlab[];
  models?: VehicleModel[];
}

export type PricingConfigMap = Record<string, VehiclePricing>;

export const DEFAULT_PRICING: PricingConfigMap = {
  motorbike: {
    label: "Motorbike",
    icon: "🏍️",
    badge_color: "bg-amber-500/10 text-amber-600 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300",
    is_ride_now: true,
    base_price: 200,
    per_km_rate: 80,
    coverage_km: 2,
    discount_percentage: 10,
    discount_slabs: [
      { id: "mb_s1", from_km: 0, to_km: 10, discount_percentage: 0 },
      { id: "mb_s2", from_km: 10, to_km: 30, discount_percentage: 5 },
      { id: "mb_s3", from_km: 30, to_km: null, discount_percentage: 10 },
    ],
  },
  three_wheeler: {
    label: "Three-wheeler (Tuk-Tuk)",
    icon: "🛺",
    badge_color: "bg-yellow-500/10 text-yellow-600 border-yellow-300 dark:bg-yellow-950/40 dark:text-yellow-300",
    is_ride_now: true,
    base_price: 300,
    per_km_rate: 100,
    coverage_km: 2,
    discount_percentage: 10,
    discount_slabs: [
      { id: "tw_s1", from_km: 0, to_km: 15, discount_percentage: 0 },
      { id: "tw_s2", from_km: 15, to_km: 35, discount_percentage: 5 },
      { id: "tw_s3", from_km: 35, to_km: null, discount_percentage: 10 },
    ],
  },
  car: {
    label: "Car",
    icon: "🚗",
    badge_color: "bg-blue-500/10 text-blue-600 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300",
    accent_color: "border-l-blue-500",
    is_ride_now: false,
    base_price: 600,
    per_km_rate: 150,
    coverage_km: 3,
    discount_percentage: 15,
    discount_slabs: [
      { id: "car_s1", from_km: 0, to_km: 20, discount_percentage: 5 },
      { id: "car_s2", from_km: 20, to_km: 50, discount_percentage: 10 },
      { id: "car_s3", from_km: 50, to_km: 100, discount_percentage: 15 },
      { id: "car_s4", from_km: 100, to_km: null, discount_percentage: 20 },
    ],
    models: [
      {
        id: "car_sedan",
        name: "Sedan",
        description: "Luxury A/C, 4 Pax, Corolla / Axio / Prius",
        base_price: 750,
        per_km_rate: 175,
        coverage_km: 3,
        discount_percentage: 15,
        discount_slabs: [
          { id: "sedan_s1", from_km: 0, to_km: 20, discount_percentage: 5 },
          { id: "sedan_s2", from_km: 20, to_km: 50, discount_percentage: 10 },
          { id: "sedan_s3", from_km: 50, to_km: 100, discount_percentage: 15 },
          { id: "sedan_s4", from_km: 100, to_km: null, discount_percentage: 20 },
        ],
      },
      {
        id: "car_suv",
        name: "SUV",
        description: "High Clearance, 4-5 Pax, Vezel / Raize / CHR",
        base_price: 850,
        per_km_rate: 190,
        coverage_km: 3,
        discount_percentage: 15,
        discount_slabs: [
          { id: "suv_s1", from_km: 0, to_km: 20, discount_percentage: 5 },
          { id: "suv_s2", from_km: 20, to_km: 50, discount_percentage: 10 },
          { id: "suv_s3", from_km: 50, to_km: 100, discount_percentage: 15 },
          { id: "suv_s4", from_km: 100, to_km: null, discount_percentage: 20 },
        ],
      },
      {
        id: "car_hatchback",
        name: "Hatchback",
        description: "Budget A/C, 3-4 Pax, Alto / Wagon R / Vitz",
        base_price: 550,
        per_km_rate: 130,
        coverage_km: 2,
        discount_percentage: 10,
        discount_slabs: [
          { id: "hatch_s1", from_km: 0, to_km: 20, discount_percentage: 5 },
          { id: "hatch_s2", from_km: 20, to_km: 50, discount_percentage: 10 },
          { id: "hatch_s3", from_km: 50, to_km: 100, discount_percentage: 15 },
          { id: "hatch_s4", from_km: 100, to_km: null, discount_percentage: 20 },
        ],
      },
    ],
  },
  van: {
    label: "Van",
    icon: "🚐",
    badge_color: "bg-purple-500/10 text-purple-600 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300",
    accent_color: "border-l-purple-500",
    is_ride_now: false,
    base_price: 900,
    per_km_rate: 200,
    coverage_km: 3,
    discount_percentage: 15,
    discount_slabs: [
      { id: "van_s1", from_km: 0, to_km: 30, discount_percentage: 5 },
      { id: "van_s2", from_km: 30, to_km: 80, discount_percentage: 10 },
      { id: "van_s3", from_km: 80, to_km: null, discount_percentage: 15 },
    ],
    models: [
      {
        id: "van_1",
        name: "KDH Flat Roof",
        description: "Dual A/C, 9-10 Pax",
        base_price: 900,
        per_km_rate: 190,
        coverage_km: 3,
        discount_percentage: 15,
        discount_slabs: [
          { id: "v1_s1", from_km: 0, to_km: 30, discount_percentage: 5 },
          { id: "v1_s2", from_km: 30, to_km: 80, discount_percentage: 10 },
          { id: "v1_s3", from_km: 80, to_km: null, discount_percentage: 15 },
        ],
      },
      {
        id: "van_2",
        name: "KDH High Roof",
        description: "Luxury Dual A/C, 14 Pax",
        base_price: 1200,
        per_km_rate: 240,
        coverage_km: 3,
        discount_percentage: 15,
        discount_slabs: [
          { id: "v2_s1", from_km: 0, to_km: 30, discount_percentage: 5 },
          { id: "v2_s2", from_km: 30, to_km: 80, discount_percentage: 10 },
          { id: "v2_s3", from_km: 80, to_km: null, discount_percentage: 15 },
        ],
      },
    ],
  },
  lorry: {
    label: "Lorry / Truck",
    icon: "🚚",
    badge_color: "bg-orange-500/10 text-orange-600 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300",
    accent_color: "border-l-orange-500",
    is_ride_now: false,
    base_price: 1500,
    per_km_rate: 300,
    coverage_km: 5,
    discount_percentage: 10,
    discount_slabs: [
      { id: "lorry_s1", from_km: 0, to_km: 40, discount_percentage: 0 },
      { id: "lorry_s2", from_km: 40, to_km: 100, discount_percentage: 8 },
      { id: "lorry_s3", from_km: 100, to_km: null, discount_percentage: 12 },
    ],
    models: [
      {
        id: "lorry_1",
        name: "Dimo Batta",
        description: "1 Ton Open/Closed Cargo",
        base_price: 1500,
        per_km_rate: 260,
        coverage_km: 5,
        discount_percentage: 10,
      },
    ],
  },
  bus: {
    label: "Bus",
    icon: "🚌",
    badge_color: "bg-red-500/10 text-red-600 border-red-300 dark:bg-red-950/40 dark:text-red-300",
    accent_color: "border-l-red-500",
    is_ride_now: false,
    base_price: 3000,
    per_km_rate: 500,
    coverage_km: 10,
    discount_percentage: 10,
    discount_slabs: [
      { id: "bus_s1", from_km: 0, to_km: 50, discount_percentage: 0 },
      { id: "bus_s2", from_km: 50, to_km: 120, discount_percentage: 10 },
      { id: "bus_s3", from_km: 120, to_km: null, discount_percentage: 15 },
    ],
    models: [
      {
        id: "bus_1",
        name: "Rosa Mini Bus",
        description: "A/C, 29-33 Seats",
        base_price: 3000,
        per_km_rate: 450,
        coverage_km: 10,
        discount_percentage: 10,
      },
    ],
  },
};

/**
 * Sub-component to manage Progressive Distance Slabs
 */
function SlabEditor({
  slabs,
  baseRate,
  onChange,
}: {
  slabs: DistanceDiscountSlab[];
  baseRate: number;
  onChange: (newSlabs: DistanceDiscountSlab[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const handleAddSlab = () => {
    const lastSlab = slabs[slabs.length - 1];
    const nextFromKm = lastSlab ? (lastSlab.to_km || lastSlab.from_km + 30) : 0;
    const newSlab: DistanceDiscountSlab = {
      id: `slab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      from_km: nextFromKm,
      to_km: nextFromKm + 50,
      discount_percentage: lastSlab ? Math.min(50, lastSlab.discount_percentage + 5) : 5,
    };
    onChange([...slabs, newSlab]);
    setOpen(true);
  };

  const handleRemoveSlab = (id: string) => {
    onChange(slabs.filter((s) => s.id !== id));
  };

  const handleFieldChange = (id: string, field: "from_km" | "to_km" | "discount_percentage", val: string) => {
    const updated = slabs.map((s) => {
      if (s.id !== id) return s;
      if (field === "to_km") {
        const trimmed = val.trim();
        return { ...s, to_km: trimmed === "" ? null : Number(trimmed) };
      }
      const num = Number(val) >= 0 ? Number(val) : 0;
      return { ...s, [field]: num };
    });
    onChange(updated);
  };

  return (
    <div className="space-y-2 border rounded-xl p-3 bg-slate-50/70 dark:bg-slate-900/40">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 text-xs font-bold text-foreground hover:text-primary transition-colors"
        >
          <Layers className="h-3.5 w-3.5 text-primary" />
          <span>Distance Discount Slabs ({slabs.length})</span>
          {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleAddSlab}
          className="h-6 text-[11px] gap-1 px-2 font-semibold"
        >
          <Plus className="h-3 w-3" />
          Add Slab
        </Button>
      </div>

      {open && (
        <div className="space-y-2 pt-2 border-t text-xs">
          {slabs.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">
              No distance slabs defined. Standard flat KM rate will apply.
            </p>
          ) : (
            <div className="space-y-2">
              {slabs.map((slab, idx) => {
                const effectiveRate =
                  baseRate > 0
                    ? Math.round(baseRate * (1 - (slab.discount_percentage || 0) / 100) * 100) / 100
                    : 0;

                return (
                  <div
                    key={slab.id}
                    className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-background border text-xs"
                  >
                    <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 h-5">
                      #{idx + 1}
                    </Badge>

                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-muted-foreground">From</span>
                      <Input
                        type="number"
                        min="0"
                        value={slab.from_km}
                        onChange={(e) => handleFieldChange(slab.id, "from_km", e.target.value)}
                        className="h-7 w-16 text-xs font-mono font-bold"
                        placeholder="0"
                      />
                      <span className="text-[11px] text-muted-foreground">KM</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-muted-foreground">To</span>
                      <Input
                        type="number"
                        min="0"
                        value={slab.to_km ?? ""}
                        onChange={(e) => handleFieldChange(slab.id, "to_km", e.target.value)}
                        className="h-7 w-16 text-xs font-mono font-bold"
                        placeholder="Above"
                      />
                      <span className="text-[11px] text-muted-foreground">KM</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-muted-foreground">Off</span>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={slab.discount_percentage}
                        onChange={(e) => handleFieldChange(slab.id, "discount_percentage", e.target.value)}
                        className="h-7 w-14 text-xs font-mono font-bold text-emerald-600"
                        placeholder="%"
                      />
                      <span className="text-[11px] font-bold text-emerald-600">%</span>
                    </div>

                    <div className="text-[10px] text-muted-foreground font-mono ml-auto">
                      Rate: <span className="font-bold text-foreground">LKR {effectiveRate}/km</span>
                    </div>

                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemoveSlab(slab.id)}
                      className="h-6 w-6 text-destructive hover:bg-destructive/10"
                      title="Remove Slab"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function VehiclePricingSettings() {
  const [pricing, setPricing] = useState<PricingConfigMap>(DEFAULT_PRICING);
  const [activeTab, setActiveTab] = useState<"ride_now" | "ride_later">("ride_now");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Dialog State for adding a new Category
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatKey, setNewCatKey] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("🚙");
  const [newCatBasePrice, setNewCatBasePrice] = useState("800");
  const [newCatKmRate, setNewCatKmRate] = useState("180");
  const [newCatCoverageKm, setNewCatCoverageKm] = useState("3");

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
        const loaded = data.value;
        const merged: PricingConfigMap = { ...DEFAULT_PRICING };

        // Merge loaded keys with defaults
        for (const k of Object.keys(loaded)) {
          let models = loaded[k]?.models && Array.isArray(loaded[k].models)
            ? loaded[k].models
            : (DEFAULT_PRICING[k]?.models || []);

          // Auto-migrate legacy car models (Alto, Wagon R, etc.) to modern variations: Sedan, Hatchback, SUV
          if (k === "car") {
            const hasLegacyModels = models.some((m: any) =>
              /alto|wagon\s*r|shuttle/i.test(m?.name || "")
            );
            const hasStandardModels =
              models.some((m: any) => /sedan/i.test(m?.name || "")) &&
              models.some((m: any) => /suv/i.test(m?.name || "")) &&
              models.some((m: any) => /hatchback/i.test(m?.name || ""));
            if (hasLegacyModels || !hasStandardModels) {
              models = DEFAULT_PRICING.car.models || [];
            }
          }

          // Ensure every model has discount_slabs configured
          models = models.map((m: any, mIdx: number) => ({
            ...m,
            discount_slabs: m.discount_slabs && m.discount_slabs.length > 0
              ? m.discount_slabs
              : (loaded[k]?.discount_slabs || DEFAULT_PRICING[k]?.discount_slabs || [
                  { id: `m_slab_${mIdx}_1`, from_km: 0, to_km: 20, discount_percentage: 5 },
                  { id: `m_slab_${mIdx}_2`, from_km: 20, to_km: 50, discount_percentage: 10 },
                  { id: `m_slab_${mIdx}_3`, from_km: 50, to_km: 100, discount_percentage: 15 },
                  { id: `m_slab_${mIdx}_4`, from_km: 100, to_km: null, discount_percentage: 20 },
                ]),
          }));

          merged[k] = {
            ...(DEFAULT_PRICING[k] || {}),
            ...loaded[k],
            models,
            discount_slabs: loaded[k]?.discount_slabs && Array.isArray(loaded[k].discount_slabs)
              ? loaded[k].discount_slabs
              : (DEFAULT_PRICING[k]?.discount_slabs || []),
          };
        }
        setPricing(merged);
      }
    } catch (err) {
      console.error("Load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (vehicleKey: string, field: keyof VehiclePricing, val: any) => {
    setPricing((prev) => ({
      ...prev,
      [vehicleKey]: {
        ...(prev[vehicleKey] || DEFAULT_PRICING[vehicleKey]),
        [field]: typeof val === "number" || typeof val === "string" ? (Number(val) >= 0 ? Number(val) : val) : val,
      },
    }));
  };

  const handleAddCategory = () => {
    if (!newCatName.trim()) {
      toast({ title: "Name required", description: "Please enter category name.", variant: "destructive" });
      return;
    }
    const cleanKey = (newCatKey.trim() || newCatName.toLowerCase().replace(/[^a-z0-9]/g, "_")).slice(0, 20);

    if (pricing[cleanKey]) {
      toast({ title: "Category Exists", description: "A category with this key already exists.", variant: "destructive" });
      return;
    }

    const newCategory: VehiclePricing = {
      label: newCatName.trim(),
      icon: newCatIcon || "🚙",
      badge_color: "bg-indigo-500/10 text-indigo-600 border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-300",
      accent_color: "border-l-indigo-500",
      is_ride_now: false,
      base_price: Number(newCatBasePrice) || 800,
      per_km_rate: Number(newCatKmRate) || 180,
      coverage_km: Number(newCatCoverageKm) || 3,
      discount_percentage: 15,
      discount_slabs: [
        { id: `slab_${Date.now()}_1`, from_km: 0, to_km: 20, discount_percentage: 5 },
        { id: `slab_${Date.now()}_2`, from_km: 20, to_km: 50, discount_percentage: 10 },
        { id: `slab_${Date.now()}_3`, from_km: 50, to_km: 100, discount_percentage: 15 },
        { id: `slab_${Date.now()}_4`, from_km: 100, to_km: null, discount_percentage: 20 },
      ],
      models: [
        {
          id: `model_${cleanKey}_1`,
          name: `Standard ${newCatName.trim()}`,
          description: "Comfort A/C, Standard Seats",
          base_price: Number(newCatBasePrice) || 800,
          per_km_rate: Number(newCatKmRate) || 180,
          coverage_km: Number(newCatCoverageKm) || 3,
          discount_percentage: 15,
          discount_slabs: [
            { id: `m_slab_${Date.now()}_1`, from_km: 0, to_km: 20, discount_percentage: 5 },
            { id: `m_slab_${Date.now()}_2`, from_km: 20, to_km: 50, discount_percentage: 10 },
            { id: `m_slab_${Date.now()}_3`, from_km: 50, to_km: 100, discount_percentage: 15 },
            { id: `m_slab_${Date.now()}_4`, from_km: 100, to_km: null, discount_percentage: 20 },
          ],
        },
      ],
    };

    setPricing((prev) => ({
      ...prev,
      [cleanKey]: newCategory,
    }));

    setShowAddCategoryModal(false);
    setNewCatName("");
    setNewCatKey("");

    toast({
      title: "Vehicle Category Added",
      description: `Added "${newCatName}". Save pricing to apply to WhatsApp bot.`,
    });
  };

  const handleRemoveCategory = (key: string) => {
    // Only allow removing custom categories (not core car, van, lorry, bus, motorbike, three_wheeler)
    if (["motorbike", "three_wheeler", "car", "van", "lorry", "bus"].includes(key)) {
      toast({
        title: "Protected Category",
        description: "Core vehicle categories cannot be deleted, but you can change their rates and models.",
        variant: "destructive",
      });
      return;
    }
    setPricing((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    toast({ title: "Category Removed", description: `Removed category "${key}".` });
  };

  const handleAddModel = (categoryKey: string) => {
    const categoryDefaults = pricing[categoryKey] || DEFAULT_PRICING[categoryKey] || {
      base_price: 600,
      per_km_rate: 150,
      coverage_km: 3,
      discount_percentage: 15,
    };

    const newId = `model_${categoryKey}_${Date.now()}`;
    const newModel: VehicleModel = {
      id: newId,
      name: `New Variation`,
      description: "A/C, Standard Seats",
      base_price: categoryDefaults.base_price,
      per_km_rate: categoryDefaults.per_km_rate,
      coverage_km: categoryDefaults.coverage_km,
      discount_percentage: categoryDefaults.discount_percentage,
      discount_slabs: categoryDefaults.discount_slabs
        ? JSON.parse(JSON.stringify(categoryDefaults.discount_slabs))
        : [
            { id: `slab_${Date.now()}_1`, from_km: 0, to_km: 20, discount_percentage: 5 },
            { id: `slab_${Date.now()}_2`, from_km: 20, to_km: 50, discount_percentage: 10 },
            { id: `slab_${Date.now()}_3`, from_km: 50, to_km: 100, discount_percentage: 15 },
            { id: `slab_${Date.now()}_4`, from_km: 100, to_km: null, discount_percentage: 20 },
          ],
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
      description: `Added model to ${categoryKey.toUpperCase()}. Click Save to persist.`,
    });
  };

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

  const handleModelFieldChange = (
    categoryKey: string,
    modelId: string,
    field: keyof VehicleModel,
    val: any
  ) => {
    setPricing((prev) => {
      const currentModels = prev[categoryKey]?.models || [];
      const updatedModels = currentModels.map((m) => {
        if (m.id !== modelId) return m;
        if (field === "name" || field === "description") {
          return { ...m, [field]: val };
        }
        if (field === "discount_slabs") {
          return { ...m, discount_slabs: val };
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
        title: "Pricing & Slabs Saved Successfully",
        description: "Dynamic categories, sub-models, and progressive distance slabs are now live on WhatsApp.",
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

  // Filter categories for Ride Now vs Ride Later
  const rideNowKeys = Object.keys(pricing).filter(
    (k) => k === "motorbike" || k === "three_wheeler" || Boolean(pricing[k]?.is_ride_now)
  );

  const scheduleKeys = Object.keys(pricing).filter(
    (k) => k !== "motorbike" && k !== "three_wheeler" && !pricing[k]?.is_ride_now
  );

  const rideLaterTotalModels = scheduleKeys.reduce(
    (acc, k) => acc + (pricing[k]?.models?.length || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Vehicle Pricing, Variations & Distance Slabs</h2>
          <p className="text-sm text-muted-foreground">
            Configure dynamic vehicle categories (Sedan, SUV, etc.) and progressive slab-by-slab distance discounts.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2 shadow-sm font-semibold">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Pricing Settings
        </Button>
      </div>

      {/* Tabs: Ride Now vs Ride Later */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid grid-cols-2 h-auto p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 gap-2 shadow-inner max-w-xl">
          <TabsTrigger
            value="ride_now"
            className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 border cursor-pointer ${
              activeTab === "ride_now"
                ? "!bg-gradient-to-r !from-amber-400 !via-amber-500 !to-yellow-500 !text-slate-950 !border-amber-400 !shadow-lg shadow-amber-500/30 ring-2 ring-amber-400/60 scale-[1.01]"
                : "bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-amber-500/15 hover:text-amber-900"
            }`}
          >
            <Zap className="h-4 w-4" />
            <span>⚡ Ride Now ({rideNowKeys.length})</span>
          </TabsTrigger>

          <TabsTrigger
            value="ride_later"
            className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 border cursor-pointer ${
              activeTab === "ride_later"
                ? "!bg-gradient-to-r !from-blue-600 !via-indigo-600 !to-blue-700 !text-white !border-blue-400 !shadow-lg shadow-blue-500/30 ring-2 ring-blue-400/60 scale-[1.01]"
                : "bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-blue-500/15 hover:text-blue-900"
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>📅 Ride Later ({scheduleKeys.length} Categories, {rideLaterTotalModels} Models)</span>
          </TabsTrigger>
        </TabsList>

        {/* ========================================================================= */}
        {/* SUB-TAB 1: RIDE NOW */}
        {/* ========================================================================= */}
        <TabsContent value="ride_now" className="space-y-4 pt-4">
          <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50/70 dark:bg-amber-950/20 text-xs text-amber-950 dark:text-amber-200 flex items-start gap-2 shadow-2xs">
            <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Ride Now Rules:</span> Local short trips exclusively offer quick-dispatch vehicles (Motorbike 🏍️ and Three-wheeler 🛺). Base Price covers the first Base Coverage KM, after which distance is calculated across defined progressive slabs.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {rideNowKeys.map((key) => {
              const item = pricing[key] || DEFAULT_PRICING[key] || {
                base_price: 300,
                per_km_rate: 100,
                coverage_km: 2,
                discount_percentage: 10,
              };

              const label = item.label || (key === "motorbike" ? "Motorbike" : "Three-wheeler (Tuk-Tuk)");
              const icon = item.icon || (key === "motorbike" ? "🏍️" : "🛺");

              return (
                <Card key={key} className="border-2 border-amber-200/80 dark:border-amber-900/60 shadow-sm hover:border-amber-400 transition-all">
                  <CardHeader className="pb-3 bg-amber-50/40 dark:bg-amber-950/10 border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{icon}</span>
                        <div>
                          <CardTitle className="text-base font-bold">{label}</CardTitle>
                          <CardDescription className="text-xs">Immediate Ride Option</CardDescription>
                        </div>
                      </div>
                      <Badge className="bg-amber-500 text-slate-950 font-bold border-amber-600">Ride Now</Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                        />
                      </div>

                      <div>
                        <Label className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground mb-1">
                          <Navigation className="h-3.5 w-3.5 text-amber-600" />
                          Base KM Rate (LKR)
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          step="5"
                          value={item.per_km_rate}
                          onChange={(e) => handleFieldChange(key, "per_km_rate", e.target.value)}
                          className="font-semibold text-sm"
                        />
                      </div>

                      <div>
                        <Label className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground mb-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-amber-600" />
                          Base Coverage (KM)
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          value={item.coverage_km}
                          onChange={(e) => handleFieldChange(key, "coverage_km", e.target.value)}
                          className="font-semibold text-sm"
                        />
                      </div>
                    </div>

                    {/* Distance Slabs Editor */}
                    <SlabEditor
                      slabs={item.discount_slabs || []}
                      baseRate={item.per_km_rate}
                      onChange={(newSlabs) => handleFieldChange(key, "discount_slabs", newSlabs)}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* SUB-TAB 2: RIDE LATER / SCHEDULE */}
        {/* ========================================================================= */}
        <TabsContent value="ride_later" className="space-y-6 pt-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-3.5 rounded-xl border border-blue-300 bg-blue-50/70 dark:bg-blue-950/20 text-xs text-blue-950 dark:text-blue-200 shadow-2xs">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Dynamic Vehicle Categories & Variations:</span> The WhatsApp bot prompts customers with all active categories below. When a category is tapped (e.g. <strong>Car</strong>), the bot presents its variations (<strong>Sedan</strong>, <strong>SUV</strong>, etc.). Fares are dynamically calculated using each variation&apos;s progressive distance slabs!
              </div>
            </div>

            <Button
              type="button"
              onClick={() => setShowAddCategoryModal(true)}
              size="sm"
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold shrink-0 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Add New Category
            </Button>
          </div>

          <div className="space-y-6">
            {scheduleKeys.map((key) => {
              const categoryConfig = pricing[key] || DEFAULT_PRICING[key] || {
                label: key,
                base_price: 600,
                per_km_rate: 150,
                coverage_km: 3,
                discount_percentage: 15,
                models: [],
              };

              const label = categoryConfig.label || key;
              const icon = categoryConfig.icon || "🚗";
              const accentColor = categoryConfig.accent_color || "border-l-blue-500";
              const models = categoryConfig.models || [];
              const isCustomCategory = !["car", "van", "lorry", "bus"].includes(key);

              return (
                <Card key={key} className={`border-l-4 ${accentColor} border shadow-sm`}>
                  <CardHeader className="pb-3 border-b bg-muted/20">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{icon}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base sm:text-lg font-bold">{label}</CardTitle>
                            <Badge variant="outline" className="text-xs font-bold px-2 py-0.5">
                              {models.length} Variation{models.length === 1 ? "" : "s"}
                            </Badge>
                            {isCustomCategory && (
                              <Badge className="bg-purple-100 text-purple-800 border-purple-300 text-[10px]">
                                Custom Category
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="text-xs mt-0.5 font-mono">
                            Category Code: <code>{key}</code> | Default Base: LKR {categoryConfig.base_price} | KM: LKR {categoryConfig.per_km_rate}
                          </CardDescription>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isCustomCategory && (
                          <Button
                            onClick={() => handleRemoveCategory(key)}
                            size="sm"
                            variant="ghost"
                            className="text-xs text-destructive hover:bg-destructive/10"
                            title="Delete category"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Delete
                          </Button>
                        )}
                        <Button
                          onClick={() => handleAddModel(key)}
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs font-bold border-primary/40 hover:bg-primary/10 text-primary"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Variation to {label}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-4">
                    {/* Category Level Default Parameters */}
                    <div className="p-3 bg-muted/10 rounded-xl border space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">
                          Category Fallback Rates & Slabs:
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          (Used if no specific variation is matched)
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <Label className="text-[11px] font-medium text-muted-foreground">Base Price (LKR)</Label>
                          <Input
                            type="number"
                            min="0"
                            value={categoryConfig.base_price}
                            onChange={(e) => handleFieldChange(key, "base_price", e.target.value)}
                            className="h-8 text-xs font-semibold"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] font-medium text-muted-foreground">Per KM Rate (LKR)</Label>
                          <Input
                            type="number"
                            min="0"
                            value={categoryConfig.per_km_rate}
                            onChange={(e) => handleFieldChange(key, "per_km_rate", e.target.value)}
                            className="h-8 text-xs font-semibold"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] font-medium text-muted-foreground">Base Coverage (KM)</Label>
                          <Input
                            type="number"
                            min="0"
                            value={categoryConfig.coverage_km}
                            onChange={(e) => handleFieldChange(key, "coverage_km", e.target.value)}
                            className="h-8 text-xs font-semibold"
                          />
                        </div>
                      </div>

                      <SlabEditor
                        slabs={categoryConfig.discount_slabs || []}
                        baseRate={categoryConfig.per_km_rate}
                        onChange={(newSlabs) => handleFieldChange(key, "discount_slabs", newSlabs)}
                      />
                    </div>

                    {/* Variations / Models List */}
                    <div className="pt-2 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Configured Variations ({models.length})
                        </h4>
                      </div>

                      {models.length === 0 ? (
                        <div className="text-center py-6 border border-dashed rounded-xl bg-muted/20 space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            No specific variations added yet for {label}.
                          </p>
                          <Button
                            onClick={() => handleAddModel(key)}
                            size="sm"
                            variant="secondary"
                            className="gap-1 text-xs"
                          >
                            <Plus className="h-3 w-3" />
                            Add First Variation (e.g. Sedan, SUV)
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
                                  Variation #{idx + 1}: {model.name}
                                </span>
                                <Button
                                  onClick={() => handleRemoveModel(key, model.id)}
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                  title="Remove variation"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>

                              {/* Variation Name & Description */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <div>
                                  <Label className="text-[11px] font-semibold text-foreground block mb-1">
                                    Variation Name (e.g. Sedan, SUV)
                                  </Label>
                                  <Input
                                    value={model.name}
                                    onChange={(e) =>
                                      handleModelFieldChange(key, model.id, "name", e.target.value)
                                    }
                                    placeholder="e.g. Sedan / SUV / Hatchback"
                                    className="h-8 text-xs font-semibold"
                                  />
                                </div>

                                <div>
                                  <Label className="text-[11px] font-semibold text-foreground block mb-1">
                                    Description (Shown on WhatsApp Poll)
                                  </Label>
                                  <Input
                                    value={model.description}
                                    onChange={(e) =>
                                      handleModelFieldChange(key, model.id, "description", e.target.value)
                                    }
                                    placeholder="e.g. 4 Pax, Luxury A/C"
                                    className="h-8 text-xs"
                                  />
                                </div>
                              </div>

                              {/* Pricing Inputs */}
                              <div className="grid grid-cols-3 gap-2 pt-1">
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
                                    className="h-8 text-xs font-semibold"
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
                                    className="h-8 text-xs font-semibold"
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
                                    className="h-8 text-xs font-semibold"
                                  />
                                </div>
                              </div>

                              {/* Variation Slabs Editor */}
                              <SlabEditor
                                slabs={model.discount_slabs || categoryConfig.discount_slabs || []}
                                baseRate={model.per_km_rate}
                                onChange={(newSlabs) =>
                                  handleModelFieldChange(key, model.id, "discount_slabs", newSlabs)
                                }
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Save Button Footer */}
      <div className="flex justify-end pt-4 border-t">
        <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2 shadow-md font-bold">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Pricing Settings
        </Button>
      </div>

      {/* Add New Category Modal */}
      <Dialog open={showAddCategoryModal} onOpenChange={setShowAddCategoryModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Add New Vehicle Category
            </DialogTitle>
            <DialogDescription className="text-xs">
              Add a new top-level vehicle category (e.g. SUV, Luxury, Electric EV) for Ride Later bookings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs font-semibold">Category Name</Label>
              <Input
                value={newCatName}
                onChange={(e) => {
                  setNewCatName(e.target.value);
                  if (!newCatKey) {
                    setNewCatKey(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 15));
                  }
                }}
                placeholder="e.g. SUV & 4WD"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">Category Code / Key</Label>
                <Input
                  value={newCatKey}
                  onChange={(e) => setNewCatKey(e.target.value)}
                  placeholder="e.g. suv"
                  className="mt-1 font-mono text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Emoji Icon</Label>
                <Input
                  value={newCatIcon}
                  onChange={(e) => setNewCatIcon(e.target.value)}
                  placeholder="🚙"
                  className="mt-1 text-center text-base"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <div>
                <Label className="text-[11px] font-medium text-muted-foreground">Base Price</Label>
                <Input
                  type="number"
                  value={newCatBasePrice}
                  onChange={(e) => setNewCatBasePrice(e.target.value)}
                  className="mt-1 text-xs font-semibold"
                />
              </div>

              <div>
                <Label className="text-[11px] font-medium text-muted-foreground">Per KM</Label>
                <Input
                  type="number"
                  value={newCatKmRate}
                  onChange={(e) => setNewCatKmRate(e.target.value)}
                  className="mt-1 text-xs font-semibold"
                />
              </div>

              <div>
                <Label className="text-[11px] font-medium text-muted-foreground">Coverage KM</Label>
                <Input
                  type="number"
                  value={newCatCoverageKm}
                  onChange={(e) => setNewCatCoverageKm(e.target.value)}
                  className="mt-1 text-xs font-semibold"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setShowAddCategoryModal(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAddCategory} className="font-bold">
              Add Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
