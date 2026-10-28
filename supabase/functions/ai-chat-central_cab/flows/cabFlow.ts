// ============================================================================
// Central Cabs - Category Sub-File: Transport Flow (Cab / Hire / Ride)
// Handles "Ride Now" (immediate) & "Schedule Ride" (advance reservation)
// ============================================================================

import {
  getGoogleMapsDistance,
  calculateFare,
  normalizeVehicleKey,
  getVehicleDisplayName,
  PricingSettings,
  VehicleModel,
  LocationInput,
  FareCalculationResult,
  buildGoogleMapsLink,
  formatLocationDisplay,
  resolveLocationCoords,
} from "../pricingEngine.ts";
import { CabSystemSettings } from "../adminHandler.ts";
import {
  SupportedLanguage,
  isAffirmativeInput,
  isNegativeInput,
  isHomeOrResetInput,
  isTimingNowChoice,
  isTimingScheduleChoice,
  getCategoryPoll,
  getVehiclePoll,
  getVehicleModelPoll,
  getTripTypePoll,
  getBookingConfirmPoll,
  getBookingConfirmManualPrompt,
  getPostBookingPoll,
  getStepPromptText,
  getBookingSummaryCard,
  getBookingSuccessMessage,
} from "../i18n.ts";
import { extractNaturalDate, extractNaturalTime } from "./dateExtractor.ts";
import { StepProcessResult } from "./types.ts";

export async function handleCabFlowStep(
  supabase: any,
  supabaseUrl: string,
  supabaseServiceKey: string,
  userId: string,
  phoneNumber: string,
  trimmed: string,
  messageType: string,
  rawPayload: any,
  step: string,
  data: any,
  lang: SupportedLanguage,
  pricingSettings: PricingSettings,
  systemSettings: CabSystemSettings,
  sessionApiKey: string,
  invalidFallback: (prompt: string, poll?: any) => Promise<StepProcessResult>
): Promise<StepProcessResult> {
  const lower = trimmed.toLowerCase();

  switch (step) {
    case "CAB_TIMING_CHOICE": {
      if (isTimingNowChoice(trimmed)) {
        data.booking_type = "now";
        data.scheduled_time = "Immediate / Now";
        return {
          replyText: getStepPromptText("CAB_FLOW", "CAB_NAME", lang),
          nextFlow: "CAB_FLOW",
          nextStep: "CAB_NAME",
          sessionData: data,
        };
      } else if (isTimingScheduleChoice(trimmed)) {
        data.booking_type = "schedule";
        return {
          replyText: getStepPromptText("CAB_FLOW", "CAB_SCHEDULE_DATE", lang),
          nextFlow: "CAB_FLOW",
          nextStep: "CAB_SCHEDULE_DATE",
          sessionData: data,
        };
      } else {
        return await invalidFallback(
          getStepPromptText("CAB_FLOW", "CAB_TIMING_CHOICE", lang)
        );
      }
    }

    case "CAB_SCHEDULE_DATE": {
      if (!trimmed || trimmed.length < 2) {
        return await invalidFallback(getStepPromptText("CAB_FLOW", "CAB_SCHEDULE_DATE", lang));
      }

      // Code-based Date Extraction (Uses "/" as separator)
      const dateParsed = extractNaturalDate(trimmed);
      const timeParsed = extractNaturalTime(trimmed);

      if (dateParsed.isRecognized && timeParsed.isRecognized) {
        data.booking_type = "schedule";
        data.schedule_date = dateParsed.formatted;
        data.schedule_time_only = timeParsed.formatted;
        data.scheduled_time = `${dateParsed.formatted} at ${timeParsed.formatted}`;
        data.raw_scheduled_time = trimmed;
        const confirmPrefix = lang === "ta"
          ? `✅ உங்கள் பயணம் *${data.scheduled_time}* நேரத்திற்கு முன்பதிவு செய்யப்பட்டது.\n\n`
          : (lang === "si"
            ? `✅ ඔබගේ Ride එක *${data.scheduled_time}* වේලාවට Schedule කරන ලදී.\n\n`
            : `✅ Your ride is scheduled for *${data.scheduled_time}*.\n\n`);

        return {
          replyText: confirmPrefix + getStepPromptText("CAB_FLOW", "CAB_NAME", lang),
          nextFlow: "CAB_FLOW",
          nextStep: "CAB_NAME",
          sessionData: data,
        };
      }

      data.booking_type = "schedule";
      data.schedule_date = dateParsed.formatted;
      data.raw_schedule_date = trimmed;

      const datePrefix = lang === "ta"
        ? `✅ திகதி: *${dateParsed.formatted}*\n\n`
        : (lang === "si"
          ? `✅ දිනය: *${dateParsed.formatted}*\n\n`
          : `✅ Date: *${dateParsed.formatted}*\n\n`);

      return {
        replyText: datePrefix + getStepPromptText("CAB_FLOW", "CAB_SCHEDULE_TIME", lang),
        nextFlow: "CAB_FLOW",
        nextStep: "CAB_SCHEDULE_TIME",
        sessionData: data,
      };
    }

    case "CAB_SCHEDULE_TIME": {
      if (!trimmed || trimmed.length < 1) {
        return await invalidFallback(getStepPromptText("CAB_FLOW", "CAB_SCHEDULE_TIME", lang));
      }
      const timeParsed = extractNaturalTime(trimmed);
      const datePart = data.schedule_date || "Scheduled Ride";
      data.booking_type = "schedule";
      data.schedule_time_only = timeParsed.formatted;
      data.scheduled_time = timeParsed.isRecognized
        ? `${datePart} at ${timeParsed.formatted}`
        : `${datePart} at ${trimmed}`;
      data.raw_scheduled_time = trimmed;

      const confirmPrefix = lang === "ta"
        ? `✅ உங்கள் பயணம் *${data.scheduled_time}* நேரத்திற்கு முன்பதிவு செய்யப்பட்டது.\n\n`
        : (lang === "si"
          ? `✅ ඔබගේ Ride එක *${data.scheduled_time}* වේලාවට Schedule කරන ලදී.\n\n`
          : `✅ Your ride is scheduled for *${data.scheduled_time}*.\n\n`);

      return {
        replyText: confirmPrefix + getStepPromptText("CAB_FLOW", "CAB_NAME", lang),
        nextFlow: "CAB_FLOW",
        nextStep: "CAB_NAME",
        sessionData: data,
      };
    }

    case "CAB_NAME": {
      if (!trimmed || trimmed.length < 2) {
        return await invalidFallback(getStepPromptText("CAB_FLOW", "CAB_NAME", lang));
      }
      data.customer_name = trimmed;
      return {
        replyText: getStepPromptText("CAB_FLOW", "CAB_PHONE", lang),
        nextFlow: "CAB_FLOW",
        nextStep: "CAB_PHONE",
        sessionData: data,
      };
    }

    case "CAB_PHONE": {
      let digits = trimmed.replace(/\D/g, "");
      if (digits.length < 9) {
        const phoneErr = lang === "ta"
          ? "⚠️ தயவுசெய்து சரியான தொடர்பு இலக்கத்தை உள்ளிடவும் (உதாரணம்: 0771234567):"
          : (lang === "si"
            ? "⚠️ කරුණාකර නිවැරදි Contact Number එකක් ඇතුළත් කරන්න (උදා: 0771234567):"
            : "⚠️ Please enter a valid contact phone number (e.g. 0771234567):");
        return await invalidFallback(phoneErr);
      }
      if (digits.startsWith("0") && digits.length === 10) {
        digits = "94" + digits.slice(1);
      } else if (digits.length === 9 && digits.startsWith("7")) {
        digits = "94" + digits;
      }
      data.customer_phone = digits;
      data.customer_whatsapp = phoneNumber;
      const bookingType = data.booking_type || "now";
      return {
        replyText: getStepPromptText("CAB_FLOW", "CAB_VEHICLE", lang),
        poll: getVehiclePoll(lang, false, bookingType),
        nextFlow: "CAB_FLOW",
        nextStep: "CAB_VEHICLE",
        sessionData: data,
      };
    }

    case "CAB_VEHICLE": {
      const bookingType = data.booking_type || "now";
      const isRideNow = bookingType === "now";
      const vehicleKey = normalizeVehicleKey(trimmed, bookingType);

      if (!vehicleKey) {
        return await invalidFallback(
          getStepPromptText("CAB_FLOW", "CAB_VEHICLE", lang),
          getVehiclePoll(lang, false, bookingType)
        );
      }

      // 1. Ride Now: Only allow motorbike or three_wheeler
      if (isRideNow && vehicleKey !== "motorbike" && vehicleKey !== "three_wheeler") {
        const rideNowErr = lang === "ta"
          ? "⚠️ உடனடி சவாரிக்கு (Ride Now) Motorbike அல்லது Three-wheeler மட்டுமே தெரிவு செய்ய முடியும். Car அல்லது Van முன்பதிவு செய்ய Schedule Ride-ஐப் பயன்படுத்தவும்.\n\nதயவுசெய்து வாகனத்தைத் தேர்ந்தெடுக்கவும்:"
          : (lang === "si"
            ? "⚠️ Ride Now සඳහා Motorbike හෝ Three-wheeler පමණක් තෝරාගත හැක. Car හෝ Van සඳහා Schedule Ride තෝරන්න.\n\nකරුණාකර වාහනය තෝරන්න:"
            : "⚠️ For Ride Now, only Motorbike or Three-wheeler can be selected. For Car or Van, please choose Schedule Ride.\n\nPlease select your vehicle:");
        return await invalidFallback(
          rideNowErr,
          getVehiclePoll(lang, false, bookingType)
        );
      }

      // 2. Schedule Ride: Only allow car, van, lorry, bus
      if (!isRideNow && (vehicleKey === "motorbike" || vehicleKey === "three_wheeler")) {
        const scheduleErr = lang === "ta"
          ? "⚠️ முன்பதிவு சவாரிக்கு (Schedule Ride) Car, Van, Lorry அல்லது Bus மட்டுமே தெரிவு செய்ய முடியும்.\n\nதயவுசெய்து வாகனத்தைத் தேர்ந்தெடுக்கவும்:"
          : (lang === "si"
            ? "⚠️ Schedule Ride සඳහා Car, Van, Lorry හෝ Bus පමණක් තෝරාගත හැක.\n\nකරුණාකර වාහනය තෝරන්න:"
            : "⚠️ For Schedule Ride, please select Car, Van, Lorry, or Bus.\n\nPlease choose your vehicle:");
        return await invalidFallback(
          scheduleErr,
          getVehiclePoll(lang, false, bookingType)
        );
      }

      data.vehicle_key = vehicleKey;

      // Check if this category has specific models configured for Schedule Ride
      if (!isRideNow) {
        const availableModels: VehicleModel[] = pricingSettings[vehicleKey]?.models || [];
        if (availableModels.length > 0) {
          const modelPoll = getVehicleModelPoll(vehicleKey, availableModels, lang);
          const promptText = lang === "ta"
            ? `தயவுசெய்து நீங்கள் விரும்பும் *${getVehicleDisplayName(vehicleKey)}* மாடலைத் தேர்ந்தெடுக்கவும்:`
            : (lang === "si"
              ? `කරුණාකර ඔබ කැමති *${getVehicleDisplayName(vehicleKey)}* මාදිලිය තෝරන්න:`
              : `Please choose your preferred *${getVehicleDisplayName(vehicleKey)}* model:`);

          return {
            replyText: promptText,
            poll: modelPoll,
            sendTextWithPoll: true,
            nextFlow: "CAB_FLOW",
            nextStep: "CAB_MODEL",
            sessionData: data,
          };
        }
      }

      data.vehicle_name = getVehicleDisplayName(vehicleKey);
      return {
        replyText: getStepPromptText("CAB_FLOW", "CAB_PICKUP", lang),
        nextFlow: "CAB_FLOW",
        nextStep: "CAB_PICKUP",
        sessionData: data,
      };
    }

    case "CAB_MODEL": {
      const vehicleKey = data.vehicle_key || "car";
      const availableModels: VehicleModel[] = pricingSettings[vehicleKey]?.models || [];

      let matchedModel: VehicleModel | null = null;

      // 1. Try matching menu digit prefix (e.g. "1", "1.", "1)")
      const numMatch = trimmed.match(/^(\d+)(?:\.|\)|\s|$)/);
      if (numMatch) {
        const idx = parseInt(numMatch[1], 10) - 1;
        if (idx >= 0 && idx < availableModels.length) {
          matchedModel = availableModels[idx];
        }
      }

      // 2. Try matching by model name (e.g. "Alto", "Wagon R", "Prius", "KDH")
      if (!matchedModel) {
        const lowerInput = trimmed.toLowerCase();
        matchedModel = availableModels.find((m) =>
          lowerInput.includes(m.name.toLowerCase()) ||
          m.name.toLowerCase().includes(lowerInput)
        ) || null;
      }

      if (!matchedModel) {
        return await invalidFallback(
          lang === "ta"
            ? "⚠️ தயவுசெய்து கீழே உள்ள மாடல்களில் ஒன்றைத் தேர்ந்தெடுக்கவும்:"
            : (lang === "si"
              ? "⚠️ කරුණාකර පහත දැක්වෙන මාදිලි වලින් එකක් තෝරන්න:"
              : "⚠️ Please choose one of the models listed below:"),
          getVehicleModelPoll(vehicleKey, availableModels, lang)
        );
      }

      data.vehicle_model = matchedModel;
      data.vehicle_name = `${getVehicleDisplayName(vehicleKey)} (${matchedModel.name}${matchedModel.description ? ` - ${matchedModel.description}` : ""})`;

      return {
        replyText: getStepPromptText("CAB_FLOW", "CAB_PICKUP", lang),
        nextFlow: "CAB_FLOW",
        nextStep: "CAB_PICKUP",
        sessionData: data,
      };
    }

    case "CAB_PICKUP": {
      const loc = extractLocation(trimmed, rawPayload);
      if (!loc.text && !loc.coords) {
        return await invalidFallback(getStepPromptText("CAB_FLOW", "CAB_PICKUP", lang));
      }
      if (!loc.coords && loc.text) {
        const resolved = await resolveLocationCoords(loc);
        if (resolved) loc.coords = resolved;
      }
      data.pickup_text = loc.text;
      data.pickup_coords = loc.coords;
      return {
        replyText: getStepPromptText("CAB_FLOW", "CAB_DROPOFF", lang),
        nextFlow: "CAB_FLOW",
        nextStep: "CAB_DROPOFF",
        sessionData: data,
      };
    }

    case "CAB_DROPOFF": {
      const loc = extractLocation(trimmed, rawPayload);
      if (!loc.text && !loc.coords) {
        return await invalidFallback(getStepPromptText("CAB_FLOW", "CAB_DROPOFF", lang));
      }
      if (!loc.coords && loc.text) {
        const resolved = await resolveLocationCoords(loc);
        if (resolved) loc.coords = resolved;
      }
      data.dropoff_text = loc.text;
      data.dropoff_coords = loc.coords;

      return {
        replyText: getStepPromptText("CAB_FLOW", "CAB_TRIP_TYPE", lang),
        poll: getTripTypePoll(lang),
        nextFlow: "CAB_FLOW",
        nextStep: "CAB_TRIP_TYPE",
        sessionData: data,
      };
    }

    case "CAB_TRIP_TYPE": {
      let tripType: "one_way" | "round_trip" | null = null;
      if (
        trimmed === "1" ||
        lower.startsWith("1.") ||
        lower.startsWith("1 ") ||
        lower.includes("one-way") ||
        lower.includes("one way") ||
        lower.includes("single")
      ) {
        tripType = "one_way";
      } else if (
        trimmed === "2" ||
        lower.startsWith("2.") ||
        lower.startsWith("2 ") ||
        lower.includes("round") ||
        lower.includes("up & down") ||
        lower.includes("two")
      ) {
        tripType = "round_trip";
      }

      if (!tripType) {
        return await invalidFallback(
          getStepPromptText("CAB_FLOW", "CAB_TRIP_TYPE", lang),
          getTripTypePoll(lang)
        );
      }

      data.trip_type = tripType;

      // Distance via Google Maps API
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

      // Calculate Fare
      const fareResult: FareCalculationResult = calculateFare(
        distanceKm,
        distanceText,
        data.vehicle_key || "car",
        tripType,
        pricingSettings,
        data.vehicle_model
      );

      data.distance_km = fareResult.distanceKm;
      data.distance_text = fareResult.distanceText;
      data.base_price = fareResult.basePrice;
      data.per_km_rate = fareResult.perKmRate;
      data.coverage_km = fareResult.coverageKm;
      data.gross_fare = fareResult.grossFare;
      data.discount_amount = fareResult.discountAmount;
      data.total_fare = fareResult.totalFare;

      const summary = getBookingSummaryCard(data, lang, false);

      return {
        replyText: summary,
        nextFlow: "CAB_FLOW",
        nextStep: "CAB_CONFIRM",
        sessionData: data,
      };
    }

    case "CAB_CONFIRM": {
      if (isAffirmativeInput(trimmed)) {
        const orderCode = await generateOrderCode(supabase, userId, "transport");
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

        return {
          replyText: getBookingSuccessMessage(orderCode, lang),
          poll: getPostBookingPoll(lang),
          sendTextWithPoll: true,
          nextFlow: "IDLE",
          nextStep: "BOOKING_COMPLETED",
          sessionData: { language: lang, last_order_code: orderCode },
        };
      } else if (isNegativeInput(trimmed)) {
        const cancelMsg = lang === "ta"
          ? "❌ முன்பதிவு ரத்து செய்யப்பட்டது.\n\n"
          : (lang === "si" ? "❌ Booking එක Cancel කරන ලදී.\n\n" : "❌ Booking cancelled.\n\n");
        return {
          replyText: cancelMsg + getStepPromptText("IDLE", "CATEGORY_CHOICE", lang),
          poll: getCategoryPoll(lang),
          nextFlow: "IDLE",
          nextStep: "CATEGORY_CHOICE",
          sessionData: { language: lang },
        };
      } else if (isHomeOrResetInput(trimmed)) {
        const homeMsg = lang === "ta"
          ? "🏠 முதன்மைப் பக்கத்திற்குத் திரும்பியது.\n\n"
          : (lang === "si" ? "🏠 ප්‍රධාන මෙනුවට පැමිණියා.\n\n" : "🏠 Returned to Main Menu.\n\n");
        return {
          replyText: homeMsg + getStepPromptText("IDLE", "CATEGORY_CHOICE", lang),
          poll: getCategoryPoll(lang),
          nextFlow: "IDLE",
          nextStep: "CATEGORY_CHOICE",
          sessionData: { language: lang },
        };
      } else {
        return await invalidFallback(
          getStepPromptText("CAB_FLOW", "CAB_CONFIRM", lang)
        );
      }
    }

    default: {
      return {
        replyText: getStepPromptText("CAB_FLOW", "CAB_NAME", lang),
        nextFlow: "CAB_FLOW",
        nextStep: "CAB_NAME",
        sessionData: data,
      };
    }
  }
}

export function extractLocation(
  text: string,
  rawPayload: any
): { text: string; coords?: { lat: number; lng: number } } {
  const locDetails = rawPayload?.locationDetails;
  if (locDetails && locDetails.latitude && locDetails.longitude) {
    const lat = Number(locDetails.latitude);
    const lng = Number(locDetails.longitude);
    const name = locDetails.name || locDetails.address || "";
    const cleanText = name ? `${name} (${lat.toFixed(4)}, ${lng.toFixed(4)})` : `Pin Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    return { text: cleanText, coords: { lat, lng } };
  }

  const cleanText = (text || "").trim();
  const urlMatch = cleanText.match(/https?:\/\/(?:maps\.google\.com|goo\.gl|maps\.app\.goo\.gl)\/[^\s]+/i);
  if (urlMatch) {
    return { text: cleanText };
  }

  const coordMatch = cleanText.match(/([-+]?\d{1,2}\.\d+)\s*,\s*([-+]?\d{1,3}\.\d+)/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    return { text: `GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`, coords: { lat, lng } };
  }

  return { text: cleanText };
}

export async function generateOrderCode(
  supabase?: any,
  userId?: string,
  category = "transport"
): Promise<string> {
  const cat = (category || "").toLowerCase();
  let prefix = "HIR";
  if (cat.includes("delivery")) {
    prefix = "DEL";
  } else if (cat.includes("rent")) {
    prefix = "RNT";
  }

  if (supabase) {
    try {
      const { data, error } = await supabase
        .schema("central_cab")
        .from("orders")
        .select("order_code")
        .ilike("order_code", `${prefix}%`);

      if (!error && Array.isArray(data)) {
        let maxNum = 0;
        for (const row of data) {
          const match = String(row.order_code || "").match(/\d+/);
          if (match) {
            const val = parseInt(match[0], 10);
            if (!isNaN(val) && val > maxNum) {
              maxNum = val;
            }
          }
        }
        const nextNum = maxNum + 1;
        const padded = String(nextNum).padStart(3, "0");
        return `${prefix} ${padded}`;
      }
    } catch (err) {
      console.error("[generateOrderCode] Error fetching order sequence:", err);
    }
  }

  return `${prefix} 001`;
}

export function formatLKR(val?: number): string {
  if (typeof val !== "number") return "LKR 0";
  return `LKR ${val.toLocaleString("en-LK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export async function saveOrderToDatabase(
  supabase: any,
  userId: string,
  serviceType: string,
  data: any
) {
  try {
    const pickupDisplay = data.pickup_coords
      ? (data.pickup_text?.includes(data.pickup_coords.lat.toFixed(4))
          ? data.pickup_text
          : `${data.pickup_text || "Pickup Point"} (${data.pickup_coords.lat.toFixed(4)}, ${data.pickup_coords.lng.toFixed(4)})`)
      : (data.pickup_text || "Pickup Point");

    const dropoffDisplay = data.dropoff_coords
      ? (data.dropoff_text?.includes(data.dropoff_coords.lat.toFixed(4))
          ? data.dropoff_text
          : `${data.dropoff_text || "Dropoff Point"} (${data.dropoff_coords.lat.toFixed(4)}, ${data.dropoff_coords.lng.toFixed(4)})`)
      : (data.dropoff_text || "Dropoff Point");

    const { error } = await supabase
      .schema("central_cab")
      .from("orders")
      .insert({
        order_code: data.order_code,
        user_id: userId,
        service_type: serviceType,
        booking_type: data.booking_type || "now",
        scheduled_time: data.scheduled_time || null,
        special_instructions: data.booking_type === "schedule" && data.scheduled_time
          ? `[Scheduled: ${data.scheduled_time}]`
          : null,
        customer_name: data.customer_name || "Customer",
        customer_phone: data.customer_phone || "",
        whatsapp_phone: data.customer_whatsapp || data.customer_phone || "",
        vehicle_type: data.vehicle_name || data.vehicle_key || "Car",
        pickup_address: pickupDisplay,
        dropoff_address: dropoffDisplay,
        pickup_coords: data.pickup_coords || null,
        dropoff_coords: data.dropoff_coords || null,
        trip_type: data.trip_type || (serviceType === "delivery" ? "one_way" : "one_way"),
        distance_km: data.distance_km || 0,
        base_price: data.base_price || 0,
        per_km_rate: data.per_km_rate || 0,
        coverage_km: data.coverage_km || 0,
        discount_percentage: data.discount_percentage || 0,
        total_fare: data.total_fare || 0,
        total_amount: data.total_fare || 0,
        delivery_items: data.delivery_items || null,
        status: "pending",
        custom_fields: {
          raw_data: data,
          language: data.language || "si",
          created_via: "whatsapp_bot",
        },
      });

    if (error) {
      console.error("[saveOrderToDatabase] Error inserting order:", error);
      if (error.code === "23505") {
        const retryCode = await generateOrderCode(supabase, userId, serviceType);
        console.log(`[saveOrderToDatabase] Retrying with fresh code: ${retryCode}`);
        data.order_code = retryCode;
        const { error: retryErr } = await supabase
          .schema("central_cab")
          .from("orders")
          .insert({
            order_code: retryCode,
            user_id: userId,
            service_type: serviceType,
            booking_type: data.booking_type || "now",
            scheduled_time: data.scheduled_time || null,
            special_instructions: data.booking_type === "schedule" && data.scheduled_time
              ? `[Scheduled: ${data.scheduled_time}]`
              : null,
            customer_name: data.customer_name || "Customer",
            customer_phone: data.customer_phone || "",
            whatsapp_phone: data.customer_whatsapp || data.customer_phone || "",
            vehicle_type: data.vehicle_name || data.vehicle_key || "Car",
            pickup_address: pickupDisplay,
            dropoff_address: dropoffDisplay,
            pickup_coords: data.pickup_coords || null,
            dropoff_coords: data.dropoff_coords || null,
            trip_type: data.trip_type || (serviceType === "delivery" ? "one_way" : "one_way"),
            distance_km: data.distance_km || 0,
            base_price: data.base_price || 0,
            per_km_rate: data.per_km_rate || 0,
            coverage_km: data.coverage_km || 0,
            discount_percentage: data.discount_percentage || 0,
            total_fare: data.total_fare || 0,
            total_amount: data.total_fare || 0,
            delivery_items: data.delivery_items || null,
            status: "pending",
            custom_fields: {
              raw_data: data,
              language: data.language || "si",
              created_via: "whatsapp_bot",
            },
          });
        if (retryErr) {
          console.error("[saveOrderToDatabase] Retry insert failed:", retryErr);
        } else {
          console.log(`[saveOrderToDatabase] ✅ Successfully saved order on retry: ${retryCode}`);
        }
      }
    } else {
      console.log(`[saveOrderToDatabase] ✅ Successfully saved order ${data.order_code}`);
    }
  } catch (err) {
    console.error("[saveOrderToDatabase] Exception:", err);
  }
}

export async function broadcastBooking(
  supabaseUrl: string,
  supabaseServiceKey: string,
  sessionApiKey: string,
  orderCode: string,
  category: string,
  data: any,
  systemSettings: CabSystemSettings
) {
  try {
    const pickupDisplay = formatLocationDisplay(data.pickup_text, data.pickup_coords);
    const dropoffDisplay = formatLocationDisplay(data.dropoff_text, data.dropoff_coords);

    const contactLine = data.customer_whatsapp && data.customer_whatsapp !== data.customer_phone
      ? `📱 *WhatsApp:* ${data.customer_whatsapp}\n📞 *Call Contact:* ${data.customer_phone}`
      : `📱 *Contact:* ${data.customer_phone || data.customer_whatsapp}`;

    const isDelivery = category.toLowerCase() === "delivery";
    const isRent = category.toLowerCase().includes("rent");
    const isScheduled = data.booking_type === "schedule" && data.scheduled_time;
    const timingHeader = isScheduled ? `📅 *SCHEDULED FOR:* ${data.scheduled_time}\n` : (isRent ? "" : `⚡ *RIDE NOW*\n`);

    // Group broadcast text (All in 100% clean English with guaranteed Google Maps links)
    // Customer phone numbers are NEVER sent to driver/rider groups. Admin contact numbers are displayed instead.
    let groupBroadcastText = "";
    if (isRent) {
      const rentLocationText = data.rent_location || data.pickup_text || "N/A";
      const rentDisplay = formatLocationDisplay(rentLocationText, data.pickup_coords);
      const rentAdminPhone = (systemSettings?.rent_admin_number || systemSettings?.admin_whatsapp_number || "").trim() || "Admin Office";
      groupBroadcastText = `🚗 *NEW RENT A CAR INQUIRY: ${orderCode}*\n━━━━━━━━━━━━━━━━━━━━\n👤 *Customer:* ${data.customer_name || "Customer"}\n📞 *Contact (Admin):* ${rentAdminPhone}\n🚗 *Category:* ${data.rent_vehicle_category || "Car"}\n🚘 *Model Preference:* ${data.rent_model || "Any Model"}\n⏱️ *Duration:* ${data.rent_duration || "1 Day"}\n📍 *Location:*\n${rentDisplay}\n━━━━━━━━━━━━━━━━━━━━\n📌 10% commission applies to this rental.`;
    } else if (isDelivery) {
      const dropoffLoc = data.delivery_location || data.dropoff_address || data.dropoff_text || "Customer Location";
      const dropoffDisplay = formatLocationDisplay(dropoffLoc, data.dropoff_coords);
      const deliveryAdminPhone = (systemSettings?.delivery_admin_number || systemSettings?.admin_whatsapp_number || "").trim() || "Admin Office";
      groupBroadcastText = `📦 *NEW DELIVERY ORDER: ${orderCode}*\n━━━━━━━━━━━━━━━━━━━━\n📂 *Category:* ${data.delivery_category || "General Items"}\n📝 *Products:* ${data.delivery_products || data.delivery_items || "Package"}\n📍 *Customer Delivery Location:*\n${dropoffDisplay}\n📞 *Contact (Admin):* ${deliveryAdminPhone}\n🌐 *Website:* www.centralonline.lk`;
    } else {
      // Group broadcast for Transport / Hire / Cab: Contact number is the Service Admin's number (NOT customer phone)
      const isRideNow = data.booking_type === "now";
      const transportAdminPhone = (!isRideNow && systemSettings?.hire_admin_number
        ? systemSettings.hire_admin_number
        : (systemSettings?.admin_whatsapp_number || systemSettings?.hire_admin_number || "")
      ).trim() || "Admin Office";
      const groupContactLine = `📞 *Contact (Admin):* ${transportAdminPhone}`;

      groupBroadcastText = `🚖 *NEW TRANSPORT BOOKING: ${orderCode}*\n━━━━━━━━━━━━━━━━━━━━\n${timingHeader}👤 *Customer:* ${data.customer_name}\n${groupContactLine}\n🚗 *Vehicle:* ${data.vehicle_name}\n📍 *Pickup Location:*\n${pickupDisplay}\n🏁 *Drop-off Location:*\n${dropoffDisplay}\n🔄 *Trip Type:* ${data.trip_type === "round_trip" ? "Round Trip (Up & Down)" : "One-Way"}\n🛣️ *Distance:* ${data.distance_text}\n💰 *Estimated Fare:* ${formatLKR(data.total_fare)}\n━━━━━━━━━━━━━━━━━━━━\n📌 10% commission applies to this ride.`;
    }

    // Admin broadcast text (Includes customer phone for direct follow-up)
    let adminBroadcastText = "";
    if (isRent) {
      const rentLocationText = data.rent_location || data.pickup_text || "N/A";
      const rentDisplay = formatLocationDisplay(rentLocationText, data.pickup_coords);
      adminBroadcastText = `🚗 *NEW RENT A CAR INQUIRY: ${orderCode}*\n━━━━━━━━━━━━━━━━━━━━\n👤 *Customer:* ${data.customer_name || "Customer"}\n📱 *Contact Phone:* ${data.customer_phone || "N/A"}\n💬 *WhatsApp:* ${data.customer_whatsapp || data.customer_phone || "N/A"}\n🚗 *Category:* ${data.rent_vehicle_category || "Car"}\n🚘 *Model Preference:* ${data.rent_model || "Any Model"}\n⏱️ *Duration:* ${data.rent_duration || "1 Day"}\n📍 *Location:*\n${rentDisplay}\n━━━━━━━━━━━━━━━━━━━━`;
    } else if (isDelivery) {
      const dropoffLoc = data.delivery_location || data.dropoff_address || data.dropoff_text || "Customer Location";
      adminBroadcastText = `📦 *NEW DELIVERY ORDER: ${orderCode}*\n━━━━━━━━━━━━━━━━━━━━\n📂 *Category:* ${data.delivery_category || "General Items"}\n📝 *Products:* ${data.delivery_products || data.delivery_items || "Package"}\n📍 *Customer Delivery Location:*\n${dropoffDisplay}\n📱 *Customer Contact:* ${data.customer_phone || "N/A"}\n💬 *Customer WhatsApp:* ${data.customer_whatsapp || data.customer_phone || "N/A"}\n🌐 *Website:* www.centralonline.lk\n━━━━━━━━━━━━━━━━━━━━\n💡 *Order Confirmation Steps:*\n1️⃣ Reply with Order ID: *${orderCode}*\n2️⃣ Then send the Shop Pickup Location (Location Pin 📍 or Address)`;
    } else {
      // Transport: Admin receives full customer phone and whatsapp details
      adminBroadcastText = `🚖 *NEW TRANSPORT BOOKING: ${orderCode}*\n━━━━━━━━━━━━━━━━━━━━\n${timingHeader}👤 *Customer:* ${data.customer_name}\n${contactLine}\n🚗 *Vehicle:* ${data.vehicle_name}\n📍 *Pickup Location:*\n${pickupDisplay}\n🏁 *Drop-off Location:*\n${dropoffDisplay}\n🔄 *Trip Type:* ${data.trip_type === "round_trip" ? "Round Trip (Up & Down)" : "One-Way"}\n🛣️ *Distance:* ${data.distance_text}\n💰 *Estimated Fare:* ${formatLKR(data.total_fare)}\n━━━━━━━━━━━━━━━━━━━━\n💡 Reply with *CONFIRM ${orderCode}* or *${orderCode}* and send Driver Voice Note to assign driver.`;
    }

    // 1. Send to Admin WhatsApp Numbers (Main Admin + Dedicated Service Admin)
    const adminRecipients = new Set<string>();
    if (systemSettings?.admin_whatsapp_number) {
      adminRecipients.add(systemSettings.admin_whatsapp_number.trim());
    }
    if (isRent && systemSettings?.rent_admin_number) {
      adminRecipients.add(systemSettings.rent_admin_number.trim());
    } else if (isDelivery && systemSettings?.delivery_admin_number) {
      adminRecipients.add(systemSettings.delivery_admin_number.trim());
    } else if (!isRent && !isDelivery && systemSettings?.hire_admin_number) {
      adminRecipients.add(systemSettings.hire_admin_number.trim());
    }

    for (const adminPhone of adminRecipients) {
      if (adminPhone) {
        console.log(`[broadcastBooking] Sending booking alert to Admin: ${adminPhone}`);
        fetch(`${supabaseUrl}/functions/v1/send-whatsapp-central_cab`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: adminPhone,
            message: adminBroadcastText,
            sessionApiKey,
          }),
        }).catch(err => console.error(`Admin dispatch to ${adminPhone} failed:`, err));
      }
    }

    // 2. Broadcast to Driver Groups
    const catLower = (category || "").toLowerCase();
    let driverGroups: any[] = [];

    if (catLower.includes("rent")) {
      driverGroups = systemSettings?.rent_a_car_groups?.length
        ? systemSettings.rent_a_car_groups
        : systemSettings?.target_driver_groups || [];
    } else if (catLower.includes("delivery")) {
      driverGroups = systemSettings?.delivery_driver_groups?.length
        ? systemSettings.delivery_driver_groups
        : systemSettings?.target_driver_groups || [];
    } else {
      // Default Transport / Hire cab
      driverGroups = systemSettings?.hire_driver_groups?.length
        ? systemSettings.hire_driver_groups
        : systemSettings?.target_driver_groups || [];
    }

    const delaySec = Math.max(1, Number(systemSettings?.broadcast_delay_seconds || 2));

    for (let i = 0; i < driverGroups.length; i++) {
      const group = driverGroups[i];
      // CRITICAL: Must use group.chat_id (e.g. 120363412586001913@g.us) for WhatsApp groups
      const targetChatId = group.chat_id || (group.id?.includes("@g.us") ? group.id : null);

      if (targetChatId) {
        if (i > 0 && delaySec > 0) {
          await new Promise((resolve) => setTimeout(resolve, delaySec * 1000));
        }
        console.log(`[broadcastBooking] Forwarding order ${orderCode} to driver group: ${group.name} (${targetChatId})`);
        fetch(`${supabaseUrl}/functions/v1/send-whatsapp-central_cab`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: targetChatId,
            message: groupBroadcastText,
            sessionApiKey,
          }),
        }).catch(err => console.error(`Group dispatch ${group.name} (${targetChatId}) failed:`, err));
      } else {
        console.warn(`[broadcastBooking] Skipping group ${group.name}: No valid chat_id found!`, group);
      }
    }
  } catch (broadcastErr) {
    console.error("[broadcastBooking] Error broadcasting booking:", broadcastErr);
  }
}

