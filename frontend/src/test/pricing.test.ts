import { describe, it, expect } from "vitest";

interface DistanceDiscountSlab {
  from_km: number;
  to_km?: number | null;
  discount_percentage: number;
}

interface VehiclePricingConfig {
  base_price: number;
  per_km_rate: number;
  coverage_km: number;
  discount_percentage: number;
  discount_slabs?: DistanceDiscountSlab[];
}

function calculateProgressiveFare(
  distanceKm: number,
  config: VehiclePricingConfig,
  isRoundTrip: boolean = false
) {
  const effectiveDistance = isRoundTrip ? distanceKm * 2 : distanceKm;
  const coverageKm = config.coverage_km || 0;
  const basePrice = config.base_price || 0;
  const perKmRate = config.per_km_rate || 0;
  const chargeableKm = Math.max(0, effectiveDistance - coverageKm);
  const grossFare = basePrice + chargeableKm * perKmRate;

  const slabs = config.discount_slabs || [];
  if (slabs.length > 0 && chargeableKm > 0) {
    const sortedSlabs = [...slabs].sort((a, b) => (Number(a.from_km) || 0) - (Number(b.from_km) || 0));
    let totalSlabKmCharge = 0;
    let coveredKm = 0;

    for (const slab of sortedSlabs) {
      const slabStart = Math.max(0, Number(slab.from_km) || 0);
      const slabEnd = slab.to_km != null && Number(slab.to_km) > slabStart ? Number(slab.to_km) : Infinity;

      const effectiveStart = Math.max(slabStart, coverageKm);
      const effectiveEnd = Math.min(slabEnd, effectiveDistance);

      if (effectiveEnd > effectiveStart) {
        const kmInSlab = effectiveEnd - effectiveStart;
        const discountPct = Math.max(0, Math.min(100, Number(slab.discount_percentage) || 0));
        const effectiveRate = perKmRate * (1 - discountPct / 100);
        totalSlabKmCharge += kmInSlab * effectiveRate;
        coveredKm += kmInSlab;
      }
    }

    const remainingKm = Math.max(0, chargeableKm - coveredKm);
    if (remainingKm > 0) {
      totalSlabKmCharge += remainingKm * perKmRate;
    }

    const totalFare = basePrice + totalSlabKmCharge;
    return {
      grossFare: Math.round(grossFare),
      discountAmount: Math.round(grossFare - totalFare),
      totalFare: Math.round(totalFare),
    };
  }

  // Legacy fallback
  let discountAmount = 0;
  if (isRoundTrip && config.discount_percentage > 0) {
    discountAmount = (grossFare * config.discount_percentage) / 100;
  }
  return {
    grossFare: Math.round(grossFare),
    discountAmount: Math.round(discountAmount),
    totalFare: Math.round(grossFare - discountAmount),
  };
}

describe("Pricing Engine - Progressive Distance Slabs & Fallbacks", () => {
  const config: VehiclePricingConfig = {
    base_price: 1000,
    per_km_rate: 100,
    coverage_km: 10,
    discount_percentage: 10,
    discount_slabs: [
      { from_km: 0, to_km: 20, discount_percentage: 5 },
      { from_km: 20, to_km: 50, discount_percentage: 10 },
      { from_km: 50, to_km: 100, discount_percentage: 15 },
    ],
  };

  it("calculates progressive slabs accurately for 100 km trip", () => {
    // 0-10 km: base price = 1000
    // 10-20 km (10 km) @ 5% off (95) = 950
    // 20-50 km (30 km) @ 10% off (90) = 2700
    // 50-100 km (50 km) @ 15% off (85) = 4250
    // Total = 1000 + 950 + 2700 + 4250 = 8900
    // Gross = 1000 + (90 * 100) = 10000
    // Discount = 1100
    const result = calculateProgressiveFare(100, config, false);
    expect(result.totalFare).toBe(8900);
    expect(result.discountAmount).toBe(1100);
    expect(result.grossFare).toBe(10000);
  });

  it("correctly handles round-trip distance expansion", () => {
    // 50 km round-trip = 100 km total distance
    const result = calculateProgressiveFare(50, config, true);
    expect(result.totalFare).toBe(8900);
    expect(result.discountAmount).toBe(1100);
  });

  it("falls back to standard rate for distances exceeding defined slabs", () => {
    // 150 km trip:
    // First 100 km = 8900
    // Next 50 km (100-150 km) has no slab defined -> billed at full per_km_rate (100) = 5000
    // Total = 8900 + 5000 = 13900
    // Gross = 1000 + (140 * 100) = 15000
    // Discount = 1100
    const result = calculateProgressiveFare(150, config, false);
    expect(result.totalFare).toBe(13900);
    expect(result.discountAmount).toBe(1100);
    expect(result.grossFare).toBe(15000);
  });

  it("preserves 100% backward compatibility when no slabs exist", () => {
    const legacyConfig: VehiclePricingConfig = {
      base_price: 300,
      per_km_rate: 100,
      coverage_km: 2,
      discount_percentage: 10,
    };
    // 100 km round trip = 200 km
    // chargeable = 198 km
    // gross = 300 + 19800 = 20100
    // discount = 10% of 20100 = 2010
    // total = 18090
    const result = calculateProgressiveFare(100, legacyConfig, true);
    expect(result.totalFare).toBe(18090);
    expect(result.discountAmount).toBe(2010);
    expect(result.grossFare).toBe(20100);
  });
});
