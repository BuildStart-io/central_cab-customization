// ============================================================================
// Central Cabs - Category Sub-File: Delivery Flow
// Handles parcel / item delivery with Categories, Specific Products, Phone,
// Current Delivery Location Pin/Text, Summary, and Confirmation
// ============================================================================

import {
  SupportedLanguage,
  isAffirmativeInput,
  isNegativeInput,
  isHomeOrResetInput,
  getLanguagePoll,
  getCategoryPoll,
  getBookingConfirmPoll,
  getPostBookingPoll,
  getStepPromptText,
  getBookingSuccessMessage,
  getDeliveryCategoryPoll,
  detectDeliveryCategory,
  getDeliveryVehiclePoll,
  detectDeliveryVehicle,
  getDeliveryOrderSummaryCard,
  getLocationRejectMessage,
} from "../i18n.ts";
import { CabSystemSettings } from "../adminHandler.ts";
import { PricingSettings, resolveLocationCoords, isValidLocationInput } from "../pricingEngine.ts";
import { StepProcessResult } from "./types.ts";
import {
  extractLocation,
  generateOrderCode,
  saveOrderToDatabase,
  broadcastBooking,
  runInBackground,
} from "./cabFlow.ts";

export async function handleDeliveryFlowStep(
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
  switch (step) {
    // ------------------------------------------------------------------------
    // Step 1: Product Category Selection
    // ------------------------------------------------------------------------
    case "DELIVERY_CATEGORY": {
      const detectedCat = detectDeliveryCategory(trimmed);
      if (!detectedCat && (!trimmed || trimmed.length < 2)) {
        return await invalidFallback(
          getStepPromptText("DELIVERY_FLOW", "DELIVERY_CATEGORY", lang),
          getDeliveryCategoryPoll(lang)
        );
      }

      data.service_type = "delivery";
      data.delivery_category = detectedCat || trimmed;

      return {
        replyText: getStepPromptText("DELIVERY_FLOW", "DELIVERY_ITEMS", lang),
        nextFlow: "DELIVERY_FLOW",
        nextStep: "DELIVERY_ITEMS",
        sessionData: data,
      };
    }

    // ------------------------------------------------------------------------
    // Step 2: Specific Products / Items / Quantities
    // ------------------------------------------------------------------------
    case "DELIVERY_ITEMS": {
      if (!trimmed || trimmed.length < 2) {
        return await invalidFallback(getStepPromptText("DELIVERY_FLOW", "DELIVERY_ITEMS", lang));
      }

      if (!data.delivery_category) {
        data.delivery_category = lang === "en" ? "Food & Items" : "ආහාර පාන සහ භාණ්ඩ";
      }

      data.delivery_products = trimmed;
      data.delivery_items = trimmed;

      return {
        replyText: getStepPromptText("DELIVERY_FLOW", "DELIVERY_VEHICLE", lang),
        poll: getDeliveryVehiclePoll(lang),
        sendTextWithPoll: true,
        nextFlow: "DELIVERY_FLOW",
        nextStep: "DELIVERY_VEHICLE",
        sessionData: data,
      };
    }

    // ------------------------------------------------------------------------
    // Step 2b: Delivery Vehicle Selection (Motorbike vs Three-wheeler)
    // ------------------------------------------------------------------------
    case "DELIVERY_VEHICLE": {
      const detected = detectDeliveryVehicle(trimmed);
      if (!detected) {
        return await invalidFallback(
          getStepPromptText("DELIVERY_FLOW", "DELIVERY_VEHICLE", lang),
          getDeliveryVehiclePoll(lang)
        );
      }

      data.vehicle_key = detected.key;
      data.vehicle_name = detected.name;

      return {
        replyText: getStepPromptText("DELIVERY_FLOW", "DELIVERY_PHONE", lang),
        nextFlow: "DELIVERY_FLOW",
        nextStep: "DELIVERY_PHONE",
        sessionData: data,
      };
    }

    // ------------------------------------------------------------------------
    // Step 3: WhatsApp / Contact Phone Number
    // ------------------------------------------------------------------------
    case "DELIVERY_PHONE": {
      let digits = trimmed.replace(/\D/g, "");
      if (digits.length < 9) {
        const phoneErr = lang === "en"
          ? "⚠️ Please enter a valid contact WhatsApp or phone number (e.g. 0771234567):"
          : "⚠️ කරුණාකර නිවැරදි Contact WhatsApp හෝ දුරකථන අංකයක් ඇතුළත් කරන්න (උදා: 0771234567):";
        return await invalidFallback(phoneErr);
      }
      if (digits.startsWith("0") && digits.length === 10) {
        digits = "94" + digits.slice(1);
      } else if (digits.length === 9 && digits.startsWith("7")) {
        digits = "94" + digits;
      }
      data.customer_phone = digits;
      data.customer_whatsapp = phoneNumber || digits;

      return {
        replyText: getStepPromptText("DELIVERY_FLOW", "DELIVERY_DISTRICT_VILLAGE", lang),
        nextFlow: "DELIVERY_FLOW",
        nextStep: "DELIVERY_DISTRICT_VILLAGE",
        sessionData: data,
      };
    }

    // ------------------------------------------------------------------------
    // Step 3b: Delivery District & Village / City
    // ------------------------------------------------------------------------
    case "DELIVERY_DISTRICT_VILLAGE": {
      // 1. If user sent a WhatsApp Location Pin or Google Maps Link directly, accept as delivery location
      if (isValidLocationInput(trimmed, rawPayload)) {
        const loc = extractLocation(trimmed, rawPayload);
        if (!loc.coords && loc.text) {
          const resolved = await resolveLocationCoords(loc, "dropoff");
          if (resolved) loc.coords = resolved;
        }

        const locDisplay = loc.text || (loc.coords ? `${loc.coords.lat}, ${loc.coords.lng}` : trimmed);
        data.delivery_location = locDisplay;
        data.dropoff_address = locDisplay;
        data.dropoff_text = locDisplay;
        data.dropoff_coords = loc.coords;
        data.district_village = loc.text || "Location Pin";
        data.district = loc.text || "Location Pin";
        data.pickup_address = "Pending Shop Pickup Assignment";
        data.pickup_text = "Pending Shop Pickup Assignment";
        data.vehicle_name = data.vehicle_name || "Motorbike 🏍️";
        data.vehicle_key = data.vehicle_key || "motorbike";

        const summary = getDeliveryOrderSummaryCard(data, lang);

        return {
          replyText: summary,
          poll: getBookingConfirmPoll(lang),
          sendTextWithPoll: true,
          nextFlow: "DELIVERY_FLOW",
          nextStep: "DELIVERY_CONFIRM",
          sessionData: data,
        };
      }

      // 2. Normal text response with District and Village
      data.district_village = trimmed;
      const parts = trimmed.split(/,|\n|-|\//).map((s: string) => s.trim()).filter(Boolean);
      data.district = parts[0] || trimmed;

      return {
        replyText: getStepPromptText("DELIVERY_FLOW", "DELIVERY_LOCATION", lang),
        nextFlow: "DELIVERY_FLOW",
        nextStep: "DELIVERY_LOCATION",
        sessionData: data,
      };
    }

    // ------------------------------------------------------------------------
    // Step 4: Current / Delivery Drop-off Location
    // ------------------------------------------------------------------------
    case "DELIVERY_LOCATION": {
      // Must be a valid WhatsApp Location Pin, Google Maps Link, or GPS Coordinates (NO plain text names)
      if (!isValidLocationInput(trimmed, rawPayload)) {
        return await invalidFallback(getLocationRejectMessage(lang, "delivery"));
      }

      const loc = extractLocation(trimmed, rawPayload);
      if (!loc.coords && loc.text) {
        const resolved = await resolveLocationCoords(loc, "dropoff");
        if (resolved) loc.coords = resolved;
      }

      const locDisplay = loc.text || (loc.coords ? `${loc.coords.lat}, ${loc.coords.lng}` : trimmed);
      data.delivery_location = locDisplay;
      data.dropoff_address = locDisplay;
      data.dropoff_text = locDisplay;
      data.dropoff_coords = loc.coords;
      data.pickup_address = "Pending Shop Pickup Assignment";
      data.pickup_text = "Pending Shop Pickup Assignment";
      data.vehicle_name = data.vehicle_name || "Motorbike 🏍️";
      data.vehicle_key = data.vehicle_key || "motorbike";

      const summary = getDeliveryOrderSummaryCard(data, lang);

      return {
        replyText: summary,
        poll: getBookingConfirmPoll(lang),
        sendTextWithPoll: true,
        nextFlow: "DELIVERY_FLOW",
        nextStep: "DELIVERY_CONFIRM",
        sessionData: data,
      };
    }

    // ------------------------------------------------------------------------
    // Step 5: Confirm or Cancel Order (Yes / No / Home)
    // ------------------------------------------------------------------------
    case "DELIVERY_CONFIRM": {
      if (isAffirmativeInput(trimmed)) {
        if (data.order_code) {
          console.warn(`[DELIVERY_CONFIRM] Order ${data.order_code} already created for this session, returning existing confirmation.`);
          return {
            replyText: getBookingSuccessMessage(data.order_code, lang, "delivery"),
            poll: getPostBookingPoll(lang),
            sendTextWithPoll: true,
            nextFlow: "IDLE",
            nextStep: "BOOKING_COMPLETED",
            sessionData: { language: lang, last_order_code: data.order_code },
          };
        }

        const orderCode = await generateOrderCode(supabase, userId, "delivery");
        data.order_code = orderCode;

        // Immediately update session in DB so concurrent requests see BOOKING_COMPLETED
        await supabase
          .schema("central_cab")
          .from("bot_sessions")
          .upsert({
            phone_number: phoneNumber,
            user_id: userId,
            flow_type: "IDLE",
            current_step: "BOOKING_COMPLETED",
            session_data: { language: lang, last_order_code: orderCode },
            last_interaction: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        // 1. Save order in central_cab.orders
        await saveOrderToDatabase(supabase, userId, "delivery", data);

        // 2. Alert Delivery Admin & Broadcast to Delivery Shop Group in background
        runInBackground(
          broadcastBooking(
            supabaseUrl,
            supabaseServiceKey,
            sessionApiKey,
            orderCode,
            "Delivery",
            data,
            systemSettings,
            userId
          )
        );

        return {
          replyText: getBookingSuccessMessage(orderCode, lang, "delivery"),
          poll: getPostBookingPoll(lang),
          sendTextWithPoll: true,
          nextFlow: "IDLE",
          nextStep: "BOOKING_COMPLETED",
          sessionData: { language: lang, last_order_code: orderCode },
        };
      } else if (isNegativeInput(trimmed)) {
        const cancelMsg = lang === "en" ? "❌ Delivery booking cancelled.\n\n" : "❌ Delivery booking එක Cancel කරන ලදී.\n\n";
        return {
          replyText: cancelMsg + getStepPromptText("IDLE", "CATEGORY_CHOICE", lang),
          poll: getCategoryPoll(lang),
          nextFlow: "IDLE",
          nextStep: "CATEGORY_CHOICE",
          sessionData: { language: lang },
        };
      } else if (isHomeOrResetInput(trimmed, "DELIVERY_CONFIRM")) {
        return {
          replyText: "Please choose your preferred language / කරුණාකර ඔබගේ භාෂාව තෝරන්න:",
          poll: getLanguagePoll(),
          sendTextWithPoll: true,
          nextFlow: "IDLE",
          nextStep: "LANGUAGE_CHOICE",
          sessionData: {},
        };
      } else {
        return await invalidFallback(
          getStepPromptText("DELIVERY_FLOW", "DELIVERY_CONFIRM", lang),
          getBookingConfirmPoll(lang)
        );
      }
    }

    // ------------------------------------------------------------------------
    // Default fallback: Start at DELIVERY_ITEMS
    // ------------------------------------------------------------------------
    default: {
      if (!data.delivery_category) {
        data.delivery_category = lang === "en" ? "Food & Items" : "ආහාර පාන සහ භාණ්ඩ";
      }
      return {
        replyText: getStepPromptText("DELIVERY_FLOW", "DELIVERY_ITEMS", lang),
        nextFlow: "DELIVERY_FLOW",
        nextStep: "DELIVERY_ITEMS",
        sessionData: data,
      };
    }
  }
}
