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
  getCategoryPoll,
  getBookingConfirmPoll,
  getPostBookingPoll,
  getStepPromptText,
  getBookingSuccessMessage,
  getDeliveryCategoryPoll,
  detectDeliveryCategory,
  getDeliveryOrderSummaryCard,
} from "../i18n.ts";
import { CabSystemSettings } from "../adminHandler.ts";
import { PricingSettings, resolveLocationCoords } from "../pricingEngine.ts";
import { StepProcessResult } from "./types.ts";
import {
  extractLocation,
  generateOrderCode,
  saveOrderToDatabase,
  broadcastBooking,
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

      data.delivery_products = trimmed;
      data.delivery_items = trimmed;

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
        const phoneErr = lang === "ta"
          ? "⚠️ தயவுசெய்து சரியான தொடர்பு WhatsApp அல்லது தொலைபேசி இலக்கத்தை உள்ளிடவும் (உதாரணம்: 0771234567):"
          : (lang === "si"
            ? "⚠️ කරුණාකර නිවැරදි Contact WhatsApp හෝ දුරකථන අංකයක් ඇතුළත් කරන්න (උදා: 0771234567):"
            : "⚠️ Please enter a valid contact WhatsApp or phone number (e.g. 0771234567):");
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
      const loc = extractLocation(trimmed, rawPayload);
      if (!loc.text && !loc.coords) {
        return await invalidFallback(getStepPromptText("DELIVERY_FLOW", "DELIVERY_LOCATION", lang));
      }
      if (!loc.coords && loc.text) {
        const resolved = await resolveLocationCoords(loc);
        if (resolved) loc.coords = resolved;
      }

      const locDisplay = loc.text || (loc.coords ? `${loc.coords.lat}, ${loc.coords.lng}` : trimmed);
      data.delivery_location = locDisplay;
      data.dropoff_address = locDisplay;
      data.dropoff_text = locDisplay;
      data.dropoff_coords = loc.coords;
      data.pickup_address = "Pending Shop Pickup Assignment";
      data.pickup_text = "Pending Shop Pickup Assignment";
      data.vehicle_name = "Motorbike / Delivery Rider";
      data.vehicle_key = "motorbike";

      const summary = getDeliveryOrderSummaryCard(data, lang);

      return {
        replyText: summary,
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
        const orderCode = await generateOrderCode(supabase, userId, "delivery");
        data.order_code = orderCode;

        // 1. Save order in central_cab.orders
        await saveOrderToDatabase(supabase, userId, "delivery", data);

        // 2. Alert Delivery Admin & Broadcast to Delivery Shop Group
        await broadcastBooking(
          supabaseUrl,
          supabaseServiceKey,
          sessionApiKey,
          orderCode,
          "Delivery",
          data,
          systemSettings
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
        const cancelMsg = lang === "ta"
          ? "❌ டெலிவரி முன்பதிவு ரத்து செய்யப்பட்டது.\n\n"
          : (lang === "si" ? "❌ Delivery booking එක Cancel කරන ලදී.\n\n" : "❌ Delivery booking cancelled.\n\n");
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
          getStepPromptText("DELIVERY_FLOW", "DELIVERY_CONFIRM", lang)
        );
      }
    }

    // ------------------------------------------------------------------------
    // Default fallback: Start at DELIVERY_CATEGORY
    // ------------------------------------------------------------------------
    default: {
      return {
        replyText: getStepPromptText("DELIVERY_FLOW", "DELIVERY_CATEGORY", lang),
        poll: getDeliveryCategoryPoll(lang),
        sendTextWithPoll: true,
        nextFlow: "DELIVERY_FLOW",
        nextStep: "DELIVERY_CATEGORY",
        sessionData: data,
      };
    }
  }
}
