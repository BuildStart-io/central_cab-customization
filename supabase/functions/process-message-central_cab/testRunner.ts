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
  expandShortUrl,
  extractCoordinatesFromTextOrUrl,
  resolveLocationCoords,
  isSriLankaCoords,
  getRoutingDistance,
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
    record("10.6 Legacy pricing without slabs retains 100% backward compatibility", legacyFare.totalFare === 18090, `Got: ${legacyFare.totalFare}`);

    // ------------------------------------------------------------------------
    // TEST 11: GOOGLE MAPS SHORT LINK EXPANSION & COORDINATE EXTRACTION
    // ------------------------------------------------------------------------
    const userShortUrl = "https://maps.app.goo.gl/XwQrJ1JUZA27Mq5p9?g_st=ic";
    
    // 11.1 Expand short URL
    const { finalUrl, redirectChain } = await expandShortUrl(userShortUrl);
    record("11.1 Short link expands into canonical Google Maps URL", redirectChain.length >= 2 && finalUrl.includes("google.com/maps"), `Hops: ${redirectChain.length}, Final: ${finalUrl.substring(0, 60)}`);

    // 11.2 Extract dropoff coordinates (Maho Junction, Maho)
    const resolvedDropoff = await resolveLocationCoords({ text: userShortUrl }, "dropoff");
    const isDropoffValid = resolvedDropoff != null && isSriLankaCoords(resolvedDropoff.lat, resolvedDropoff.lng);
    record("11.2 Resolves dropoff coordinates within Sri Lanka bounds", isDropoffValid, `Coords: ${JSON.stringify(resolvedDropoff)}`);
    record("11.3 Dropoff matches Maho Junction (~7.82, ~80.27)", resolvedDropoff != null && Math.abs(resolvedDropoff.lat - 7.82) < 0.1 && Math.abs(resolvedDropoff.lng - 80.28) < 0.1, `Coords: ${JSON.stringify(resolvedDropoff)}`);
    record("11.4 Rejects foreign/German server default coordinates", resolvedDropoff != null && resolvedDropoff.lat < 15, `Lat: ${resolvedDropoff?.lat}`);

    // 11.3 Distance calculation from Batticaloa to Maho Junction
    const pickupInput = { text: "Batticaloa", coords: { lat: 7.7305, lng: 81.6804 } };
    const dropoffInput = { text: userShortUrl, coords: resolvedDropoff || undefined };
    const routeDist = await getRoutingDistance(pickupInput, dropoffInput);
    record("11.5 Route distance between Batticaloa and Maho Junction is realistic (~216 km)", routeDist.distanceKm >= 200 && routeDist.distanceKm <= 240, `Distance: ${routeDist.distanceKm} km`);

    // ------------------------------------------------------------------------
    // TEST 12: FARE CALCULATION ACROSS ALL VEHICLE CATEGORIES & VARIATIONS
    // ------------------------------------------------------------------------
    const allVehiclesSettings: PricingSettings = {
      motorbike: {
        base_price: 100,
        per_km_rate: 65,
        coverage_km: 1,
        discount_slabs: [
          { from_km: 10, to_km: 30, discount_percentage: 5 },
          { from_km: 30, to_km: 55, discount_percentage: 10 },
        ],
      },
      three_wheeler: {
        base_price: 130,
        per_km_rate: 70,
        coverage_km: 1,
        discount_slabs: [
          { from_km: 0, to_km: 15, discount_percentage: 0 },
          { from_km: 15, to_km: 35, discount_percentage: 5 },
          { from_km: 35, to_km: null, discount_percentage: 10 },
        ],
      },
      car: {
        base_price: 600,
        per_km_rate: 150,
        coverage_km: 3,
        discount_slabs: [
          { from_km: 0, to_km: 20, discount_percentage: 5 },
          { from_km: 20, to_km: 50, discount_percentage: 10 },
          { from_km: 50, to_km: 100, discount_percentage: 15 },
          { from_km: 100, to_km: null, discount_percentage: 20 },
        ],
      },
      van: {
        base_price: 900,
        per_km_rate: 200,
        coverage_km: 3,
        discount_slabs: [
          { from_km: 0, to_km: 30, discount_percentage: 5 },
          { from_km: 30, to_km: 80, discount_percentage: 10 },
          { from_km: 80, to_km: null, discount_percentage: 15 },
        ],
      },
      lorry: {
        base_price: 1500,
        per_km_rate: 300,
        coverage_km: 5,
        discount_slabs: [
          { from_km: 0, to_km: 40, discount_percentage: 0 },
          { from_km: 40, to_km: 100, discount_percentage: 8 },
          { from_km: 100, to_km: null, discount_percentage: 12 },
        ],
      },
      bus: {
        base_price: 3000,
        per_km_rate: 200,
        coverage_km: 10,
        discount_slabs: [
          { from_km: 0, to_km: 50, discount_percentage: 0 },
          { from_km: 50, to_km: 120, discount_percentage: 10 },
          { from_km: 120, to_km: null, discount_percentage: 15 },
        ],
      },
    };

    // 12.1 Motorbike fare test (10 km)
    // Base 100 covers 1 km -> 9 km chargeable at 65 = 585 -> total = 685
    const fareMotorbike = calculateFare(10, "10 km", "motorbike", "one_way", allVehiclesSettings);
    record("12.1 Motorbike 10km fare is correct (685)", fareMotorbike.totalFare === 685, `Got: ${fareMotorbike.totalFare}`);

    // 12.2 Three-wheeler fare test (20 km)
    // Base 130 covers 1 km -> 19 km chargeable:
    // 0-15km (1 to 15 = 14km) @ 0% (70) = 980
    // 15-20km (5km) @ 5% (66.5) = 332.5
    // Total = 130 + 980 + 332.5 = 1442.5
    const fareTukTuk = calculateFare(20, "20 km", "three_wheeler", "one_way", allVehiclesSettings);
    record("12.2 Three-wheeler 20km fare is correct (1442.5)", fareTukTuk.totalFare === 1442.5, `Got: ${fareTukTuk.totalFare}`);

    // 12.3 Car -> Sedan model test (216 km)
    const sedanModel: VehicleModel = {
      name: "Sedan",
      base_price: 700,
      coverage_km: 3,
      per_km_rate: 160,
      discount_slabs: [
        { from_km: 0, to_km: 20, discount_percentage: 5 },
        { from_km: 20, to_km: 50, discount_percentage: 10 },
        { from_km: 50, to_km: 100, discount_percentage: 15 },
        { from_km: 100, to_km: null, discount_percentage: 20 },
      ],
    };
    // Base 700 (3km) -> 213km chargeable:
    // 3-20km (17km) @ 152 = 2584
    // 20-50km (30km) @ 144 = 4320
    // 50-100km (50km) @ 136 = 6800
    // 100-216km (116km) @ 128 = 14848
    // Total = 700 + 2584 + 4320 + 6800 + 14848 = 29252
    const fareSedan = calculateFare(216, "216 km", "car", "one_way", allVehiclesSettings, sedanModel);
    record("12.3 Car Sedan 216km fare is correct (29252)", fareSedan.totalFare === 29252, `Got: ${fareSedan.totalFare}`);

    // 12.4 Car -> Hatchback model test (216 km)
    const hatchbackModel: VehicleModel = {
      name: "Hatchback",
      base_price: 500,
      coverage_km: 2,
      per_km_rate: 125,
      discount_slabs: [
        { from_km: 0, to_km: 20, discount_percentage: 5 },
        { from_km: 20, to_km: 50, discount_percentage: 10 },
        { from_km: 50, to_km: 100, discount_percentage: 15 },
        { from_km: 100, to_km: null, discount_percentage: 20 },
      ],
    };
    // Base 500 (2km) -> 214km chargeable:
    // 2-20km (18km) @ 118.75 = 2137.5
    // 20-50km (30km) @ 112.5 = 3375
    // 50-100km (50km) @ 106.25 = 5312.5
    // 100-216km (116km) @ 100 = 11600
    // Total = 500 + 2137.5 + 3375 + 5312.5 + 11600 = 22925
    const fareHatchback = calculateFare(216, "216 km", "car", "one_way", allVehiclesSettings, hatchbackModel);
    record("12.4 Car Hatchback 216km fare is correct (22925)", fareHatchback.totalFare === 22925, `Got: ${fareHatchback.totalFare}`);

    // 12.5 Car -> SUV model test (216 km)
    const suvModel: VehicleModel = {
      name: "SUV",
      base_price: 850,
      coverage_km: 3,
      per_km_rate: 185,
      discount_slabs: [
        { from_km: 0, to_km: 20, discount_percentage: 5 },
        { from_km: 20, to_km: 50, discount_percentage: 10 },
        { from_km: 50, to_km: 100, discount_percentage: 15 },
        { from_km: 100, to_km: null, discount_percentage: 20 },
      ],
    };
    // Base 850 (3km) -> 213km chargeable:
    // 3-20km (17km) @ 175.75 = 2987.75
    // 20-50km (30km) @ 166.5 = 4995
    // 50-100km (50km) @ 157.25 = 7862.5
    // 100-216km (116km) @ 148 = 17168
    // Total = 850 + 2987.75 + 4995 + 7862.5 + 17168 = 33863.25
    const fareSUV = calculateFare(216, "216 km", "car", "one_way", allVehiclesSettings, suvModel);
    record("12.5 Car SUV 216km fare is correct (33863.25)", fareSUV.totalFare === 33863.25, `Got: ${fareSUV.totalFare}`);

    // 12.6 Van -> KDH Flat Roof (100 km)
    const vanFlatModel: VehicleModel = {
      name: "KDH Flat Roof",
      base_price: 900,
      coverage_km: 3,
      per_km_rate: 190,
      discount_slabs: [
        { from_km: 0, to_km: 30, discount_percentage: 5 },
        { from_km: 30, to_km: 80, discount_percentage: 10 },
        { from_km: 80, to_km: null, discount_percentage: 15 },
      ],
    };
    // Base 900 (3km) -> 97km chargeable:
    // 3-30km (27km) @ 180.5 = 4873.5
    // 30-80km (50km) @ 171 = 8550
    // 80-100km (20km) @ 161.5 = 3230
    // Total = 900 + 4873.5 + 8550 + 3230 = 17553.5
    const fareVanFlat = calculateFare(100, "100 km", "van", "one_way", allVehiclesSettings, vanFlatModel);
    record("12.6 Van Flat Roof 100km fare is correct (17553.5)", fareVanFlat.totalFare === 17553.5, `Got: ${fareVanFlat.totalFare}`);

    // 12.7 Van -> KDH High Roof (100 km)
    const vanHighModel: VehicleModel = {
      name: "KDH High Roof",
      base_price: 1200,
      coverage_km: 3,
      per_km_rate: 240,
      discount_slabs: [
        { from_km: 0, to_km: 30, discount_percentage: 5 },
        { from_km: 30, to_km: 80, discount_percentage: 10 },
        { from_km: 80, to_km: null, discount_percentage: 15 },
      ],
    };
    // Base 1200 (3km) -> 97km chargeable:
    // 3-30km (27km) @ 228 = 6156
    // 30-80km (50km) @ 216 = 10800
    // 80-100km (20km) @ 204 = 4080
    // Total = 1200 + 6156 + 10800 + 4080 = 22236
    const fareVanHigh = calculateFare(100, "100 km", "van", "one_way", allVehiclesSettings, vanHighModel);
    record("12.7 Van High Roof 100km fare is correct (22236)", fareVanHigh.totalFare === 22236, `Got: ${fareVanHigh.totalFare}`);

    // 12.8 Lorry -> Dimo Batta (150 km)
    const lorryModel: VehicleModel = {
      name: "Dimo Batta",
      base_price: 1200,
      coverage_km: 3,
      per_km_rate: 220,
      discount_slabs: [
        { from_km: 0, to_km: 40, discount_percentage: 0 },
        { from_km: 40, to_km: 100, discount_percentage: 8 },
        { from_km: 100, to_km: null, discount_percentage: 12 },
      ],
    };
    // Base 1200 (3km) -> 147km chargeable:
    // 3-40km (37km) @ 220 = 8140
    // 40-100km (60km) @ 202.4 = 12144
    // 100-150km (50km) @ 193.6 = 9680
    // Total = 1200 + 8140 + 12144 + 9680 = 31164
    const fareLorry = calculateFare(150, "150 km", "lorry", "one_way", allVehiclesSettings, lorryModel);
    record("12.8 Lorry Dimo Batta 150km fare is correct (31164)", fareLorry.totalFare === 31164, `Got: ${fareLorry.totalFare}`);

    // 12.9 Bus -> Rosa Mini Bus (216 km: Real user booking scenario!)
    const busModel: VehicleModel = {
      name: "Rosa Mini Bus",
      base_price: 3000,
      coverage_km: 10,
      per_km_rate: 200,
      discount_slabs: [
        { from_km: 0, to_km: 50, discount_percentage: 0 },
        { from_km: 50, to_km: 120, discount_percentage: 10 },
        { from_km: 120, to_km: null, discount_percentage: 15 },
      ],
    };
    // Base 3000 (10km) -> 206km chargeable:
    // 10-50km (40km) @ 200 = 8000
    // 50-120km (70km) @ 180 = 12600
    // 120-216km (96km) @ 170 = 16320
    // Total = 3000 + 8000 + 12600 + 16320 = 39920
    // Gross = 3000 + (206 * 200) = 44200
    // Discount = 4280
    const fareBus = calculateFare(216, "216 km", "bus", "one_way", allVehiclesSettings, busModel);
    record("12.9 Bus Rosa Mini Bus 216km fare is correct (39920)", fareBus.totalFare === 39920, `Got: ${fareBus.totalFare}`);
    record("12.10 Bus Rosa Mini Bus gross fare is correct (44200)", fareBus.grossFare === 44200, `Got: ${fareBus.grossFare}`);
    record("12.11 Bus Rosa Mini Bus discount amount is correct (4280)", fareBus.discountAmount === 4280, `Got: ${fareBus.discountAmount}`);

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
