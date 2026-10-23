// ============================================================================
// Central Cabs - Category Sub-File: Rent a Car Flow
// Handles car/vehicle rental inquiries with step-by-step interactive workflow:
// Vehicle Category Poll -> Customer Name -> Phone Number -> Location ->
// Model Preference -> Rental Duration -> Summary & Confirmation Poll ->
// Group broadcast (without phone) + Admin broadcast (with phone).
// ============================================================================

import { CabSystemSettings } from "../adminHandler.ts";
import {
  SupportedLanguage,
  isAffirmativeInput,
  isNegativeInput,
  getCategoryPoll,
  getBookingConfirmPoll,
  getPostBookingPoll,
  getStepPromptText,
  getBookingSuccessMessage,
  getRentVehiclePoll,
  detectRentVehicleCategory,
  getRentBookingSummaryCard,
} from "../i18n.ts";
import { StepProcessResult } from "./types.ts";
import {
  generateOrderCode,
  saveOrderToDatabase,
  broadcastBooking,
} from "./cabFlow.ts";

export async function handleRentFlowStep(
  supabase: any,
  supabaseUrl: string,
  supabaseServiceKey: string,
  userId: string,
  phoneNumber: string,
  trimmed: string,
  step: string,
  data: any,
  lang: SupportedLanguage,
  systemSettings: CabSystemSettings,
  sessionApiKey: string,
  invalidFallback: (prompt: string, poll?: any) => Promise<StepProcessResult>
): Promise<StepProcessResult> {
  switch (step) {
    // 1. Vehicle Category Selection (Bike / Three-Wheel / Car / Van)
    case "RENT_VEHICLE_CHOICE": {
      const category = detectRentVehicleCategory(trimmed);
      data.rent_vehicle_category = category;
      data.service_type = "rent_a_car";

      return {
        replyText: getStepPromptText("RENT_A_CAR_FLOW", "RENT_NAME", lang),
        nextFlow: "RENT_A_CAR_FLOW",
        nextStep: "RENT_NAME",
        sessionData: data,
      };
    }

    // 2. Customer Name
    case "RENT_NAME": {
      if (!trimmed || trimmed.length < 2) {
        return await invalidFallback(getStepPromptText("RENT_A_CAR_FLOW", "RENT_NAME", lang));
      }
      data.customer_name = trimmed;

      return {
        replyText: getStepPromptText("RENT_A_CAR_FLOW", "RENT_PHONE", lang),
        nextFlow: "RENT_A_CAR_FLOW",
        nextStep: "RENT_PHONE",
        sessionData: data,
      };
    }

    // 3. Contact Phone Number
    case "RENT_PHONE": {
      const cleanInput = (trimmed || "").replace(/[^\d+]/g, "");
      const finalPhone = cleanInput.length >= 7 ? cleanInput : phoneNumber;
      data.customer_phone = finalPhone;
      data.customer_whatsapp = phoneNumber;

      return {
        replyText: getStepPromptText("RENT_A_CAR_FLOW", "RENT_LOCATION", lang),
        nextFlow: "RENT_A_CAR_FLOW",
        nextStep: "RENT_LOCATION",
        sessionData: data,
      };
    }

    // 4. Rental Location / City / Area
    case "RENT_LOCATION": {
      if (!trimmed || trimmed.length < 2) {
        return await invalidFallback(getStepPromptText("RENT_A_CAR_FLOW", "RENT_LOCATION", lang));
      }
      data.rent_location = trimmed;
      data.pickup_text = trimmed;
      data.dropoff_text = "N/A";

      return {
        replyText: getStepPromptText("RENT_A_CAR_FLOW", "RENT_MODEL", lang),
        nextFlow: "RENT_A_CAR_FLOW",
        nextStep: "RENT_MODEL",
        sessionData: data,
      };
    }

    // 5. Vehicle Model Preference (e.g. Alto, WagonR, Aqua, Prius, KDH, or Any)
    case "RENT_MODEL": {
      data.rent_model = trimmed || "Any Model";
      data.vehicle_name = `${data.rent_vehicle_category || "Vehicle"} (${data.rent_model})`;

      return {
        replyText: getStepPromptText("RENT_A_CAR_FLOW", "RENT_DURATION", lang),
        nextFlow: "RENT_A_CAR_FLOW",
        nextStep: "RENT_DURATION",
        sessionData: data,
      };
    }

    // 6. Rental Duration (e.g. 2 Days, 1 Week, 1 Month)
    case "RENT_DURATION": {
      if (!trimmed || trimmed.length < 1) {
        return await invalidFallback(getStepPromptText("RENT_A_CAR_FLOW", "RENT_DURATION", lang));
      }
      data.rent_duration = trimmed;
      data.rent_inquiry = `Category: ${data.rent_vehicle_category || "Car"} | Model: ${data.rent_model} | Duration: ${data.rent_duration} | Location: ${data.rent_location}`;

      const summaryCard = getRentBookingSummaryCard(data, lang);

      return {
        replyText: summaryCard,
        poll: getBookingConfirmPoll(lang),
        sendTextWithPoll: true,
        nextFlow: "RENT_A_CAR_FLOW",
        nextStep: "RENT_CONFIRM",
        sessionData: data,
      };
    }

    // 7. Confirmation Step (Yes / No)
    case "RENT_CONFIRM": {
      if (isAffirmativeInput(trimmed)) {
        const orderCode = await generateOrderCode(supabase, userId, "rent_a_car");
        data.order_code = orderCode;
        data.customer_phone = data.customer_phone || phoneNumber;
        data.customer_whatsapp = phoneNumber;
        data.customer_name = data.customer_name || "Customer";

        // Save order in central_cab.orders
        await saveOrderToDatabase(supabase, userId, "rent_a_car", data);

        // Broadcast to Driver Groups (without customer phone) & Admins (with customer phone)
        await broadcastBooking(
          supabaseUrl,
          supabaseServiceKey,
          sessionApiKey,
          orderCode,
          "Rent a Car",
          data,
          systemSettings
        );

        return {
          replyText: getBookingSuccessMessage(orderCode, lang, "rent_a_car"),
          poll: getPostBookingPoll(lang),
          sendTextWithPoll: true,
          nextFlow: "IDLE",
          nextStep: "BOOKING_COMPLETED",
          sessionData: { language: lang, last_order_code: orderCode },
        };
      } else if (isNegativeInput(trimmed)) {
        const cancelMsg = lang === "ta"
          ? "❌ வாடகை வாகன முன்பதிவு ரத்து செய்யப்பட்டது.\n\n"
          : (lang === "si" ? "❌ Rent a Car ඉල්ලීම අවලංගු කරන ලදී.\n\n" : "❌ Rent a Car request cancelled.\n\n");
        return {
          replyText: cancelMsg + getStepPromptText("IDLE", "CATEGORY_CHOICE", lang),
          poll: getCategoryPoll(lang),
          nextFlow: "IDLE",
          nextStep: "CATEGORY_CHOICE",
          sessionData: { language: lang },
        };
      } else {
        return await invalidFallback(
          getRentBookingSummaryCard(data, lang),
          getBookingConfirmPoll(lang)
        );
      }
    }

    default: {
      return {
        replyText: getStepPromptText("RENT_A_CAR_FLOW", "RENT_VEHICLE_CHOICE", lang),
        poll: getRentVehiclePoll(lang),
        sendTextWithPoll: true,
        nextFlow: "RENT_A_CAR_FLOW",
        nextStep: "RENT_VEHICLE_CHOICE",
        sessionData: data,
      };
    }
  }
}
