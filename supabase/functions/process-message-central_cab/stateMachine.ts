// ============================================================================
// Ceylon Central Cabs & Delivery - Finite State Machine (FSM)
// Strict Step-by-Step Conversational Booking Engine (0% Hallucination)
// ============================================================================

import {
  getGoogleMapsDistance,
  calculateFare,
  normalizeVehicleKey,
  getVehicleDisplayName,
  PricingSettings,
  LocationInput,
  FareCalculationResult,
  buildGoogleMapsLink,
  resolveLocationCoords,
} from "./pricingEngine.ts";
import { CabSystemSettings } from "./adminHandler.ts";

export interface BotSessionState {
  phone_number: string;
  user_id: string;
  flow_type: "IDLE" | "CAB_FLOW" | "DELIVERY_FLOW" | "ADMIN_FLOW";
  current_step: string;
  session_data: {
    customer_name?: string;
    customer_phone?: string;
    vehicle_key?: string;
    vehicle_name?: string;
    pickup_text?: string;
    pickup_coords?: { lat: number; lng: number };
    dropoff_text?: string;
    dropoff_coords?: { lat: number; lng: number };
    trip_type?: "one_way" | "round_trip";
    delivery_items?: string;
    distance_km?: number;
    distance_text?: string;
    base_price?: number;
    per_km_rate?: number;
    coverage_km?: number;
    gross_fare?: number;
    discount_amount?: number;
    total_fare?: number;
    [key: string]: any;
  };
}

/**
 * Generate unique 3-4 digit Order Code (e.g., #ORD845)
 */
function generateOrderCode(): string {
  const randomNum = Math.floor(100 + Math.random() * 900); // 3-digit number 100-999
  return `#ORD${randomNum}`;
}

/**
 * Format currency LKR
 */
function formatLKR(amount: number): string {
  return `LKR ${Number(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Extract location text or coordinates from incoming message
 */
function extractLocation(messageText: string, rawPayload: any): LocationInput {
  const p = rawPayload?.payload || rawPayload || {};
  const loc = p.location || rawPayload?.locationDetails || p._data;

  const lat = loc?.latitude || loc?.degreesLatitude || loc?.lat;
  const lng = loc?.longitude || loc?.degreesLongitude || loc?.lng;

  if (lat && lng) {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    const nameOrDesc = (loc?.name || loc?.description || loc?.address || loc?.loc || "").trim();
    const mapUrl = `https://maps.google.com/?q=${latNum},${lngNum}`;
    const cleanText = nameOrDesc ? `${nameOrDesc} (${mapUrl})` : mapUrl;
    return {
      coords: { lat: latNum, lng: lngNum },
      text: cleanText,
    };
  }

  let cleanText = (messageText || "").trim();
  // Guard against raw base64 thumbnails leaking into location text
  if (cleanText.startsWith("/9j/") || cleanText.startsWith("data:image") || cleanText.length > 200) {
    cleanText = "Shared Location Pin";
  }

  return { text: cleanText };
}

/**
 * Main State Machine Transition Handler
 */
export async function processCustomerChatStep(
  supabase: any,
  supabaseUrl: string,
  supabaseServiceKey: string,
  userId: string,
  phoneNumber: string,
  messageText: string,
  messageType: string,
  rawPayload: any,
  session: BotSessionState,
  pricingSettings: PricingSettings,
  systemSettings: CabSystemSettings,
  sessionApiKey: string
): Promise<{ replyText: string; nextFlow: string; nextStep: string; sessionData: any }> {
  const trimmed = (messageText || "").trim();
  const lower = trimmed.toLowerCase();

  // 1. Global Reset Commands
  if (["reset", "cancel", "start", "menu", "restart", "hi", "hello"].includes(lower) && session.current_step !== "WELCOME") {
    return {
      replyText: getWelcomeMessage(),
      nextFlow: "IDLE",
      nextStep: "WELCOME",
      sessionData: {},
    };
  }

  const flow = session.flow_type || "IDLE";
  const step = session.current_step || "WELCOME";
  const data = { customer_whatsapp: phoneNumber, ...(session.session_data || {}) };

  // =========================================================================
  // WELCOME / MAIN MENU
  // =========================================================================
  if (step === "WELCOME" || flow === "IDLE") {
    if (trimmed === "1" || lower.includes("transport") || lower.includes("cab")) {
      return {
        replyText: "Please enter your Name.",
        nextFlow: "CAB_FLOW",
        nextStep: "CAB_NAME",
        sessionData: { customer_whatsapp: phoneNumber },
      };
    } else if (trimmed === "2" || lower.includes("delivery")) {
      return {
        replyText: "Please enter your Name.",
        nextFlow: "DELIVERY_FLOW",
        nextStep: "DELIVERY_NAME",
        sessionData: { customer_whatsapp: phoneNumber },
      };
    } else {
      return {
        replyText: getWelcomeMessage(),
        nextFlow: "IDLE",
        nextStep: "WELCOME",
        sessionData: {},
      };
    }
  }

  // =========================================================================
  // FLOW 1: TRANSPORT (CABS)
  // =========================================================================
  if (flow === "CAB_FLOW") {
    switch (step) {
      case "CAB_NAME": {
        if (!trimmed || trimmed.length < 2) {
          return {
            replyText: "⚠️ Please enter a valid Name.\n\nPlease enter your Name:",
            nextFlow: flow, nextStep: step, sessionData: data,
          };
        }
        data.customer_name = trimmed;
        return {
          replyText: "Please provide your Contact Number.",
          nextFlow: flow, nextStep: "CAB_PHONE", sessionData: data,
        };
      }

      case "CAB_PHONE": {
        let digits = trimmed.replace(/\D/g, "");
        if (digits.length < 9) {
          return {
            replyText: "⚠️ Please enter a valid Contact Number (e.g., 0771234567):",
            nextFlow: flow, nextStep: step, sessionData: data,
          };
        }
        if (digits.startsWith("0") && digits.length === 10) {
          digits = "94" + digits.slice(1);
        } else if (digits.length === 9 && digits.startsWith("7")) {
          digits = "94" + digits;
        }
        data.customer_phone = digits;
        return {
          replyText: "Please select your preferred vehicle:\n\n1. Motorbike 🏍️\n2. Three-wheeler 🛺\n3. Car 🚗\n4. Van 🚐\n5. Lorry 🚚\n6. Bus 🚌\n\n(Type the vehicle name or number)",
          nextFlow: flow, nextStep: "CAB_VEHICLE", sessionData: data,
        };
      }

      case "CAB_VEHICLE": {
        const vehicleKey = normalizeVehicleKey(trimmed);
        if (!vehicleKey) {
          return {
            replyText: "⚠️ Invalid selection. Please choose from:\n(Motorbike, Three-wheeler, Car, Van, Lorry, Bus)",
            nextFlow: flow, nextStep: step, sessionData: data,
          };
        }
        data.vehicle_key = vehicleKey;
        data.vehicle_name = getVehicleDisplayName(vehicleKey);
        return {
          replyText: "Please share your live/current location via WhatsApp. If you cannot share it, please type your nearest City and District name.",
          nextFlow: flow, nextStep: "CAB_PICKUP", sessionData: data,
        };
      }

      case "CAB_PICKUP": {
        const loc = extractLocation(trimmed, rawPayload);
        if (!loc.text && !loc.coords) {
          return {
            replyText: "⚠️ Please provide your Pickup Location by sharing a WhatsApp Location Pin OR typing your City and District name:",
            nextFlow: flow, nextStep: step, sessionData: data,
          };
        }
        if (!loc.coords && loc.text) {
          const resolved = await resolveLocationCoords(loc);
          if (resolved) loc.coords = resolved;
        }
        data.pickup_text = loc.text;
        data.pickup_coords = loc.coords;
        return {
          replyText: "Please share your Drop-off location via WhatsApp OR type your nearest City and District name.",
          nextFlow: flow, nextStep: "CAB_DROPOFF", sessionData: data,
        };
      }

      case "CAB_DROPOFF": {
        const loc = extractLocation(trimmed, rawPayload);
        if (!loc.text && !loc.coords) {
          return {
            replyText: "⚠️ Please provide your Drop-off Location by sharing a WhatsApp Location Pin OR typing your City and District name:",
            nextFlow: flow, nextStep: step, sessionData: data,
          };
        }
        if (!loc.coords && loc.text) {
          const resolved = await resolveLocationCoords(loc);
          if (resolved) loc.coords = resolved;
        }
        data.dropoff_text = loc.text;
        data.dropoff_coords = loc.coords;

        return {
          replyText: "Is this a One-Way or Round Trip (Up & Down)?\n\n1. One-Way\n2. Round Trip",
          nextFlow: flow, nextStep: "CAB_TRIP_TYPE", sessionData: data,
        };
      }

      case "CAB_TRIP_TYPE": {
        let tripType: "one_way" | "round_trip" | null = null;
        if (trimmed === "1" || lower.includes("one") || lower.includes("single")) {
          tripType = "one_way";
        } else if (trimmed === "2" || lower.includes("round") || lower.includes("up & down") || lower.includes("two")) {
          tripType = "round_trip";
        }

        if (!tripType) {
          return {
            replyText: "⚠️ Please select a valid Trip Type:\n1. One-Way\n2. Round Trip",
            nextFlow: flow, nextStep: step, sessionData: data,
          };
        }

        data.trip_type = tripType;

        // Fetch Distance via Google Maps API
        let distanceKm = 10;
        let distanceText = "10.0 km";
        try {
          const pickupLoc: LocationInput = { text: data.pickup_text, coords: data.pickup_coords };
          const dropoffLoc: LocationInput = { text: data.dropoff_text, coords: data.dropoff_coords };
          if (!data.pickup_coords) {
            const resolvedPickup = await resolveLocationCoords(pickupLoc);
            if (resolvedPickup) data.pickup_coords = resolvedPickup;
          }
          if (!data.dropoff_coords) {
            const resolvedDropoff = await resolveLocationCoords(dropoffLoc);
            if (resolvedDropoff) data.dropoff_coords = resolvedDropoff;
          }
          const distResult = await getGoogleMapsDistance(pickupLoc, dropoffLoc);
          distanceKm = distResult.distanceKm;
          distanceText = distResult.distanceText;
        } catch (err) {
          console.warn("Distance Matrix calculation fallback:", err);
        }

        // Calculate Fare using exact dynamic pricing logic
        const fareResult: FareCalculationResult = calculateFare(
          distanceKm,
          distanceText,
          data.vehicle_key || "car",
          tripType,
          pricingSettings
        );

        data.distance_km = fareResult.distanceKm;
        data.distance_text = fareResult.distanceText;
        data.base_price = fareResult.basePrice;
        data.per_km_rate = fareResult.perKmRate;
        data.coverage_km = fareResult.coverageKm;
        data.gross_fare = fareResult.grossFare;
        data.discount_amount = fareResult.discountAmount;
        data.total_fare = fareResult.totalFare;

        const pickupMapLink = buildGoogleMapsLink(data.pickup_text, data.pickup_coords);
        const dropoffMapLink = buildGoogleMapsLink(data.dropoff_text, data.dropoff_coords);

        const pickupDisplay = data.pickup_text?.includes("maps.google") || data.pickup_text?.includes("google.com/maps")
          ? data.pickup_text
          : (pickupMapLink ? `${data.pickup_text}\n🗺️ *Pickup Map:* ${pickupMapLink}` : data.pickup_text);

        const dropoffDisplay = data.dropoff_text?.includes("maps.google") || data.dropoff_text?.includes("google.com/maps")
          ? data.dropoff_text
          : (dropoffMapLink ? `${data.dropoff_text}\n🗺️ *Drop-off Map:* ${dropoffMapLink}` : data.dropoff_text);

        const summary = `📋 *BOOKING SUMMARY*\n━━━━━━━━━━━━━━━━━━━━\n👤 *Name:* ${data.customer_name}\n📱 *Contact:* ${data.customer_phone}\n🚗 *Vehicle:* ${data.vehicle_name}\n📍 *Pickup:* ${pickupDisplay}\n🏁 *Drop-off:* ${dropoffDisplay}\n🛣️ *Distance:* ${data.distance_text}\n🔄 *Trip Type:* ${tripType === "round_trip" ? "Round Trip (Up & Down)" : "One-Way"}\n💰 *Final Price:* ${formatLKR(data.total_fare)}${data.discount_amount > 0 ? ` (Includes ${formatLKR(data.discount_amount)} Round Trip Discount)` : ""}\n━━━━━━━━━━━━━━━━━━━━\n\nPlease confirm your booking (Yes/No).`;

        return {
          replyText: summary,
          nextFlow: flow, nextStep: "CAB_CONFIRM", sessionData: data,
        };
      }

      case "CAB_CONFIRM": {
        if (lower === "yes" || lower === "y" || lower === "confirm") {
          const orderCode = generateOrderCode();
          data.order_code = orderCode;

          // 1. Save order in central_cab.orders
          await saveOrderToDatabase(supabase, userId, "transport", data);

          // 2. Alert Admin & Broadcast to Driver Groups
          await broadcastBooking(
            supabaseUrl,
            supabaseServiceKey,
            sessionApiKey,
            orderCode,
            "Transport",
            data,
            systemSettings
          );

          const pickupMapLink = buildGoogleMapsLink(data.pickup_text, data.pickup_coords);
          const confirmPickup = data.pickup_text?.includes("maps.google") || data.pickup_text?.includes("google.com/maps")
            ? data.pickup_text
            : (pickupMapLink ? `${data.pickup_text}\n🗺️ *Pickup Map:* ${pickupMapLink}` : data.pickup_text);

          return {
            replyText: `We will notify you when a driver is assigned.\nYour Order ID is *${orderCode}*.\n📍 *Pickup:* ${confirmPickup}`,
            nextFlow: "IDLE", nextStep: "WELCOME", sessionData: {},
          };
        } else if (lower === "no" || lower === "n" || lower === "cancel") {
          return {
            replyText: "❌ Booking cancelled.\n\n" + getWelcomeMessage(),
            nextFlow: "IDLE", nextStep: "WELCOME", sessionData: {},
          };
        } else {
          return {
            replyText: "⚠️ Please reply *Yes* to confirm or *No* to cancel your booking.",
            nextFlow: flow, nextStep: step, sessionData: data,
          };
        }
      }
    }
  }

  // =========================================================================
  // FLOW 2: DELIVERY
  // =========================================================================
  if (flow === "DELIVERY_FLOW") {
    switch (step) {
      case "DELIVERY_NAME": {
        if (!trimmed || trimmed.length < 2) {
          return {
            replyText: "⚠️ Please enter a valid Name.\n\nPlease enter your Name:",
            nextFlow: flow, nextStep: step, sessionData: data,
          };
        }
        data.customer_name = trimmed;
        return {
          replyText: "Please provide your Contact Number.",
          nextFlow: flow, nextStep: "DELIVERY_PHONE", sessionData: data,
        };
      }

      case "DELIVERY_PHONE": {
        let digits = trimmed.replace(/\D/g, "");
        if (digits.length < 9) {
          return {
            replyText: "⚠️ Please enter a valid Contact Number (e.g., 0771234567):",
            nextFlow: flow, nextStep: step, sessionData: data,
          };
        }
        if (digits.startsWith("0") && digits.length === 10) {
          digits = "94" + digits.slice(1);
        } else if (digits.length === 9 && digits.startsWith("7")) {
          digits = "94" + digits;
        }
        data.customer_phone = digits;
        return {
          replyText: "Please select your preferred vehicle:\n\n1. Three-wheeler 🛺\n2. Car 🚗\n\n(Type the vehicle name or number)",
          nextFlow: flow, nextStep: "DELIVERY_VEHICLE", sessionData: data,
        };
      }

      case "DELIVERY_VEHICLE": {
        const vehicleKey = normalizeVehicleKey(trimmed);
        // Delivery constraint: Only Car and Three-wheeler permitted
        if (vehicleKey !== "car" && vehicleKey !== "three_wheeler") {
          return {
            replyText: "⚠️ Delivery is only available for:\n1. Three-wheeler 🛺\n2. Car 🚗\n\nPlease choose Car or Three-wheeler:",
            nextFlow: flow, nextStep: step, sessionData: data,
          };
        }
        data.vehicle_key = vehicleKey;
        data.vehicle_name = getVehicleDisplayName(vehicleKey);
        return {
          replyText: "Please share your live/current location via WhatsApp. If you cannot share it, please type your nearest City and District name.",
          nextFlow: flow, nextStep: "DELIVERY_PICKUP", sessionData: data,
        };
      }

      case "DELIVERY_PICKUP": {
        const loc = extractLocation(trimmed, rawPayload);
        if (!loc.text && !loc.coords) {
          return {
            replyText: "⚠️ Please provide your Pickup Location by sharing a WhatsApp Location Pin OR typing your City and District name:",
            nextFlow: flow, nextStep: step, sessionData: data,
          };
        }
        if (!loc.coords && loc.text) {
          const resolved = await resolveLocationCoords(loc);
          if (resolved) loc.coords = resolved;
        }
        data.pickup_text = loc.text;
        data.pickup_coords = loc.coords;
        return {
          replyText: "Please share your Drop-off location via WhatsApp OR type your nearest City and District name.",
          nextFlow: flow, nextStep: "DELIVERY_DROPOFF", sessionData: data,
        };
      }

      case "DELIVERY_DROPOFF": {
        const loc = extractLocation(trimmed, rawPayload);
        if (!loc.text && !loc.coords) {
          return {
            replyText: "⚠️ Please provide your Drop-off Location by sharing a WhatsApp Location Pin OR typing your City and District name:",
            nextFlow: flow, nextStep: step, sessionData: data,
          };
        }
        if (!loc.coords && loc.text) {
          const resolved = await resolveLocationCoords(loc);
          if (resolved) loc.coords = resolved;
        }
        data.dropoff_text = loc.text;
        data.dropoff_coords = loc.coords;
        return {
          replyText: "Please type the list of items to be delivered.",
          nextFlow: flow, nextStep: "DELIVERY_ITEMS", sessionData: data,
        };
      }

      case "DELIVERY_ITEMS": {
        if (!trimmed || trimmed.length < 2) {
          return {
            replyText: "⚠️ Please type the list of items to be delivered:",
            nextFlow: flow, nextStep: step, sessionData: data,
          };
        }
        data.delivery_items = trimmed;

        // Calculate Distance
        let distanceKm = 10;
        let distanceText = "10.0 km";
        try {
          const pickupLoc: LocationInput = { text: data.pickup_text, coords: data.pickup_coords };
          const dropoffLoc: LocationInput = { text: data.dropoff_text, coords: data.dropoff_coords };
          if (!data.pickup_coords) {
            const resolvedPickup = await resolveLocationCoords(pickupLoc);
            if (resolvedPickup) data.pickup_coords = resolvedPickup;
          }
          if (!data.dropoff_coords) {
            const resolvedDropoff = await resolveLocationCoords(dropoffLoc);
            if (resolvedDropoff) data.dropoff_coords = resolvedDropoff;
          }
          const distResult = await getGoogleMapsDistance(pickupLoc, dropoffLoc);
          distanceKm = distResult.distanceKm;
          distanceText = distResult.distanceText;
        } catch (err) {
          console.warn("Delivery Distance Matrix fallback:", err);
        }

        // Delivery is calculated as One-Way
        const fareResult: FareCalculationResult = calculateFare(
          distanceKm,
          distanceText,
          data.vehicle_key || "car",
          "one_way",
          pricingSettings
        );

        data.distance_km = fareResult.distanceKm;
        data.distance_text = fareResult.distanceText;
        data.base_price = fareResult.basePrice;
        data.per_km_rate = fareResult.perKmRate;
        data.coverage_km = fareResult.coverageKm;
        data.gross_fare = fareResult.grossFare;
        data.discount_amount = 0;
        data.total_fare = fareResult.totalFare;

        const pickupMapLink = buildGoogleMapsLink(data.pickup_text, data.pickup_coords);
        const dropoffMapLink = buildGoogleMapsLink(data.dropoff_text, data.dropoff_coords);

        const pickupDisplay = data.pickup_text?.includes("maps.google") || data.pickup_text?.includes("google.com/maps")
          ? data.pickup_text
          : (pickupMapLink ? `${data.pickup_text}\n🗺️ *Pickup Map:* ${pickupMapLink}` : data.pickup_text);

        const dropoffDisplay = data.dropoff_text?.includes("maps.google") || data.dropoff_text?.includes("google.com/maps")
          ? data.dropoff_text
          : (dropoffMapLink ? `${data.dropoff_text}\n🗺️ *Drop-off Map:* ${dropoffMapLink}` : data.dropoff_text);

        const summary = `📦 *DELIVERY SUMMARY*\n━━━━━━━━━━━━━━━━━━━━\n👤 *Name:* ${data.customer_name}\n📱 *Contact:* ${data.customer_phone}\n🚗 *Vehicle:* ${data.vehicle_name}\n📍 *Pickup:* ${pickupDisplay}\n🏁 *Drop-off:* ${dropoffDisplay}\n📦 *Items:* ${data.delivery_items}\n🛣️ *Distance:* ${data.distance_text}\n💰 *Final Price:* ${formatLKR(data.total_fare)}\n━━━━━━━━━━━━━━━━━━━━\n\nPlease confirm your booking (Yes/No).`;

        return {
          replyText: summary,
          nextFlow: flow, nextStep: "DELIVERY_CONFIRM", sessionData: data,
        };
      }

      case "DELIVERY_CONFIRM": {
        if (lower === "yes" || lower === "y" || lower === "confirm") {
          const orderCode = generateOrderCode();
          data.order_code = orderCode;

          // 1. Save order in central_cab.orders
          await saveOrderToDatabase(supabase, userId, "delivery", data);

          // 2. Alert Admin & Broadcast to Driver Groups
          await broadcastBooking(
            supabaseUrl,
            supabaseServiceKey,
            sessionApiKey,
            orderCode,
            "Delivery",
            data,
            systemSettings
          );

          const pickupMapLink = buildGoogleMapsLink(data.pickup_text, data.pickup_coords);
          const confirmPickup = data.pickup_text?.includes("maps.google") || data.pickup_text?.includes("google.com/maps")
            ? data.pickup_text
            : (pickupMapLink ? `${data.pickup_text}\n🗺️ *Pickup Map:* ${pickupMapLink}` : data.pickup_text);

          return {
            replyText: `We will notify you when a driver is assigned.\nYour Order ID is *${orderCode}*.\n📍 *Pickup:* ${confirmPickup}`,
            nextFlow: "IDLE", nextStep: "WELCOME", sessionData: {},
          };
        } else if (lower === "no" || lower === "n" || lower === "cancel") {
          return {
            replyText: "❌ Delivery booking cancelled.\n\n" + getWelcomeMessage(),
            nextFlow: "IDLE", nextStep: "WELCOME", sessionData: {},
          };
        } else {
          return {
            replyText: "⚠️ Please reply *Yes* to confirm or *No* to cancel your booking.",
            nextFlow: flow, nextStep: step, sessionData: data,
          };
        }
      }
    }
  }

  // Fallback
  return {
    replyText: getWelcomeMessage(),
    nextFlow: "IDLE",
    nextStep: "WELCOME",
    sessionData: {},
  };
}

function getWelcomeMessage(): string {
  return "Welcome to Ceylon Central Cabs & Delivery.\n\nPress 1 for Transport (Cabs)\nPress 2 for Delivery";
}

async function saveOrderToDatabase(supabase: any, userId: string, serviceType: string, data: any) {
  try {
    const { error } = await supabase
      .schema("central_cab")
      .from("orders")
      .insert({
        order_code: data.order_code,
        user_id: userId,
        service_type: serviceType,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        customer_whatsapp: data.customer_whatsapp || data.customer_phone,
        vehicle_type: data.vehicle_name || data.vehicle_key,
        pickup_address: data.pickup_text,
        pickup_coords: data.pickup_coords ? JSON.stringify(data.pickup_coords) : null,
        dropoff_address: data.dropoff_text,
        dropoff_coords: data.dropoff_coords ? JSON.stringify(data.dropoff_coords) : null,
        trip_type: data.trip_type || "one_way",
        delivery_items: data.delivery_items || null,
        distance_km: data.distance_km || 0,
        base_price: data.base_price || 0,
        per_km_rate: data.per_km_rate || 0,
        coverage_km: data.coverage_km || 0,
        discount_percentage: data.discount_amount > 0 ? (data.trip_type === "round_trip" ? 15 : 0) : 0,
        total_fare: data.total_fare || 0,
        status: "pending",
      });

    if (error) {
      console.error("[saveOrderToDatabase] Database error:", error);
    }
  } catch (err) {
    console.error("[saveOrderToDatabase] Exception:", err);
  }
}

async function broadcastBooking(
  supabaseUrl: string,
  supabaseServiceKey: string,
  sessionApiKey: string,
  orderCode: string,
  category: string,
  data: any,
  systemSettings: CabSystemSettings
) {
  const isDelivery = category.toLowerCase() === "delivery";
  
  const pickupMapLink = buildGoogleMapsLink(data.pickup_text, data.pickup_coords);
  const dropoffMapLink = buildGoogleMapsLink(data.dropoff_text, data.dropoff_coords);

  const pickupDisplay = data.pickup_text?.includes("maps.google") || data.pickup_text?.includes("google.com/maps")
    ? data.pickup_text
    : (pickupMapLink ? `${data.pickup_text}\n🗺️ *Pickup Map:* ${pickupMapLink}` : data.pickup_text);

  const dropoffDisplay = data.dropoff_text?.includes("maps.google") || data.dropoff_text?.includes("google.com/maps")
    ? data.dropoff_text
    : (dropoffMapLink ? `${data.dropoff_text}\n🗺️ *Drop-off Map:* ${dropoffMapLink}` : data.dropoff_text);

  const contactLine = data.customer_phone && data.customer_whatsapp && data.customer_phone !== data.customer_whatsapp
    ? `📱 *WhatsApp:* ${data.customer_whatsapp}\n📞 *Call Contact:* ${data.customer_phone}`
    : `📱 *Contact:* ${data.customer_phone || data.customer_whatsapp}`;

  const broadcastText = `🚖 *NEW ${category.toUpperCase()} BOOKING: ${orderCode}*\n━━━━━━━━━━━━━━━━━━━━\n👤 *Customer:* ${data.customer_name}\n${contactLine}\n🚗 *Vehicle:* ${data.vehicle_name}\n📍 *Pickup:* ${pickupDisplay}\n🏁 *Drop-off:* ${dropoffDisplay}\n${isDelivery ? `📦 *Items:* ${data.delivery_items}\n` : `🔄 *Trip:* ${data.trip_type === "round_trip" ? "Round Trip (Up & Down)" : "One-Way"}\n`}🛣️ *Distance:* ${data.distance_text}\n💰 *Estimated Fare:* ${formatLKR(data.total_fare)}\n━━━━━━━━━━━━━━━━━━━━\n📌 10% commission applies to this ride.`;

  // 1. Send to Admin WhatsApp Number
  const adminPhone = systemSettings?.admin_whatsapp_number;
  if (adminPhone) {
    console.log(`[Broadcast] Sending new booking alert to Admin: ${adminPhone}`);
    await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-central_cab`, {
      method: "POST",
      headers: { Authorization: `Bearer ${supabaseServiceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: adminPhone, message: broadcastText, sessionApiKey }),
    }).catch(err => console.error("Admin alert failed:", err));
  }

  // 2. Broadcast to all Target Driver Groups
  const groups = systemSettings?.target_driver_groups || [];
  for (const group of groups) {
    if (group.chat_id) {
      console.log(`[Broadcast] Broadcasting order ${orderCode} to group: ${group.name} (${group.chat_id})`);
      await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-central_cab`, {
        method: "POST",
        headers: { Authorization: `Bearer ${supabaseServiceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ to: group.chat_id, message: broadcastText, sessionApiKey }),
      }).catch(err => console.error(`Group broadcast failed (${group.chat_id}):`, err));
    }
  }
}
