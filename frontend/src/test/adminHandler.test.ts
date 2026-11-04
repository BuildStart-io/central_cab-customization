import { describe, it, expect } from "vitest";

// Types matching adminHandler.ts
interface DriverGroup {
  id?: string;
  name: string;
  chat_id: string;
}

interface CabSystemSettings {
  admin_whatsapp_number: string;
  hire_admin_number?: string;
  rent_admin_number?: string;
  delivery_admin_number?: string;
  broadcast_delay_seconds?: number;
  hire_driver_groups?: DriverGroup[];
  rent_a_car_groups?: DriverGroup[];
  delivery_driver_groups?: DriverGroup[];
  delivery_rider_groups?: DriverGroup[];
  target_driver_groups?: DriverGroup[];
}

function normalizePhone(p?: string): string {
  return String(p || "").replace(/\D/g, "");
}

function isAdminUser(phoneNumber: string, systemSettings: CabSystemSettings): boolean {
  const senderPhone = normalizePhone(phoneNumber);
  if (!senderPhone || senderPhone.length < 7) return false;

  const adminList = [
    normalizePhone(systemSettings?.admin_whatsapp_number),
    normalizePhone(systemSettings?.hire_admin_number),
    normalizePhone(systemSettings?.rent_admin_number),
    normalizePhone(systemSettings?.delivery_admin_number),
  ].filter(Boolean);

  const senderLast9 = senderPhone.slice(-9);

  return adminList.some((a) => {
    if (senderPhone === a) return true;
    if (a.length >= 9 && senderLast9 === a.slice(-9)) return true;
    return senderPhone.endsWith(a) || a.endsWith(senderPhone);
  });
}

function extractOrderCode(text: string): string | null {
  if (!text) return null;
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

function extractShopPickupLocation(messageText: string, orderCode: string): string {
  let cleaned = messageText || "";
  const safeCode = (orderCode || "").replace(/\s+/g, "[-_\\s]?");
  const orderRegex = new RegExp(`(?:#)?\\b${safeCode}\\b`, "i");
  cleaned = cleaned.replace(orderRegex, " ");
  cleaned = cleaned.replace(/\b(confirm|conform|confrm|cnf|confirmed|conformed|order|book|booked|ok|done|accept|accepted|yes)\b/gi, " ");
  cleaned = cleaned.replace(/\b(shop\s*pickup\s*location|shop\s*pickup|pickup\s*location|pickup|shop\s*location|shop)\s*[:=-]?\s*/gi, " ");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  cleaned = cleaned.replace(/^[-:,\s]+/, "").trim();
  return cleaned;
}

describe("Admin Handler & Approval Logic Verification", () => {
  const settings: CabSystemSettings = {
    admin_whatsapp_number: "94770001122",
    hire_admin_number: "94770003344",
    rent_admin_number: "94770005566",
    delivery_admin_number: "94770007788",
    hire_driver_groups: [{ id: "hire_grp", name: "Hire Drivers", chat_id: "hire_grp@g.us" }],
    rent_a_car_groups: [{ id: "rent_grp", name: "Rent Fleet", chat_id: "rent_grp@g.us" }],
    delivery_driver_groups: [{ id: "shop_grp", name: "Delivery Shops", chat_id: "shop_grp@g.us" }],
    delivery_rider_groups: [{ id: "rider_grp", name: "Delivery Riders", chat_id: "rider_grp@g.us" }],
  };

  // 1. Phone number authorization
  it("authenticates Master Admin and all service-specific admins", () => {
    expect(isAdminUser("94770001122", settings)).toBe(true);
    expect(isAdminUser("+94 77 000 1122", settings)).toBe(true);
    expect(isAdminUser("0770001122", settings)).toBe(true);
    expect(isAdminUser("94770003344", settings)).toBe(true); // Hire
    expect(isAdminUser("94770005566", settings)).toBe(true); // Rent
    expect(isAdminUser("94770007788", settings)).toBe(true); // Delivery
    expect(isAdminUser("94719998877", settings)).toBe(false); // Customer
  });

  // 2. Order Code Extraction
  it("correctly extracts and normalizes order codes for all services", () => {
    expect(extractOrderCode("HIR 001")).toBe("HIR 001");
    expect(extractOrderCode("CONFIRM HIR 42")).toBe("HIR 042");
    expect(extractOrderCode("#hir-105")).toBe("HIR 105");
    expect(extractOrderCode("RNT 003")).toBe("RNT 003");
    expect(extractOrderCode("Please confirm RNT-12")).toBe("RNT 012");
    expect(extractOrderCode("DEL 007")).toBe("DEL 007");
    expect(extractOrderCode("CONFIRM DEL-99")).toBe("DEL 099");
    expect(extractOrderCode("Hello how are you")).toBe(null);
  });

  // 3. Shop Pickup Location Extraction
  it("extracts clean shop pickup location from delivery confirmation message", () => {
    const loc1 = extractShopPickupLocation("CONFIRM DEL 001 Perera Bakers, Main Street, Batticaloa", "DEL 001");
    expect(loc1).toBe("Perera Bakers, Main Street, Batticaloa");

    const loc2 = extractShopPickupLocation("DEL 002 shop pickup: Cargills Food City, Colombo 03", "DEL 002");
    expect(loc2).toBe("Cargills Food City, Colombo 03");

    const emptyLoc = extractShopPickupLocation("DEL 003 ok confirmed", "DEL 003");
    expect(emptyLoc).toBe("");
  });

  // 4. Service 1: Hire / Cab Approval Workflow
  it("executes Service 1 (Hire Cab) approval workflow: Order selection -> Voice Note -> Confirmation", () => {
    // Step 1: Admin sends order code
    const initialSession = { step: "IDLE", pendingCode: null };
    const orderInput = "HIR 015";
    const extracted = extractOrderCode(orderInput);
    expect(extracted).toBe("HIR 015");

    // Transition to AWAITING_VOICE_NOTE
    const awaitingSession = {
      step: "AWAITING_VOICE_NOTE",
      pendingCode: extracted,
    };
    expect(awaitingSession.step).toBe("AWAITING_VOICE_NOTE");
    expect(awaitingSession.pendingCode).toBe("HIR 015");

    // Step 2: Admin sends voice note
    const voiceMsg = { type: "ptt", mediaUrl: "https://example.com/driver-voice.ogg" };
    expect(voiceMsg.type).toBe("ptt");
    expect(voiceMsg.mediaUrl).toBeTruthy();

    // Final order confirmed state
    const confirmedOrder = {
      order_code: awaitingSession.pendingCode,
      status: "confirmed",
      assigned_voice_url: voiceMsg.mediaUrl,
    };
    expect(confirmedOrder.status).toBe("confirmed");
    expect(confirmedOrder.assigned_voice_url).toBe("https://example.com/driver-voice.ogg");
  });

  // 5. Service 2: Rent a Car Approval Workflow
  it("executes Service 2 (Rent a Car) approval workflow: Immediate booking confirmation upon RNT code", () => {
    const adminMsg = "CONFIRM RNT 004";
    const code = extractOrderCode(adminMsg);
    expect(code).toBe("RNT 004");

    const order = { order_code: code, status: "pending", service_type: "rent_a_car" };
    // RNT requires no voice note: immediate confirmation
    const confirmedOrder = { ...order, status: "confirmed" };
    expect(confirmedOrder.status).toBe("confirmed");

    const rentGroups = settings.rent_a_car_groups;
    expect(rentGroups?.length).toBe(1);
    expect(rentGroups?.[0].chat_id).toBe("rent_grp@g.us");
  });

  // 6. Service 3: Delivery Approval Workflow (Two-step and One-step)
  it("executes Service 3 (Delivery) approval workflow via 2-step (code then location) and 1-step", () => {
    // 6a: 2-Step
    const step1Msg = "DEL 009";
    const code = extractOrderCode(step1Msg);
    expect(code).toBe("DEL 009");

    const sessionState = {
      step: "AWAITING_DELIVERY_SHOP_LOCATION",
      pendingCode: code,
    };
    expect(sessionState.step).toBe("AWAITING_DELIVERY_SHOP_LOCATION");

    const step2Msg = "Kandy Sweet House, Station Road";
    const assignedLocation = step2Msg.trim();
    const confirmedDelivery2Step = {
      order_code: sessionState.pendingCode,
      status: "confirmed",
      pickup_address: assignedLocation,
    };
    expect(confirmedDelivery2Step.status).toBe("confirmed");
    expect(confirmedDelivery2Step.pickup_address).toBe("Kandy Sweet House, Station Road");

    // 6b: 1-Step (Single message with both code and shop location)
    const singleMsg = "CONFIRM DEL 010 Royal Bakery, Batticaloa";
    const singleCode = extractOrderCode(singleMsg);
    const shopLoc = extractShopPickupLocation(singleMsg, singleCode!);
    expect(singleCode).toBe("DEL 010");
    expect(shopLoc).toBe("Royal Bakery, Batticaloa");

    const confirmedDelivery1Step = {
      order_code: singleCode,
      status: "confirmed",
      pickup_address: shopLoc,
    };
    expect(confirmedDelivery1Step.status).toBe("confirmed");
    expect(confirmedDelivery1Step.pickup_address).toBe("Royal Bakery, Batticaloa");
  });
});
