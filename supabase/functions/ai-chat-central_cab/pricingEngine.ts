// ============================================================================
// Ceylon Central Cabs & Delivery - Dynamic Pricing Engine
// Secure Google Maps Distance Matrix API Integration & Fare Calculator
// ============================================================================

export interface DistanceDiscountSlab {
  id?: string;
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

export interface VehiclePricingConfig {
  label?: string;
  icon?: string;
  badge_color?: string;
  is_ride_now?: boolean;
  base_price: number;
  per_km_rate: number;
  coverage_km: number;
  discount_percentage?: number;
  discount_slabs?: DistanceDiscountSlab[];
  models?: VehicleModel[];
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
 * Supports menu indices:
 * 1 -> Motorbike
 * 2 -> Three-wheeler
 * 3 -> Car
 * 4 -> Van
 * 5 -> Lorry
 * 6 -> Bus
 * As well as Sinhala/English vehicle names and colloquial variations.
 */
export function normalizeVehicleKey(
  vehicle: string,
  bookingType?: string,
  pricingSettings?: PricingSettings
): string {
  const raw = (vehicle || "").trim();
  if (!raw) return "";

  const lowerRaw = raw.toLowerCase();
  const v = lowerRaw.replace(/[-_\s]/g, "");

  // 1. Dynamic exact/label check against categories in pricingSettings if provided
  if (pricingSettings) {
    for (const key of Object.keys(pricingSettings)) {
      const cfg = pricingSettings[key];
      const keyNormalized = key.toLowerCase().replace(/[-_\s]/g, "");
      const labelNormalized = (cfg?.label || "").toLowerCase().replace(/[-_\s]/g, "");

      if (v === keyNormalized || (labelNormalized && v === labelNormalized)) {
        return key;
      }
    }

    // 1b. Dynamic check against any model / variation defined under any category
    for (const key of Object.keys(pricingSettings)) {
      const cfg = pricingSettings[key];
      if (Array.isArray(cfg?.models)) {
        for (const model of cfg.models) {
          const mName = (model?.name || "").toLowerCase().trim();
          const mNormalized = mName.replace(/[-_\s]/g, "");
          if (mNormalized && (v.includes(mNormalized) || lowerRaw.includes(mName))) {
            return key;
          }
        }
      }
    }
  }

  // 2. Explicit vehicle names first (so "1. Car 🚗" or "2. Van 🚐" match car/van and not digit 1/2)
  if (
    v.includes("car") ||
    v.includes("sedan") ||
    v.includes("hatchback") ||
    v.includes("suv") ||
    v.includes("alto") ||
    v.includes("wagonr") ||
    v.includes("කාර්")
  ) {
    return "car";
  }

  if (v.includes("van") || v.includes("kdh") || v.includes("hiace") || v.includes("වෑන්")) {
    return "van";
  }

  if (v.includes("lorry") || v.includes("truck") || v.includes("dimo") || v.includes("bata") || v.includes("ලොරි")) {
    return "lorry";
  }

  if (v.includes("bus") || v.includes("coach") || v.includes("බස්")) {
    return "bus";
  }

  // 3. Explicit Three-wheeler text (e.g. "3wheeler", "3-wheeler", "3 wheeler", "threewheeler", "tuktuk")
  if (
    v.includes("3wheeler") ||
    v.includes("threewheeler") ||
    v.includes("three") ||
    v.includes("tuk") ||
    v.includes("wheeler") ||
    v.includes("trishaw") ||
    v.includes("bajaj") ||
    v.includes("auto") ||
    v.includes("ත්‍රිරෝද")
  ) {
    return "three_wheeler";
  }

  // 4. Motorbike
  if (v.includes("bike") || v.includes("motor") || v.includes("මෝටර්")) {
    return "motorbike";
  }

  // 5. Check any custom categories in pricingSettings by substring
  if (pricingSettings) {
    for (const key of Object.keys(pricingSettings)) {
      if (key !== "motorbike" && key !== "three_wheeler" && key !== "car" && key !== "van" && key !== "lorry" && key !== "bus") {
        const cfg = pricingSettings[key];
        const keyLower = key.toLowerCase();
        const labelLower = (cfg?.label || "").toLowerCase();
        if (lowerRaw.includes(keyLower) || (labelLower && lowerRaw.includes(labelLower))) {
          return key;
        }
      }
    }
  }

  // 6. Direct menu number check: matches "1", "1.", "1)", "2", "3", etc.
  const numPrefixMatch = raw.match(/^\s*(\d+)(?:\.|\)|\s|$)/);
  if (numPrefixMatch) {
    const digitNum = parseInt(numPrefixMatch[1], 10);

    // If dynamic pricingSettings is present, map menu indices to configured categories
    if (pricingSettings) {
      if (bookingType === "schedule") {
        const scheduleKeys = Object.keys(pricingSettings).filter(
          (k) => k !== "motorbike" && k !== "three_wheeler" && !pricingSettings[k]?.is_ride_now
        );
        const idx = digitNum - 1;
        if (idx >= 0 && idx < scheduleKeys.length) {
          return scheduleKeys[idx];
        }
      } else {
        const rideNowKeys = Object.keys(pricingSettings).filter(
          (k) => k === "motorbike" || k === "three_wheeler" || Boolean(pricingSettings[k]?.is_ride_now)
        );
        const idx = digitNum - 1;
        if (idx >= 0 && idx < rideNowKeys.length) {
          return rideNowKeys[idx];
        }
      }
    }

    // Standard fallback digit mapping
    if (bookingType === "schedule") {
      switch (String(digitNum)) {
        case "1": return "car";
        case "2": return "van";
        case "3": return "lorry";
        case "4": return "bus";
      }
    } else {
      switch (String(digitNum)) {
        case "1": return "motorbike";
        case "2": return "three_wheeler";
        case "3": return "car";
        case "4": return "van";
        case "5": return "lorry";
        case "6": return "bus";
      }
    }
  }

  return "";
}

/**
 * Display name formatting for vehicles
 */
export function getVehicleDisplayName(vehicleKey: string, pricingSettings?: PricingSettings): string {
  if (pricingSettings && pricingSettings[vehicleKey]?.label) {
    const l = pricingSettings[vehicleKey].label!;
    const emoji = pricingSettings[vehicleKey].icon || (
      vehicleKey === "motorbike" ? "🏍️" :
      vehicleKey === "three_wheeler" ? "🛺" :
      vehicleKey === "car" ? "🚗" :
      vehicleKey === "van" ? "🚐" :
      vehicleKey === "lorry" ? "🚚" :
      vehicleKey === "bus" ? "🚌" : "🚙"
    );
    return `${l} ${emoji}`.trim();
  }

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
  param1?: any,
  param2?: any
): string {
  let locationText = "";
  let coords: { lat: number; lng: number } | null = null;

  if (typeof param1 === "string") {
    locationText = param1;
  } else if (param1 && typeof param1 === "object" && typeof param1.lat === "number" && typeof param1.lng === "number") {
    coords = param1;
  }

  if (typeof param2 === "string") {
    locationText = param2;
  } else if (param2 && typeof param2 === "object" && typeof param2.lat === "number" && typeof param2.lng === "number") {
    coords = param2;
  }

  if (!coords && locationText) {
    const match = locationText.match(/([-+]?\d{1,2}\.\d+)\s*,\s*([-+]?\d{1,3}\.\d+)/);
    if (match) {
      coords = { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }
  }

  if (coords?.lat && coords?.lng) {
    return `https://maps.google.com/?q=${coords.lat},${coords.lng}`;
  }
  if (locationText && typeof locationText === "string" && locationText.trim()) {
    const clean = locationText.trim();
    if (clean.includes("maps.google.com") || clean.includes("goo.gl") || clean.includes("google.com/maps")) {
      return clean;
    }
    const query = clean.toLowerCase().includes("sri lanka") ? clean : `${clean}, Sri Lanka`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }
  return "";
}

/**
 * Format any location with a clickable, guaranteed Google Maps link for drivers/shops/riders/admins
 */
export function formatLocationDisplay(
  addressOrText?: string,
  coords?: { lat: number; lng: number } | null
): string {
  const text = (addressOrText || "").trim();
  if (!text || text === "N/A" || text.toLowerCase().includes("pending shop")) {
    return text || "N/A";
  }

  // If text already has a full maps URL embedded
  const urlMatch = text.match(/https?:\/\/(?:maps\.google\.com|goo\.gl|maps\.app\.goo\.gl|www\.google\.com\/maps)[^\s]+/i);
  if (urlMatch) {
    return text;
  }

  let lat = coords?.lat;
  let lng = coords?.lng;

  if ((!lat || !lng) && text) {
    const coordMatch = text.match(/([-+]?\d{1,2}\.\d+)\s*,\s*([-+]?\d{1,3}\.\d+)/);
    if (coordMatch) {
      lat = parseFloat(coordMatch[1]);
      lng = parseFloat(coordMatch[2]);
    }
  }

  let mapUrl = "";
  let cleanName = text;

  if (lat && lng) {
    mapUrl = `https://maps.google.com/?q=${lat},${lng}`;
    cleanName = cleanName.replace(/\s*\([-+]?\d{1,2}\.\d+,\s*[-+]?\d{1,3}\.\d+\)/g, "").trim();
    if (!cleanName || /^location:?$/i.test(cleanName) || /^pin location$/i.test(cleanName) || /^gps:?$/i.test(cleanName)) {
      cleanName = `GPS Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    }
  } else {
    const query = cleanName.toLowerCase().includes("sri lanka") ? cleanName : `${cleanName}, Sri Lanka`;
    mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  return `${cleanName}\n🗺️ *Google Maps:* ${mapUrl}`;
}

function isValidLatLng(lat: number, lng: number): boolean {
  return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function isSriLankaCoords(lat: number, lng: number): boolean {
  return !isNaN(lat) && !isNaN(lng) && lat >= 5.5 && lat <= 10.5 && lng >= 79.0 && lng <= 82.5;
}

export function isGoogleMapsUrl(str: string): boolean {
  if (!str) return false;
  return /https?:\/\/(?:maps\.google\.com|goo\.gl\/maps|maps\.app\.goo\.gl|www\.google\.com\/maps|google\.com\/maps)[^\s]*/i.test(str);
}

/**
 * Validates whether the incoming input is an acceptable location.
 * Strictly accepts:
 * 1. Native WhatsApp location pins
 * 2. Full or shortened Google Maps links
 * 3. Exact GPS coordinate strings (e.g. 6.9271, 79.8612)
 * Rejects plain typed text (e.g. "Colombo", "Kandy", "airport").
 */
export function isValidLocationInput(text: string, rawPayload: any): boolean {
  // 1. Direct WhatsApp location pin or payload coordinates
  const locDetails = rawPayload?.locationDetails;
  if (locDetails && locDetails.latitude && locDetails.longitude) {
    return true;
  }
  const wMsg = rawPayload?._data?.message || {};
  if (wMsg.locationMessage?.degreesLatitude && wMsg.locationMessage?.degreesLongitude) {
    return true;
  }
  if (rawPayload?.type === "location" || rawPayload?._data?.type === "location") {
    return true;
  }

  // 2. Contains Google Maps link
  const str = (text || "").trim();
  if (isGoogleMapsUrl(str)) {
    return true;
  }

  // 3. Explicit GPS Coordinates: e.g. "6.9271, 79.8612" or "GPS: 6.9271, 79.8612"
  if (/^(?:gps:?\s*)?[+-]?\d{1,2}\.\d+[\s,]+[+-]?\d{1,3}\.\d+$/i.test(str)) {
    return true;
  }

  return false;
}

/**
 * Unshorten / expand short URLs (maps.app.goo.gl, goo.gl/maps, bit.ly, etc.)
 * Follows HTTP 301/302/303/307/308 redirects step-by-step up to 6 hops.
 * Returns the final URL and the full redirect chain for deep parameter inspection.
 */
export async function expandShortUrl(url: string): Promise<{ finalUrl: string; redirectChain: string[] }> {
  let currentUrl = (url || "").trim();
  const redirectChain = [currentUrl];

  for (let hop = 0; hop < 6; hop++) {
    try {
      const res = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(6000),
      });

      const loc = res.headers.get("location");
      if (loc && [301, 302, 303, 307, 308].includes(res.status)) {
        const nextUrl = new URL(loc, currentUrl).href;
        redirectChain.push(nextUrl);
        currentUrl = nextUrl;
      } else {
        break;
      }
    } catch (e) {
      console.warn("[expandShortUrl] notice:", (e as Error).message);
      break;
    }
  }

  return { finalUrl: currentUrl, redirectChain };
}

/**
 * Geocode a Sri Lanka town or place name using local registry and OpenStreetMap Nominatim.
 */
export async function geocodeSriLankaPlace(name: string): Promise<{ lat: number; lng: number } | null> {
  if (!name) return null;
  const clean = name.replace(/\+/g, " ").replace(/loc:/i, "").trim();
  if (!clean || clean.length < 2) return null;

  const textLower = clean.toLowerCase();
  for (const [town, coords] of Object.entries(SRI_LANKA_TOWNS)) {
    if (textLower.includes(town)) {
      return coords;
    }
  }

  // OpenStreetMap Nominatim with explicit Sri Lanka scope
  try {
    const q = textLower.includes("sri lanka") ? clean : `${clean}, Sri Lanka`;
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`, {
      headers: { "User-Agent": "CentralCabService/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        if (isValidLatLng(lat, lng) && isSriLankaCoords(lat, lng)) {
          return { lat, lng };
        }
      }
    }
  } catch (err) {
    console.warn("Nominatim lookup notice:", (err as Error).message);
  }

  return null;
}

/**
 * Extract GPS coordinates from text, raw coordinates, or any Google Maps URL format
 * Supports:
 * - Direct params: ?q=lat,lng / ?query=lat,lng / ll=lat,lng / daddr=lat,lng / saddr=lat,lng
 * - Path params: /@lat,lng,... or !3dlat!4dlng
 * - Navigation links: extracts daddr (dropoff) or saddr (pickup) coordinates or place queries
 * - Place names: resolves /maps/place/<name> or daddr/q place text via Sri Lanka geocoding
 * - Short links: unshortens maps.app.goo.gl / goo.gl/maps via redirect resolution
 * - Deep HTML inspection: extracts !3d<lat>!4d<lng> coordinates validated within Sri Lanka bounds
 * - Excludes client/server default static map coordinates (e.g. European / German data centers)
 */
export async function extractCoordinatesFromTextOrUrl(
  text: string,
  role: "pickup" | "dropoff" = "dropoff"
): Promise<{ lat: number; lng: number } | null> {
  if (!text) return null;
  const str = text.trim();

  // 1. Direct coordinate string: e.g. "6.7972, 79.9012" or "GPS: 6.7972, 79.9012"
  const rawMatch = str.match(/([+-]?\d{1,2}\.\d+)[,\s]+([+-]?\d{1,3}\.\d+)/);
  if (rawMatch && !str.includes("http://") && !str.includes("https://")) {
    const lat = parseFloat(rawMatch[1]);
    const lng = parseFloat(rawMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // 2. Direct query parameters on the input string (if already a long link):
  if (role === "dropoff") {
    const daddrMatch = str.match(/[?&]daddr=([+-]?\d+\.?\d*)[,%2C\s]+([+-]?\d+\.?\d*)/i);
    if (daddrMatch) {
      const lat = parseFloat(daddrMatch[1]);
      const lng = parseFloat(daddrMatch[2]);
      if (isValidLatLng(lat, lng)) return { lat, lng };
    }
  } else {
    const saddrMatch = str.match(/[?&]saddr=([+-]?\d+\.?\d*)[,%2C\s]+([+-]?\d+\.?\d*)/i);
    if (saddrMatch) {
      const lat = parseFloat(saddrMatch[1]);
      const lng = parseFloat(saddrMatch[2]);
      if (isValidLatLng(lat, lng)) return { lat, lng };
    }
  }

  const qMatch = str.match(/[?&](?:q|query|ll|loc)=([+-]?\d+\.?\d*)[,%2C\s]+([+-]?\d+\.?\d*)/i);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  const atMatch = str.match(/@([+-]?\d+\.?\d*)[,%2C\s]+([+-]?\d+\.?\d*)/i);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  const dMatch = str.match(/!3d([+-]?\d+\.?\d*)!4d([+-]?\d+\.?\d*)/i);
  if (dMatch) {
    const lat = parseFloat(dMatch[1]);
    const lng = parseFloat(dMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // 3. Shortened or full Google Maps links: maps.app.goo.gl, goo.gl/maps, or google.com/maps
  if (str.includes("goo.gl") || str.includes("maps.app") || str.includes("google.com/maps") || str.includes("http://") || str.includes("https://")) {
    try {
      const urlMatch = str.match(/https?:\/\/[^\s]+/i);
      if (urlMatch) {
        const { finalUrl, redirectChain } = await expandShortUrl(urlMatch[0]);

        // Inspect all URLs in the redirect chain from newest to oldest
        for (const u of [...redirectChain].reverse()) {
          try {
            const parsed = new URL(u);

            // Role-specific check: daddr (dropoff) or saddr (pickup)
            if (role === "dropoff") {
              const daddr = parsed.searchParams.get("daddr");
              if (daddr) {
                const coordM = daddr.match(/([+-]?\d+\.?\d*)[,%2C\s]+([+-]?\d+\.?\d*)/);
                if (coordM) {
                  const lat = parseFloat(coordM[1]);
                  const lng = parseFloat(coordM[2]);
                  if (isValidLatLng(lat, lng) && isSriLankaCoords(lat, lng)) return { lat, lng };
                }
                const placeCoords = await geocodeSriLankaPlace(daddr);
                if (placeCoords) return placeCoords;
              }
            } else {
              const saddr = parsed.searchParams.get("saddr");
              if (saddr) {
                const coordM = saddr.match(/([+-]?\d+\.?\d*)[,%2C\s]+([+-]?\d+\.?\d*)/);
                if (coordM) {
                  const lat = parseFloat(coordM[1]);
                  const lng = parseFloat(coordM[2]);
                  if (isValidLatLng(lat, lng) && isSriLankaCoords(lat, lng)) return { lat, lng };
                }
                const placeCoords = await geocodeSriLankaPlace(saddr);
                if (placeCoords) return placeCoords;
              }
            }

            // Check coordinates in path (@lat,lng)
            const atM = u.match(/@([+-]?\d+\.?\d*)[,%2C\s]+([+-]?\d+\.?\d*)/);
            if (atM) {
              const lat = parseFloat(atM[1]);
              const lng = parseFloat(atM[2]);
              if (isValidLatLng(lat, lng) && isSriLankaCoords(lat, lng)) return { lat, lng };
            }

            // Check data param coordinates (!3dlat!4dlng)
            const dataM = u.match(/!3d([+-]?\d+\.?\d*)!4d([+-]?\d+\.?\d*)/);
            if (dataM) {
              const lat = parseFloat(dataM[1]);
              const lng = parseFloat(dataM[2]);
              if (isValidLatLng(lat, lng) && isSriLankaCoords(lat, lng)) return { lat, lng };
            }

            // Check q / query / ll / loc
            const qParam = parsed.searchParams.get("q") || parsed.searchParams.get("query") || parsed.searchParams.get("ll") || parsed.searchParams.get("loc");
            if (qParam) {
              const qM = qParam.match(/([+-]?\d+\.?\d*)[,%2C\s]+([+-]?\d+\.?\d*)/);
              if (qM) {
                const lat = parseFloat(qM[1]);
                const lng = parseFloat(qM[2]);
                if (isValidLatLng(lat, lng) && isSriLankaCoords(lat, lng)) return { lat, lng };
              }
              const placeCoords = await geocodeSriLankaPlace(qParam);
              if (placeCoords) return placeCoords;
            }

            // Check /maps/place/<name>
            const placeMatch = u.match(/\/maps\/place\/([^/@?]+)/i);
            if (placeMatch) {
              const placeName = decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
              const placeCoords = await geocodeSriLankaPlace(placeName);
              if (placeCoords) return placeCoords;
            }
          } catch (_) {
            // continue checking other hops
          }
        }

        // If URL parsing didn't find coordinates, fetch HTML of finalUrl and inspect !3d!4d coordinates
        try {
          const res = await fetch(finalUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Accept-Language": "en-US,en;q=0.9",
            },
            signal: AbortSignal.timeout(6000),
          });
          const html = await res.text();

          // Extract all !3d<lat>!4d<lng> coordinates
          const dMatches = [...html.matchAll(/!3d([+-]?\d+\.?\d*)!4d([+-]?\d+\.?\d*)/g)];
          const validCoords: { lat: number; lng: number }[] = [];
          for (const m of dMatches) {
            const lat = parseFloat(m[1]);
            const lng = parseFloat(m[2]);
            if (isValidLatLng(lat, lng) && isSriLankaCoords(lat, lng)) {
              validCoords.push({ lat, lng });
            }
          }

          if (validCoords.length > 0) {
            // If multiple points found (e.g. directions), pickup is first, dropoff is last
            const selected = role === "dropoff" ? validCoords[validCoords.length - 1] : validCoords[0];
            return selected;
          }

          // Check if there is a meta or title with place name
          const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
          if (titleMatch && !titleMatch[1].trim().toLowerCase().startsWith("google maps")) {
            const cleanTitle = titleMatch[1].replace(/- Google Maps/i, "").trim();
            const placeCoords = await geocodeSriLankaPlace(cleanTitle);
            if (placeCoords) return placeCoords;
          }
        } catch (err) {
          console.warn("[Google Maps HTML Parser] notice:", (err as Error).message);
        }
      }
    } catch (e) {
      console.warn("[Google Maps Link Parser] Unshorten notice:", (e as Error).message);
    }
  }

  return null;
}

export async function resolveLocationCoords(
  input: LocationInput,
  role: "pickup" | "dropoff" = "dropoff"
): Promise<{ lat: number; lng: number } | null> {
  if (input.coords?.lat && input.coords?.lng && isSriLankaCoords(input.coords.lat, input.coords.lng)) {
    return input.coords;
  }
  if (!input.text) return null;

  // 1. Check if the text contains a Google Maps URL, raw coordinates, or directions link
  const parsedCoords = await extractCoordinatesFromTextOrUrl(input.text, role);
  if (parsedCoords) {
    return parsedCoords;
  }

  // 2. Geocode as place or town name
  return await geocodeSriLankaPlace(input.text);
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
    const originCoords = await resolveLocationCoords(pickup, "pickup");
    const destCoords = await resolveLocationCoords(dropoff, "dropoff");

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
 * 1. Base Price covers the first Base Coverage KM (coverage_km).
 * 2. Beyond Base Coverage KM, if Progressive Distance Slabs are defined:
 *    - Each KM segment is charged at its slab's discounted rate: slab_km * (per_km_rate * (1 - slab_discount / 100)).
 * 3. Fallback: If no slabs are configured, standard per-km rate applies with round-trip discount if applicable.
 */
export function calculateFare(
  distanceKm: number,
  distanceText: string,
  vehicleKey: string,
  tripType: "one_way" | "round_trip",
  pricingSettings: PricingSettings,
  customModel?: VehicleModel
): FareCalculationResult {
  const categoryConfig = pricingSettings[vehicleKey] || {
    base_price: 500,
    per_km_rate: 120,
    coverage_km: 2,
    discount_percentage: 10,
  };

  const basePrice = Number(customModel?.base_price ?? categoryConfig.base_price) || 0;
  const perKmRate = Number(customModel?.per_km_rate ?? categoryConfig.per_km_rate) || 0;
  const coverageKm = Number(customModel?.coverage_km ?? categoryConfig.coverage_km) || 0;
  const discountPercentage = Number(customModel?.discount_percentage ?? categoryConfig.discount_percentage) || 0;

  // Slabs: customModel slabs take priority, then categoryConfig slabs
  const slabs: DistanceDiscountSlab[] =
    customModel?.discount_slabs && customModel.discount_slabs.length > 0
      ? customModel.discount_slabs
      : (categoryConfig.discount_slabs && categoryConfig.discount_slabs.length > 0 ? categoryConfig.discount_slabs : []);

  let effectiveDistance = distanceKm;
  const isRoundTrip = tripType === "round_trip";

  if (isRoundTrip) {
    effectiveDistance = distanceKm * 2;
  }

  // Chargeable KM over base coverage
  const chargeableKm = Math.max(0, effectiveDistance - coverageKm);
  const grossFare = basePrice + (chargeableKm * perKmRate);

  let discountAmount = 0;
  let totalFare = grossFare;

  // 1. Progressive Slab-by-Slab Calculation (When slabs are defined)
  if (slabs.length > 0 && chargeableKm > 0) {
    const sortedSlabs = [...slabs].sort((a, b) => (Number(a.from_km) || 0) - (Number(b.from_km) || 0));

    let totalSlabKmCharge = 0;
    let coveredKm = 0;

    for (const slab of sortedSlabs) {
      const slabStart = Math.max(0, Number(slab.from_km) || 0);
      const slabEnd = slab.to_km != null && Number(slab.to_km) > slabStart ? Number(slab.to_km) : Infinity;

      // The chargeable portion that overlaps this slab
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

    // Any distance not covered by defined slabs charged at standard rate
    const remainingKm = Math.max(0, chargeableKm - coveredKm);
    if (remainingKm > 0) {
      totalSlabKmCharge += remainingKm * perKmRate;
    }

    totalFare = basePrice + totalSlabKmCharge;
    discountAmount = Math.max(0, grossFare - totalFare);
  } else {
    // 2. Legacy fallback calculation (Round trip discount percentage)
    if (isRoundTrip && discountPercentage > 0) {
      discountAmount = Math.round((grossFare * (discountPercentage / 100)) * 100) / 100;
      totalFare = grossFare - discountAmount;
    }
  }

  // Round final fares to 2 decimals
  discountAmount = Math.round(discountAmount * 100) / 100;
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
