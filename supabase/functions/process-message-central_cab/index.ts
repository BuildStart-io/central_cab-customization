import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { processCustomerChatStep, BotSessionState } from "./stateMachine.ts";
import { handleAdminMessage, isAdminUser, CabSystemSettings } from "./adminHandler.ts";
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

  // 3. Route to Admin Handler or Customer State Machine
  if (isAdminUser(phoneNumber, systemSettings)) {
    console.log(`[${corrId}] Detected message from configured Admin (${phoneNumber})`);
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
  } else {
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
      sessionApiKey
    );

    replyText = stepResult.replyText;

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
  }

  // 4. Send outbound WhatsApp reply if generated
  if (replyText) {
    console.log(`[${corrId}] Outbound reply to ${phoneNumber}: ${replyText.substring(0, 60)}`);
    
    // Send via send-whatsapp-central_cab
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
}
