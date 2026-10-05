import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

function extractPhoneFromJid(jid: string): string {
  return String(jid || "")
    .replace(/@s\.whatsapp\.net$/i, "")
    .replace(/@c\.us$/i, "")
    .replace(/^\+/, "")
    .replace(/[^\d]/g, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const correlationId = crypto.randomUUID();

  try {
    const body = await req.json();
    console.log(`[${correlationId}] [webhook-wsender-central_cab] Webhook payload:`, JSON.stringify(body).substring(0, 500));

    const event = body?.event;
    const sessionName = body?.session;
    const wp = body?.payload || {};

    if (!sessionName) {
      return new Response(JSON.stringify({ error: "Missing session in payload" }), {
        status: 400, headers: jsonHeaders,
      });
    }

    // Map WAHA session name to user in user_wsender_sessions
    const { data: sessionMapping } = await supabase
      .from("user_wsender_sessions")
      .select("user_id, session_id")
      .or(`session_id.eq.${sessionName},session_api_key.eq.${sessionName}`)
      .limit(1)
      .maybeSingle();

    const userId = sessionMapping?.user_id || null;

    if (event === "session.status") {
      console.log(`[${correlationId}] session.status for ${sessionName}: ${wp?.status}`);
      return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders });
    }

    if (event !== "message" && event !== "message.any") {
      return new Response(JSON.stringify({ ok: true, skipped: event }), { headers: jsonHeaders });
    }

    if (wp?.fromMe === true) {
      return new Response(JSON.stringify({ ok: true, skipped: "fromMe" }), { headers: jsonHeaders });
    }

    // STRICT BOT RULE: Direct Chat Only. Completely ignore groups, broadcasts, newsletters.
    const fromJid = String(wp.from || wp._data?.key?.remoteJid || "");
    if (/@g\.us$/i.test(fromJid) || /@broadcast$/i.test(fromJid) || /@newsletter$/i.test(fromJid)) {
      console.log(`[${correlationId}] Ignoring group/broadcast message from: ${fromJid}`);
      return new Response(JSON.stringify({ ok: true, skipped: "group_or_broadcast" }), { headers: jsonHeaders });
    }

    let phoneNumber = "";

    // Resolve LID if applicable
    if (/@lid$/i.test(fromJid)) {
      const wahaBase = (Deno.env.get("WAHA_BASE_URL") || "").replace(/\/+$/, "");
      const wahaKey = Deno.env.get("WAHA_API_KEY") || "";
      try {
        const lidRes = await fetch(`${wahaBase}/api/${encodeURIComponent(sessionName)}/lids/${encodeURIComponent(fromJid)}`, {
          headers: { "X-Api-Key": wahaKey, Accept: "application/json" },
          signal: AbortSignal.timeout(10_000),
        });
        if (lidRes.ok) {
          const lidData = await lidRes.json();
          phoneNumber = extractPhoneFromJid(lidData?.pn || "");
        }
      } catch (err) {
        console.warn(`[${correlationId}] LID lookup error:`, (err as Error).message);
      }
      if (!phoneNumber) phoneNumber = fromJid;
    } else {
      phoneNumber = extractPhoneFromJid(fromJid)
        || extractPhoneFromJid(wp._data?.key?.participantPn || "")
        || extractPhoneFromJid(wp._data?.key?.senderPn || "");
    }

    if (!phoneNumber) {
      return new Response(JSON.stringify({ error: "No phone number extracted" }), { status: 400, headers: jsonHeaders });
    }

    // Location and media detection
    const wMsg = wp._data?.message || {};
    const isLocation = Boolean(
      wp.location ||
      wp.type === "location" ||
      wp._data?.type === "location" ||
      wMsg.locationMessage
    );

    const locLat = wp.location?.latitude || wMsg.locationMessage?.degreesLatitude || wp._data?.lat;
    const locLng = wp.location?.longitude || wMsg.locationMessage?.degreesLongitude || wp._data?.lng;
    const locName = wp.location?.name || wp.location?.description || wMsg.locationMessage?.name || wMsg.locationMessage?.address || wp._data?.loc || "";

    // Message type detection
    let messageType = wp.type || "text";
    if (messageType === "chat") messageType = "text";
    if (wMsg.imageMessage) messageType = "image";
    else if (wMsg.videoMessage) messageType = "video";
    else if (wMsg.audioMessage) messageType = wMsg.audioMessage?.ptt ? "ptt" : "audio";
    else if (wMsg.documentMessage) messageType = "document";
    else if (wMsg.stickerMessage) messageType = "sticker";
    else if (isLocation) messageType = "location";

    // Message text extraction (do NOT pick base64 thumbnail string for location messages)
    let messageText = "";
    if (isLocation) {
      messageText = locName.trim() || (locLat && locLng ? `Location: ${Number(locLat).toFixed(4)}, ${Number(locLng).toFixed(4)}` : "WhatsApp Location Pin");
    } else {
      messageText = wp.body
        || wp._data?.message?.conversation
        || wp._data?.message?.extendedTextMessage?.text
        || wp._data?.message?.imageMessage?.caption
        || wp._data?.message?.videoMessage?.caption
        || "";
    }

    const senderName = wp._data?.pushName || wp._data?.notifyName || wp.notifyName || "Customer";
    const wahaMessageId = wp.id || wp._data?.key?.id || `${phoneNumber}-${Date.now()}`;

    // Extract direct media URL if available
    const directMediaUrl = wp.media?.url || body?.payload?.media?.url || body?.media?.url || null;
    const enrichedPayload = {
      ...body,
      directMediaUrl,
      locationDetails: (locLat && locLng) ? {
        latitude: Number(locLat),
        longitude: Number(locLng),
        name: locName,
        address: locName,
      } : null
    };

    console.log(`[${correlationId}] Enqueueing to central_cab.message_queue from ${phoneNumber} (${messageType}): ${messageText.substring(0, 60)}`);

    // Insert into central_cab.message_queue schema
    const { error: enqueueError } = await supabase
      .schema("central_cab")
      .from("message_queue")
      .upsert(
        {
          wsender_message_id: wahaMessageId,
          user_id: userId,
          phone_number: phoneNumber,
          sender_name: senderName,
          message_text: messageText,
          message_type: messageType,
          session_api_key: sessionName,
          raw_payload: enrichedPayload,
          status: "pending",
          correlation_id: correlationId,
        },
        { onConflict: "wsender_message_id", ignoreDuplicates: true }
      );

    if (enqueueError) {
      if (enqueueError.code === "23505") {
        return new Response(JSON.stringify({ success: true, duplicate: true }), { headers: jsonHeaders });
      }
      console.error(`[${correlationId}] Queue error:`, enqueueError);
      throw new Error("Failed to enqueue message to central_cab queue");
    }

    // Trigger process-message-central_cab asynchronously
    fetch(`${supabaseUrl}/functions/v1/process-message-central_cab`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ trigger: "webhook", correlationId }),
    }).catch((err) => {
      console.warn(`[${correlationId}] Trigger process-message-central_cab failed:`, err.message);
    });

    return new Response(
      JSON.stringify({ success: true, queued: true, messageId: wahaMessageId, correlationId }),
      { headers: jsonHeaders }
    );
  } catch (error) {
    console.error(`[${correlationId}] Webhook error:`, error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: jsonHeaders,
    });
  }
});
