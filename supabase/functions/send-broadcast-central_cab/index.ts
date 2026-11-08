import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    db: { schema: "central_cab" },
  });

  let triggerSource = "cron";
  let targetOrderCode = "";
  try {
    const body = await req.json();
    if (body?.trigger) triggerSource = body.trigger;
    if (body?.orderCode) targetOrderCode = body.orderCode;
  } catch {
    // Body is empty for plain cron triggers
  }

  console.log(`[send-broadcast-central_cab] Triggered by: ${triggerSource}${targetOrderCode ? ` (order: ${targetOrderCode})` : ""}`);

  // 1. Recover stale items stuck in 'processing' for more than 2 minutes
  try {
    await supabase
      .from("order_broadcast_queue")
      .update({ status: "pending", updated_at: new Date().toISOString() })
      .eq("status", "processing")
      .lt("updated_at", new Date(Date.now() - 2 * 60 * 1000).toISOString());
  } catch (recErr) {
    console.warn("[send-broadcast-central_cab] Recovery error:", recErr);
  }

  // 2. Read delay from cab_system_settings
  let delaySec = 3;
  try {
    const { data: settingsRow } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "cab_system_settings")
      .limit(1)
      .maybeSingle();

    if (settingsRow?.value?.broadcast_delay_seconds !== undefined) {
      delaySec = Math.max(1, Number(settingsRow.value.broadcast_delay_seconds));
    }
  } catch (setErr) {
    console.warn("[send-broadcast-central_cab] Settings lookup error:", setErr);
  }

  // Calculate safe batch size to finish comfortably under 50 seconds (well within the 150s limit)
  const batchSize = Math.min(15, Math.max(4, Math.floor(45 / delaySec)));

  // 3. Fetch pending broadcast records
  const { data: pendingItems, error: fetchErr } = await supabase
    .from("order_broadcast_queue")
    .select("*")
    .in("status", ["pending", "failed"])
    .lt("attempts", 3)
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (fetchErr) {
    console.error("[send-broadcast-central_cab] Fetch error:", fetchErr);
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!pendingItems || pendingItems.length === 0) {
    return new Response(JSON.stringify({ success: true, processed: 0, message: "No pending broadcasts" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[send-broadcast-central_cab] Claiming batch of ${pendingItems.length} items (delay: ${delaySec}s)`);

  let sentCount = 0;
  let failCount = 0;

  for (let i = 0; i < pendingItems.length; i++) {
    const item = pendingItems[i];

    // Atomically claim the item so concurrent runs don't duplicate
    const { data: claimed, error: claimErr } = await supabase
      .from("order_broadcast_queue")
      .update({
        status: "processing",
        attempts: (item.attempts || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id)
      .in("status", ["pending", "failed"])
      .select()
      .maybeSingle();

    if (claimErr || !claimed) {
      continue;
    }

    if (i > 0 && delaySec > 0) {
      await new Promise((resolve) => setTimeout(resolve, delaySec * 1000));
    }

    console.log(`[send-broadcast-central_cab] Forwarding order ${item.order_code} to group: ${item.group_name} (${item.group_chat_id})`);

    try {
      const gRes = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-central_cab`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: item.group_chat_id,
          message: item.message_text,
          sessionApiKey: item.session_api_key,
        }),
      });

      const resText = await gRes.text();

      if (gRes.ok || gRes.status === 200 || gRes.status === 201) {
        sentCount++;
        await supabase
          .from("order_broadcast_queue")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        // Update central_cab.orders.broadcasted_groups
        try {
          const { data: existingOrder } = await supabase
            .from("orders")
            .select("broadcasted_groups")
            .eq("order_code", item.order_code)
            .maybeSingle();

          const currentGroups = Array.isArray(existingOrder?.broadcasted_groups)
            ? [...existingOrder.broadcasted_groups]
            : [];

          currentGroups.push({
            name: item.group_name,
            chat_id: item.group_chat_id,
            sent_at: new Date().toISOString(),
          });

          await supabase
            .from("orders")
            .update({
              broadcasted_groups: currentGroups,
              updated_at: new Date().toISOString(),
            })
            .eq("order_code", item.order_code);
        } catch (upErr) {
          console.warn(`[send-broadcast-central_cab] Failed to update orders.broadcasted_groups for ${item.order_code}:`, upErr);
        }
      } else {
        failCount++;
        console.error(`[send-broadcast-central_cab] Group dispatch ${item.group_name} (${item.group_chat_id}) failed: status ${gRes.status} - ${resText.slice(0, 150)}`);
        const isExhausted = (item.attempts || 0) + 1 >= (item.max_attempts || 3);
        await supabase
          .from("order_broadcast_queue")
          .update({
            status: isExhausted ? "failed" : "pending",
            error_message: `HTTP ${gRes.status}: ${resText.slice(0, 300)}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);
      }
    } catch (err: any) {
      failCount++;
      console.error(`[send-broadcast-central_cab] Group dispatch ${item.group_name} (${item.group_chat_id}) exception:`, err);
      const isExhausted = (item.attempts || 0) + 1 >= (item.max_attempts || 3);
      await supabase
        .from("order_broadcast_queue")
        .update({
          status: isExhausted ? "failed" : "pending",
          error_message: err?.message || String(err),
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
    }
  }

  return new Response(JSON.stringify({
    success: true,
    processed: pendingItems.length,
    sent: sentCount,
    failed: failCount,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
