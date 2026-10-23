// ============================================================================
// Central Cabs - Category Sub-File: Cancellation Flow
// Finds active orders and safely processes customer cancellations
// ============================================================================

import { CabSystemSettings } from "../adminHandler.ts";
import {
  SupportedLanguage,
  isAffirmativeInput,
  isNegativeInput,
  getCategoryPoll,
  getCancelConfirmPoll,
  getStepPromptText,
  getCancellationSuccessMessage,
} from "../i18n.ts";
import { StepProcessResult } from "./types.ts";

export async function handleCancelFlowStep(
  supabase: any,
  supabaseUrl: string,
  supabaseServiceKey: string,
  userId: string,
  phoneNumber: string,
  trimmed: string,
  step: string,
  sessionData: any,
  lang: SupportedLanguage,
  systemSettings: CabSystemSettings,
  sessionApiKey: string,
  invalidFallback: (prompt: string, poll?: any) => Promise<StepProcessResult>
): Promise<StepProcessResult> {
  if (step === "CANCEL_CONFIRM") {
    if (isAffirmativeInput(trimmed)) {
      const orderCode = sessionData?.target_order_code;
      const serviceType = sessionData?.service_type || "Booking";

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
        replyText: `${getCancellationSuccessMessage(orderCode, lang)}\n\n${getStepPromptText("IDLE", "CATEGORY_CHOICE", lang)}`,
        poll: getCategoryPoll(lang),
        nextFlow: "IDLE",
        nextStep: "CATEGORY_CHOICE",
        sessionData: { language: lang },
      };
    } else if (isNegativeInput(trimmed)) {
      const cancelMsg = lang === "ta"
        ? "முன்பதிவு ரத்து செய்வது தவிர்க்கப்பட்டது.\n\n"
        : (lang === "si" ? "Order එක Cancel කිරීම අත්හැර දමන ලදී.\n\n" : "Order cancellation discarded.\n\n");
      return {
        replyText: cancelMsg + getStepPromptText("IDLE", "CATEGORY_CHOICE", lang),
        poll: getCategoryPoll(lang),
        nextFlow: "IDLE",
        nextStep: "CATEGORY_CHOICE",
        sessionData: { language: lang },
      };
    } else {
      const confirmErr = lang === "ta"
        ? "⚠️ முன்பதிவை ரத்து செய்ய *Yes* எனவும், தவிர்க்க *No* எனவும் பதிலளிக்கவும்."
        : (lang === "si"
          ? "⚠️ කරුණාකර Order එක Cancel කිරීමට *Yes* ලෙස හෝ අත්හැරීමට *No* ලෙස Reply කරන්න."
          : "⚠️ Please reply *Yes* to cancel order or *No* to keep order.");
      return await invalidFallback(confirmErr, getCancelConfirmPoll(lang));
    }
  }

  return {
    replyText: getStepPromptText("IDLE", "CATEGORY_CHOICE", lang),
    poll: getCategoryPoll(lang),
    nextFlow: "IDLE",
    nextStep: "CATEGORY_CHOICE",
    sessionData: { language: lang },
  };
}

export async function startCancelFlow(
  supabase: any,
  userId: string,
  phoneNumber: string,
  currentStep: string,
  lang: SupportedLanguage = "si",
  welcomeSetting?: any
): Promise<StepProcessResult> {
  const cleanPhone = phoneNumber.replace(/\D/g, "");
  let altPhone = cleanPhone;
  if (cleanPhone.startsWith("94") && cleanPhone.length === 11) {
    altPhone = "0" + cleanPhone.slice(2);
  } else if (cleanPhone.startsWith("0") && cleanPhone.length === 10) {
    altPhone = "94" + cleanPhone.slice(1);
  }

  const orConditions = [`whatsapp_phone.eq.${phoneNumber}`];
  if (cleanPhone) {
    orConditions.push(
      `whatsapp_phone.eq.${cleanPhone}`,
      `customer_phone.eq.${cleanPhone}`,
      `customer_phone.eq.${altPhone}`
    );
  }

  const { data: activeOrders, error } = await supabase
    .schema("central_cab")
    .from("orders")
    .select("order_code, service_type, customer_phone, whatsapp_phone")
    .eq("user_id", userId)
    .or(orConditions.join(","))
    .in("status", ["pending", "confirmed", "assigned", "driver_assigned"])
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("[startCancelFlow] Query error:", error);
  }

  let activeOrder = activeOrders && activeOrders.length > 0 ? activeOrders[0] : null;

  // Fallback: check with ilike
  if (!activeOrder && cleanPhone && cleanPhone.length >= 8) {
    const { data: fallbackOrders } = await supabase
      .schema("central_cab")
      .from("orders")
      .select("order_code, service_type, customer_phone, whatsapp_phone")
      .eq("user_id", userId)
      .ilike("whatsapp_phone", `%${cleanPhone}%`)
      .in("status", ["pending", "confirmed", "assigned", "driver_assigned"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (fallbackOrders && fallbackOrders.length > 0) {
      activeOrder = fallbackOrders[0];
    }
  }

  if (activeOrder) {
    const askMsg = lang === "ta"
      ? `உங்களுக்கு ஏற்கனவே செயலில் உள்ள முன்பதிவு உள்ளது (Order ID: *${activeOrder.order_code}*).\nஅதை ரத்து செய்ய விரும்புகிறீர்களா?`
      : (lang === "si"
        ? `ඔබට දැනටමත් Active Order එකක් ඇත (Order ID: *${activeOrder.order_code}*).\nඔබට එය Cancel කිරීමට අවශ්‍යද?`
        : `You have an active booking (Order ID: *${activeOrder.order_code}*).\nWould you like to cancel it?`);

    return {
      replyText: askMsg,
      poll: getCancelConfirmPoll(lang),
      nextFlow: "CANCEL_FLOW",
      nextStep: "CANCEL_CONFIRM",
      sessionData: { target_order_code: activeOrder.order_code, service_type: activeOrder.service_type, language: lang },
    };
  }

  const noOrderMsg = lang === "ta"
    ? "உங்களிடம் தற்போது செயலில் உள்ள முன்பதிவு எதுவும் இல்லை.\n\n"
    : (lang === "si"
      ? "ඔබට දැනට Active Booking එකක් නොමැත.\n\n"
      : "You do not have any active booking right now.\n\n");

  return {
    replyText: noOrderMsg + getStepPromptText("IDLE", "CATEGORY_CHOICE", lang),
    poll: getCategoryPoll(lang),
    nextFlow: "IDLE",
    nextStep: "CATEGORY_CHOICE",
    sessionData: { language: lang },
  };
}

export async function broadcastCancellation(
  supabaseUrl: string,
  supabaseServiceKey: string,
  sessionApiKey: string,
  orderCode: string,
  serviceType: string,
  phoneNumber: string,
  systemSettings: CabSystemSettings
) {
  const cancelText = `🚫 *ORDER CANCELLED BY CUSTOMER*\n━━━━━━━━━━━━━━━━━━━━\n🆔 *Order ID:* ${orderCode}\n📁 *Service:* ${serviceType}\n📱 *Customer:* ${phoneNumber}\n━━━━━━━━━━━━━━━━━━━━\nThis booking has been cancelled and is no longer available.`;

  const adminPhone = systemSettings?.admin_whatsapp_number;
  if (adminPhone) {
    fetch(`${supabaseUrl}/functions/v1/send-whatsapp-central_cab`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: adminPhone,
        message: cancelText,
        sessionApiKey,
      }),
    }).catch(err => console.error("Admin cancel alert failed:", err));
  }

  const sType = (serviceType || "").toLowerCase();
  let driverGroups: any[] = [];
  if (sType.includes("delivery")) {
    driverGroups = systemSettings?.delivery_driver_groups?.length
      ? systemSettings.delivery_driver_groups
      : systemSettings?.target_driver_groups || [];
  } else if (sType.includes("rent")) {
    driverGroups = systemSettings?.rent_a_car_groups?.length
      ? systemSettings.rent_a_car_groups
      : systemSettings?.target_driver_groups || [];
  } else {
    driverGroups = systemSettings?.hire_driver_groups?.length
      ? systemSettings.hire_driver_groups
      : systemSettings?.target_driver_groups || [];
  }

  for (const group of driverGroups) {
    const targetChatId = group.chat_id || (group.id?.includes("@g.us") ? group.id : null);
    if (targetChatId) {
      console.log(`[broadcastCancellation] Forwarding cancellation to group: ${group.name} (${targetChatId})`);
      fetch(`${supabaseUrl}/functions/v1/send-whatsapp-central_cab`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: targetChatId,
          message: cancelText,
          sessionApiKey,
        }),
      }).catch(err => console.error(`Group cancel alert ${group.name} (${targetChatId}) failed:`, err));
    }
  }
}
