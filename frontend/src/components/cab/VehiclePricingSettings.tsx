import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Car, Bike, Truck, Bus, CheckCircle2, Percent, DollarSign, Navigation } from "lucide-react";

export interface VehiclePricing {
  base_price: number;
  per_km_rate: number;
  coverage_km: number;
  discount_percentage: number;
}

export type PricingConfigMap = Record<string, VehiclePricing>;

const VEHICLES = [
  { key: "motorbike", label: "Motorbike", icon: Bike, badgeColor: "bg-blue-500/10 text-blue-500 border-blue-200" },
  { key: "three_wheeler", label: "Three-wheeler (Tuk-Tuk)", icon: Car, badgeColor: "bg-amber-500/10 text-amber-500 border-amber-200" },
  { key: "car", label: "Car (Sedan / Hatchback)", icon: Car, badgeColor: "bg-emerald-500/10 text-emerald-500 border-emerald-200" },
  { key: "van", label: "Van", icon: Truck, badgeColor: "bg-purple-500/10 text-purple-500 border-purple-200" },
  { key: "lorry", label: "Lorry / Truck", icon: Truck, badgeColor: "bg-orange-500/10 text-orange-500 border-orange-200" },
  { key: "bus", label: "Bus", icon: Bus, badgeColor: "bg-red-500/10 text-red-500 border-red-200" },
];

const DEFAULT_PRICING: PricingConfigMap = {
  motorbike: { base_price: 200, per_km_rate: 80, coverage_km: 2, discount_percentage: 10 },
  three_wheeler: { base_price: 300, per_km_rate: 100, coverage_km: 2, discount_percentage: 10 },
  car: { base_price: 600, per_km_rate: 150, coverage_km: 3, discount_percentage: 15 },
  van: { base_price: 900, per_km_rate: 200, coverage_km: 3, discount_percentage: 15 },
  lorry: { base_price: 1500, per_km_rate: 300, coverage_km: 5, discount_percentage: 10 },
  bus: { base_price: 3000, per_km_rate: 500, coverage_km: 10, discount_percentage: 10 },
};

export default function VehiclePricingSettings() {
  const [pricing, setPricing] = useState<PricingConfigMap>(DEFAULT_PRICING);
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
        setPricing({ ...DEFAULT_PRICING, ...data.value });
      }
    } catch (err) {
      console.error("Load error:", err);
    } finally {
      setLoading(false);
    }
  };

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
        description: "Dynamic pricing formula is now active for all incoming bookings.",
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Vehicle Pricing Engine</h2>
          <p className="text-sm text-muted-foreground">
            Configure the 4 core pricing parameters for each vehicle category.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Pricing Settings
        </Button>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {VEHICLES.map(({ key, label, icon: Icon, badgeColor }) => {
          const item = pricing[key] || DEFAULT_PRICING[key];

          return (
            <Card key={key} className="border shadow-sm hover:border-primary/40 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg border ${badgeColor}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">{label}</CardTitle>
                      <CardDescription className="text-xs">Category: {key}</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3.5 pt-1">
                {/* 1. Base Price */}
                <div>
                  <Label className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground mb-1">
                    <DollarSign className="h-3.5 w-3.5 text-primary" />
                    Base Price (LKR)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="10"
                    value={item.base_price}
                    onChange={(e) => handleFieldChange(key, "base_price", e.target.value)}
                    className="font-medium"
                    placeholder="e.g. 500"
                  />
                </div>

                {/* 2. Per KM Rate */}
                <div>
                  <Label className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground mb-1">
                    <Navigation className="h-3.5 w-3.5 text-primary" />
                    Per Kilometer Rate (LKR)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="5"
                    value={item.per_km_rate}
                    onChange={(e) => handleFieldChange(key, "per_km_rate", e.target.value)}
                    className="font-medium"
                    placeholder="e.g. 120"
                  />
                </div>

                {/* 3. Base Price Coverage KM */}
                <div>
                  <Label className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground mb-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    Base Price Coverage (KM)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={item.coverage_km}
                    onChange={(e) => handleFieldChange(key, "coverage_km", e.target.value)}
                    className="font-medium"
                    placeholder="e.g. 2"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    Distance covered within Base Price
                  </span>
                </div>

                {/* 4. Round Trip Discount Percentage */}
                <div>
                  <Label className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground mb-1">
                    <Percent className="h-3.5 w-3.5 text-primary" />
                    Round Trip Discount (%)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={item.discount_percentage}
                    onChange={(e) => handleFieldChange(key, "discount_percentage", e.target.value)}
                    className="font-medium"
                    placeholder="e.g. 15"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    Applied only for Round Trips
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Pricing Settings
        </Button>
      </div>
    </div>
  );
}
