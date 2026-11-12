// ============================================================================
// Ceylon Central Cabs & Delivery - Admin Handler
// Supports Master Admin & Service-Specific Admins (Hire, Rent a Car, Delivery)
// Handles:
// 1. Rent a car booking confirmation to group & customer when admin sends RNT code
// 2. Hire cab voice dispatch / confirmation to driver group & customer
// 3. Multi-admin phone number validation
// ============================================================================

import {
  buildGoogleMapsLink,
  formatLocationDisplay,
  getRoutingDistance,
  calculateDeliveryFare,
  PricingSettings,
} from "./pricingEngine.ts";
import { formatLKR } from "./flows/cabFlow.ts";
import {
  getDeliveryCustomerConfirmedMessage,
  getShortTripCustomerConfirmedMessage,
} from "./i18n.ts";

export interface DriverGroup {
  id?: string;
  name: string;
  chat_id: string;
}

export interface CabSystemSettings {
  admin_whatsapp_number?: string;
  hire_admin_number?: string;
  rent_admin_number?: string;
  delivery_admin_number?: string;
  delivery_rider_admin_number?: string;
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
  if (!senderPhone || senderPhone.length < 7) return false;

  const adminList = [
    normalizePhone(systemSettings?.admin_whatsapp_number),
    normalizePhone(systemSettings?.hire_admin_number),
    normalizePhone(systemSettings?.rent_admin_number),
    normalizePhone(systemSettings?.delivery_admin_number),
    normalizePhone(systemSettings?.delivery_rider_admin_number),
  ].filter(Boolean);

  const senderLast9 = senderPhone.slice(-9);

  return adminList.some((a) => {
    if (senderPhone === a) return true;
    if (a.length >= 9 && senderLast9 === a.slice(-9)) return true;
    return senderPhone.endsWith(a) || a.endsWith(senderPhone);
  });
}

/**
 * Extract Order Code from text (e.g., "HIRS 001", "DELR 001", "HIR 001", "RNT 001", "DEL 001", "#ORD845")
 */
export function extractOrderCode(text: string): string | null {
  if (!text) return null;
  // Match HIRS 001, DELR 001, HIR 001, DEL 001, RNT 001 (with optional #, -, _, space)
  const prefixMatch = text.match(/\b(?:#)?(HIRS|HIR|DELR|DEL|RNT)[-_\s]?(\d{1,6})\b/i);
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
  userId: string,
  pricingSettings?: PricingSettings
): Promise<{ handled: boolean; replyText?: string }> {
  const productList = targetOrder.delivery_items
    || targetOrder.custom_fields?.raw_data?.delivery_products
    || targetOrder.custom_fields?.raw_data?.delivery_items
    || "Package / Items";
  const category = targetOrder.custom_fields?.raw_data?.delivery_category || "Delivery";
  const customerDropoff = targetOrder.dropoff_address
    || targetOrder.custom_fields?.raw_data?.delivery_location
    || "Customer Location";

  // 1. Calculate road distance between Shop Pickup & Customer Dropoff
  const distanceInfo = await getRoutingDistance(
    { text: shopLocationText, coords: shopCoords || undefined },
    { text: customerDropoff, coords: targetOrder.dropoff_coords || undefined }
  );

  // 2. Fetch or use Pricing Settings to calculate delivery fare
  let activePricing: PricingSettings = pricingSettings || {} as any;
  if (!activePricing || Object.keys(activePricing).length === 0) {
    try {
      const { data: pSet } = await supabase
        .schema("central_cab")
        .from("settings")
        .select("value")
        .eq("user_id", userId)
        .eq("key", "cab_pricing")
        .maybeSingle();
      if (pSet?.value) activePricing = pSet.value;
    } catch (e) {
      console.warn("[dispatchConfirmedDeliveryOrder] Error loading cab_pricing:", e);
    }
  }

  const vehicleKey = targetOrder.vehicle_key || targetOrder.custom_fields?.raw_data?.vehicle_key || "motorbike";
  const fareResult = calculateDeliveryFare(
    distanceInfo.distanceKm,
    distanceInfo.distanceText,
    vehicleKey,
    activePricing
  );

  const baseCode = (targetOrder.order_code || "DEL 001").trim();
  const riderCode = baseCode.startsWith("DELR") ? baseCode : baseCode.replace(/^DEL\b/i, "DELR");

  // 3. Update order in database: status -> awaiting_rider, set shop pickup, distance, fare, and rider code
  await supabase
    .schema("central_cab")
    .from("orders")
    .update({
      order_code: riderCode,
      status: "pending",
      pickup_address: shopLocationText,
      pickup_coords: shopCoords || null,
      distance_km: fareResult.distanceKm,
      total_fare: fareResult.totalFare,
      total_amount: fareResult.totalFare,
      special_instructions: `[Shop Pickup: ${shopLocationText}] [Items: ${productList}] [Distance: ${fareResult.distanceText}] [Delivery Fare: LKR ${fareResult.totalFare}]`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", targetOrder.id);

  // 4. Update admin session to await Voice Note for this rider job
  await supabase
    .schema("central_cab")
    .from("bot_sessions")
    .upsert({
      phone_number: adminPhoneNumber,
      user_id: userId,
      flow_type: "ADMIN_FLOW",
      current_step: "AWAITING_VOICE_NOTE",
      session_data: { pending_admin_order_code: riderCode, pending_order_id: targetOrder.id },
      updated_at: new Date().toISOString(),
    });

  const shopLocationDisplay = formatLocationDisplay(shopLocationText, shopCoords);
  const dropoffLocationDisplay = formatLocationDisplay(customerDropoff, targetOrder.dropoff_coords);

  // 5. Send Shop confirmation notice to Delivery Shop Groups (Sinhala text)
  const shopGroups = (systemSettings.delivery_driver_groups && systemSettings.delivery_driver_groups.length > 0)
    ? systemSettings.delivery_driver_groups
    : (systemSettings.target_driver_groups || []);

  const shopConfirmNotice = `✅ *Delivery ඇණවුම සඳහා කඩය තහවුරු කරන ලදී: ${targetOrder.order_code}*\n━━━━━━━━━━━━━━━━━━━━\n🏪 *කඩයේ ස්ථානය (Shop Pickup):*\n${shopLocationDisplay}\n\n📦 *භාණ්ඩ:* ${productList}\n📂 *වර්ගය:* ${category}\n📍 *භාණ්ඩ භාරදිය යුතු ස්ථානය (Delivery Location):*\n${dropoffLocationDisplay}\n━━━━━━━━━━━━━━━━━━━━\n📌 කඩයේ ස්ථානය සටහන් කරගන්නා ලදී. Delivery Rider යොමු කරනු ලැබේ.`;

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

  const vName = targetOrder.vehicle_type || (vehicleKey === "three_wheeler" ? "Three-wheeler 🛺" : "Motorbike 🏍️");

  // 6. Forward Delivery Ride Job immediately to Delivery Riders Groups (DELR code with pickup, dropoff, distance, fare)
  const riderGroups = (systemSettings.delivery_rider_groups && systemSettings.delivery_rider_groups.length > 0)
    ? systemSettings.delivery_rider_groups
    : (systemSettings.target_driver_groups || []);

  let serviceAdminPhone = (systemSettings?.delivery_rider_admin_number || systemSettings?.delivery_admin_number || systemSettings?.admin_whatsapp_number || "").trim();
  const groupContact = serviceAdminPhone || "Admin Office";

  const riderJobNotice = `🛵 *නව Delivery සවාරියක් (Ride Job): ${riderCode}*\n━━━━━━━━━━━━━━━━━━━━\n🏪 *භාණ්ඩ ලබාගත යුතු කඩය (Shop Pickup Location):*\n${shopLocationDisplay}\n\n📍 *භාණ්ඩ භාරදිය යුතු ස්ථානය (Customer Drop-off):*\n${dropoffLocationDisplay}\n\n🛵 *වාහනය:* ${vName}\n🛣️ *දුර:* ${fareResult.distanceText}\n💰 *Delivery ගාස්තුව:* ${formatLKR(fareResult.totalFare)}\n📦 *ලබාගත යුතු භාණ්ඩ:* ${productList}\n📞 *කාර්යාල දුරකථන:* ${groupContact}\n━━━━━━━━━━━━━━━━━━━━\n⚡ කරුණාකර මෙම Delivery සවාරිය භාරගෙන කඩය වෙත ගොස් භාණ්ඩ ලබාගන්න!`;

  const delaySec = Math.max(1, Number(systemSettings.broadcast_delay_seconds || 3));
  for (let gIdx = 0; gIdx < riderGroups.length; gIdx++) {
    const group = riderGroups[gIdx];
    const targetChatId = group.chat_id || (group.id?.includes("@g.us") ? group.id : null);
    if (targetChatId) {
      if (gIdx > 0) {
        const jitterMs = Math.floor(Math.random() * 1000);
        await new Promise((resolve) => setTimeout(resolve, delaySec * 1000 + jitterMs));
      }
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

  return {
    handled: true,
    replyText: `🛵 *Delivery Rider Job ${riderCode} Dispatched to Riders Group!*\n━━━━━━━━━━━━━━━━━━━━\n🏪 *Shop Pickup Location:*\n${shopLocationDisplay}\n\n📍 *Customer Drop-off Location:*\n${dropoffLocationDisplay}\n\n🛵 *Vehicle:* ${vName}\n🛣️ *Distance:* ${fareResult.distanceText}\n💰 *Delivery Fee:* ${formatLKR(fareResult.totalFare)}\n📦 *Items:* ${productList}\n━━━━━━━━━━━━━━━━━━━━\n📌 Riders Group වෙත Job එක යොමු කරන ලදී.\n🎙️ Rider කෙනෙක් භාරගත් පසු Voice Note එක දැමීමට *${riderCode}* ලෙස එවන්න.`,
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
  sessionApiKey: string,
  pricingSettings?: PricingSettings
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
          userId,
          pricingSettings
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
          userId,
          pricingSettings
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

    const sType = String(order.service_type || "").toLowerCase();
    const isShortTrip = targetOrderCode.startsWith("HIRS") || order.booking_type === "now";
    const isDeliveryRider = targetOrderCode.startsWith("DELR") || sType.includes("delivery");
    const isRent = sType.includes("rent") || targetOrderCode.startsWith("RNT");
    const isHire = !isShortTrip && !isDeliveryRider && !isRent;

    let targetGroups: DriverGroup[] = [];
    if (isDeliveryRider || isShortTrip) {
      targetGroups = (systemSettings.delivery_rider_groups && systemSettings.delivery_rider_groups.length > 0)
        ? systemSettings.delivery_rider_groups
        : (systemSettings.delivery_driver_groups || systemSettings.target_driver_groups || []);
    } else if (isRent) {
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

    let serviceAdminPhone = (systemSettings?.admin_whatsapp_number || "").trim();
    if (isShortTrip || isDeliveryRider) {
      serviceAdminPhone = (systemSettings?.delivery_rider_admin_number || systemSettings?.delivery_admin_number || systemSettings?.admin_whatsapp_number || "").trim();
    } else if (isRent && systemSettings?.rent_admin_number) {
      serviceAdminPhone = systemSettings.rent_admin_number.trim();
    } else if (isHire && systemSettings?.hire_admin_number) {
      serviceAdminPhone = systemSettings.hire_admin_number.trim();
    }
    const groupContact = serviceAdminPhone || "Admin Office";

    let broadcastTag = "";
    if (isDeliveryRider) {
      const productList = order.delivery_items || order.custom_fields?.raw_data?.delivery_products || "Items";
      broadcastTag = `🛵 *නව Delivery සවාරියක් (Ride Job): ${targetOrderCode}*\n━━━━━━━━━━━━━━━━━━━━\n🏪 *භාණ්ඩ ලබාගත යුතු කඩය (Shop Pickup Location):*\n${pickupDisplay}\n\n📍 *භාණ්ඩ භාරදිය යුතු ස්ථානය (Customer Drop-off):*\n${dropoffDisplay}\n\n🛵 *වාහනය:* ${order.vehicle_type || "Motorbike"}\n🛣️ *දුර:* ${order.distance_km ? `${order.distance_km} km` : "N/A"}\n💰 *Delivery ගාස්තුව:* ${formatLKR(order.total_fare)}\n📦 *ලබාගත යුතු භාණ්ඩ:* ${productList}\n📞 *කාර්යාල දුරකථන:* ${groupContact}\n━━━━━━━━━━━━━━━━━━━━\n⚡ කරුණාකර මෙම Delivery සවාරිය භාරගෙන කඩය වෙත ගොස් භාණ්ඩ ලබාගන්න!`;
    } else if (isShortTrip) {
      broadcastTag = `🛵 *නව කෙටි ගමනක් (Short Trip - Ride Now): ${targetOrderCode}*\n━━━━━━━━━━━━━━━━━━━━\n👤 *පාරිභෝගිකයා:* ${order.customer_name || "Customer"}\n📞 *කාර්යාල දුරකථන:* ${groupContact}\n🛵 *වාහනය:* ${order.vehicle_type || "Ride Now Vehicle"}\n📍 *ආරම්භක ස්ථානය (Pickup):*\n${pickupDisplay}\n🏁 *ගමනාන්තය (Drop-off):*\n${dropoffDisplay}\n🛣️ *දුර:* ${order.distance_km ? `${order.distance_km} km` : "N/A"}\n💰 *ඇස්තමේන්තුගත ගාස්තුව:* ${formatLKR(order.total_fare)}\n━━━━━━━━━━━━━━━━━━━━\n⚡ ළඟම සිටින Rider මහතා මෙම කෙටි ගමන භාරගන්න!`;
    } else if (isHire) {
      broadcastTag = `✅ *සවාරිය තහවුරු කර රියදුරු යොමු කරන ලදී: ${targetOrderCode}*\n━━━━━━━━━━━━━━━━━━━━\n👤 *පාරිභෝගිකයා:* ${order.customer_name || "N/A"}\n📞 *කාර්යාල දුරකථන:* ${groupContact}\n📍 *ආරම්භක ස්ථානය (Pickup):*\n${pickupDisplay}\n🏁 *ගමනාන්තය (Drop-off):*\n${dropoffDisplay}\n━━━━━━━━━━━━━━━━━━━━\n📌 රියදුරු මහතා යොමු කර ඇත. සවාරිය තහවුරුයි.`;
    } else if (isRent) {
      broadcastTag = `✅ *Rent a Car වෙන්කිරීම තහවුරුයි: ${targetOrderCode}*\n━━━━━━━━━━━━━━━━━━━━\n👤 *පාරිභෝගිකයා:* ${order.customer_name || "Customer"}\n📞 *කාර්යාල දුරකථන:* ${groupContact}\n🚗 *වාහන වර්ගය:* ${order.vehicle_type || "Vehicle"}\n📍 *ස්ථානය:*\n${pickupDisplay}\n━━━━━━━━━━━━━━━━━━━━\n📌 මෙම වාහනය වෙන්කර ඇති බැවින් තවදුරටත් ලබාගත නොහැක.`;
    }

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
      const orderLang = order.custom_fields?.language || "si";
      let customerConfirmText = "";
      if (isDeliveryRider) {
        const productList = order.delivery_items || order.custom_fields?.raw_data?.delivery_products || "Items";
        customerConfirmText = getDeliveryCustomerConfirmedMessage(
          targetOrderCode,
          pickupDisplay,
          dropoffDisplay,
          order.vehicle_type || "Motorbike 🏍️",
          order.distance_km ? `${order.distance_km} km` : "N/A",
          formatLKR(order.total_fare),
          productList,
          orderLang
        );
      } else if (isShortTrip) {
        customerConfirmText = getShortTripCustomerConfirmedMessage(
          targetOrderCode,
          pickupDisplay,
          dropoffDisplay,
          order.vehicle_type || "Motorbike 🏍️",
          order.distance_km ? `${order.distance_km} km` : "N/A",
          formatLKR(order.total_fare),
          orderLang
        );
      } else if (sType.includes("rent")) {
        customerConfirmText = orderLang === "en"
          ? `✅ *Your Rent a Car Booking is Confirmed!*\n\n🏷️ *Order ID:* *${targetOrderCode}*\n🚗 *Vehicle:* ${order.vehicle_type || "Vehicle"}\n📍 *Location:* ${order.pickup_address || "N/A"}\n\nOur rental provider has been assigned and will contact you shortly.`
          : `✅ *ඔබගේ Rent a Car Booking එක තහවුරු කරන ලදී!*\n\n🏷️ *Order ID:* *${targetOrderCode}*\n🚗 *වාහනය:* ${order.vehicle_type || "Vehicle"}\n📍 *ස්ථානය:* ${order.pickup_address || "N/A"}\n\nඅපගේ නියෝජිතයෙකු ඉක්මනින් ඔබව සම්බන්ධ කරගනු ඇත.`;
      } else {
        customerConfirmText = orderLang === "en"
          ? `✅ *Your order is confirmed.*\n\n🏷️ *Order ID:* *${targetOrderCode}*\n🚗 *Vehicle:* ${order.vehicle_type || "Cab"}\n📍 *Pickup:*\n${order.pickup_address || "N/A"}\n🏁 *Drop-off:*\n${order.dropoff_address || "N/A"}\n\n🚕 A driver has been assigned and will contact you shortly.`
          : `✅ *ඔබගේ Booking එක තහවුරු කරන ලදී!*\n\n🏷️ *Order ID:* *${targetOrderCode}*\n🚗 *වාහනය:* ${order.vehicle_type || "Cab"}\n📍 *ආරම්භක ස්ථානය:*\n${order.pickup_address || "N/A"}\n🏁 *ගමනාන්තය:*\n${order.dropoff_address || "N/A"}\n\n🚕 රියදුරු මහතා ඔබව ඉක්මනින් සම්බන්ධ කරගනු ඇත.`;
      }

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

    // Fallback: Check if DEL vs DELR swapped (e.g. order in DB is DELR 019 but admin typed DEL 019, or vice versa)
    if (!order && (orderCode.startsWith("DEL") || orderCode.startsWith("DELR"))) {
      const swappedCode = orderCode.startsWith("DELR")
        ? orderCode.replace(/^DELR\b/i, "DEL")
        : orderCode.replace(/^DEL\b/i, "DELR");
      const cleanSwapped = swappedCode.replace(/\s+/g, "");
      const { data: swappedOrder } = await supabase
        .schema("central_cab")
        .from("orders")
        .select("*")
        .eq("user_id", userId)
        .or(`order_code.ilike.%${swappedCode}%,order_code.ilike.%${cleanSwapped}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (swappedOrder) order = swappedOrder;
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
      const rentBookedText = `✅ *Rent a Car වෙන්කිරීම තහවුරුයි: ${order.order_code}*\n━━━━━━━━━━━━━━━━━━━━\n🚗 *වාහනය:* ${order.vehicle_type || "Vehicle"}\n⏱️ *කාල සීමාව:* ${rentDuration}\n📍 *ස්ථානය (Location):*\n${rentLocationDisplay}\n━━━━━━━━━━━━━━━━━━━━\n📌 මෙම වාහනය වෙන්කර ඇති බැවින් තවදුරටත් ලබාගත නොහැක.`;

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
        const orderLang = order.custom_fields?.language || "si";
        const customerConfirmText = orderLang === "en"
          ? `✅ *Your Rent a Car Booking is Confirmed!*\n\n🏷️ *Order Code:* *${order.order_code}*\n🚗 *Vehicle:* ${order.vehicle_type || "Vehicle"}\n📍 *Location:* ${order.pickup_address || "N/A"}\n\nOur agent will contact you shortly with the vehicle photos and pricing details.\n\nThank you! We are very glad you chose our service. 🚗`
          : `✅ *ඔබගේ Rent a Car Booking එක තහවුරු කරන ලදී!*\n\n🏷️ *Order Code:* *${order.order_code}*\n🚗 *වාහනය:* ${order.vehicle_type || "Vehicle"}\n📍 *ස්ථානය:* ${order.pickup_address || "N/A"}\n\nඅපගේ නියෝජිතයෙකු (Agent) ඉක්මනින් ඔබව සම්බන්ධ කරගෙන වාහනයේ ඡායාරූප සහ මිල ගණන් ලබා දෙනු ඇත.\n\nස්තූතියි! 🚗`;
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

    const isDeliveryRider = orderCode.startsWith("DELR") || (order.order_code && order.order_code.startsWith("DELR") && Boolean(order.pickup_address));
    const isDeliveryShop = (sType.includes("delivery") || orderCode.startsWith("DEL")) && !isDeliveryRider;

    // Case B-1: Delivery Rider Order: Admin typed DELR code -> prompt for Driver Voice Note
    if (isDeliveryRider) {
      await supabase
        .schema("central_cab")
        .from("bot_sessions")
        .upsert({
          phone_number: adminPhoneNumber,
          user_id: userId,
          flow_type: "ADMIN_FLOW",
          current_step: "AWAITING_VOICE_NOTE",
          session_data: { pending_admin_order_code: order.order_code, pending_order_id: order.id },
          updated_at: new Date().toISOString(),
        });

      return {
        handled: true,
        replyText: `🎙️ *Delivery Rider Job ${order.order_code} Selected!*\n━━━━━━━━━━━━━━━━━━━━\nකරුණාකර Rider / Driver මහතා සඳහා Voice Note එක එවන්න.\n\n(Please send the Driver Voice Note now. It will be dispatched to confirm the delivery rider job.)`,
      };
    }

    // Case B-2: Delivery Shop Order: Admin sends order number first, then shop pickup location
    if (isDeliveryShop) {
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
        userId,
        pricingSettings
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
    replyText: `👋 *Central Cabs Admin Control Panel*\n\n1. Send *CONFIRM HIR 001* or *HIRS 001* (+ Voice Note) to confirm a ride.\n2. Send *RNT 001* to mark Rent a Car as Booked.\n3. Send *DEL 001* to set Shop Location, then send *DELR 001* (+ Voice Note) for Rider dispatch.`,
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
