import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WAHA_BASE = (Deno.env.get("WAHA_BASE_URL") || "").replace(/\/+$/, "");
const WAHA_KEY = Deno.env.get("WAHA_API_KEY") || "";

function detectMediaType(url: string): "image" | "video" | "audio" | "document" | null {
  if (!url) return null;
  const lower = url.toLowerCase();
  if (/\.(jpg|jpeg|png|webp|gif)(\?|$)/.test(lower)) return "image";
  if (/\.(mp4|mov|avi|webm|3gp|3gpp)(\?|$)/.test(lower)) return "video";
  if (/\.(mp3|wav|ogg|oga|m4a|aac|amr|opus)(\?|$)/.test(lower)) return "audio";
  if (/\.(pdf|docx?|xlsx?|pptx?|csv|txt)(\?|$)/.test(lower)) return "document";
  return "image";
}

function toChatId(to: string): string {
  if (!to) return "";
  if (to.includes("@")) return to.trim();
  let digits = String(to).replace(/\D/g, "");
  if (!digits) return "";
  // Auto-normalize Sri Lankan local numbers: 07XXXXXXXX -> 947XXXXXXXX, 7XXXXXXXX -> 947XXXXXXXX
  if (digits.startsWith("0") && digits.length === 10) {
    digits = "94" + digits.slice(1);
  } else if (digits.length === 9 && digits.startsWith("7")) {
    digits = "94" + digits;
  }
  if (digits.length >= 15) return `${digits}@lid`;
  return `${digits}@c.us`;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunkSize) as unknown as number[]
    );
  }
  return btoa(binary);
}

function filenameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop() || "file";
    return last.split("?")[0];
  } catch {
    return "file";
  }
}

async function wahaFetch(path: string, body: any) {
  if (!WAHA_BASE) throw new Error("WAHA_BASE_URL not configured");
  return fetch(`${WAHA_BASE}${path}`, {
    method: "POST",
    headers: {
      "X-Api-Key": WAHA_KEY,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function getActiveSession(preferredSession?: string): Promise<string> {
  if (preferredSession && preferredSession !== "default") {
    return preferredSession;
  }
  try {
    const res = await fetch(`${WAHA_BASE}/api/sessions`, {
      headers: { "X-Api-Key": WAHA_KEY },
    });
    if (res.ok) {
      const sessions = await res.json();
      const working = sessions.find((s: any) => s.status === "WORKING");
      if (working?.name) return working.name;
      if (sessions[0]?.name) return sessions[0].name;
    }
  } catch (err) {
    console.warn("[send-whatsapp-central_cab] Failed to query active sessions:", err);
  }
  return preferredSession || Deno.env.get("WAHA_DEFAULT_SESSION") || "default";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, message, sessionApiKey, imageUrl, mediaUrl, mediaType: explicitType } = await req.json();

    if (!to || (!message && !imageUrl && !mediaUrl)) {
      return new Response(
        JSON.stringify({ error: "Missing 'to' or 'message'/'mediaUrl' field" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sessionName = await getActiveSession(sessionApiKey);
    const chatId = toChatId(to);
    const url = mediaUrl || imageUrl;
    const detectedType = explicitType || (url ? detectMediaType(url) : null);

    console.log(`[send-whatsapp-central_cab] Sending to ${chatId} (${detectedType || "text"}): ${(message || "").substring(0, 60)}`);

    let res: Response;

    if (url) {
      const fileName = filenameFromUrl(url);
      let file: any = null;

      // If media is hosted locally inside WAHA (/api/files/) or localhost:3000
      if (url.includes("/api/files/") || url.includes("localhost:3000") || url.includes("waha:3000")) {
        const fetchUrl = url.replace("http://localhost:3000", WAHA_BASE || "http://waha:3000");
        try {
          console.log(`[send-whatsapp-central_cab] Fetching internal media buffer from ${fetchUrl}...`);
          const fileRes = await fetch(fetchUrl, {
            headers: { "X-Api-Key": WAHA_KEY },
          });
          if (fileRes.ok) {
            const buf = await fileRes.arrayBuffer();
            const b64 = uint8ToBase64(new Uint8Array(buf));
            const contentType = fileRes.headers.get("content-type") || (detectedType === "audio" ? "audio/ogg; codecs=opus" : "application/octet-stream");
            file = {
              data: b64,
              filename: fileName || (detectedType === "audio" ? "voice.oga" : "file"),
              mimetype: contentType,
            };
            console.log(`[send-whatsapp-central_cab] Successfully converted internal media (${buf.byteLength} bytes) to base64 payload`);
          } else {
            console.warn(`[send-whatsapp-central_cab] Failed to fetch internal media (${fileRes.status})`);
          }
        } catch (fetchErr) {
          console.warn(`[send-whatsapp-central_cab] Internal media fetch error:`, fetchErr);
        }
      }

      // If base64 conversion was not applicable or failed, fallback to url
      if (!file) {
        file = {
          url: url.replace("http://localhost:3000", WAHA_BASE || "http://waha:3000"),
          filename: fileName,
          mimetype: detectedType === "audio" ? "audio/ogg; codecs=opus" : undefined,
        };
      }

      const caption = message || "";

      switch (detectedType) {
        case "video":
          res = await wahaFetch("/api/sendVideo", { session: sessionName, chatId, file, caption });
          break;
        case "audio":
          res = await wahaFetch("/api/sendVoice", { session: sessionName, chatId, file });
          // If sendVoice fails (e.g. WAHA WEBJS puppeteer waveform decode error), fallback to sendFile
          if (!res.ok) {
            const errBody = await res.text();
            console.warn(`[send-whatsapp-central_cab] /api/sendVoice failed [${res.status}]: ${errBody}. Retrying via /api/sendFile...`);
            res = await wahaFetch("/api/sendFile", { session: sessionName, chatId, file, caption });
          }
          break;
        case "document":
          res = await wahaFetch("/api/sendFile", { session: sessionName, chatId, file, caption });
          break;
        case "image":
        default:
          res = await wahaFetch("/api/sendImage", { session: sessionName, chatId, file, caption });
          break;
      }
    } else {
      res = await wahaFetch("/api/sendText", { session: sessionName, chatId, text: message });
    }

    const responseText = await res.text();
    console.log(`[send-whatsapp-central_cab] WAHA response [${res.status}]: ${responseText.substring(0, 300)}`);

    if (!res.ok) {
      let parsed: any = null;
      try { parsed = JSON.parse(responseText); } catch { /* ignore */ }
      throw new Error(parsed?.message || parsed?.error || `WAHA send failed (${res.status}): ${responseText.substring(0, 200)}`);
    }

    let data: any = null;
    try { data = JSON.parse(responseText); } catch { /* ignore */ }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[send-whatsapp-central_cab] Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
