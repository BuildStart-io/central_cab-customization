// ============================================================================
// Ceylon Central Cabs & Delivery - Admin Handler
// Supports Master Admin & Service-Specific Admins (Hire, Rent a Car, Delivery)
// Handles:
// 1. Rent a car booking confirmation to group & customer when admin sends RNT code
// 2. Hire cab voice dispatch / confirmation to driver group & customer
// 3. Multi-admin phone number validation
// ============================================================================

import { buildGoogleMapsLink, formatLocationDisplay } from "./pricingEngine.ts";

export interface DriverGroup {
  id?: string;
  name: string;
  chat_id: string;
}

export interface CabSystemSettings {
  admin_whatsapp_number: string;
  hire_admin_number?: string;
  rent_admin_number?: string;
  delivery_admin_number?: string;
  broadcast_delay_seconds?: number;
  hire_driver_groups?: DriverGroup[];
  rent_a_car_groups?: DriverGroup[];
  delivery_driver_groups?: DriverGroup[]; // Delivery Shop Groups
  delivery_rider_groups?: DriverGroup[];  // Delivery Riders Groups
  target_driver_groups?: DriverGroup[];
}

function normalizePhone(p?: string): string {
  return String(p || "").replace(/\D/g, "");
}

/**
 * Extract Shop Pickup Location from text when admin confirms a delivery order
 */
export function extractShopPickupLocation(messageText: string, orderCode: string): string {
  let cleaned = messageText || "";
  const safeCode = (orderCode || "").replace(/\s+/g, "[-_\\s]?");
  const orderRegex = new RegExp(`(?:#)?\\b${safeCode}\\b`, "i");
  cleaned = cleaned.replace(orderRegex, " ");
  // Match confirm, conform, confrm, cnf, accept, ok, book, done, yes, etc.
  cleaned = cleaned.replace(/\b(confirm|conform|confrm|cnf|confirmed|conformed|order|book|booked|ok|done|accept|accepted|yes)\b/gi, " ");
  cleaned = cleaned.replace(/\b(shop\s*pickup\s*location|shop\s*pickup|pickup\s*location|pickup|shop\s*location|shop)\s*[:=-]?\s*/gi, " ");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  cleaned = cleaned.replace(/^[-:,\s]+/, "").trim();
  return cleaned;
}

/**
 * Check if the message is from any configured Admin WhatsApp number
 * (Master Admin, Hire Admin, Rent a Car Admin, or Delivery Admin)
 */
export function isAdminUser(phoneNumber: string, systemSettings: CabSystemSettings): boolean {
  const senderPhone = normalizePhone(phoneNumber);
  if (!senderPhone) return false;

  const adminList = [
    normalizePhone(systemSettings?.admin_whatsapp_number),
    normalizePhone(systemSettings?.hire_admin_number),
    normalizePhone(systemSettings?.rent_admin_number),
    normalizePhone(systemSettings?.delivery_admin_number),
  ].filter(Boolean);

  return adminList.some((a) => senderPhone === a || senderPhone.endsWith(a) || a.endsWith(senderPhone));
}

/**
 * Extract Order Code from text (e.g., "HIR 001", "RNT 001", "DEL 001", "#ORD845")
 */
export function extractOrderCode(text: string): string | null {
  if (!text) return null;
  // Match HIR 001, DEL 001, RNT 001 (with optional #, -, _, space)
  const prefixMatch = text.match(/\b(?:#)?(HIR|DEL|RNT)[-_\s]?(\d{1,6})\b/i);
  if (prefixMatch) {
    const prefix = prefixMatch[1].toUpperCase();
    const num = prefixMatch[2].padStart(3, "0");
    return `${prefix} ${num}`;
  }
  const match = text.match(/(#\d{1,6})\b/i) || text.match(/(#?ORD[-_\s]?\d{1,6})/i) || text.match(/(#?CAB[-_\s]?[A-Z0-9]{1,8})/i);
  if (match) {
    let code = match[1].trim();
    if (!code.startsWith("#") && !code.toUpperCase().startsWith("CAB")) code = `#${code}`;
    return code;
  }
  return null;
}

/**
 * Helper to dispatch confirmed delivery order to Shop & Rider groups and notify customer
 */
export async function dispatchConfirmedDeliveryOrder(
  supabase: any,
  supabaseUrl: string,
  supabaseServiceKey: string,
  sessionApiKey: string,
  systemSettings: CabSystemSettings,
  targetOrder: any,
  shopLocationText: string,
  shopCoords: { lat: number; lng: number } | null,
  adminPhoneNumber: string,
  userId: string
): Promise<{ handled: boolean; replyText?: string }> {
  const productList = targetOrder.delivery_items
    || targetOrder.custom_fields?.raw_data?.delivery_products
    || targetOrder.custom_fields?.raw_data?.delivery_items
    || "Package / Items";
  const category = targetOrder.custom_fields?.raw_data?.delivery_category || "Delivery";
  const customerDropoff = targetOrder.dropoff_address
    || targetOrder.custom_fields?.raw_data?.delivery_location
    || "Customer Location";

  // 1. Update order in database: status -> confirmed, pickup_address -> shopLocationText
  await supabase
    .schema("central_cab")
    .from("orders")
    .update({
      status: "confirmed",
      pickup_address: shopLocationText,
      pickup_coords: shopCoords || null,
      special_instructions: `[Shop Pickup: ${shopLocationText}] [Items: ${productList}]`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", targetOrder.id);

  // 2. Clear admin pending state in bot_sessions
  await supabase
    .schema("central_cab")
    .from("bot_sessions")
    .upsert({
      phone_number: adminPhoneNumber,
      user_id: userId,
      flow_type: "ADMIN_FLOW",
      current_step: "IDLE",
      session_data: {},
      updated_at: new Date().toISOString(),
    });

  const shopLocationDisplay = formatLocationDisplay(shopLocationText, shopCoords);
  const dropoffLocationDisplay = formatLocationDisplay(customerDropoff, targetOrder.dropoff_coords);

  // 3. Send Confirmed notice to Delivery Shop Groups (100% clean English)
  const shopGroups = (systemSettings.delivery_driver_groups && systemSettings.delivery_driver_groups.length > 0)
    ? systemSettings.delivery_driver_groups
    : (systemSettings.target_driver_groups || []);

  const shopConfirmNotice = `✅ *DELIVERY ORDER CONFIRMED: ${targetOrder.order_code}*\n━━━━━━━━━━━━━━━━━━━━\n🏪 *Shop Pickup Location:*\n${shopLocationDisplay}\n\n📦 *Products / Items:* ${productList}\n📂 *Category:* ${category}\n📍 *Customer Delivery Location:*\n${dropoffLocationDisplay}\n━━━━━━━━━━━━━━━━━━━━\n📌 Order confirmed. Delivery rider has been dispatched for pickup.`;

  for (const group of shopGroups) {
    const targetChatId = group.chat_id || (group.id?.includes("@g.us") ? group.id : null);
    if (targetChatId) {
      console.log(`[AdminHandler] Forwarding delivery order confirmed notice to Shop group: ${group.name} (${targetChatId})`);
      await sendWhatsAppMessage(
        supabaseUrl,
        supabaseServiceKey,
        targetChatId,
        shopConfirmNotice,
        sessionApiKey
      );
    }
  }

  // 4. Dispatch Ride Job to Delivery Riders Groups (100% clean English)
  const riderGroups = (systemSettings.delivery_rider_groups && systemSettings.delivery_rider_groups.length > 0)
    ? systemSettings.delivery_rider_groups
    : shopGroups;

  const deliveryAdminPhone = (systemSettings?.delivery_admin_number || systemSettings?.admin_whatsapp_number || "").trim() || "Admin Office";
  const riderJobNotice = `🛵 *NEW DELIVERY RIDE JOB: ${targetOrder.order_code}*\n━━━━━━━━━━━━━━━━━━━━\n🏪 *Shop Pickup Location (Pick up items here):*\n${shopLocationDisplay}\n\n📍 *Customer Delivery Location (Drop off items here):*\n${dropoffLocationDisplay}\n\n📦 *Products to Pick Up:* ${productList}\n📂 *Category:* ${category}\n📞 *Contact (Delivery Admin):* ${deliveryAdminPhone}\n━━━━━━━━━━━━━━━━━━━━\n⚡ Please accept this delivery ride and proceed to the shop for pickup!`;

  for (const group of riderGroups) {
    const targetChatId = group.chat_id || (group.id?.includes("@g.us") ? group.id : null);
    if (targetChatId) {
      console.log(`[AdminHandler] Forwarding delivery ride job to Rider group: ${group.name} (${targetChatId})`);
      await sendWhatsAppMessage(
        supabaseUrl,
        supabaseServiceKey,
        targetChatId,
        riderJobNotice,
        sessionApiKey
      );
    }
  }

  // 5. Send Confirmation Update to Customer WhatsApp
  const targetCustomerNumber = targetOrder.whatsapp_phone || targetOrder.customer_whatsapp || targetOrder.customer_phone;
  if (targetCustomerNumber) {
    const orderLang = targetOrder.custom_fields?.language || "ta";
    const customerConfirmText = orderLang === "ta"
      ? `✅ *உங்கள் டெலிவரி முன்பதிவு உறுதி செய்யப்பட்டது! (Order Confirmed)*\n\n🏷️ *Order Code:* *${targetOrder.order_code}*\n🏪 *கடை இடம் (Shop Pickup):*\n${shopLocationDisplay}\n\n📦 *பொருட்கள்:* ${productList}\n📍 *டெலிவரி இடம்:* ${dropoffLocationDisplay}\n\n🛵 டெலிவரி ரைடர் கடைக்குச் சென்று பொருட்களைப் பெற்றுக்கொண்டு உங்கள் இடத்திற்கு விரைந்து வருகிறார்!\n\nநன்றி! எமது சேவையைத் தெரிவு செய்தமைக்கு மிக்க மகிழ்ச்சி. 📦`
      : (orderLang === "si"
        ? `✅ *ඔබගේ Delivery ඇණවුම තහවුරු කරන ලදී! (Order Confirmed)*\n\n🏷️ *Order Code:* *${targetOrder.order_code}*\n🏪 *Shop Pickup:*\n${shopLocationDisplay}\n\n📦 *භාණ්ඩ:* ${productList}\n📍 *Delivery Location:* ${dropoffLocationDisplay}\n\n🛵 Delivery Rider කඩයට ගොස් භාණ්ඩ රැගෙන ඔබගේ ස්ථානයට පැමිණීමට පිටත්ව ඇත!\n\nස්තූතියි! 📦`
        : `✅ *Your Delivery Order is Confirmed!*\n\n🏷️ *Order Code:* *${targetOrder.order_code}*\n🏪 *Shop Pickup Location:* ${shopLocationDisplay}\n📦 *Products:* ${productList}\n📍 *Delivery Location:* ${dropoffLocationDisplay}\n\n🛵 A delivery rider has been assigned and is heading to the shop for pickup and delivery to your location.\n\nThank you for choosing Central Delivery! 📦`);

    await sendWhatsAppMessage(
      supabaseUrl,
      supabaseServiceKey,
      targetCustomerNumber,
      customerConfirmText,
      sessionApiKey
    );
  }

  return {
    handled: true,
    replyText: `✅ *Shop Pickup Location assigned for Delivery Order ${targetOrder.order_code}!* (Confirmed)\n\n🏪 *Shop Location:*\n${shopLocationDisplay}\n\n🛵 Dispatched to ${riderGroups.length} Delivery Rider group(s) & confirmation sent to customer.`,
  };
}

/**
 * Handle incoming message from Admin or Driver dispatch
 */
export async function handleAdminMessage(
  supabase: any,
  supabaseUrl: string,
  supabaseServiceKey: string,
  userId: string,
  adminPhoneNumber: string,
  messageText: string,
  messageType: string,
  rawPayload: any,
  systemSettings: CabSystemSettings,
  sessionApiKey: string
): Promise<{ handled: boolean; replyText?: string }> {
  console.log(`[AdminHandler] Processing message from Admin (${adminPhoneNumber}), type=${messageType}: ${messageText}`);

  let orderCode = extractOrderCode(messageText);
  const isVoice = messageType === "ptt" || messageType === "audio";
  const voiceMediaUrl = rawPayload?.directMediaUrl || rawPayload?.payload?.media?.url || rawPayload?.media?.url || null;

  const lowerText = (messageText || "").trim().toLowerCase();
  const isExplicitConfirm = /\b(confirm|conform|confrm|cnf|confirmed|conformed|accept|accepted|ok|done|yes|book|booked)\b/i.test(lowerText);

  // 0. Fetch Admin Session state
  const { data: adminSession } = await supabase
    .schema("central_cab")
    .from("bot_sessions")
    .select("session_data, current_step")
    .eq("phone_number", adminPhoneNumber)
    .maybeSingle();

  const isAwaitingDeliveryLocation = adminSession?.current_step === "AWAITING_DELIVERY_SHOP_LOCATION"
    && Boolean(adminSession?.session_data?.pending_admin_order_code);

  // If Admin is in the middle of assigning Shop Location for a Delivery Order
  if (isAwaitingDeliveryLocation) {
    if (lowerText === "cancel" || lowerText === "exit") {
      await supabase
        .schema("central_cab")
        .from("bot_sessions")
        .upsert({
          phone_number: adminPhoneNumber,
          user_id: userId,
          flow_type: "ADMIN_FLOW",
          current_step: "IDLE",
          session_data: {},
          updated_at: new Date().toISOString(),
        });
      return {
        handled: true,
        replyText: `❌ Shop pickup location assignment cancelled.`,
      };
    }

    // If admin sent a DIFFERENT order code (e.g. switching to another order), let it proceed below.
    // Otherwise, this message is the Shop Location (Location Pin or Text address)!
    if (!orderCode && !isVoice && !voiceMediaUrl) {
      const pendingCode = adminSession.session_data.pending_admin_order_code;
      let { data: targetOrder } = await supabase
        .schema("central_cab")
        .from("orders")
        .select("*")
        .ilike("order_code", pendingCode)
        .maybeSingle();

      if (targetOrder) {
        let shopCoords: { lat: number; lng: number } | null = null;
        let shopLocText = (messageText || "").trim();

        const locLat = rawPayload?.locationDetails?.latitude ?? rawPayload?.location?.latitude ?? rawPayload?.payload?.location?.latitude;
        const locLng = rawPayload?.locationDetails?.longitude ?? rawPayload?.location?.longitude ?? rawPayload?.payload?.location?.longitude;
        const locName = rawPayload?.locationDetails?.name || rawPayload?.locationDetails?.address || rawPayload?.location?.name || rawPayload?.location?.address || "";

        if (locLat && locLng) {
          shopCoords = {
            lat: Number(locLat),
            lng: Number(locLng),
          };
          shopLocText = locName ? `${locName} (${shopCoords.lat.toFixed(4)}, ${shopCoords.lng.toFixed(4)})` : `Shop Location (${shopCoords.lat.toFixed(4)}, ${shopCoords.lng.toFixed(4)})`;
        } else {
          const match = (messageText || "").match(/([-+]?\d{1,2}\.\d+)\s*,\s*([-+]?\d{1,3}\.\d+)/);
          if (match) {
            shopCoords = { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
          }
        }

        if (!shopLocText || shopLocText.length < 2) {
          return {
            handled: true,
            replyText: `⚠️ Please send a valid Shop Pickup Location (Pin 📍 or Name / Address) to confirm Order *${targetOrder.order_code}*.`,
          };
        }

        return await dispatchConfirmedDeliveryOrder(
          supabase,
          supabaseUrl,
          supabaseServiceKey,
          sessionApiKey,
          systemSettings,
          targetOrder,
          shopLocText,
          shopCoords,
          adminPhoneNumber,
          userId
        );
      }
    }
  }

  // If no order code directly in message text, check last admin session state
  if (!orderCode && (isVoice || voiceMediaUrl || isExplicitConfirm)) {
    if (adminSession?.session_data?.pending_admin_order_code) {
      orderCode = adminSession.session_data.pending_admin_order_code;
    }
  }

  // Check if Admin sent a Location Pin
  const isLocationMsg = messageType === "location"
    || (messageText || "").toLowerCase().startsWith("location:")
    || Boolean(rawPayload?.locationDetails)
    || /[-+]?\d{1,2}\.\d+,\s*[-+]?\d{1,3}\.\d+/.test(messageText || "");

  if (isLocationMsg) {
    let adminLocCoords: { lat: number; lng: number } | null = null;
    let adminLocName = "";

    if (rawPayload?.locationDetails?.latitude && rawPayload?.locationDetails?.longitude) {
      adminLocCoords = {
        lat: Number(rawPayload.locationDetails.latitude),
        lng: Number(rawPayload.locationDetails.longitude),
      };
      adminLocName = rawPayload.locationDetails.name || rawPayload.locationDetails.address || "";
    } else {
      const match = (messageText || "").match(/([-+]?\d{1,2}\.\d+)\s*,\s*([-+]?\d{1,3}\.\d+)/);
      if (match) {
        adminLocCoords = { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
      }
    }

    if (adminLocCoords) {
      // 1. Save to admin session state
      await supabase
        .schema("central_cab")
        .from("bot_sessions")
        .upsert({
          phone_number: adminPhoneNumber,
          user_id: userId,
          flow_type: "ADMIN_FLOW",
          current_step: "LOCATION_RECEIVED",
          session_data: {
            last_admin_location: {
              name: adminLocName,
              coords: adminLocCoords,
              text: messageText,
              timestamp: Date.now(),
            },
          },
          updated_at: new Date().toISOString(),
        });

      // 2. Check if there is an active delivery order to assign this shop location to
      let targetCode = orderCode;
      if (!targetCode) {
        targetCode = adminSession?.session_data?.pending_admin_order_code || null;
      }

      let targetOrder: any = null;
      if (targetCode) {
        let { data: o } = await supabase
          .schema("central_cab")
          .from("orders")
          .select("*")
          .eq("user_id", userId)
          .ilike("order_code", targetCode)
          .maybeSingle();
        if (!o) {
          const { data: globalO } = await supabase
            .schema("central_cab")
            .from("orders")
            .select("*")
            .ilike("order_code", targetCode)
            .maybeSingle();
          o = globalO;
        }
        targetOrder = o;
      }

      if (!targetOrder) {
        // Fallback: check most recent delivery order created in last 2 hours
        const { data: recentDel } = await supabase
          .schema("central_cab")
          .from("orders")
          .select("*")
          .eq("service_type", "delivery")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (recentDel) {
          targetOrder = recentDel;
        }
      }

      if (targetOrder) {
        const cleanShopText = adminLocName
          ? `${adminLocName} (${adminLocCoords.lat.toFixed(4)}, ${adminLocCoords.lng.toFixed(4)})`
          : `Shop Location (${adminLocCoords.lat.toFixed(4)}, ${adminLocCoords.lng.toFixed(4)})`;

        return await dispatchConfirmedDeliveryOrder(
          supabase,
          supabaseUrl,
          supabaseServiceKey,
          sessionApiKey,
          systemSettings,
          targetOrder,
          cleanShopText,
          adminLocCoords,
          adminPhoneNumber,
          userId
        );
      }

      return {
        handled: true,
        replyText: `📍 Location received (${adminLocCoords.lat.toFixed(4)}, ${adminLocCoords.lng.toFixed(4)})!\nReply with *CONFIRM DEL-xxx* to attach this shop location to an order.`,
      };
    }
  }

  // 1. If Admin or Driver sent a Voice Note with Order Code in caption/text or from pending state
  if (isVoice || voiceMediaUrl) {
    let targetOrderCode = orderCode;

    // If no order code directly in message text, check last admin session state
    if (!targetOrderCode) {
      const { data: session } = await supabase
        .schema("central_cab")
        .from("bot_sessions")
        .select("session_data")
        .eq("phone_number", adminPhoneNumber)
        .maybeSingle();

      targetOrderCode = session?.session_data?.pending_admin_order_code || null;
    }

    // If still no order code, check for the most recent pending order
    if (!targetOrderCode) {
      const { data: latestPending } = await supabase
        .schema("central_cab")
        .from("orders")
        .select("order_code")
        .eq("user_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      targetOrderCode = latestPending?.order_code || null;
    }

    if (!targetOrderCode) {
      return {
        handled: true,
        replyText: "⚠️ Please provide an Order ID (e.g., HIR 001, RNT 001) along with the voice note.",
      };
    }

    // Look up the order in central_cab.orders
    let { data: order } = await supabase
      .schema("central_cab")
      .from("orders")
      .select("*")
      .eq("user_id", userId)
      .ilike("order_code", targetOrderCode)
      .maybeSingle();

    if (!order) {
      const cleanCode = targetOrderCode.replace(/\s+/g, "");
      const { data: altOrder } = await supabase
        .schema("central_cab")
        .from("orders")
        .select("*")
        .eq("user_id", userId)
        .or(`order_code.ilike.%${targetOrderCode}%,order_code.ilike.%${cleanCode}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (altOrder) order = altOrder;
    }

    if (!order) {
      const cleanCode = targetOrderCode.replace(/\s+/g, "");
      const { data: globalOrder } = await supabase
        .schema("central_cab")
        .from("orders")
        .select("*")
        .or(`order_code.ilike.%${targetOrderCode}%,order_code.ilike.%${cleanCode}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (globalOrder) order = globalOrder;
    }

    if (!order) {
      return {
        handled: true,
        replyText: `⚠️ Could not find Order ${targetOrderCode}. Please verify the Order ID.`,
      };
    }

    console.log(`[AdminHandler] Found Order ${targetOrderCode} for customer ${order.customer_phone}. Dispatching voice note to driver groups...`);

    let targetGroups: DriverGroup[] = [];
    const sType = String(order.service_type || "").toLowerCase();
    if (sType.includes("delivery")) {
      targetGroups = (systemSettings.delivery_driver_groups && systemSettings.delivery_driver_groups.length > 0)
        ? systemSettings.delivery_driver_groups
        : (systemSettings.target_driver_groups || []);
    } else if (sType.includes("rent")) {
      targetGroups = (systemSettings.rent_a_car_groups && systemSettings.rent_a_car_groups.length > 0)
        ? systemSettings.rent_a_car_groups
        : (systemSettings.target_driver_groups || []);
    } else {
      targetGroups = (systemSettings.hire_driver_groups && systemSettings.hire_driver_groups.length > 0)
        ? systemSettings.hire_driver_groups
        : (systemSettings.target_driver_groups || []);
    }

    const pickupDisplay = formatLocationDisplay(order.pickup_address, order.pickup_coords);
    const dropoffDisplay = formatLocationDisplay(order.dropoff_address, order.dropoff_coords);

    const isHire = !sType.includes("delivery") && !sType.includes("rent");
    const isRent = sType.includes("rent") || targetOrderCode.startsWith("RNT");
    const isDelivery = sType.includes("delivery") || targetOrderCode.startsWith("DEL");

    let serviceAdminPhone = (systemSettings?.admin_whatsapp_number || "").trim();
    if (isHire && systemSettings?.hire_admin_number) {
      serviceAdminPhone = systemSettings.hire_admin_number.trim();
    } else if (isRent && systemSettings?.rent_admin_number) {
      serviceAdminPhone = systemSettings.rent_admin_number.trim();
    } else if (isDelivery && systemSettings?.delivery_admin_number) {
      serviceAdminPhone = systemSettings.delivery_admin_number.trim();
    }
    const groupContact = serviceAdminPhone || "Admin Office";

    const broadcastTag = isHire
      ? `✅ *HIRE BOOKING CONFIRMED / DRIVER ASSIGNED: ${targetOrderCode}*\n━━━━━━━━━━━━━━━━━━━━\n👤 *Customer:* ${order.customer_name || "N/A"}\n📞 *Contact (Admin):* ${groupContact}\n📍 *Pickup Location:*\n${pickupDisplay}\n🏁 *Drop-off Location:*\n${dropoffDisplay}\n━━━━━━━━━━━━━━━━━━━━\n📌 Driver assigned. Booking confirmed.`
      : (isRent
        ? `✅ *RENT A CAR BOOKED / CONFIRMED: ${targetOrderCode}*\n━━━━━━━━━━━━━━━━━━━━\n👤 *Customer:* ${order.customer_name || "Customer"}\n📞 *Contact (Admin):* ${groupContact}\n🚗 *Category:* ${order.vehicle_type || "Vehicle"}\n📍 *Location:*\n${pickupDisplay}\n━━━━━━━━━━━━━━━━━━━━\n📌 This vehicle has been booked and confirmed. No longer available.`
        : (isDelivery
          ? `✅ *DELIVERY ORDER ASSIGNED: ${targetOrderCode}*\n━━━━━━━━━━━━━━━━━━━━\n👤 *Customer:* ${order.customer_name || "Customer"}\n📞 *Contact (Admin):* ${groupContact}\n📍 *Delivery Location:*\n${dropoffDisplay}\n━━━━━━━━━━━━━━━━━━━━\n📌 Delivery rider assigned.`
          : `📢 *Update for Order ${targetOrderCode}*\n👤 *Customer:* ${order.customer_name || "N/A"}\n📞 *Contact (Admin):* ${groupContact}\n📍 *Pickup Location:*\n${pickupDisplay}\n🏁 *Drop-off Location:*\n${dropoffDisplay}`));

    const delaySec = Math.max(1, Number(systemSettings.broadcast_delay_seconds || 3));

    // 1. Forward Voice Note to service-configured Driver Groups
    for (let gIdx = 0; gIdx < targetGroups.length; gIdx++) {
      const group = targetGroups[gIdx];
      const targetChatId = group.chat_id || (group.id?.includes("@g.us") ? group.id : null);
      if (targetChatId) {
        if (gIdx > 0) {
          const jitterMs = Math.floor(Math.random() * 1000);
          await new Promise((resolve) => setTimeout(resolve, delaySec * 1000 + jitterMs));
        }

        console.log(`[AdminHandler] Forwarding voice note to driver group: ${group.name} (${targetChatId})`);
        
        await sendWhatsAppMessage(
          supabaseUrl,
          supabaseServiceKey,
          targetChatId,
          broadcastTag,
          sessionApiKey
        );

        if (voiceMediaUrl) {
          await sendWhatsAppVoice(
            supabaseUrl,
            supabaseServiceKey,
            targetChatId,
            voiceMediaUrl,
            sessionApiKey
          );
        }
      }
    }

    // 2. Alert Customer: "Your order is confirmed."
    const targetCustomerNumber = order.whatsapp_phone || order.customer_whatsapp || order.customer_phone;
    if (targetCustomerNumber) {
      console.log(`[AdminHandler] Sending confirmation alert to customer WhatsApp: ${targetCustomerNumber}`);
      const customerConfirmText = sType.includes("rent")
        ? `✅ *Your Rent a Car Booking is Confirmed!*\nOrder ID: *${targetOrderCode}*\nVehicle: *${order.vehicle_type || "Vehicle"}*\n📍 *Location:* ${order.pickup_address || "N/A"}\n\nOur rental provider has been assigned and will contact you shortly.`
        : `✅ *Your order is confirmed.*\nOrder ID: *${targetOrderCode}*\nVehicle: *${order.vehicle_type || "Cab"}*\n📍 *Pickup:* ${order.pickup_address || "N/A"}\n🏁 *Drop-off:* ${order.dropoff_address || "N/A"}\n\nA driver has been assigned and will contact you shortly.`;

      await sendWhatsAppMessage(
        supabaseUrl,
        supabaseServiceKey,
        targetCustomerNumber,
        customerConfirmText,
        sessionApiKey
      );
    }

    // 3. Update Order in DB
    await supabase
      .schema("central_cab")
      .from("orders")
      .update({
        status: "confirmed",
        assigned_voice_url: voiceMediaUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    // Clear admin pending state
    await supabase
      .schema("central_cab")
      .from("bot_sessions")
      .upsert({
        phone_number: adminPhoneNumber,
        user_id: userId,
        flow_type: "ADMIN_FLOW",
        current_step: "IDLE",
        session_data: {},
        updated_at: new Date().toISOString(),
      });

    return {
      handled: true,
      replyText: `✅ Voice update for Order *${targetOrderCode}* has been forwarded to ${targetGroups.length} driver group(s), and confirmation was sent to customer.`,
    };
  }

  // 2. If Admin sent text with an Order ID
  if (orderCode) {
    // Look up the order in central_cab.orders
    let { data: order } = await supabase
      .schema("central_cab")
      .from("orders")
      .select("*")
      .eq("user_id", userId)
      .ilike("order_code", orderCode)
      .maybeSingle();

    if (!order) {
      const cleanCode = orderCode.replace(/\s+/g, "");
      const { data: altOrder } = await supabase
        .schema("central_cab")
        .from("orders")
        .select("*")
        .eq("user_id", userId)
        .or(`order_code.ilike.%${orderCode}%,order_code.ilike.%${cleanCode}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (altOrder) order = altOrder;
    }

    if (!order) {
      const cleanCode = orderCode.replace(/\s+/g, "");
      const { data: globalOrder } = await supabase
        .schema("central_cab")
        .from("orders")
        .select("*")
        .or(`order_code.ilike.%${orderCode}%,order_code.ilike.%${cleanCode}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (globalOrder) order = globalOrder;
    }

    if (!order) {
      return {
        handled: true,
        replyText: `⚠️ Could not find Order ${orderCode}. Please verify the Order ID.`,
      };
    }

    const sType = String(order.service_type || "").toLowerCase();
    const isRent = sType.includes("rent") || orderCode.startsWith("RNT");

    // Case A: Rent a Car Order: sending the RNT order number immediately confirms & marks it booked in group!
    if (isRent) {
      // 1. Update order status to confirmed in DB
      await supabase
        .schema("central_cab")
        .from("orders")
        .update({
          status: "confirmed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      // Clear admin pending state
      await supabase
        .schema("central_cab")
        .from("bot_sessions")
        .upsert({
          phone_number: adminPhoneNumber,
          user_id: userId,
          flow_type: "ADMIN_FLOW",
          current_step: "IDLE",
          session_data: {},
          updated_at: new Date().toISOString(),
        });

      // 2. Forward "Order Booked" message to Rent a Car driver groups (100% English)
      const rentGroups = (systemSettings.rent_a_car_groups && systemSettings.rent_a_car_groups.length > 0)
        ? systemSettings.rent_a_car_groups
        : (systemSettings.target_driver_groups || []);

      const rentDuration = order.custom_fields?.raw_data?.rent_duration || "N/A";
      const rentLocationDisplay = formatLocationDisplay(order.pickup_address, order.pickup_coords);
      const rentBookedText = `✅ *RENT A CAR BOOKED / CONFIRMED: ${order.order_code}*\n━━━━━━━━━━━━━━━━━━━━\n🚗 *Vehicle:* ${order.vehicle_type || "Vehicle"}\n⏱️ *Duration:* ${rentDuration}\n📍 *Location:*\n${rentLocationDisplay}\n━━━━━━━━━━━━━━━━━━━━\n📌 This vehicle has been booked and confirmed. No longer available.`;

      for (const group of rentGroups) {
        const targetChatId = group.chat_id || (group.id?.includes("@g.us") ? group.id : null);
        if (targetChatId) {
          console.log(`[AdminHandler] Forwarding Rent a car booked notice to group: ${group.name} (${targetChatId})`);
          await sendWhatsAppMessage(
            supabaseUrl,
            supabaseServiceKey,
            targetChatId,
            rentBookedText,
            sessionApiKey
          );
        }
      }

      // 3. Send confirmation to Customer WhatsApp
      const targetCustomerNumber = order.whatsapp_phone || order.customer_whatsapp || order.customer_phone;
      if (targetCustomerNumber) {
        const orderLang = order.custom_fields?.language || "ta";
        const customerConfirmText = orderLang === "ta"
          ? `✅ *உங்கள் வாடகை வாகன முன்பதிவு உறுதி செய்யப்பட்டது!*\n\n🏷️ *Order Code:* *${order.order_code}*\n🚗 *வாகனம்:* ${order.vehicle_type || "Vehicle"}\n📍 *இடம்:* ${order.pickup_address || "N/A"}\n\nஎமது முகவர் (Agent) விரைவில் உங்களைத் தொடர்புகொண்டு, வாகனத்தின் புகைப்படங்கள் மற்றும் விலை சம்பந்தப்பட்ட விபரங்களைத் தெரிவிப்பார்.\n\nநன்றி! எமது சேவையைத் தெரிவு செய்தமைக்கு மிக்க மகிழ்ச்சி. 🚗`
          : (orderLang === "si"
            ? `✅ *ඔබගේ Rent a Car Booking එක තහවුරු කරන ලදී!*\n\n🏷️ *Order Code:* *${order.order_code}*\n🚗 *වාහනය:* ${order.vehicle_type || "Vehicle"}\n📍 *ස්ථානය:* ${order.pickup_address || "N/A"}\n\nඅපගේ නියෝජිතයෙකු (Agent) ඉක්මනින් ඔබව සම්බන්ධ කරගෙන වාහනයේ ඡායාරූප සහ මිල ගණන් ලබා දෙනු ඇත.\n\nස්තූතියි! 🚗`
            : `✅ *Your Rent a Car Booking is Confirmed!*\n\n🏷️ *Order Code:* *${order.order_code}*\n🚗 *Vehicle:* ${order.vehicle_type || "Vehicle"}\n📍 *Location:* ${order.pickup_address || "N/A"}\n\nOur agent will contact you shortly with the vehicle photos and pricing details.\n\nThank you! We are very glad you chose our service. 🚗`);
        await sendWhatsAppMessage(
          supabaseUrl,
          supabaseServiceKey,
          targetCustomerNumber,
          customerConfirmText,
          sessionApiKey
        );
      }

      return {
        handled: true,
        replyText: `✅ Rent a Car Order *${order.order_code}* confirmed! Booked notice sent to ${rentGroups.length} Rent a Car group(s) and confirmation sent to customer.`,
      };
    }

    const isDelivery = sType.includes("delivery") || orderCode.startsWith("DEL");

    // Case B: Delivery Order: Admin sends order number first, then shop pickup location
    if (isDelivery) {
      let shopPickupLocation = extractShopPickupLocation(messageText, orderCode);
      let shopPickupCoords: { lat: number; lng: number } | null = null;

      // Check if coordinates exist in extracted text or location payload
      const locLat = rawPayload?.locationDetails?.latitude ?? rawPayload?.location?.latitude ?? rawPayload?.payload?.location?.latitude;
      const locLng = rawPayload?.locationDetails?.longitude ?? rawPayload?.location?.longitude ?? rawPayload?.payload?.location?.longitude;
      if (locLat && locLng) {
        shopPickupCoords = { lat: Number(locLat), lng: Number(locLng) };
      } else {
        const textCoordMatch = (shopPickupLocation || "").match(/([-+]?\d{1,2}\.\d+)\s*,\s*([-+]?\d{1,3}\.\d+)/);
        if (textCoordMatch) {
          shopPickupCoords = { lat: parseFloat(textCoordMatch[1]), lng: parseFloat(textCoordMatch[2]) };
        }
      }

      // If no valid shop pickup location was provided in this message, prompt admin for it (Step 2)
      if (!shopPickupLocation || shopPickupLocation.length < 2) {
        const productList = order.delivery_items
          || order.custom_fields?.raw_data?.delivery_products
          || order.custom_fields?.raw_data?.delivery_items
          || "Package / Items";
        const category = order.custom_fields?.raw_data?.delivery_category || "Delivery";
        const customerDropoff = order.dropoff_address
          || order.custom_fields?.raw_data?.delivery_location
          || "Customer Location";
        const dropoffDisplay = formatLocationDisplay(customerDropoff, order.dropoff_coords);

        // Store waiting state in bot_sessions
        await supabase
          .schema("central_cab")
          .from("bot_sessions")
          .upsert({
            phone_number: adminPhoneNumber,
            user_id: userId,
            flow_type: "ADMIN_FLOW",
            current_step: "AWAITING_DELIVERY_SHOP_LOCATION",
            session_data: { pending_admin_order_code: order.order_code, pending_order_id: order.id },
            updated_at: new Date().toISOString(),
          });

        return {
          handled: true,
          replyText: `📦 *Delivery Order ${order.order_code} Selected!*\n━━━━━━━━━━━━━━━━━━━━\n📂 *Category:* ${category}\n📝 *Products:* ${productList}\n📍 *Customer Drop-off:* ${dropoffDisplay}\n━━━━━━━━━━━━━━━━━━━━\n🏪 *Please send the Shop Pickup Location:*\n👉 Share WhatsApp Location Pin 📍 OR type the Shop Name / Address.`,
        };
      }

      // If shop location was provided alongside the order code (e.g. "CONFIRM DEL 001 ABC Bakery")
      return await dispatchConfirmedDeliveryOrder(
        supabase,
        supabaseUrl,
        supabaseServiceKey,
        sessionApiKey,
        systemSettings,
        order,
        shopPickupLocation,
        shopPickupCoords,
        adminPhoneNumber,
        userId
      );
    }

    // Case C: Hire (Transport) Order: require driver voice note before dispatching to group
    await supabase
      .schema("central_cab")
      .from("bot_sessions")
      .upsert({
        phone_number: adminPhoneNumber,
        user_id: userId,
        flow_type: "ADMIN_FLOW",
        current_step: "AWAITING_VOICE_NOTE",
        session_data: { pending_admin_order_code: order.order_code },
        updated_at: new Date().toISOString(),
      });

    return {
      handled: true,
      replyText: `🎙️ Order *${order.order_code}* selected.\n\nPlease send the Driver Voice Note now. Once received, the confirmed booking details and voice note will be dispatched together to the driver group.`,
    };
  }

  // General Admin Menu
  return {
    handled: true,
    replyText: `👋 *Central Cabs Admin Control Panel*\n\n1. Send *CONFIRM HIR 001* or *HIR 001* (+ Voice Note) to confirm a ride.\n2. Send *RNT 001* to mark Rent a Car as Booked.\n3. Send *DEL 001* to start Delivery Confirmation, then share Shop Location.`,
  };
}

async function sendWhatsAppMessage(
  supabaseUrl: string,
  supabaseServiceKey: string,
  to: string,
  message: string,
  sessionApiKey: string
) {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-central_cab`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to, message, sessionApiKey }),
    });
    if (!res.ok) {
      console.error(`Failed to send WhatsApp message to ${to} [${res.status}]: ${await res.text()}`);
    }
  } catch (err) {
    console.error(`Failed to send WhatsApp message to ${to}:`, err);
  }
}

async function sendWhatsAppVoice(
  supabaseUrl: string,
  supabaseServiceKey: string,
  to: string,
  mediaUrl: string,
  sessionApiKey: string
) {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-central_cab`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to, mediaUrl, mediaType: "audio", sessionApiKey }),
    });
    if (!res.ok) {
      console.error(`Failed to send WhatsApp voice to ${to} [${res.status}]: ${await res.text()}`);
    } else {
      console.log(`[AdminHandler] Voice note successfully sent to ${to}`);
    }
  } catch (err) {
    console.error(`Failed to send WhatsApp voice to ${to}:`, err);
  }
}
