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

function isPossibleQuestion(text: string): boolean {
  const lower = text.toLowerCase();
  if (lower.includes("?")) return true;
  
  const engWords = [
    "price", "how much", "rate", "cost", "charge",
    "keeyada", "kiyada", "gaana", "gani", "mudal",
    "thiyenawada", "puluwanda", "koheda", "wisthara", "visthara", "detail",
    "ac", "aircon", "van ekak", "car ekak", "bus ekak",
    "what", "how", "when", "where", "why", "can you", "do you", "cancel", "epa",
    "wrong", "incorrect", "distance", "location", "pila", "waradi", "dura", "weradi"
  ];
  
  const sinWords = ["මිල", "කීයද", "ගාණ", "කොහෙද", "තියෙනවද", "පුළුවන්ද", "විස්තර", "වැරදි", "දුර"];

  if (text.includes("http://") || text.includes("https://")) return false;
  if (text.length > 100) return true;

  for (const w of engWords) {
    const regex = new RegExp(`\\b${w.replace(/\//g, "\\/")}\\b`);
    if (regex.test(lower)) return true;
  }
  
  for (const w of sinWords) {
    if (lower.includes(w)) return true;
  }
  
  return false;
}

function getCurrentStepPrompt(flow: string, step: string): string {
  if (flow === "CAB_FLOW") {
    switch (step) {
      case "CAB_NAME": return "කරුණාකර ඔබගේ නම ඇතුළත් කරන්න:";
      case "CAB_PHONE": return "කරුණාකර ඔබගේ Contact Number එක ලබා දෙන්න:";
      case "CAB_VEHICLE": return "කරුණාකර ඔබට අවශ්‍ය වාහනය තෝරන්න:\n\n1. Motorbike 🏍️\n2. Three-wheeler 🛺\n3. Car 🚗\n4. Van 🚐\n5. Lorry 🚚\n6. Bus 🚌";
      case "CAB_PICKUP": return "කරුණාකර ඔබගේ Live/Current location එක WhatsApp හරහා share කරන්න. ඔබට එය share කිරීමට අපහසු නම්, කරුණාකර ඔබගේ ළඟම ඇති නගරය සහ දිස්ත්‍රික්කය Type කරන්න:";
      case "CAB_DROPOFF": return "කරුණාකර ඔබගේ Drop-off location එක WhatsApp හරහා share කරන්න හෝ ඔබගේ ළඟම ඇති නගරය සහ දිස්ත්‍රික්කය Type කරන්න:";
      case "CAB_TRIP_TYPE": return "මෙය One-Way ගමනක් ද නැතහොත් Round Trip (Up & Down) ගමනක් ද?\n\n1. One-Way\n2. Round Trip";
      case "CAB_CONFIRM": return "කරුණාකර Booking එක Confirm කිරීමට *Yes* ලෙස හෝ Cancel කිරීමට *No* ලෙස Reply කරන්න.";
    }
  } else if (flow === "DELIVERY_FLOW") {
    switch (step) {
      case "DELIVERY_NAME": return "කරුණාකර ඔබගේ නම ඇතුළත් කරන්න:";
      case "DELIVERY_PHONE": return "කරුණාකර ඔබගේ Contact Number එක ලබා දෙන්න:";
      case "DELIVERY_VEHICLE": return "කරුණාකර ඔබට අවශ්‍ය වාහනය තෝරන්න:\n\n1. Motorbike 🏍️\n2. Three-wheeler 🛺";
      case "DELIVERY_PICKUP": return "කරුණාකර ඔබගේ Live/Current location එක WhatsApp හරහා share කරන්න. ඔබට එය share කිරීමට අපහසු නම්, කරුණාකර ඔබගේ ළඟම ඇති නගරය සහ දිස්ත්‍රික්කය Type කරන්න:";
      case "DELIVERY_DROPOFF": return "කරුණාකර ඔබගේ Drop-off location එක WhatsApp හරහා share කරන්න හෝ ඔබගේ ළඟම ඇති නගරය සහ දිස්ත්‍රික්කය Type කරන්න:";
      case "DELIVERY_ITEMS": return "කරුණාකර Delivery කළ යුතු භාණ්ඩ ලැයිස්තුව Type කරන්න:";
      case "DELIVERY_CONFIRM": return "කරුණාකර Booking එක Confirm කිරීමට *Yes* ලෙස හෝ Cancel කිරීමට *No* ලෙස Reply කරන්න.";
    }
  }
  return "කරුණාකර ඔබගේ පිළිතුර ලබා දෙන්න.";
}

export interface BotSessionState {
  phone_number: string;
  user_id: string;
  flow_type: "IDLE" | "CAB_FLOW" | "DELIVERY_FLOW" | "ADMIN_FLOW" | "CANCEL_FLOW";
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
  
  // Search aggressively for location data in common webhook formats
  const loc = p.location || 
              p.locationMessage || 
              p.message?.locationMessage || 
              p.data?.location ||
              rawPayload?.locationDetails || 
              p._data?.location ||
              p._data || 
              p;

  const lat = loc?.latitude || loc?.degreesLatitude || loc?.lat || p.lat || p.latitude;
  const lng = loc?.longitude || loc?.degreesLongitude || loc?.lng || p.lng || p.longitude;

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
  if (cleanText.startsWith("/9j/") || cleanText.startsWith("data:image") || (!cleanText.includes("http") && cleanText.length > 300)) {
    cleanText = "Shared Location Pin";
  }

  return { text: cleanText };
}


async function handleAiFallback(
  supabase: any,
  userId: string,
  userMessage: string,
  fallbackErrorPrompt: string,
  pricingSettings: PricingSettings
): Promise<string> {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  const aiGenerateUrl = Deno.env.get("AI_GENERATE_URL");
  const botApiKey = Deno.env.get("BOT_API_KEY");

  if (!lovableApiKey && !(aiGenerateUrl && botApiKey)) {
    return "NOT_A_QUESTION";
  }

  // 1. Fetch FAQs
  const { data: faqs } = await supabase
    .schema("central_cab")
    .from("faqs")
    .select("question, answer")
    .eq("is_active", true)
    .eq("user_id", userId);

  const faqText = (faqs || []).map((f: any) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");

  const pricingContext = `
Motorbike: LKR ${pricingSettings.motorbike.per_km_rate}/km (Base: LKR ${pricingSettings.motorbike.base_price})
Three-wheeler: LKR ${pricingSettings.three_wheeler.per_km_rate}/km (Base: LKR ${pricingSettings.three_wheeler.base_price})
Car: LKR ${pricingSettings.car.per_km_rate}/km (Base: LKR ${pricingSettings.car.base_price})
Van: LKR ${pricingSettings.van.per_km_rate}/km (Base: LKR ${pricingSettings.van.base_price})
Lorry: LKR ${pricingSettings.lorry.per_km_rate}/km (Base: LKR ${pricingSettings.lorry.base_price})
Bus: LKR ${pricingSettings.bus.per_km_rate}/km (Base: LKR ${pricingSettings.bus.base_price})
`;

  const systemPrompt = `You are a strict, hallucination-free assistant for Ceylon Central Cabs. 
The user is currently in the middle of a booking flow. Instead of answering the system's question, they said: "${userMessage}"

Your job is to determine if the user is asking a valid question that can be answered ONLY using the provided FAQs or Pricing Details below.

PRICING DETAILS:
${pricingContext}

FAQs:
${faqText || "No FAQs available"}

RULES:
1. If the user's message is a clear question that can be answered by the Pricing Details or FAQs, answer it briefly in 1-2 sentences.
2. If the user asks something outside of the provided FAQs/Pricing, DO NOT guess or hallucinate. You MUST reply exactly with: "Sorry, I don't have that information."
3. CRITICAL CANCEL INTENT: If the user's message indicates ANY intention to cancel, abort, stop, or inquire about cancelling their booking (e.g., "cancel", "cancel panna ealuma", "epa", "cancel karanna", "I don't want it", "cancel booking"), regardless of the language (English, Sinhala, Tamil, or Tanglish/Singlish), you MUST reply EXACTLY with the text: "INTENT_CANCEL_ORDER".
4. If the user complains that the "pickup location", "dropoff location", "distance", or "price" is incorrect or wrong (e.g., "distance is wrong", "wrong location", "not 180km", "location pila"), you MUST reply EXACTLY with the text: "INTENT_WRONG_LOCATION".
5. If the user's message is NOT a question (e.g. it's just an answer to a booking step like a name, location, or 'yes'/'no'), you MUST reply exactly with the text: "NOT_A_QUESTION".
6. CRITICAL LANGUAGE RULE: If you provide an answer, you MUST write your AI answer in conversational Sinhala using Sinhala script.
7. If you provide an answer or say "Sorry, I don't have that information.", you MUST append the original system prompt exactly as provided below at the very end of your response, separated by two newlines.

SYSTEM PROMPT TO APPEND:
${fallbackErrorPrompt}`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage }
  ];

  const MODEL = "google/gemini-3-flash-preview";
  const MAX_TOKENS = 250;

  try {
    let aiResponse: Response;
    if (aiGenerateUrl && botApiKey) {
      aiResponse = await fetch(aiGenerateUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bot-key": botApiKey },
        body: JSON.stringify({ messages, model: MODEL, maxTokens: MAX_TOKENS }),
      });
    } else {
      aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL, messages, max_tokens: MAX_TOKENS }),
      });
    }

    if (!aiResponse.ok) return fallbackErrorPrompt;

    const aiData = await aiResponse.json();
    const responseText = aiData.text || aiData.choices?.[0]?.message?.content;
    
    if (responseText && responseText.trim()) {
      return responseText.trim();
    }
  } catch (err) {
    console.error("AI Fallback Error:", err);
  }

  return "NOT_A_QUESTION";
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

  // 1. Check for Cancel Command First (Fast Path)
  const isCancelCommand = lower.includes("cancel") || lower.includes("epa") || lower === "cancel order" || lower === "cancel booking";

  if (isCancelCommand) {
    return await startCancelFlow(supabase, userId, phoneNumber, session.current_step);
  }

  // 1.5. Global Reset Commands (excluding cancel)
  if (["reset", "start", "menu", "restart", "hi", "hello"].includes(lower) && session.current_step !== "WELCOME") {
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

  // 1.8. Global Question Interception for Active Flows
  if ((flow === "CAB_FLOW" || flow === "DELIVERY_FLOW") && isPossibleQuestion(trimmed)) {
    const stepPrompt = getCurrentStepPrompt(flow, step);
    const aiReply = await handleAiFallback(supabase, userId, trimmed, stepPrompt, pricingSettings);
    
    if (aiReply.includes("INTENT_CANCEL_ORDER")) {
      return await startCancelFlow(supabase, userId, phoneNumber, step);
    }
    if (aiReply.includes("INTENT_WRONG_LOCATION")) {
      return handleWrongLocationIntent(flow, data);
    }

    if (!aiReply.includes("NOT_A_QUESTION")) {
      return { replyText: aiReply, nextFlow: flow, nextStep: step, sessionData: data };
    }
  }

  const invalidFallback = async (fallbackStr: string) => {
    const aiReply = await handleAiFallback(supabase, userId, trimmed, fallbackStr, pricingSettings);
    
    if (aiReply.includes("INTENT_CANCEL_ORDER")) {
      return await startCancelFlow(supabase, userId, phoneNumber, step);
    }
    if (aiReply.includes("INTENT_WRONG_LOCATION")) {
      return handleWrongLocationIntent(flow, data);
    }

    if (aiReply.includes("NOT_A_QUESTION")) {
      return { replyText: fallbackStr, nextFlow: flow, nextStep: step, sessionData: data };
    }
    return { replyText: aiReply, nextFlow: flow, nextStep: step, sessionData: data };
  };

  // =========================================================================
  // WELCOME / MAIN MENU
  // =========================================================================
  if (step === "WELCOME" || flow === "IDLE") {
    if (trimmed === "1" || lower.includes("transport") || lower.includes("cab")) {
      return {
        replyText: "කරුණාකර ඔබගේ නම ඇතුළත් කරන්න.",
        nextFlow: "CAB_FLOW",
        nextStep: "CAB_NAME",
        sessionData: { customer_whatsapp: phoneNumber },
      };
    } else if (trimmed === "2" || lower.includes("delivery")) {
      return {
        replyText: "කරුණාකර ඔබගේ නම ඇතුළත් කරන්න.",
        nextFlow: "DELIVERY_FLOW",
        nextStep: "DELIVERY_NAME",
        sessionData: { customer_whatsapp: phoneNumber },
      };
    } else {
      const fallbackStr = getWelcomeMessage();
      const aiReply = await handleAiFallback(supabase, userId, trimmed, fallbackStr, pricingSettings);
      
      if (aiReply.includes("INTENT_CANCEL_ORDER")) {
        return await startCancelFlow(supabase, userId, phoneNumber, step);
      }
      if (aiReply.includes("INTENT_WRONG_LOCATION")) {
        return handleWrongLocationIntent(flow, data);
      }
      
      let finalReply = aiReply;
      if (aiReply.includes("NOT_A_QUESTION")) {
        finalReply = fallbackStr;
      }
      
      return {
        replyText: finalReply,
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
          return await invalidFallback("⚠️ කරුණාකර නිවැරදි නමක් ඇතුළත් කරන්න.\n\nකරුණාකර ඔබගේ නම ඇතුළත් කරන්න:");
        }
        data.customer_name = trimmed;
        return {
          replyText: "කරුණාකර ඔබගේ Contact Number එක ලබා දෙන්න.",
          nextFlow: flow, nextStep: "CAB_PHONE", sessionData: data,
        };
      }

      case "CAB_PHONE": {
        let digits = trimmed.replace(/\D/g, "");
        if (digits.length < 9) {
          return await invalidFallback("⚠️ කරුණාකර නිවැරදි Contact Number එකක් ඇතුළත් කරන්න (උදා: 0771234567):");
        }
        if (digits.startsWith("0") && digits.length === 10) {
          digits = "94" + digits.slice(1);
        } else if (digits.length === 9 && digits.startsWith("7")) {
          digits = "94" + digits;
        }
        data.customer_phone = digits;
        return {
          replyText: "කරුණාකර ඔබට අවශ්‍ය වාහනය තෝරන්න:\n\n1. Motorbike 🏍️\n2. Three-wheeler 🛺\n3. Car 🚗\n4. Van 🚐\n5. Lorry 🚚\n6. Bus 🚌\n\n(වාහනයේ නම හෝ අංකය Type කරන්න)",
          nextFlow: flow, nextStep: "CAB_VEHICLE", sessionData: data,
        };
      }

      case "CAB_VEHICLE": {
        const vehicleKey = normalizeVehicleKey(trimmed);
        if (!vehicleKey) {
          return await invalidFallback("⚠️ වැරදි තේරීමක්. කරුණාකර පහත ඒවායින් එකක් තෝරන්න:\n(Motorbike, Three-wheeler, Car, Van, Lorry, Bus)");
        }
        data.vehicle_key = vehicleKey;
        data.vehicle_name = getVehicleDisplayName(vehicleKey);
        return {
          replyText: "කරුණාකර ඔබගේ Live/Current location එක WhatsApp හරහා share කරන්න. ඔබට එය share කිරීමට අපහසු නම්, කරුණාකර ඔබගේ ළඟම ඇති නගරය සහ දිස්ත්‍රික්කය Type කරන්න.",
          nextFlow: flow, nextStep: "CAB_PICKUP", sessionData: data,
        };
      }

      case "CAB_PICKUP": {
        const loc = extractLocation(trimmed, rawPayload);
        if (!loc.text && !loc.coords) {
          return await invalidFallback("⚠️ කරුණාකර WhatsApp Location Pin එකක් Share කිරීමෙන් හෝ ඔබගේ නගරය සහ දිස්ත්‍රික්කය Type කිරීමෙන් Pickup Location එක ලබා දෙන්න:");
        }
        if (!loc.coords && loc.text) {
          const resolved = await resolveLocationCoords(loc);
          if (resolved) loc.coords = resolved;
        }
        data.pickup_text = loc.text;
        data.pickup_coords = loc.coords;
        return {
          replyText: "කරුණාකර ඔබගේ Drop-off location එක WhatsApp හරහා share කරන්න හෝ ඔබගේ ළඟම ඇති නගරය සහ දිස්ත්‍රික්කය Type කරන්න.",
          nextFlow: flow, nextStep: "CAB_DROPOFF", sessionData: data,
        };
      }

      case "CAB_DROPOFF": {
        const loc = extractLocation(trimmed, rawPayload);
        if (!loc.text && !loc.coords) {
          return await invalidFallback("⚠️ කරුණාකර WhatsApp Location Pin එකක් Share කිරීමෙන් හෝ ඔබගේ නගරය සහ දිස්ත්‍රික්කය Type කිරීමෙන් Drop-off Location එක ලබා දෙන්න:");
        }
        if (!loc.coords && loc.text) {
          const resolved = await resolveLocationCoords(loc);
          if (resolved) loc.coords = resolved;
        }
        data.dropoff_text = loc.text;
        data.dropoff_coords = loc.coords;

        return {
          replyText: "මෙය One-Way ගමනක් ද නැතහොත් Round Trip (Up & Down) ගමනක් ද?\n\n1. One-Way\n2. Round Trip",
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
          return await invalidFallback("⚠️ කරුණාකර නිවැරදි Trip Type එකක් තෝරන්න:\n1. One-Way\n2. Round Trip");
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

        const summary = `📋 *BOOKING SUMMARY*\n━━━━━━━━━━━━━━━━━━━━\n👤 *Name:* ${data.customer_name}\n📱 *Contact:* ${data.customer_phone}\n🚗 *Vehicle:* ${data.vehicle_name}\n📍 *Pickup:* ${pickupDisplay}\n🏁 *Drop-off:* ${dropoffDisplay}\n🛣️ *Distance:* ${data.distance_text}\n🔄 *Trip Type:* ${tripType === "round_trip" ? "Round Trip (Up & Down)" : "One-Way"}\n💰 *Final Price:* ${formatLKR(data.total_fare)}${data.discount_amount > 0 ? ` (Includes ${formatLKR(data.discount_amount)} Round Trip Discount)` : ""}\n━━━━━━━━━━━━━━━━━━━━\n\nකරුණාකර ඔබගේ Booking එක Confirm කරන්න (Yes/No).`;

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
            replyText: `Driver කෙනෙක් assign කළ පසු අපි ඔබට දැනුම් දෙන්නෙමු.\nඔබගේ Order ID එක *${orderCode}*.\n📍 *Pickup:* ${confirmPickup}`,
            nextFlow: "IDLE", nextStep: "WELCOME", sessionData: {},
          };
        } else if (lower === "no" || lower === "n" || lower === "cancel") {
          return {
            replyText: "❌ Booking එක Cancel කරන ලදී.\n\n" + getWelcomeMessage(),
            nextFlow: "IDLE", nextStep: "WELCOME", sessionData: {},
          };
        } else {
          return await invalidFallback("⚠️ කරුණාකර Booking එක Confirm කිරීමට *Yes* ලෙස හෝ Cancel කිරීමට *No* ලෙස Reply කරන්න.");
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
          return await invalidFallback("⚠️ කරුණාකර නිවැරදි නමක් ඇතුළත් කරන්න.\n\nකරුණාකර ඔබගේ නම ඇතුළත් කරන්න:");
        }
        data.customer_name = trimmed;
        return {
          replyText: "කරුණාකර ඔබගේ Contact Number එක ලබා දෙන්න.",
          nextFlow: flow, nextStep: "DELIVERY_PHONE", sessionData: data,
        };
      }

      case "DELIVERY_PHONE": {
        let digits = trimmed.replace(/\D/g, "");
        if (digits.length < 9) {
          return await invalidFallback("⚠️ කරුණාකර නිවැරදි Contact Number එකක් ඇතුළත් කරන්න (උදා: 0771234567):");
        }
        if (digits.startsWith("0") && digits.length === 10) {
          digits = "94" + digits.slice(1);
        } else if (digits.length === 9 && digits.startsWith("7")) {
          digits = "94" + digits;
        }
        data.customer_phone = digits;
        return {
          replyText: "කරුණාකර ඔබට අවශ්‍ය වාහනය තෝරන්න:\n\n1. Motorbike 🏍️\n2. Three-wheeler 🛺\n\n(වාහනයේ නම හෝ අංකය Type කරන්න)",
          nextFlow: flow, nextStep: "DELIVERY_VEHICLE", sessionData: data,
        };
      }

      case "DELIVERY_VEHICLE": {
        const vehicleKey = normalizeVehicleKey(trimmed);
        // Delivery constraint: Only Motorbike and Three-wheeler permitted
        if (vehicleKey !== "motorbike" && vehicleKey !== "three_wheeler") {
          return await invalidFallback("⚠️ Delivery පහසුකම ඇත්තේ මේවාට පමණි:\n1. Motorbike 🏍️\n2. Three-wheeler 🛺\n\nකරුණාකර Motorbike හෝ Three-wheeler තෝරන්න:");
        }
        data.vehicle_key = vehicleKey;
        data.vehicle_name = getVehicleDisplayName(vehicleKey);
        return {
          replyText: "කරුණාකර ඔබගේ Live/Current location එක WhatsApp හරහා share කරන්න. ඔබට එය share කිරීමට අපහසු නම්, කරුණාකර ඔබගේ ළඟම ඇති නගරය සහ දිස්ත්‍රික්කය Type කරන්න.",
          nextFlow: flow, nextStep: "DELIVERY_PICKUP", sessionData: data,
        };
      }

      case "DELIVERY_PICKUP": {
        const loc = extractLocation(trimmed, rawPayload);
        if (!loc.text && !loc.coords) {
          return await invalidFallback("⚠️ කරුණාකර WhatsApp Location Pin එකක් Share කිරීමෙන් හෝ ඔබගේ නගරය සහ දිස්ත්‍රික්කය Type කිරීමෙන් Pickup Location එක ලබා දෙන්න:");
        }
        if (!loc.coords && loc.text) {
          const resolved = await resolveLocationCoords(loc);
          if (resolved) loc.coords = resolved;
        }
        data.pickup_text = loc.text;
        data.pickup_coords = loc.coords;
        return {
          replyText: "කරුණාකර ඔබගේ Drop-off location එක WhatsApp හරහා share කරන්න හෝ ඔබගේ ළඟම ඇති නගරය සහ දිස්ත්‍රික්කය Type කරන්න.",
          nextFlow: flow, nextStep: "DELIVERY_DROPOFF", sessionData: data,
        };
      }

      case "DELIVERY_DROPOFF": {
        const loc = extractLocation(trimmed, rawPayload);
        if (!loc.text && !loc.coords) {
          return await invalidFallback("⚠️ කරුණාකර WhatsApp Location Pin එකක් Share කිරීමෙන් හෝ ඔබගේ නගරය සහ දිස්ත්‍රික්කය Type කිරීමෙන් Drop-off Location එක ලබා දෙන්න:");
        }
        if (!loc.coords && loc.text) {
          const resolved = await resolveLocationCoords(loc);
          if (resolved) loc.coords = resolved;
        }
        data.dropoff_text = loc.text;
        data.dropoff_coords = loc.coords;
        return {
          replyText: "කරුණාකර Delivery කළ යුතු භාණ්ඩ ලැයිස්තුව Type කරන්න.",
          nextFlow: flow, nextStep: "DELIVERY_ITEMS", sessionData: data,
        };
      }

      case "DELIVERY_ITEMS": {
        if (!trimmed || trimmed.length < 2) {
          return await invalidFallback("⚠️ කරුණාකර Delivery කළ යුතු භාණ්ඩ ලැයිස්තුව Type කරන්න:");
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

        const summary = `📦 *DELIVERY SUMMARY*\n━━━━━━━━━━━━━━━━━━━━\n👤 *Name:* ${data.customer_name}\n📱 *Contact:* ${data.customer_phone}\n🚗 *Vehicle:* ${data.vehicle_name}\n📍 *Pickup:* ${pickupDisplay}\n🏁 *Drop-off:* ${dropoffDisplay}\n📦 *Items:* ${data.delivery_items}\n🛣️ *Distance:* ${data.distance_text}\n💰 *Final Price:* ${formatLKR(data.total_fare)}\n━━━━━━━━━━━━━━━━━━━━\n\nකරුණාකර ඔබගේ Booking එක Confirm කරන්න (Yes/No).`;

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
            replyText: `Driver කෙනෙක් assign කළ පසු අපි ඔබට දැනුම් දෙන්නෙමු.\nඔබගේ Order ID එක *${orderCode}*.\n📍 *Pickup:* ${confirmPickup}`,
            nextFlow: "IDLE", nextStep: "WELCOME", sessionData: {},
          };
        } else if (lower === "no" || lower === "n" || lower === "cancel") {
          return {
            replyText: "❌ Delivery booking එක Cancel කරන ලදී.\n\n" + getWelcomeMessage(),
            nextFlow: "IDLE", nextStep: "WELCOME", sessionData: {},
          };
        } else {
          return await invalidFallback("⚠️ කරුණාකර Booking එක Confirm කිරීමට *Yes* ලෙස හෝ Cancel කිරීමට *No* ලෙස Reply කරන්න.");
        }
      }
    }
  }

  // =========================================================================
  // FLOW 3: CANCEL
  // =========================================================================
  if (flow === "CANCEL_FLOW") {
    if (step === "CANCEL_CONFIRM") {
      if (lower === "yes" || lower === "y" || lower === "confirm") {
        const orderCode = session.session_data?.target_order_code;
        const serviceType = session.session_data?.service_type || "Booking";

        if (orderCode) {
          await supabase
            .schema("central_cab")
            .from("orders")
            .update({ status: "cancelled" })
            .eq("order_code", orderCode);

          await broadcastCancellation(
            supabaseUrl,
            supabaseServiceKey,
            sessionApiKey,
            orderCode,
            serviceType,
            phoneNumber,
            systemSettings
          );
        }

        return {
          replyText: `✅ ඔබගේ Order එක (*${orderCode || ""}*) සාර්ථකව Cancel කරන ලදී.\n\n` + getWelcomeMessage(),
          nextFlow: "IDLE",
          nextStep: "WELCOME",
          sessionData: {},
        };
      } else if (lower === "no" || lower === "n" || lower === "cancel") {
        return {
          replyText: "Order එක Cancel කිරීම අත්හැර දමන ලදී.\n\n" + getWelcomeMessage(),
          nextFlow: "IDLE",
          nextStep: "WELCOME",
          sessionData: {},
        };
      } else {
        return await invalidFallback("⚠️ කරුණාකර Order එක Cancel කිරීමට *Yes* ලෙස හෝ අත්හැරීමට *No* ලෙස Reply කරන්න.");
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

function handleWrongLocationIntent(flow: string, data: any) {
  if (flow === "IDLE" || flow === "CANCEL_FLOW") {
    return {
      replyText: "ඔබට දැනට Active Booking එකක් නොමැත.\n\n" + getWelcomeMessage(),
      nextFlow: "IDLE",
      nextStep: "WELCOME",
      sessionData: {}
    };
  }

  delete data.pickup_text;
  delete data.pickup_coords;
  delete data.dropoff_text;
  delete data.dropoff_coords;
  delete data.distance_km;
  delete data.distance_text;

  const nextStep = flow === "DELIVERY_FLOW" ? "DELIVERY_PICKUP" : "CAB_PICKUP";
  const reply = "ඔබගේ Location එක හෝ දුර ප්‍රමාණය වැරදි බව අපි හඳුනා ගත්තෙමු. කරුණාකර නැවත ඔබගේ Pickup Location එක නිවැරදිව ලබා දෙන්න:";
  
  return {
    replyText: reply,
    nextFlow: flow,
    nextStep: nextStep,
    sessionData: data
  };
}

function getWelcomeMessage(): string {
  return "Ceylon Central Cabs & Delivery වෙත සාදරයෙන් පිළිගනිමු.\n\nTransport (Cabs) සඳහා 1 ඔබන්න\nDelivery සඳහා 2 ඔබන්න";
}

async function startCancelFlow(supabase: any, userId: string, phoneNumber: string, currentStep: string) {
  const { data: activeOrders } = await supabase
    .schema("central_cab")
    .from("orders")
    .select("order_code, service_type")
    .eq("user_id", userId)
    .eq("customer_phone", phoneNumber)
    .in("status", ["pending", "driver_assigned"])
    .order("created_at", { ascending: false })
    .limit(1);

  if (activeOrders && activeOrders.length > 0) {
    const activeOrder = activeOrders[0];
    return {
      replyText: `ඔබට දැනටමත් Active Order එකක් ඇත (Order ID: *${activeOrder.order_code}*).\nඔබට එය Cancel කිරීමට අවශ්‍යද? (Yes/No)`,
      nextFlow: "CANCEL_FLOW",
      nextStep: "CANCEL_CONFIRM",
      sessionData: { target_order_code: activeOrder.order_code, service_type: activeOrder.service_type },
    };
  } else {
    if (currentStep !== "WELCOME") {
      return {
        replyText: "❌ Flow එක Cancel කරන ලදී.\n\n" + getWelcomeMessage(),
        nextFlow: "IDLE",
        nextStep: "WELCOME",
        sessionData: {},
      };
    } else {
      return {
        replyText: "ඔබට Cancel කිරීමට කිසිදු Active Order එකක් නොමැත.\n\n" + getWelcomeMessage(),
        nextFlow: "IDLE",
        nextStep: "WELCOME",
        sessionData: {},
      };
    }
  }
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

async function broadcastCancellation(
  supabaseUrl: string,
  supabaseServiceKey: string,
  sessionApiKey: string,
  orderCode: string,
  category: string,
  customerPhone: string,
  systemSettings: CabSystemSettings
) {
  const broadcastText = `❌ *ORDER CANCELLED: ${orderCode}*\n━━━━━━━━━━━━━━━━━━━━\n👤 *Customer Contact:* ${customerPhone}\n\n*The customer has cancelled this ${category} booking.*\nDrivers, please DO NOT proceed.`;

  const adminPhone = systemSettings?.admin_whatsapp_number;
  if (adminPhone) {
    await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-central_cab`, {
      method: "POST",
      headers: { Authorization: `Bearer ${supabaseServiceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: adminPhone, message: broadcastText, sessionApiKey }),
    }).catch(err => console.error("Admin cancel alert failed:", err));
  }

  const groups = systemSettings?.target_driver_groups || [];
  for (const group of groups) {
    if (group.chat_id) {
      await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-central_cab`, {
        method: "POST",
        headers: { Authorization: `Bearer ${supabaseServiceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ to: group.chat_id, message: broadcastText, sessionApiKey }),
      }).catch(err => console.error(`Group cancel broadcast failed (${group.chat_id}):`, err));
    }
  }
}
