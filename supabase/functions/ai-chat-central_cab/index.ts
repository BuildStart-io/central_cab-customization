import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { processCustomerChatStep, BotSessionState } from "./stateMachine.ts";
import { handleAdminMessage, isAdminUser, extractOrderCode, CabSystemSettings } from "./adminHandler.ts";
import { PricingSettings } from "./pricingEngine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    db: { schema: "central_cab" },
  });

  let triggerSource = "cron";
  let triggerCorrelationId = "";
  try {
    const body = await req.json();
    triggerSource = body?.trigger || "cron";
    triggerCorrelationId = body?.correlationId || "";
  } catch { /* empty body fine */ }

  console.log(`[process-message-central_cab] Triggered by: ${triggerSource}${triggerCorrelationId ? ` (corr: ${triggerCorrelationId})` : ""}`);

  // 1. Recover stale messages stuck in 'processing' > 2 minutes
  await supabase
    .schema("central_cab")
    .from("message_queue")
    .update({ status: "pending", updated_at: new Date().toISOString() })
    .eq("status", "processing")
    .lt("updated_at", new Date(Date.now() - 2 * 60 * 1000).toISOString());

  // 2. Process messages in loop
  let processedCount = 0;
  const maxIterations = 10;

  for (let i = 0; i < maxIterations; i++) {
    const { data: candidates, error: fetchError } = await supabase
      .schema("central_cab")
      .from("message_queue")
      .select("*")
      .in("status", ["pending", "failed"])
      .lt("attempts", 3)
      .order("created_at", { ascending: true })
      .limit(1);

    if (fetchError || !candidates || candidates.length === 0) {
      break;
    }

    const msg = candidates[0];
    const corrId = msg.correlation_id || triggerCorrelationId || msg.id.substring(0, 8);

    // Atomically claim message
    const { data: claimed, error: claimError } = await supabase
      .schema("central_cab")
      .from("message_queue")
      .update({ status: "processing", attempts: msg.attempts + 1, updated_at: new Date().toISOString() })
      .eq("id", msg.id)
      .in("status", ["pending", "failed"])
      .select()
      .single();

    if (claimError || !claimed) {
      continue;
    }

    try {
      await handleSingleMessage(supabase, supabaseUrl, supabaseServiceKey, msg, corrId);

      await supabase
        .schema("central_cab")
        .from("message_queue")
        .update({ status: "done", processed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", msg.id);

      processedCount++;
      console.log(`[${corrId}] ✅ [central_cab] Processed message ${msg.id}`);
    } catch (error: any) {
      const newStatus = msg.attempts + 1 >= msg.max_attempts ? "dead" : "failed";
      console.error(`[${corrId}] ❌ [central_cab] Message ${msg.id} failed:`, error.message);
      await supabase
        .schema("central_cab")
        .from("message_queue")
        .update({
          status: newStatus,
          error_message: error.message || String(error),
          updated_at: new Date().toISOString(),
        })
        .eq("id", msg.id);
    }
  }

  return new Response(JSON.stringify({ processed: processedCount }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

async function handleSingleMessage(
  supabase: any,
  supabaseUrl: string,
  supabaseServiceKey: string,
  msg: any,
  corrId: string
) {
  const { user_id: userId, phone_number: phoneNumber, message_text: messageText, message_type: messageType, session_api_key: sessionApiKey, raw_payload: rawPayload } = msg;

  // 1. Fetch Central Cab Settings
  const { data: settingsList } = await supabase
    .schema("central_cab")
    .from("settings")
    .select("key, value")
    .eq("user_id", userId);

  const pricingSettings: PricingSettings = settingsList?.find((s: any) => s.key === "cab_pricing")?.value || {
    motorbike: { base_price: 200, per_km_rate: 80, coverage_km: 2, discount_percentage: 10 },
    three_wheeler: { base_price: 300, per_km_rate: 100, coverage_km: 2, discount_percentage: 10 },
    car: { base_price: 600, per_km_rate: 150, coverage_km: 3, discount_percentage: 15 },
    van: { base_price: 900, per_km_rate: 200, coverage_km: 3, discount_percentage: 15 },
    lorry: { base_price: 1500, per_km_rate: 300, coverage_km: 5, discount_percentage: 10 },
    bus: { base_price: 3000, per_km_rate: 500, coverage_km: 10, discount_percentage: 10 },
  };

  const systemSettings: CabSystemSettings = settingsList?.find((s: any) => s.key === "cab_system_settings")?.value || {
    admin_whatsapp_number: "",
    target_driver_groups: [],
  };

  const welcomeSetting = settingsList?.find((s: any) => s.key === "welcome_message")?.value || null;

  // 2. Record Inbound Message in central_cab.conversations
  await supabase
    .schema("central_cab")
    .from("conversations")
    .insert({
      user_id: userId,
      phone_number: phoneNumber,
      message: messageText || `[${messageType}]`,
      direction: "inbound",
      message_type: messageType,
      metadata: { raw: rawPayload, correlationId: corrId },
    });

  let replyText = "";

  const isVoiceWithOrderCode = (messageType === "ptt" || messageType === "audio" || Boolean(rawPayload?.directMediaUrl || rawPayload?.payload?.media?.url || rawPayload?.media?.url)) && Boolean(extractOrderCode(messageText));

  // 3. Route to Admin Handler or Customer State Machine
  if (isAdminUser(phoneNumber, systemSettings) || isVoiceWithOrderCode) {
    console.log(`[${corrId}] Detected message from Admin/Driver (${phoneNumber}), isVoiceWithOrderCode=${isVoiceWithOrderCode}`);
    const adminResult = await handleAdminMessage(
      supabase,
      supabaseUrl,
      supabaseServiceKey,
      userId,
      phoneNumber,
      messageText,
      messageType,
      rawPayload,
      systemSettings,
      sessionApiKey
    );
    replyText = adminResult.replyText || "";

    if (replyText) {
      console.log(`[${corrId}] Outbound reply to Admin (${phoneNumber}): ${replyText.substring(0, 60)}`);
      await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-central_cab`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: phoneNumber,
          message: replyText,
          sessionApiKey,
        }),
      }).catch((err) => console.error("Admin reply send error:", err));

      // Record Outbound in central_cab.conversations
      await supabase
        .schema("central_cab")
        .from("conversations")
        .insert({
          user_id: userId,
          phone_number: phoneNumber,
          message: replyText,
          direction: "outbound",
          message_type: "text",
          metadata: { correlationId: corrId, adminReply: true },
        });
    }
  } else {
    // 2.1 Register customer contact in central_cab.contact_usage for billing cycle tracking
    await registerContact(supabase, userId, phoneNumber, corrId);

    // Customer 1-on-1 state machine
    console.log(`[${corrId}] Routing to Customer State Machine for ${phoneNumber}`);
    
    // Fetch or create bot session
    const { data: sessionRecord } = await supabase
      .schema("central_cab")
      .from("bot_sessions")
      .select("*")
      .eq("phone_number", phoneNumber)
      .maybeSingle();

    const currentSession: BotSessionState = sessionRecord || {
      phone_number: phoneNumber,
      user_id: userId,
      flow_type: "IDLE",
      current_step: "WELCOME",
      session_data: {},
    };

    const stepResult = await processCustomerChatStep(
      supabase,
      supabaseUrl,
      supabaseServiceKey,
      userId,
      phoneNumber,
      messageText,
      messageType,
      rawPayload,
      currentSession,
      pricingSettings,
      systemSettings,
      sessionApiKey,
      welcomeSetting
    );

    replyText = stepResult.replyText;
    const stepPoll = stepResult.poll;
    const stepMediaUrl = stepResult.mediaUrl;

    // Persist updated session
    await supabase
      .schema("central_cab")
      .from("bot_sessions")
      .upsert({
        phone_number: phoneNumber,
        user_id: userId,
        flow_type: stepResult.nextFlow,
        current_step: stepResult.nextStep,
        session_data: stepResult.sessionData,
        last_interaction: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    // 4. Send outbound WhatsApp reply or poll if generated
    if (replyText || stepPoll || stepMediaUrl) {
      if (stepMediaUrl) {
        console.log(`[${corrId}] Outbound media to ${phoneNumber}: ${stepMediaUrl}`);
        await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-central_cab`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: phoneNumber,
            mediaUrl: stepMediaUrl,
            sessionApiKey,
          }),
        }).catch(err => console.error("Media send error:", err));
      }

      // Send text message if no poll, or if explicitly configured (e.g. welcome message before language poll)
      const shouldSendText = replyText && replyText.trim() && (!stepPoll || stepResult.sendTextWithPoll);
      if (shouldSendText) {
        console.log(`[${corrId}] Outbound reply to ${phoneNumber}: ${replyText.substring(0, 60)}`);
        
        await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-central_cab`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: phoneNumber,
            message: replyText,
            sessionApiKey,
          }),
        });

        // Record Outbound in central_cab.conversations
        await supabase
          .schema("central_cab")
          .from("conversations")
          .insert({
            user_id: userId,
            phone_number: phoneNumber,
            message: replyText,
            direction: "outbound",
            message_type: "text",
            metadata: { correlationId: corrId },
          });
      }

      if (stepPoll) {
        console.log(`[${corrId}] Outbound poll to ${phoneNumber}: ${stepPoll.name} (${stepPoll.options.length} options)`);

        await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-central_cab`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: phoneNumber,
            poll: stepPoll,
            sessionApiKey,
          }),
        });

        // Record Poll in central_cab.conversations
        await supabase
          .schema("central_cab")
          .from("conversations")
          .insert({
            user_id: userId,
            phone_number: phoneNumber,
            message: `[Poll] ${stepPoll.name}\n${stepPoll.options.join("\n")}`,
            direction: "outbound",
            message_type: "poll",
            metadata: { correlationId: corrId, poll: stepPoll },
          });
      }
    }
  }
}

/** Normalize a WhatsApp identifier to a stable contact key (digits only). */
export function normalizeContactKey(raw: string): string {
  return String(raw || "").split("@")[0].replace(/\D/g, "");
}

/** Start of the current billing cycle for a profile. */
export function cycleStart(billingCycleStart: string | null | undefined): string {
  if (!billingCycleStart) {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  const now = new Date();
  const current = new Date(billingCycleStart);
  while (true) {
    const next = new Date(current);
    next.setMonth(next.getMonth() + 1);
    if (next > now) break;
    current.setTime(next.getTime());
  }
  return current.toISOString();
}

/**
 * Registers an inbound contact against the current billing cycle in central_cab.contact_usage.
 */
async function registerContact(supabase: any, userId: string, phoneNumber: string, corrId: string) {
  try {
    const key = normalizeContactKey(phoneNumber);
    if (!key) return { blocked: false, isNew: false };

    const { data: profile } = await supabase
      .schema("central_cab")
      .from("profiles")
      .select("billing_cycle_start, addon_contacts, plan_tier")
      .eq("user_id", userId)
      .maybeSingle();

    const periodStart = cycleStart(profile?.billing_cycle_start);

    const { data: existing } = await supabase
      .schema("central_cab")
      .from("contact_usage")
      .select("id")
      .eq("user_id", userId)
      .eq("phone_number", key)
      .eq("period_start", periodStart)
      .maybeSingle();

    if (existing) return { blocked: false, isNew: false };

    // New contact — enforce allowance before counting them in
    const { data: platformLimits } = await supabase
      .schema("central_cab")
      .from("platform_settings")
      .select("value")
      .eq("key", "plan_limits")
      .maybeSingle();

    const tier = profile?.plan_tier || "free";
    const tierLimits = platformLimits?.value?.[tier] || {};
    const limit = (tierLimits.contacts_per_month || 50) + (profile?.addon_contacts || 0);

    const { data: used } = await supabase
      .schema("central_cab")
      .rpc("get_contact_usage", {
        _user_id: userId,
        _since: periodStart,
      });

    if ((used || 0) >= limit) {
      console.log(`[${corrId}] Contact limit ${used}/${limit} reached for user ${userId}`);
      return { blocked: true, isNew: true };
    }

    await supabase
      .schema("central_cab")
      .from("contact_usage")
      .insert({ user_id: userId, phone_number: key, period_start: periodStart });

    console.log(`[${corrId}] New contact registered (${(used || 0) + 1}/${limit}) for user ${userId}`);
    return { blocked: false, isNew: true };
  } catch (e) {
    console.error(`[${corrId}] registerContact failed:`, e);
    return { blocked: false, isNew: false };
  }
}

