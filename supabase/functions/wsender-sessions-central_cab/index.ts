import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  "Access-Control-Max-Age": "86400",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const WAHA_BASE = (Deno.env.get("WAHA_BASE_URL") || "").replace(/\/+$/, "");
const WAHA_KEY = Deno.env.get("WAHA_API_KEY") || "";

async function wahaFetch(path: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const headers = new Headers(init.headers || {});
  if (WAHA_KEY) headers.set("X-Api-Key", WAHA_KEY);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  const { timeoutMs, ...rest } = init;
  return fetch(`${WAHA_BASE}${path}`, {
    ...rest,
    headers,
    signal: init.signal || AbortSignal.timeout(timeoutMs ?? 30_000),
  });
}

function wahaFireAndForget(path: string, method: string, timeoutMs = 25_000) {
  return wahaFetch(path, { method, timeoutMs }).then(
    (r) => r.status,
    (e) => { console.warn("waha bg call failed", path, String(e)); return 0; },
  );
}

async function safeReadJson(res: Response) {
  const txt = await res.text();
  if (!txt.trim()) return null;
  try { return JSON.parse(txt); } catch { return { raw: txt }; }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

function isPng(bytes: Uint8Array): boolean {
  return bytes.length > 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "No authorization header" }), {
      status: 401, headers: jsonHeaders,
    });
  }

  let user: any = null;
  let isSuperAdmin = false;

  if (authHeader.includes(supabaseServiceKey)) {
    user = { id: "00000000-0000-0000-0000-000000000000", email: "admin@system" };
    isSuperAdmin = true;
  } else {
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authError } = await userClient.auth.getUser();
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: jsonHeaders,
      });
    }
    user = userData.user;
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (!WAHA_BASE) {
    return new Response(JSON.stringify({ error: "WAHA_BASE_URL not configured" }), {
      status: 500, headers: jsonHeaders,
    });
  }

  try {
    if (!isSuperAdmin) {
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      isSuperAdmin = (userRoles || []).some((r: any) => r.role === "super_admin");
    }

    const getOwnedSessionNames = async (): Promise<string[]> => {
      let q = supabase.from("user_wsender_sessions").select("session_id, session_api_key");
      if (!isSuperAdmin) q = q.eq("user_id", user.id);
      const { data } = await q;
      const set = new Set<string>();
      for (const row of data || []) {
        if (row.session_id) set.add(row.session_id);
        if (row.session_api_key) set.add(row.session_api_key);
      }
      return Array.from(set);
    };

    const assertOwnsSession = async (sessionName: string) => {
      if (isSuperAdmin) return true;
      const { data } = await supabase
        .from("user_wsender_sessions")
        .select("id")
        .eq("user_id", user.id)
        .or(`session_id.eq.${sessionName},session_api_key.eq.${sessionName}`)
        .limit(1)
        .maybeSingle();
      if (!data) {
        throw new Response(JSON.stringify({ error: "Session not found or not owned by you" }), {
          status: 403, headers: jsonHeaders,
        });
      }
      return true;
    };

    switch (action) {
      case "list-sessions": {
        const owned = await getOwnedSessionNames();
        if (!isSuperAdmin && owned.length === 0) {
          return new Response(JSON.stringify({ success: true, data: [] }), { headers: jsonHeaders });
        }

        const res = await wahaFetch("/api/sessions?all=true");
        if (!res.ok) {
          return new Response(JSON.stringify({ error: "WAHA list failed", status: res.status }), {
            status: 502, headers: jsonHeaders,
          });
        }
        const allSessions = (await res.json()) || [];
        const filtered = isSuperAdmin
          ? allSessions
          : allSessions.filter((s: any) => owned.includes(s.name));

        const normalized = filtered.map((s: any) => ({
          id: s.name,
          name: s.name,
          status: s.status,
          phone: s.me?.id?.split("@")[0] || null,
          engine: s.engine,
        }));

        return new Response(JSON.stringify({ success: true, data: normalized }), { headers: jsonHeaders });
      }

      case "create-session": {
        let sessionName = "";
        try {
          const body = await req.json();
          sessionName = body?.sessionName || body?.name || "";
        } catch { /* empty */ }

        if (!sessionName) {
          sessionName = `user-${user.id.substring(0, 8)}-${Date.now().toString(36)}`;
        }
        sessionName = sessionName.replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();

        // Webhook URL specifically targeting webhook-wsender-central_cab
        const webhookUrl = Deno.env.get("WEBHOOK_URL_OVERRIDE") || `${supabaseUrl}/functions/v1/webhook-wsender-central_cab`;

        const wahaPayload = {
          name: sessionName,
          start: true,
          config: {
            webhooks: [{
              url: webhookUrl,
              events: ["message", "message.any", "session.status"],
            }],
          },
        };

        const res = await wahaFetch("/api/sessions", {
          method: "POST",
          body: JSON.stringify(wahaPayload),
        });

        if (!res.ok && res.status !== 409 && res.status !== 422) {
          const err = await safeReadJson(res);
          return new Response(JSON.stringify({ error: err?.message || "Failed to create WAHA session" }), {
            status: res.status, headers: jsonHeaders,
          });
        }

        await supabase.from("user_wsender_sessions").upsert({
          user_id: user.id,
          session_id: sessionName,
          session_name: sessionName,
          session_api_key: sessionName,
        }, { onConflict: "user_id,session_id" });

        return new Response(JSON.stringify({
          success: true,
          data: { id: sessionName, name: sessionName, status: "STARTING" },
        }), { headers: jsonHeaders });
      }

      case "session-details": {
        const sessionId = url.searchParams.get("sessionId");
        if (!sessionId) {
          return new Response(JSON.stringify({ error: "Missing sessionId" }), { status: 400, headers: jsonHeaders });
        }
        await assertOwnsSession(sessionId);

        const res = await wahaFetch(`/api/sessions/${encodeURIComponent(sessionId)}`);
        if (!res.ok) {
          return new Response(JSON.stringify({ error: "WAHA session not found" }), { status: res.status, headers: jsonHeaders });
        }
        const s = await res.json();
        return new Response(JSON.stringify({
          success: true,
          data: {
            id: s.name,
            name: s.name,
            status: s.status,
            phone: s.me?.id?.split("@")[0] || null,
          },
        }), { headers: jsonHeaders });
      }

      case "get-qr": {
        const sessionId = url.searchParams.get("sessionId");
        if (!sessionId) {
          return new Response(JSON.stringify({ error: "Missing sessionId" }), { status: 400, headers: jsonHeaders });
        }
        await assertOwnsSession(sessionId);

        let res: Response | null = null;
        for (let attempt = 0; attempt < 5; attempt++) {
          res = await wahaFetch(`/api/${encodeURIComponent(sessionId)}/auth/qr`);
          if (res.ok) break;

          // If stopped on first attempt, auto-start it
          if (attempt === 0) {
            try {
              const detailRes = await wahaFetch(`/api/sessions/${encodeURIComponent(sessionId)}`);
              if (detailRes.ok) {
                const detail = await detailRes.json();
                if (detail.status === "STOPPED") {
                  await wahaFetch(`/api/sessions/${encodeURIComponent(sessionId)}/start`, { method: "POST" });
                }
              }
            } catch { /* ignore */ }
          }

          // Wait 1.5s for Chromium to finish initializing QR
          await new Promise((r) => setTimeout(r, 1500));
        }

        if (!res || !res.ok) {
          return new Response(JSON.stringify({
            error: "QR code is still preparing. Chromium is booting up, please wait a few seconds and click Get QR Code again.",
            status: res?.status || 500,
          }), {
            status: res?.status === 422 ? 422 : 502,
            headers: jsonHeaders,
          });
        }

        const contentType = res.headers.get("content-type") || res.headers.get("Content-Type") || "";
        if (contentType.includes("image/")) {
          const buf = new Uint8Array(await res.arrayBuffer());
          const b64 = bytesToBase64(buf);
          return new Response(JSON.stringify({
            success: true,
            data: { qrImage: `data:${contentType};base64,${b64}`, qrCode: null },
          }), { headers: jsonHeaders });
        }

        const data = await safeReadJson(res);
        let qrImage: string | null = null;
        let qrCode: string | null = null;

        if (data?.data && typeof data.data === "string") {
          const mime = data.mimetype || "image/png";
          qrImage = data.data.startsWith("data:") ? data.data : `data:${mime};base64,${data.data}`;
        } else if (data?.qr || data?.value) {
          qrCode = data.qr || data.value;
        }

        return new Response(JSON.stringify({
          success: true,
          data: { qrCode, qrImage },
        }), { headers: jsonHeaders });
      }

      case "delete-session": {
        const sessionId = url.searchParams.get("sessionId");
        if (!sessionId) {
          return new Response(JSON.stringify({ error: "Missing sessionId" }), { status: 400, headers: jsonHeaders });
        }
        await assertOwnsSession(sessionId);

        wahaFireAndForget(`/api/sessions/${encodeURIComponent(sessionId)}/stop`, "POST");
        wahaFireAndForget(`/api/sessions/${encodeURIComponent(sessionId)}/logout`, "POST");
        wahaFireAndForget(`/api/sessions/${encodeURIComponent(sessionId)}`, "DELETE");

        await supabase
          .from("user_wsender_sessions")
          .delete()
          .eq("user_id", user.id)
          .or(`session_id.eq.${sessionId},session_api_key.eq.${sessionId}`);

        return new Response(JSON.stringify({ success: true, message: "Session deleted" }), { headers: jsonHeaders });
      }

      case "set-webhook": {
        const sessionId = url.searchParams.get("sessionId");
        if (!sessionId) {
          return new Response(JSON.stringify({ error: "Missing sessionId" }), { status: 400, headers: jsonHeaders });
        }
        await assertOwnsSession(sessionId);

        let webhookUrl = "";
        try {
          const body = await req.json();
          webhookUrl = body?.webhook_url || body?.url || "";
        } catch { /* empty */ }

        if (!webhookUrl) {
          webhookUrl = Deno.env.get("WEBHOOK_URL_OVERRIDE") || `${supabaseUrl}/functions/v1/webhook-wsender-central_cab`;
        }

        // Update session webhook in WAHA
        try {
          await wahaFetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
            method: "PATCH",
            body: JSON.stringify({
              config: {
                webhooks: [{
                  url: webhookUrl,
                  events: ["message", "message.any", "session.status"],
                }],
              },
            }),
          });
        } catch (e) {
          console.warn("WAHA patch webhook notice:", e);
        }

        return new Response(JSON.stringify({
          success: true,
          message: "Webhook configured successfully",
          data: { webhookUrl },
        }), { headers: jsonHeaders });
      }

      case "list-groups": {
        let sessionId = url.searchParams.get("sessionId");
        if (!sessionId) {
          const owned = await getOwnedSessionNames();
          if (owned.length > 0) {
            sessionId = owned[0];
          }
        }
        if (!sessionId) {
          return new Response(JSON.stringify({ success: true, data: [] }), { headers: jsonHeaders });
        }
        await assertOwnsSession(sessionId);

        // Try /api/{sessionId}/groups
        let res = await wahaFetch(`/api/${encodeURIComponent(sessionId)}/groups`);
        if (!res.ok) {
          // Fallback to /api/{sessionId}/chats
          res = await wahaFetch(`/api/${encodeURIComponent(sessionId)}/chats`);
        }

        if (!res.ok) {
          const err = await safeReadJson(res);
          return new Response(JSON.stringify({ error: err?.message || "Failed to fetch groups from WhatsApp" }), {
            status: res.status, headers: jsonHeaders,
          });
        }

        const rawData = (await res.json()) || [];
        const normalizeId = (val: any): string => {
          if (!val) return "";
          if (typeof val === "string") return val;
          if (typeof val === "object") {
            return val._serialized || (val.user && val.server ? `${val.user}@${val.server}` : "") || "";
          }
          return String(val);
        };

        const normalizeName = (g: any, fallbackId: string): string => {
          if (typeof g.name === "string" && g.name.trim()) return g.name.trim();
          if (typeof g.subject === "string" && g.subject.trim()) return g.subject.trim();
          if (g.groupMetadata && typeof g.groupMetadata.subject === "string" && g.groupMetadata.subject.trim()) {
            return g.groupMetadata.subject.trim();
          }
          return fallbackId ? `Group (${fallbackId.replace("@g.us", "")})` : "WhatsApp Group";
        };

        const groups = (Array.isArray(rawData) ? rawData : [])
          .map((g: any) => {
            const cleanId = normalizeId(g.id || g.groupMetadata?.id);
            const cleanName = normalizeName(g, cleanId);
            return {
              id: cleanId,
              name: cleanName,
              isGroup: Boolean(g.isGroup || cleanId.endsWith("@g.us")),
            };
          })
          .filter((g) => g.id && (g.id.endsWith("@g.us") || g.isGroup))
          .map((g) => ({
            id: g.id,
            name: g.name,
          }));

        return new Response(JSON.stringify({ success: true, data: groups }), { headers: jsonHeaders });
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: jsonHeaders });
    }
  } catch (err: any) {
    if (err instanceof Response) return err;
    console.error("wsender-sessions-central_cab error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: jsonHeaders });
  }
});
