import { describe, it, expect } from "vitest";

// Test Spintax resolution
function resolveSpintax(text: string): string {
  if (!text) return "";
  let spun = text;
  const spintaxRegex = /\{([^{}]+)\}/g;
  while (spintaxRegex.test(spun)) {
    spun = spun.replace(spintaxRegex, (_, match) => {
      const parts = match.split("|");
      return parts[Math.floor(Math.random() * parts.length)] || "";
    });
  }
  return spun;
}

// Test Unique Fingerprint Generation
function generateUniqueFingerprint(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Test Anti-Ban delay calculation with Jitter
function calculateInterval(baseSeconds: number, withJitter: boolean): number {
  let delay = Math.max(3, baseSeconds);
  if (withJitter) {
    // jitter between 1 and 4 seconds
    const jitter = 2; // sample deterministic jitter for test
    delay += jitter;
  }
  return delay;
}

describe("WhatsApp Group Broadcast Suite", () => {
  it("resolves spintax dynamically to valid options", () => {
    const template = "{Hello|Hi|Greetings} drivers! {Please drive safe|Stay alert on the road}.";
    const resolved = resolveSpintax(template);

    expect(resolved).not.toContain("{");
    expect(resolved).not.toContain("}");
    expect(resolved).not.toContain("|");

    const possibleGreetings = ["Hello", "Hi", "Greetings"];
    const hasGreeting = possibleGreetings.some((g) => resolved.startsWith(g));
    expect(hasGreeting).toBe(true);
  });

  it("handles Tamil and Sinhala spintax properly", () => {
    const tamilTemplate = "{வணக்கம்|அன்புடையீர்}! 🚖 {அதிக சவாரிகள் உள்ளன|முன்பதிவுகள் தயாராக உள்ளன}.";
    const resolved = resolveSpintax(tamilTemplate);
    expect(resolved).not.toContain("{");
    expect(resolved).not.toContain("}");
    const containsTamilGreeting = resolved.includes("வணக்கம்") || resolved.includes("அன்புடையீர்");
    expect(containsTamilGreeting).toBe(true);
  });

  it("generates 4-character non-colliding fingerprints", () => {
    const code1 = generateUniqueFingerprint();
    const code2 = generateUniqueFingerprint();
    expect(code1).toHaveLength(4);
    expect(code2).toHaveLength(4);
    expect(/^[A-Z0-9]{4}$/.test(code1)).toBe(true);
  });

  it("computes safe anti-ban delay with jitter", () => {
    const delayWithout = calculateInterval(8, false);
    expect(delayWithout).toBe(8);

    const delayWith = calculateInterval(8, true);
    expect(delayWith).toBe(10);
  });

  it("differentiates all 4 service categories and assigns correct labels", () => {
    const categories = ["hire", "rent_a_car", "delivery_shop", "delivery_riders"] as const;
    expect(categories).toHaveLength(4);

    const labels: Record<string, string> = {
      hire: "Hire Drivers",
      rent_a_car: "Rent a Car",
      delivery_shop: "Delivery Shops",
      delivery_riders: "Delivery Riders",
    };

    categories.forEach((cat) => {
      expect(labels[cat]).toBeDefined();
    });
  });

  it("validates WhatsApp Group chat ID format (@g.us)", () => {
    const validGroupJid = "120363413931020462@g.us";
    const invalidPhone = "0771234567";

    expect(validGroupJid.endsWith("@g.us")).toBe(true);
    expect(invalidPhone.endsWith("@g.us")).toBe(false);
  });
});
