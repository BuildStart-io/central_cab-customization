// ============================================================================
// Ceylon Central Cabs & Delivery - Dynamic Pricing Engine
// Secure Google Maps Distance Matrix API Integration & Fare Calculator
// ============================================================================

export interface VehiclePricingConfig {
  base_price: number;
  per_km_rate: number;
  coverage_km: number;
  discount_percentage: number;
}

export interface PricingSettings {
  motorbike: VehiclePricingConfig;
  three_wheeler: VehiclePricingConfig;
  car: VehiclePricingConfig;
  van: VehiclePricingConfig;
  lorry: VehiclePricingConfig;
  bus: VehiclePricingConfig;
  [key: string]: VehiclePricingConfig;
}

export interface LocationInput {
  text?: string;
  coords?: { lat: number; lng: number };
}

export interface FareCalculationResult {
  distanceKm: number;
  distanceText: string;
  basePrice: number;
  perKmRate: number;
  coverageKm: number;
  chargeableKm: number;
  grossFare: number;
  discountAmount: number;
  totalFare: number;
  tripType: string;
  vehicleKey: string;
}

/**
 * Normalized vehicle key lookup
 */
export function normalizeVehicleKey(vehicle: string): string {
  const v = (vehicle || "").toLowerCase().trim().replace(/[-_\s]/g, "");
  if (v.includes("bike") || v.includes("motor") || v === "1") return "motorbike";
  if (v.includes("three") || v.includes("tuk") || v.includes("wheeler") || v.includes("3") || v === "2") return "three_wheeler";
  if (v.includes("car") || v === "3") return "car";
  if (v.includes("van") || v === "4") return "van";
  if (v.includes("lorry") || v.includes("truck") || v === "5") return "lorry";
  if (v.includes("bus") || v === "6") return "bus";
  return "";
}

/**
 * Display name formatting for vehicles
 */
export function getVehicleDisplayName(vehicleKey: string): string {
  switch (vehicleKey) {
    case "motorbike": return "Motorbike 🏍️";
    case "three_wheeler": return "Three-wheeler 🛺";
    case "car": return "Car 🚗";
    case "van": return "Van 🚐";
    case "lorry": return "Lorry 🚚";
    case "bus": return "Bus 🚌";
    default: return vehicleKey;
  }
}

// Built-in coordinates for Sri Lanka major cities, towns and landmarks for instant offline resolution
const SRI_LANKA_TOWNS: Record<string, { lat: number; lng: number }> = {
  colombo: { lat: 6.9271, lng: 79.8612 },
  pettah: { lat: 6.9337, lng: 79.8501 },
  fort: { lat: 6.9337, lng: 79.8501 },
  moratuwa: { lat: 6.7972, lng: 79.9012 },
  katunayake: { lat: 7.1694, lng: 79.8894 },
  airport: { lat: 7.1804, lng: 79.8841 },
  dehiwala: { lat: 6.8511, lng: 79.8653 },
  "mount lavinia": { lat: 6.8384, lng: 79.8653 },
  panadura: { lat: 6.7132, lng: 79.9074 },
  nugegoda: { lat: 6.8649, lng: 79.8997 },
  maharagama: { lat: 6.8480, lng: 79.9265 },
  kaduwela: { lat: 6.9331, lng: 79.9839 },
  malabe: { lat: 6.9042, lng: 79.9546 },
  kotte: { lat: 6.8912, lng: 79.9002 },
  wattala: { lat: 6.9899, lng: 79.8914 },
  "ja-ela": { lat: 7.0744, lng: 79.8917 },
  urani: { lat: 7.7191, lng: 81.6731 },
  kallady: { lat: 7.7135, lng: 81.7051 },
  kattankudy: { lat: 7.6833, lng: 81.7167 },
  eravur: { lat: 7.7833, lng: 81.6000 },
  chenkalady: { lat: 7.8000, lng: 81.5833 },
  valachchenai: { lat: 7.9167, lng: 81.5333 },
  maruthamunai: { lat: 7.4580, lng: 81.8230 },
  sainthamaruthu: { lat: 7.3950, lng: 81.8380 },
  kalmunai: { lat: 7.4167, lng: 81.8167 },
  akkaraipattu: { lat: 7.2200, lng: 81.8500 },
  batticaloa: { lat: 7.7304, lng: 81.6804 },
  kandy: { lat: 7.2906, lng: 80.6337 },
  galle: { lat: 6.0535, lng: 80.2210 },
  jaffna: { lat: 9.6615, lng: 80.0255 },
  negombo: { lat: 7.2008, lng: 79.8736 },
  kurunegala: { lat: 7.4818, lng: 80.3609 },
  anuradhapura: { lat: 8.3114, lng: 80.4037 },
  trincomalee: { lat: 8.5874, lng: 81.2152 },
  badulla: { lat: 6.9934, lng: 81.0550 },
  matara: { lat: 5.9549, lng: 80.5550 },
  ratnapura: { lat: 6.6828, lng: 80.4037 },
  ampara: { lat: 7.2833, lng: 81.6667 },
  chenkalady: { lat: 7.8000, lng: 81.5833 },
  vavuniya: { lat: 8.7514, lng: 80.4971 },
  gampaha: { lat: 7.0840, lng: 79.9926 },
  kalutara: { lat: 6.5854, lng: 79.9607 },
  nuwaraeliya: { lat: 6.9497, lng: 80.7891 },
  matale: { lat: 7.4675, lng: 80.6234 },
  hambantota: { lat: 6.1246, lng: 81.1185 },
  polonnaruwa: { lat: 7.9403, lng: 81.0188 },
  monaragala: { lat: 6.8728, lng: 81.3507 },
  kegalle: { lat: 7.2513, lng: 80.3464 },
  kilinochchi: { lat: 9.3803, lng: 80.3770 },
  mannar: { lat: 8.9810, lng: 79.9044 },
  mullaitivu: { lat: 9.2671, lng: 80.8142 },
  dambulla: { lat: 7.8742, lng: 80.6511 },
  sigiriya: { lat: 7.9570, lng: 80.7603 },
  bandarawela: { lat: 6.8258, lng: 80.9982 },
  ella: { lat: 6.8667, lng: 81.0466 },
  tangalle: { lat: 6.0242, lng: 80.7941 },
  mirissa: { lat: 5.9483, lng: 80.4588 },
  weligama: { lat: 5.9722, lng: 80.4278 },
  hikkaduwa: { lat: 6.1395, lng: 80.1063 },
  bentota: { lat: 6.4259, lng: 79.9958 },
  beruwala: { lat: 6.4788, lng: 79.9828 },
  kuliyapitiya: { lat: 7.4689, lng: 80.0400 },
  chilaw: { lat: 7.5758, lng: 79.7953 },
  puttalam: { lat: 8.0362, lng: 79.8283 },
};

/**
 * Generate a direct, clickable Google Maps navigation link
 * When opened on a phone, WhatsApp renders a map preview and launches Google Maps navigation.
 */
export function buildGoogleMapsLink(
  locationText?: string,
  coords?: { lat: number; lng: number } | null
): string {
  if (coords?.lat && coords?.lng) {
    return `https://www.google.com/maps?q=${coords.lat},${coords.lng}`;
  }
  if (locationText && locationText.trim()) {
    const clean = locationText.trim();
    const query = clean.toLowerCase().includes("sri lanka") ? clean : `${clean}, Sri Lanka`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }
  return "";
}

function isValidLatLng(lat: number, lng: number): boolean {
  return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Extract GPS coordinates from text, raw coordinates, or any Google Maps URL format
 * Supports:
 * - Direct params: ?q=lat,lng / ?query=lat,lng / ll=lat,lng
 * - Path params: /@lat,lng,...
 * - Raw coordinate string: "6.7972, 79.9012"
 * - Short links: maps.app.goo.gl / goo.gl/maps via redirect resolution
 */
export async function extractCoordinatesFromTextOrUrl(text: string): Promise<{ lat: number; lng: number } | null> {
  if (!text) return null;
  const str = text.trim();

  // 1. Direct query parameters: ?q=lat,lng or ?query=lat,lng
  const qMatch = str.match(/[?&](?:q|query)=([+-]?\d+\.?\d*)[,%2C\s]+([+-]?\d+\.?\d*)/i);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // 2. Path coordinates: /@lat,lng,
  const atMatch = str.match(/@([+-]?\d+\.?\d*)[,%2C\s]+([+-]?\d+\.?\d*)/i);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // 3. Query param: ll=lat,lng, center=lat,lng, destination=lat,lng
  const llMatch = str.match(/[?&](?:ll|destination|origin|center)=([+-]?\d+\.?\d*)[,%2C\s]+([+-]?\d+\.?\d*)/i);
  if (llMatch) {
    const lat = parseFloat(llMatch[1]);
    const lng = parseFloat(llMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // 4. Raw coordinate string: e.g. "6.7972274, 79.9012242"
  const rawMatch = str.match(/([+-]?\d{1,2}\.\d+)[,\s]+([+-]?\d{1,3}\.\d+)/);
  if (rawMatch) {
    const lat = parseFloat(rawMatch[1]);
    const lng = parseFloat(rawMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // 5. Shortened Google Maps links: maps.app.goo.gl or goo.gl/maps
  if (str.includes("goo.gl") || str.includes("maps.app")) {
    try {
      const urlMatch = str.match(/https?:\/\/[^\s]+/i);
      if (urlMatch) {
        const res = await fetch(urlMatch[0], {
          redirect: "follow",
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
          signal: AbortSignal.timeout(5000),
        });
        const finalUrl = res.url || "";
        const finalMatch = finalUrl.match(/@([+-]?\d+\.?\d*)[,%2C\s]+([+-]?\d+\.?\d*)/i) ||
                           finalUrl.match(/[?&](?:q|query)=([+-]?\d+\.?\d*)[,%2C\s]+([+-]?\d+\.?\d*)/i);
        if (finalMatch) {
          const lat = parseFloat(finalMatch[1]);
          const lng = parseFloat(finalMatch[2]);
          if (isValidLatLng(lat, lng)) return { lat, lng };
        }
        const html = await res.text();
        const htmlMatch = html.match(/@([+-]?\d+\.?\d*)[,%2C\s]+([+-]?\d+\.?\d*)/i) ||
                          html.match(/center=([+-]?\d+\.?\d*)%2C([+-]?\d+\.?\d*)/i) ||
                          html.match(/ll=([+-]?\d+\.?\d*)%2C([+-]?\d+\.?\d*)/i);
        if (htmlMatch) {
          const lat = parseFloat(htmlMatch[1]);
          const lng = parseFloat(htmlMatch[2]);
          if (isValidLatLng(lat, lng)) return { lat, lng };
        }
      }
    } catch (e) {
      console.warn("[Google Maps Link Parser] Unshorten notice:", (e as Error).message);
    }
  }

  return null;
}

export async function resolveLocationCoords(input: LocationInput): Promise<{ lat: number; lng: number } | null> {
  if (input.coords?.lat && input.coords?.lng) {
    return input.coords;
  }
  if (!input.text) return null;

  // 1. Check if the text contains a Google Maps URL or GPS coordinates
  const parsedCoords = await extractCoordinatesFromTextOrUrl(input.text);
  if (parsedCoords) {
    return parsedCoords;
  }

  // 2. Check built-in Sri Lanka towns
  const textLower = input.text.toLowerCase().trim();
  for (const [town, coords] of Object.entries(SRI_LANKA_TOWNS)) {
    if (textLower.includes(town)) {
      return coords;
    }
  }

  // Fallback to OpenStreetMap Nominatim
  try {
    const q = textLower.includes("sri lanka") ? input.text : `${input.text}, Sri Lanka`;
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`, {
      headers: { "User-Agent": "CentralCabService/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
        return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
      }
    }
  } catch (err) {
    console.warn("Nominatim lookup notice:", (err as Error).message);
  }
  return null;
}

function calculateHaversineDistance(
  coord1: { lat: number; lng: number },
  coord2: { lat: number; lng: number }
): number {
  const R = 6371; // Earth's radius in km
  const dLat = (coord2.lat - coord1.lat) * (Math.PI / 180);
  const dLng = (coord2.lng - coord1.lng) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coord1.lat * (Math.PI / 180)) *
      Math.cos(coord2.lat * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightLine = R * c;
  // Sri Lanka road curvature factor (~1.3x)
  return Math.round(Math.max(straightLine * 1.3, 0.5) * 10) / 10;
}

/**
 * 100% Free Road Distance Calculation via OSRM (Open Source Routing Machine)
 * Documentation: https://project-osrm.org/docs/v5.24.0/api/#requests
 */
export async function getOSRMRouteDistance(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<{ distanceKm: number; distanceText: string; durationMinutes?: number } | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "CentralCabService/1.0",
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code === "Ok" && data.routes?.[0]?.distance) {
      const distanceMeters = Number(data.routes[0].distance);
      const distanceKm = Math.round((distanceMeters / 1000) * 10) / 10;
      const durationSeconds = Number(data.routes[0].duration || 0);
      const durationMinutes = Math.round(durationSeconds / 60);
      return {
        distanceKm: Math.max(distanceKm, 0.5),
        distanceText: `${distanceKm} km`,
        durationMinutes,
      };
    }
  } catch (e) {
    console.warn("OSRM routing notice:", (e as Error).message);
  }
  return null;
}

/**
 * Query Driving Distance - Primary Engine: Open Source Routing Machine (OSRM)
 * 100% Free, Zero Google Maps API cost or restrictions.
 */
export async function getRoutingDistance(
  pickup: LocationInput,
  dropoff: LocationInput
): Promise<{ distanceKm: number; distanceText: string }> {
  try {
    // 1. Resolve coordinates for Pickup and Dropoff
    const originCoords = await resolveLocationCoords(pickup);
    const destCoords = await resolveLocationCoords(dropoff);

    if (originCoords && destCoords) {
      // 2. Primary Engine: OSRM Route API
      const osrmResult = await getOSRMRouteDistance(originCoords, destCoords);
      if (osrmResult) {
        console.log(`[OSRM Primary Engine] Road distance: ${osrmResult.distanceKm} km`);
        return {
          distanceKm: osrmResult.distanceKm,
          distanceText: osrmResult.distanceText,
        };
      }

      // 3. Instant Offline Backup: Haversine with 1.3x Sri Lanka road factor
      const haversineKm = calculateHaversineDistance(originCoords, destCoords);
      console.log(`[Haversine Offline Engine] Fallback road distance: ${haversineKm} km`);
      return {
        distanceKm: Math.max(haversineKm, 0.5),
        distanceText: `${haversineKm} km`,
      };
    }
  } catch (err) {
    console.warn("Distance calculation notice:", err);
  }

  // 4. Fallback Estimation if geocoding completely fails
  return { distanceKm: 8, distanceText: "8.0 km (Estimated)" };
}

// Backward-compatible alias for existing imports
export const getGoogleMapsDistance = getRoutingDistance;

/**
 * Calculate Dynamic Pricing according to the exact business rules
 * 
 * Let D = exact distance, C = Base Price Coverage KM
 * One-Way: If D <= C -> Fare = Base Price. If D > C -> Fare = Base Price + ((D - C) * Per KM Rate)
 * Round Trip: D_total = One-Way * 2. Calculate gross fare using above logic, then apply Discount Percentage.
 */
export function calculateFare(
  distanceKm: number,
  distanceText: string,
  vehicleKey: string,
  tripType: "one_way" | "round_trip",
  pricingSettings: PricingSettings
): FareCalculationResult {
  const config = pricingSettings[vehicleKey] || {
    base_price: 500,
    per_km_rate: 120,
    coverage_km: 2,
    discount_percentage: 10,
  };

  const basePrice = Number(config.base_price) || 0;
  const perKmRate = Number(config.per_km_rate) || 0;
  const coverageKm = Number(config.coverage_km) || 0;
  const discountPercentage = Number(config.discount_percentage) || 0;

  let effectiveDistance = distanceKm;
  let isRoundTrip = tripType === "round_trip";

  if (isRoundTrip) {
    effectiveDistance = distanceKm * 2;
  }

  // Chargeable KM over base coverage
  const chargeableKm = Math.max(0, effectiveDistance - coverageKm);
  const grossFare = basePrice + (chargeableKm * perKmRate);

  let discountAmount = 0;
  let totalFare = grossFare;

  if (isRoundTrip && discountPercentage > 0) {
    discountAmount = Math.round((grossFare * (discountPercentage / 100)) * 100) / 100;
    totalFare = grossFare - discountAmount;
  }

  // Round final fare to 2 decimals
  totalFare = Math.round(totalFare * 100) / 100;

  return {
    distanceKm: Math.round(effectiveDistance * 10) / 10,
    distanceText: isRoundTrip ? `${distanceKm} km x 2 (Round Trip = ${effectiveDistance} km)` : distanceText,
    basePrice,
    perKmRate,
    coverageKm,
    chargeableKm: Math.round(chargeableKm * 10) / 10,
    grossFare: Math.round(grossFare * 100) / 100,
    discountAmount,
    totalFare,
    tripType,
    vehicleKey,
  };
}
