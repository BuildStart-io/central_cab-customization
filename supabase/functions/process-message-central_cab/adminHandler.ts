// ============================================================================
// Ceylon Central Cabs & Delivery - Admin Handler
// Admin Voice Note Forwarding to Driver Groups & Customer Confirmation Alert
// ============================================================================

import { buildGoogleMapsLink } from "./pricingEngine.ts";

export interface DriverGroup {
  id?: string;
  name: string;
  chat_id: string;
}

export interface CabSystemSettings {
  admin_whatsapp_number: string;
  target_driver_groups: DriverGroup[];
}

function normalizePhone(p: string): string {
  return String(p || "").replace(/\D/g, "");
}

/**
 * Check if the message is from the configured Admin WhatsApp number
 */
export function isAdminUser(phoneNumber: string, systemSettings: CabSystemSettings): boolean {
  const adminPhone = normalizePhone(systemSettings?.admin_whatsapp_number);
  const senderPhone = normalizePhone(phoneNumber);
  return Boolean(adminPhone && senderPhone && (senderPhone === adminPhone || senderPhone.endsWith(adminPhone) || adminPhone.endsWith(senderPhone)));
}

/**
 * Extract Order Code from text (e.g., "#ORD845", "ORD845", "ORD-845", "845")
 */
export function extractOrderCode(text: string): string | null {
  if (!text) return null;
  const match = text.match(/(#?ORD[-_\s]?\d{3,6})/i);
  if (match) {
    let code = match[1].toUpperCase().replace(/[-_\s]/g, "");
    if (!code.startsWith("#")) code = `#${code}`;
    return code;
  }
  return null;
}

/**
 * Handle incoming message from Admin
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

  const orderCode = extractOrderCode(messageText);
  const isVoice = messageType === "ptt" || messageType === "audio";
  const voiceMediaUrl = rawPayload?.directMediaUrl || rawPayload?.payload?.media?.url || rawPayload?.media?.url || null;

  // 1. If Admin sent a Voice Note with Order Code in caption or text
  if (isVoice || voiceMediaUrl) {
    let targetOrderCode = orderCode;

    // If no order code directly in message text, check last admin session state or pending order
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
        replyText: "⚠️ Please provide an Order ID (e.g., #ORD845) along with the voice note.",
      };
    }

    // Look up the order in central_cab.orders
    const { data: order, error: orderError } = await supabase
      .schema("central_cab")
      .from("orders")
      .select("*")
      .eq("user_id", userId)
      .eq("order_code", targetOrderCode)
      .maybeSingle();

    if (orderError || !order) {
      return {
        handled: true,
        replyText: `⚠️ Could not find Order ${targetOrderCode}. Please verify the Order ID.`,
      };
    }

    console.log(`[AdminHandler] Found Order ${targetOrderCode} for customer ${order.customer_phone}. Dispatching voice note to driver groups...`);

    const targetGroups = systemSettings.target_driver_groups || [];
    
    let pickupMapLink = "";
    if (order.pickup_coords) {
      try {
        const coords = typeof order.pickup_coords === "string" ? JSON.parse(order.pickup_coords) : order.pickup_coords;
        pickupMapLink = buildGoogleMapsLink(order.pickup_address, coords);
      } catch {
        pickupMapLink = buildGoogleMapsLink(order.pickup_address);
      }
    } else {
      pickupMapLink = buildGoogleMapsLink(order.pickup_address);
    }

    const pickupDisplay = order.pickup_address?.includes("maps.google") || order.pickup_address?.includes("google.com/maps")
      ? order.pickup_address
      : (pickupMapLink ? `${order.pickup_address}\n🗺️ *Pickup Map:* ${pickupMapLink}` : order.pickup_address);

    const broadcastTag = `📢 *Update for Order ${targetOrderCode}*\n👤 *Customer:* ${order.customer_name || "N/A"}\n📱 *Contact:* ${order.customer_phone || "N/A"}\n📍 *Pickup:* ${pickupDisplay}\n🏁 *Drop-off:* ${order.dropoff_address || "N/A"}`;

    // 1. Forward Voice Note to all configured Driver Groups
    for (const group of targetGroups) {
      if (group.chat_id) {
        console.log(`[AdminHandler] Forwarding voice note to driver group: ${group.name} (${group.chat_id})`);
        
        // Send tag text first or alongside
        await sendWhatsAppMessage(
          supabaseUrl,
          supabaseServiceKey,
          group.chat_id,
          broadcastTag,
          sessionApiKey
        );

        // Send Voice Note
        if (voiceMediaUrl) {
          await sendWhatsAppVoice(
            supabaseUrl,
            supabaseServiceKey,
            group.chat_id,
            voiceMediaUrl,
            sessionApiKey
          );
        }
      }
    }

    // 2. Alert Customer: "Your order is confirmed."
    const targetCustomerNumber = order.customer_whatsapp || order.customer_phone;
    console.log(`[AdminHandler] Sending confirmation alert to customer WhatsApp: ${targetCustomerNumber} (contact: ${order.customer_phone})`);
    const customerConfirmText = `✅ *Your order is confirmed.*\nOrder ID: *${targetOrderCode}*\nVehicle: *${order.vehicle_type || "Cab"}*\n📍 *Pickup:* ${order.pickup_address || "N/A"}\n🏁 *Drop-off:* ${order.dropoff_address || "N/A"}\n\nA driver has been assigned and will contact you shortly.`;
    
    await sendWhatsAppMessage(
      supabaseUrl,
      supabaseServiceKey,
      targetCustomerNumber,
      customerConfirmText,
      sessionApiKey
    );

    // If contact phone is different, also send a notification there
    if (order.customer_phone && order.customer_whatsapp && order.customer_phone !== order.customer_whatsapp) {
      console.log(`[AdminHandler] Sending backup confirmation to contact phone: ${order.customer_phone}`);
      await sendWhatsAppMessage(
        supabaseUrl,
        supabaseServiceKey,
        order.customer_phone,
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
      replyText: `✅ Voice update for Order *${targetOrderCode}* has been forwarded to ${targetGroups.length} driver group(s), and confirmation was sent to customer (${order.customer_phone}).`,
    };
  }

  // 2. If Admin sent text with an Order ID
  if (orderCode) {
    // Store as pending order code in admin session
    await supabase
      .schema("central_cab")
      .from("bot_sessions")
      .upsert({
        phone_number: adminPhoneNumber,
        user_id: userId,
        flow_type: "ADMIN_FLOW",
        current_step: "AWAITING_VOICE_NOTE",
        session_data: { pending_admin_order_code: orderCode },
        updated_at: new Date().toISOString(),
      });

    return {
      handled: true,
      replyText: `🎙️ Order *${orderCode}* selected. Please send the Voice Note with driver details now. It will be forwarded to all driver groups.`,
    };
  }

  // General Admin Menu
  return {
    handled: true,
    replyText: `👋 *Admin Control Panel*\n\nTo assign a ride:\n1. Send an Order ID (e.g. *#ORD845*)\n2. Send the Driver Voice Note to broadcast.`,
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
