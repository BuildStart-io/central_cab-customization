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

describe("Pricing Engine - Comprehensive All Vehicles & Variations Verification", () => {
  // 1. Motorbike
  const motorbikeConfig: VehiclePricingConfig = {
    base_price: 100,
    per_km_rate: 65,
    coverage_km: 1,
    discount_percentage: 5,
    discount_slabs: [
      { from_km: 10, to_km: 30, discount_percentage: 5 },
      { from_km: 30, to_km: 55, discount_percentage: 10 },
    ],
  };

  it("calculates Motorbike fare for 10 km trip", () => {
    // 1 km covered by base price 100. 9 km @ 65 = 585 -> total = 685
    const res = calculateProgressiveFare(10, motorbikeConfig, false);
    expect(res.totalFare).toBe(685);
    expect(res.grossFare).toBe(685);
    expect(res.discountAmount).toBe(0);
  });

  // 2. Three-wheeler (Tuk-Tuk)
  const tukTukConfig: VehiclePricingConfig = {
    base_price: 130,
    per_km_rate: 70,
    coverage_km: 1,
    discount_percentage: 5,
    discount_slabs: [
      { from_km: 0, to_km: 15, discount_percentage: 0 },
      { from_km: 15, to_km: 35, discount_percentage: 5 },
      { from_km: 35, to_km: null, discount_percentage: 10 },
    ],
  };

  it("calculates Three-wheeler fare for 20 km trip", () => {
    // 1 km base -> 19 km chargeable:
    // 1-15 km (14 km) @ 70 = 980
    // 15-20 km (5 km) @ 66.5 = 332.5
    // Total = 130 + 980 + 332.5 = 1442.5 -> round 1443 or 1442.5
    const res = calculateProgressiveFare(20, tukTukConfig, false);
    expect(res.totalFare).toBe(1443);
    expect(res.grossFare).toBe(1460);
    expect(res.discountAmount).toBe(18); // 1460 - 1442.5 = 17.5 -> 18
  });

  // 3. Car - Sedan
  const sedanConfig: VehiclePricingConfig = {
    base_price: 700,
    coverage_km: 3,
    per_km_rate: 160,
    discount_percentage: 15,
    discount_slabs: [
      { from_km: 0, to_km: 20, discount_percentage: 5 },
      { from_km: 20, to_km: 50, discount_percentage: 10 },
      { from_km: 50, to_km: 100, discount_percentage: 15 },
      { from_km: 100, to_km: null, discount_percentage: 20 },
    ],
  };

  it("calculates Car Sedan fare for 216 km (Batticaloa to Maho)", () => {
    // Base 700 covers 3 km -> 213 km chargeable:
    // 3-20 km (17 km) @ 152 = 2584
    // 20-50 km (30 km) @ 144 = 4320
    // 50-100 km (50 km) @ 136 = 6800
    // 100-216 km (116 km) @ 128 = 14848
    // Total = 700 + 2584 + 4320 + 6800 + 14848 = 29252
    // Gross = 700 + (213 * 160) = 34780
    // Discount = 5528
    const res = calculateProgressiveFare(216, sedanConfig, false);
    expect(res.totalFare).toBe(29252);
    expect(res.grossFare).toBe(34780);
    expect(res.discountAmount).toBe(5528);
  });

  // 4. Car - Hatchback
  const hatchbackConfig: VehiclePricingConfig = {
    base_price: 500,
    coverage_km: 2,
    per_km_rate: 125,
    discount_percentage: 10,
    discount_slabs: [
      { from_km: 0, to_km: 20, discount_percentage: 5 },
      { from_km: 20, to_km: 50, discount_percentage: 10 },
      { from_km: 50, to_km: 100, discount_percentage: 15 },
      { from_km: 100, to_km: null, discount_percentage: 20 },
    ],
  };

  it("calculates Car Hatchback fare for 216 km", () => {
    // Base 500 covers 2 km -> 214 km chargeable:
    // 2-20 km (18 km) @ 118.75 = 2137.5
    // 20-50 km (30 km) @ 112.5 = 3375
    // 50-100 km (50 km) @ 106.25 = 5312.5
    // 100-216 km (116 km) @ 100 = 11600
    // Total = 500 + 2137.5 + 3375 + 5312.5 + 11600 = 22925
    // Gross = 500 + 214 * 125 = 27250
    // Discount = 4325
    const res = calculateProgressiveFare(216, hatchbackConfig, false);
    expect(res.totalFare).toBe(22925);
    expect(res.grossFare).toBe(27250);
    expect(res.discountAmount).toBe(4325);
  });

  // 5. Car - SUV
  const suvConfig: VehiclePricingConfig = {
    base_price: 850,
    coverage_km: 3,
    per_km_rate: 185,
    discount_percentage: 15,
    discount_slabs: [
      { from_km: 0, to_km: 20, discount_percentage: 5 },
      { from_km: 20, to_km: 50, discount_percentage: 10 },
      { from_km: 50, to_km: 100, discount_percentage: 15 },
      { from_km: 100, to_km: null, discount_percentage: 20 },
    ],
  };

  it("calculates Car SUV fare for 216 km", () => {
    // Base 850 covers 3 km -> 213 km chargeable:
    // 3-20 km (17 km) @ 175.75 = 2987.75
    // 20-50 km (30 km) @ 166.5 = 4995
    // 50-100 km (50 km) @ 157.25 = 7862.5
    // 100-216 km (116 km) @ 148 = 17168
    // Total = 850 + 2987.75 + 4995 + 7862.5 + 17168 = 33863.25 -> 33863
    // Gross = 850 + (213 * 185) = 40255
    const res = calculateProgressiveFare(216, suvConfig, false);
    expect(res.totalFare).toBe(33863);
    expect(res.grossFare).toBe(40255);
  });

  // 6. Van - KDH Flat Roof
  const vanFlatConfig: VehiclePricingConfig = {
    base_price: 900,
    coverage_km: 3,
    per_km_rate: 190,
    discount_percentage: 25,
    discount_slabs: [
      { from_km: 0, to_km: 30, discount_percentage: 5 },
      { from_km: 30, to_km: 80, discount_percentage: 10 },
      { from_km: 80, to_km: null, discount_percentage: 15 },
    ],
  };

  it("calculates Van Flat Roof fare for 100 km", () => {
    // Base 900 covers 3 km -> 97 km chargeable:
    // 3-30 km (27 km) @ 180.5 = 4873.5
    // 30-80 km (50 km) @ 171 = 8550
    // 80-100 km (20 km) @ 161.5 = 3230
    // Total = 900 + 4873.5 + 8550 + 3230 = 17553.5 -> 17554
    const res = calculateProgressiveFare(100, vanFlatConfig, false);
    expect(res.totalFare).toBe(17554);
    expect(res.grossFare).toBe(19330);
  });

  // 7. Lorry - Dimo Batta
  const lorryConfig: VehiclePricingConfig = {
    base_price: 1200,
    coverage_km: 3,
    per_km_rate: 220,
    discount_percentage: 25,
    discount_slabs: [
      { from_km: 0, to_km: 40, discount_percentage: 0 },
      { from_km: 40, to_km: 100, discount_percentage: 8 },
      { from_km: 100, to_km: null, discount_percentage: 12 },
    ],
  };

  it("calculates Lorry Dimo Batta fare for 150 km", () => {
    // Base 1200 covers 3 km -> 147 km chargeable:
    // 3-40 km (37 km) @ 220 = 8140
    // 40-100 km (60 km) @ 202.4 = 12144
    // 100-150 km (50 km) @ 193.6 = 9680
    // Total = 1200 + 8140 + 12144 + 9680 = 31164
    const res = calculateProgressiveFare(150, lorryConfig, false);
    expect(res.totalFare).toBe(31164);
    expect(res.grossFare).toBe(33540);
    expect(res.discountAmount).toBe(2376);
  });

  // 8. Bus - Rosa Mini Bus (User's booking scenario)
  const busConfig: VehiclePricingConfig = {
    base_price: 3000,
    coverage_km: 10,
    per_km_rate: 200,
    discount_percentage: 25,
    discount_slabs: [
      { from_km: 0, to_km: 50, discount_percentage: 0 },
      { from_km: 50, to_km: 120, discount_percentage: 10 },
      { from_km: 120, to_km: null, discount_percentage: 15 },
    ],
  };

  it("calculates Bus Rosa Mini Bus fare for 216 km (Batticaloa to Maho Junction)", () => {
    // Base 3000 covers 10 km -> 206 km chargeable:
    // 10-50 km (40 km) @ 200 = 8000
    // 50-120 km (70 km) @ 180 = 12600
    // 120-216 km (96 km) @ 170 = 16320
    // Total = 3000 + 8000 + 12600 + 16320 = 39920
    // Gross = 3000 + (206 * 200) = 44200
    // Discount = 4280
    const res = calculateProgressiveFare(216, busConfig, false);
    expect(res.totalFare).toBe(39920);
    expect(res.grossFare).toBe(44200);
    expect(res.discountAmount).toBe(4280);
  });
});
