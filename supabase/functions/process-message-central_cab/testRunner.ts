import { processCustomerChatStep, BotSessionState } from "./stateMachine.ts";
import {
  isValidLocationInput,
  isGoogleMapsUrl,
  formatLocationDisplay,
  PricingSettings,
  calculateFare,
  normalizeVehicleKey,
  DistanceDiscountSlab,
  VehicleModel,
} from "./pricingEngine.ts";
import {
  SupportedLanguage,
  getDropoffHelpPoll,
  getDropoffHelpGuide,
  getDropoffDirectLinkPrompt,
  getLocationRejectMessage,
  formatLocationLinkForCustomer,
  getBookingSummaryCard,
  getDeliveryOrderSummaryCard,
  getTripTypePoll,
} from "./i18n.ts";

export interface TestResultItem {
  name: string;
  passed: boolean;
  details?: string;
  error?: string;
}

export async function runAllAutomatedTests(
  supabase: any,
  supabaseUrl: string,
  supabaseServiceKey: string,
  userId: string
): Promise<{ total: number; passed: number; failed: number; results: TestResultItem[] }> {
  const results: TestResultItem[] = [];

  function record(name: string, condition: boolean, details?: string) {
    results.push({
      name,
      passed: !!condition,
      details,
      error: condition ? undefined : details || "Assertion failed",
    });
  }

  const defaultPricing: PricingSettings = {
    motorbike: { base_price: 200, per_km_rate: 80, coverage_km: 2, discount_percentage: 10 },
    three_wheeler: { base_price: 300, per_km_rate: 100, coverage_km: 2, discount_percentage: 10 },
    car: { base_price: 600, per_km_rate: 150, coverage_km: 3, discount_percentage: 15 },
    van: { base_price: 900, per_km_rate: 200, coverage_km: 3, discount_percentage: 15 },
    lorry: { base_price: 1500, per_km_rate: 300, coverage_km: 5, discount_percentage: 10 },
    bus: { base_price: 3000, per_km_rate: 500, coverage_km: 10, discount_percentage: 10 },
  };

  const defaultSystemSettings: any = {
    admin_whatsapp_number: "94770000000",
    target_driver_groups: [],
  };

  const testPhone = "94779998877";

  try {
    // ------------------------------------------------------------------------
    // TEST 1: isValidLocationInput Unit Tests
    // ------------------------------------------------------------------------
    record("1.1 Reject plain text 'Colombo'", isValidLocationInput("Colombo", {}) === false);
    record("1.2 Reject plain text 'Katunayake Airport'", isValidLocationInput("Katunayake Airport", {}) === false);
    record("1.3 Reject plain text 'Galle Fort Road'", isValidLocationInput("Galle Fort Road", {}) === false);
    record("1.4 Accept maps.google.com URL", isValidLocationInput("https://maps.google.com/?q=6.9271,79.8612", {}) === true);
    record("1.5 Accept maps.app.goo.gl URL", isValidLocationInput("https://maps.app.goo.gl/u8W3G4vX1", {}) === true);
    record("1.6 Accept goo.gl/maps URL", isValidLocationInput("https://goo.gl/maps/abc123xyz", {}) === true);
    record("1.7 Accept WhatsApp Location Pin payload", isValidLocationInput("Location: Pin", { locationDetails: { latitude: 6.9271, longitude: 79.8612 } }) === true);
    record("1.8 Accept Raw GPS Coordinates", isValidLocationInput("6.9271, 79.8612", {}) === true);

    // ------------------------------------------------------------------------
    // TEST 2: formatLocationLinkForCustomer Unit Tests
    // ------------------------------------------------------------------------
    const pinLink = formatLocationLinkForCustomer("Pin Location (6.9271, 79.8612)", { lat: 6.9271, lng: 79.8612 });
    record("2.1 Pin formats into clickable Google Maps link", pinLink.includes("https://maps.google.com/?q=6.9271,79.8612"), pinLink);
    record("2.2 Pin does not show raw 'Pin Location'", !pinLink.includes("Pin Location"), pinLink);

    const shareUrl = "https://maps.app.goo.gl/sample123";
    const sharedFormatted = formatLocationLinkForCustomer(shareUrl, { lat: 6.0535, lng: 80.2210 });
    record("2.3 Preserves shared Google Maps URL", sharedFormatted.includes(shareUrl), sharedFormatted);

    // ------------------------------------------------------------------------
    // TEST 3: Drop-off Poll & Guide definitions
    // ------------------------------------------------------------------------
    const taPoll = getDropoffHelpPoll("ta");
    record("3.1 Tamil Dropoff Poll has 3 options", taPoll.options.length === 3);
    record("3.2 Tamil Poll Option 1 is Direct Link", taPoll.options[0].includes("தெரியும்"));
    record("3.3 Tamil Poll Option 2 is Help", taPoll.options[1].includes("தெரியாது"));

    const siPoll = getDropoffHelpPoll("si");
    record("3.4 Sinhala Poll Option 1 is Direct Link", siPoll.options[0].includes("දන්නවා"));
    record("3.5 Sinhala Poll Option 2 is Help", siPoll.options[1].includes("දන්නේ නෑ"));

    const taGuide = getDropoffHelpGuide("ta");
    record("3.6 Tamil Help Guide has 5-step tutorial", taGuide.includes("1️⃣") && taGuide.includes("Copy") && taGuide.includes("Paste"));

    const siGuide = getDropoffHelpGuide("si");
    record("3.7 Sinhala Help Guide has 5-step tutorial", siGuide.includes("1️⃣") && siGuide.includes("Copy") && siGuide.includes("Paste"));

    // ------------------------------------------------------------------------
    // TEST 4: CAB_PICKUP State Machine Validation
    // ------------------------------------------------------------------------
    const pickupSession: BotSessionState = {
      phone_number: testPhone,
      user_id: userId,
      flow_type: "CAB_FLOW",
      current_step: "CAB_PICKUP",
      session_data: {
        language: "ta",
        booking_type: "now",
        customer_name: "Test User",
        customer_phone: "0771234567",
        vehicle_key: "three_wheeler",
        vehicle_name: "Three-wheeler 🛺",
      },
    };

    // 4.1 Plain text sent to CAB_PICKUP -> MUST BE REJECTED
    const pickupPlainRes = await processCustomerChatStep(
      supabase,
      supabaseUrl,
      supabaseServiceKey,
      userId,
      testPhone,
      "Colombo Fort",
      "text",
      {},
      pickupSession,
      defaultPricing,
      defaultSystemSettings
    );
    record("4.1 Reject plain text at CAB_PICKUP", pickupPlainRes.nextStep === "CAB_PICKUP" && pickupPlainRes.replyText.includes("எழுத்தில் தட்டச்சு செய்வதை ஏற்க முடியாது"), pickupPlainRes.replyText);

    // 4.2 Valid WhatsApp Pin sent to CAB_PICKUP -> ACCEPTED, moves to CAB_DROPOFF with poll
    const pinPayload = {
      locationDetails: { latitude: 6.9271, longitude: 79.8612, name: "Colombo Fort Station" },
    };
    const pickupPinRes = await processCustomerChatStep(
      supabase,
      supabaseUrl,
      supabaseServiceKey,
      userId,
      testPhone,
      "Location: 6.9271, 79.8612",
      "location",
      pinPayload,
      pickupSession,
      defaultPricing,
      defaultSystemSettings
    );
    record("4.2 Accept Pin at CAB_PICKUP -> CAB_DROPOFF", pickupPinRes.nextStep === "CAB_DROPOFF");
    record("4.3 Returns Dropoff Help Poll on reaching CAB_DROPOFF", pickupPinRes.poll?.name.includes("Drop") || pickupPinRes.poll?.name.includes("சேரும் இடம்"));

    // ------------------------------------------------------------------------
    // TEST 5: CAB_DROPOFF State Machine Validation
    // ------------------------------------------------------------------------
    const dropoffSession: BotSessionState = {
      phone_number: testPhone,
      user_id: userId,
      flow_type: "CAB_FLOW",
      current_step: "CAB_DROPOFF",
      session_data: {
        ...pickupPinRes.sessionData,
      },
    };

    // 5.1 User votes Option 2 / Help
    const dropoffHelpRes = await processCustomerChatStep(
      supabase,
      supabaseUrl,
      supabaseServiceKey,
      userId,
      testPhone,
      "2. எனக்கு தெரியாது (Help / வழிகாட்டல்) ❓",
      "poll_response",
      {},
      dropoffSession,
      defaultPricing,
      defaultSystemSettings
    );
    record("5.1 Option 2 returns Help Guide", dropoffHelpRes.nextStep === "CAB_DROPOFF" && dropoffHelpRes.replyText.includes("Google Maps") && dropoffHelpRes.replyText.includes("Copy"), dropoffHelpRes.replyText);

    // 5.2 User votes Option 1 / Direct Link
    const dropoffDirectRes = await processCustomerChatStep(
      supabase,
      supabaseUrl,
      supabaseServiceKey,
      userId,
      testPhone,
      "1. எனக்கு தெரியும் (Direct Link அனுப்ப) 🔗",
      "poll_response",
      {},
      dropoffSession,
      defaultPricing,
      defaultSystemSettings
    );
    record("5.2 Option 1 prompts for Google Maps link", dropoffDirectRes.nextStep === "CAB_DROPOFF" && dropoffDirectRes.replyText.includes("Google Maps Link"));

    // 5.3 User types plain text location -> MUST BE REJECTED
    const dropoffPlainRes = await processCustomerChatStep(
      supabase,
      supabaseUrl,
      supabaseServiceKey,
      userId,
      testPhone,
      "Galle Face Green",
      "text",
      {},
      dropoffSession,
      defaultPricing,
      defaultSystemSettings
    );
    record("5.3 Reject plain text at CAB_DROPOFF", dropoffPlainRes.nextStep === "CAB_DROPOFF" && dropoffPlainRes.replyText.includes("எழுத்தில் தட்டச்சு செய்வதை ஏற்க முடியாது"));
    record("5.4 Rejection re-renders dropoff poll", dropoffPlainRes.poll?.name.includes("Drop") || dropoffPlainRes.poll?.name.includes("சேரும் இடம்"));

    // 5.4 User sends valid Google Maps link -> ACCEPTED, moves to CAB_TRIP_TYPE with poll
    const dropoffLinkRes = await processCustomerChatStep(
      supabase,
      supabaseUrl,
      supabaseServiceKey,
      userId,
      testPhone,
      "https://maps.google.com/?q=6.0535,80.2210",
      "text",
      {},
      dropoffSession,
      defaultPricing,
      defaultSystemSettings
    );
    record("5.5 Accept Google Maps link at CAB_DROPOFF -> CAB_TRIP_TYPE", dropoffLinkRes.nextStep === "CAB_TRIP_TYPE");
    record("5.6 Returns Trip Type poll on reaching CAB_TRIP_TYPE", dropoffLinkRes.poll?.name.includes("Trip Type") || dropoffLinkRes.poll?.name.includes("பயண வகை"));

    // ------------------------------------------------------------------------
    // TEST 6: CAB_TRIP_TYPE & Order Summary with Clickable Links
    // ------------------------------------------------------------------------
    const tripTypeSession: BotSessionState = {
      phone_number: testPhone,
      user_id: userId,
      flow_type: "CAB_FLOW",
      current_step: "CAB_TRIP_TYPE",
      session_data: {
        ...dropoffLinkRes.sessionData,
      },
    };

    const tripTypeRes = await processCustomerChatStep(
      supabase,
      supabaseUrl,
      supabaseServiceKey,
      userId,
      testPhone,
      "1. One-Way (ஒரு வழி) ➡️",
      "text",
      {},
      tripTypeSession,
      defaultPricing,
      defaultSystemSettings
    );

    record("6.1 Select Trip Type -> CAB_CONFIRM", tripTypeRes.nextStep === "CAB_CONFIRM");
    const summaryCard = tripTypeRes.replyText;
    record("6.2 Summary Card contains Pickup Google Maps URL", summaryCard.includes("https://maps.google.com/?q=6.9271,79.8612"), summaryCard);
    record("6.3 Summary Card contains Dropoff Google Maps URL", summaryCard.includes("https://maps.google.com/?q=6.0535,80.2210"), summaryCard);
    record("6.4 Summary Card does not contain raw 'Pin Location'", !summaryCard.includes("Pin Location (6.9271"), summaryCard);
    record("6.5 Summary Card contains fare calculation", summaryCard.includes("LKR") && summaryCard.includes("கட்டணம்:"), summaryCard);

    // ------------------------------------------------------------------------
    // TEST 7: Order Confirmation & Database Persistence
    // ------------------------------------------------------------------------
    const confirmSession: BotSessionState = {
      phone_number: testPhone,
      user_id: userId,
      flow_type: "CAB_FLOW",
      current_step: "CAB_CONFIRM",
      session_data: {
        ...tripTypeRes.sessionData,
      },
    };

    const confirmRes = await processCustomerChatStep(
      supabase,
      supabaseUrl,
      supabaseServiceKey,
      userId,
      testPhone,
      "Yes, Confirm Booking ✅",
      "text",
      {},
      confirmSession,
      defaultPricing,
      defaultSystemSettings
    );

    record("7.1 Booking Confirmed -> IDLE / BOOKING_COMPLETED", confirmRes.nextStep === "BOOKING_COMPLETED" || confirmRes.nextFlow === "IDLE");
    const confirmedOrderCode = confirmRes.sessionData?.last_order_code;
    record("7.2 Order code generated", !!confirmedOrderCode, confirmedOrderCode);

    if (confirmedOrderCode) {
      const { data: dbOrder, error: dbErr } = await supabase
        .schema("central_cab")
        .from("orders")
        .select("order_code, pickup_address, dropoff_address, total_fare")
        .eq("order_code", confirmedOrderCode)
        .single();

      record("7.3 Order stored in orders table", !dbErr && !!dbOrder);
      record("7.4 Database pickup_address has Google Maps link", dbOrder?.pickup_address?.includes("maps.google.com"), dbOrder?.pickup_address);
      record("7.5 Database dropoff_address has Google Maps link", dbOrder?.dropoff_address?.includes("maps.google.com"), dbOrder?.dropoff_address);
    }

    // ------------------------------------------------------------------------
    // TEST 8: DELIVERY FLOW Location Validation
    // ------------------------------------------------------------------------
    const deliveryLocationSession: BotSessionState = {
      phone_number: testPhone,
      user_id: userId,
      flow_type: "DELIVERY_FLOW",
      current_step: "DELIVERY_LOCATION",
      session_data: {
        language: "ta",
        delivery_category: "Food & Drinks",
        delivery_items: "2 Burgers",
        customer_phone: "0771234567",
      },
    };

    // Plain text in delivery
    const deliveryPlainRes = await processCustomerChatStep(
      supabase,
      supabaseUrl,
      supabaseServiceKey,
      userId,
      testPhone,
      "Kollupitiya Supermarket",
      "text",
      {},
      deliveryLocationSession,
      defaultPricing,
      defaultSystemSettings
    );
    record("8.1 Reject plain text in DELIVERY_LOCATION", deliveryPlainRes.nextStep === "DELIVERY_LOCATION" && deliveryPlainRes.replyText.includes("எழுத்தில் தட்டச்சு செய்வதை ஏற்க முடியாது"));

    // Google Maps link in delivery
    const deliveryLinkRes = await processCustomerChatStep(
      supabase,
      supabaseUrl,
      supabaseServiceKey,
      userId,
      testPhone,
      "https://maps.google.com/?q=6.9147,79.8778",
      "text",
      {},
      deliveryLocationSession,
      defaultPricing,
      defaultSystemSettings
    );
    record("8.2 Accept Google Maps link in DELIVERY_LOCATION -> DELIVERY_CONFIRM", deliveryLinkRes.nextStep === "DELIVERY_CONFIRM");
    record("8.3 Delivery summary includes Google Maps link", deliveryLinkRes.replyText.includes("https://maps.google.com/?q=6.9147,79.8778"), deliveryLinkRes.replyText);

    // ------------------------------------------------------------------------
    // TEST 9: DYNAMIC VEHICLE CATEGORIES & VARIATIONS (MODELS)
    // ------------------------------------------------------------------------
    const dynamicPricing: PricingSettings = {
      ...defaultPricing,
      car: {
        ...defaultPricing.car,
        label: "Car",
        icon: "🚗",
        models: [
          { name: "Sedan", description: "4-seater budget sedan" },
          { name: "SUV", description: "Spacious 5-seater" },
        ],
      },
      suv_vip: {
        label: "VIP SUV",
        icon: "🚙",
        base_price: 1200,
        per_km_rate: 220,
        coverage_km: 5,
        discount_percentage: 10,
      },
    };

    // 9.1 Dynamic vehicle key normalization
    record("9.1 Match standard vehicle 'car'", normalizeVehicleKey("Car", "schedule", dynamicPricing) === "car");
    record("9.2 Match dynamic custom category 'VIP SUV'", normalizeVehicleKey("VIP SUV", "schedule", dynamicPricing) === "suv_vip");
    record("9.3 Match dynamic vehicle by digit index", normalizeVehicleKey("1", "schedule", dynamicPricing) === "car");

    // 9.2 CAB_VEHICLE -> CAB_MODEL progression
    const cabVehicleSession: BotSessionState = {
      phone_number: testPhone,
      user_id: userId,
      flow_type: "CAB_FLOW",
      current_step: "CAB_VEHICLE",
      session_data: {
        language: "ta",
        customer_name: "Test Customer",
        customer_phone: "0771234567",
        booking_type: "schedule",
        trip_type: "one_way",
      },
    };

    const vehicleSelectRes = await processCustomerChatStep(
      supabase,
      supabaseUrl,
      supabaseServiceKey,
      userId,
      testPhone,
      "1. Car 🚗",
      "text",
      {},
      cabVehicleSession,
      dynamicPricing,
      defaultSystemSettings
    );

    record("9.4 Selecting category with models transitions to CAB_MODEL", vehicleSelectRes.nextStep === "CAB_MODEL");
    record("9.5 Poll for models presented in chat", vehicleSelectRes.poll != null && vehicleSelectRes.poll.options.some((o: string) => o.includes("Sedan")));

    // 9.3 CAB_MODEL -> CAB_PICKUP progression
    const cabModelSession: BotSessionState = {
      ...cabVehicleSession,
      current_step: "CAB_MODEL",
      session_data: {
        ...cabVehicleSession.session_data,
        vehicle_type: "car",
      },
    };

    const modelSelectRes = await processCustomerChatStep(
      supabase,
      supabaseUrl,
      supabaseServiceKey,
      userId,
      testPhone,
      "1. Sedan (4-seater budget sedan)",
      "text",
      {},
      cabModelSession,
      dynamicPricing,
      defaultSystemSettings
    );

    record("9.6 Selecting model transitions to CAB_PICKUP", modelSelectRes.nextStep === "CAB_PICKUP");
    record("9.7 Model name stored in session data", modelSelectRes.sessionData?.vehicle_model?.name === "Sedan");

    // ------------------------------------------------------------------------
    // TEST 10: PROGRESSIVE DISTANCE SLAB PRICING ENGINE
    // ------------------------------------------------------------------------
    const testSlabs: DistanceDiscountSlab[] = [
      { from_km: 0, to_km: 20, discount_percentage: 5 },
      { from_km: 20, to_km: 50, discount_percentage: 10 },
      { from_km: 50, to_km: 100, discount_percentage: 15 },
    ];

    const slabPricingSettings: PricingSettings = {
      ...defaultPricing,
      car: {
        base_price: 1000,
        per_km_rate: 100,
        coverage_km: 10,
        discount_percentage: 10,
        discount_slabs: testSlabs,
      },
    };

    // 10.1 One-way 100 km test:
    // Base: 1000 (covers 0-10 km)
    // Slab 1 (10-20 km, 10 km): 10 * (100 * 0.95) = 950
    // Slab 2 (20-50 km, 30 km): 30 * (100 * 0.90) = 2700
    // Slab 3 (50-100 km, 50 km): 50 * (100 * 0.85) = 4250
    // Expected total: 1000 + 950 + 2700 + 4250 = 8900
    // Expected gross: 1000 + (90 * 100) = 10000
    // Expected discount: 1100
    const fare100 = calculateFare(100, "100 km", "car", "one_way", slabPricingSettings);
    record("10.1 Progressive slab total fare matches exact mathematical model (8900)", fare100.totalFare === 8900, `Got: ${fare100.totalFare}`);
    record("10.2 Progressive slab discount amount matches exact model (1100)", fare100.discountAmount === 1100, `Got: ${fare100.discountAmount}`);
    record("10.3 Progressive slab gross fare is correct (10000)", fare100.grossFare === 10000, `Got: ${fare100.grossFare}`);

    // 10.2 Round trip 50 km (50 x 2 = 100 km total)
    const fareRoundTrip = calculateFare(50, "50 km", "car", "round_trip", slabPricingSettings);
    record("10.4 Round-trip 50km correctly expands to 100km and calculates same progressive slab total", fareRoundTrip.totalFare === 8900, `Got: ${fareRoundTrip.totalFare}`);

    // 10.3 Model-specific slabs override vehicle slabs
    const customModelWithSlabs: VehicleModel = {
      name: "Luxury",
      discount_slabs: [{ from_km: 0, to_km: 100, discount_percentage: 20 }],
    };
    // Base 1000 + 90 km * (100 * 0.80 = 80) = 1000 + 7200 = 8200
    const fareModelSlabs = calculateFare(100, "100 km", "car", "one_way", slabPricingSettings, customModelWithSlabs);
    record("10.5 Custom model discount slabs override category default slabs", fareModelSlabs.totalFare === 8200, `Got: ${fareModelSlabs.totalFare}`);

    // 10.4 Legacy fallback without slabs (Round-trip discount percentage applies)
    const legacyFare = calculateFare(100, "100 km", "three_wheeler", "round_trip", defaultPricing);
    // three_wheeler: base 300, per_km 100, coverage 2, discount 10%
    // 100km round trip = 200 km
    // chargeable = 198 km
    // gross = 300 + 198 * 100 = 20100
    // discount = 10% of 20100 = 2010
    // total = 18090
    record("10.6 Legacy pricing without slabs retains 100% backward compatibility", legacyFare.totalFare === 18090, `Got: ${legacyFare.totalFare}`);

  } catch (err: any) {
    record("Fatal Test Exception", false, err.message + "\n" + err.stack);
  }

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  return {
    total: results.length,
    passed: passedCount,
    failed: failedCount,
    results,
  };
}
