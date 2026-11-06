// ============================================================================
// Ceylon Central Cabs & Delivery - Multi-Lingual Engine (i18n)
// Native Dual Language Support: Sinhala and English
// ============================================================================

export type SupportedLanguage = "si" | "en";

export interface PollDefinition {
  name: string;
  options: string[];
  multipleAnswers?: boolean;
}

/**
 * Normalize and detect selected language from user input or poll vote
 * 1 -> Sinhala (si)
 * 2 -> English (en)
 */
export function detectLanguageSelection(input: string): SupportedLanguage | null {
  const text = (input || "").trim().toLowerCase();

  // Sinhala indicators (Option 1)
  if (
    text === "1" ||
    text.startsWith("1.") ||
    text.startsWith("1 ") ||
    text.includes("sinhala") ||
    text.includes("සිංහල") ||
    text.includes("singlish") ||
    text.includes("sinhala 🇱🇰")
  ) {
    return "si";
  }

  // English indicators (Option 2)
  if (
    text === "2" ||
    text.startsWith("2.") ||
    text.startsWith("2 ") ||
    text.includes("english") ||
    text.includes("eng") ||
    text.includes("en") ||
    text.includes("english 🇬🇧")
  ) {
    return "en";
  }

  return null;
}

/**
 * Normalize and detect selected service category from user input or poll vote
 */
export type ServiceCategory =
  | "ride_now"
  | "ride_schedule"
  | "rent_a_car"
  | "delivery"
  | "ask_a_question";

export function isResetChoice(input: string): boolean {
  const text = (input || "").trim().toLowerCase();
  if (
    text === "reset" ||
    text === "menu" ||
    text === "main menu" ||
    text === "restart" ||
    text === "start over" ||
    text === "home" ||
    text === "go to home page" ||
    text === "goto home page" ||
    text === "go to home" ||
    text === "goto home" ||
    text === "home page" ||
    text === "back" ||
    text.includes("reset") ||
    text.includes("main menu") ||
    text.includes("go to home") ||
    text.includes("goto home") ||
    text.includes("ප්‍රධාන මෙනුව") ||
    text.includes("මුල් මෙනුව")
  ) {
    return true;
  }
  return false;
}


export function detectServiceCategory(input: string): ServiceCategory | null {
  const text = (input || "").trim().toLowerCase();

  // 1. Short Trip / Ride Now (Immediate)
  if (
    text === "1" ||
    text.startsWith("1.") ||
    text.startsWith("1 ") ||
    text.includes("ride now") ||
    text.includes("now ride") ||
    text.includes("short trip") ||
    text.includes("short") ||
    text.includes("ලග") ||
    text.includes("ලඟ") ||
    text.includes("laga") ||
    text.includes("දැන්ම") ||
    text.includes("danma") ||
    text.includes("damma")
  ) {
    return "ride_now";
  }

  // 2. Long Trip / Schedule Ride (Advance reservation)
  if (
    text === "2" ||
    text.startsWith("2.") ||
    text.startsWith("2 ") ||
    text.includes("schedule ride") ||
    text.includes("schedule") ||
    text.includes("long trip") ||
    text.includes("long distance") ||
    text.includes("long") ||
    text.includes("දුර") ||
    text.includes("dura") ||
    text.includes("outstation") ||
    text.includes("reserve") ||
    text.includes("පසුවට") ||
    text.includes("passe") ||
    text.includes("pasuwata") ||
    text.includes("later")
  ) {
    return "ride_schedule";
  }

  // 3. Rent a Car
  if (
    text === "3" ||
    text.startsWith("3.") ||
    text.startsWith("3 ") ||
    text.includes("rent a car") ||
    text.includes("rent") ||
    text.includes("කාර් කුලියට")
  ) {
    return "rent_a_car";
  }

  // 4. Delivery
  if (
    text === "4" ||
    text.startsWith("4.") ||
    text.startsWith("4 ") ||
    text.includes("delivery") ||
    text.includes("භාණ්ඩ") ||
    text.includes("පාර්සල්") ||
    text.includes("ඇණවුම්")
  ) {
    return "delivery";
  }

  // 5. Ask a question / More details & App
  if (
    text === "5" ||
    text.startsWith("5.") ||
    text.startsWith("5 ") ||
    text.includes("වැඩිවිස්තර") ||
    text.includes("වැඩි විස්තර") ||
    text.includes("ලබාගැනීමට") ||
    text.includes("ඇප්") ||
    text.includes("app") ||
    text.includes("more details") ||
    text.includes("details") ||
    text.includes("ask") ||
    text.includes("question") ||
    text.includes("help") ||
    text.includes("inquiry") ||
    text.includes("ප්‍රශ්න") ||
    text.includes("විස්තර")
  ) {
    return "ask_a_question";
  }

  // Fallback keyword matching for transport without explicit timing
  if (text.includes("cab") || text.includes("taxi") || text.includes("ප්‍රවාහන")) {
    return "ride_now";
  }

  return null;
}

/**
 * Affirmative checks across Sinhala, English
 */
export function isAffirmativeInput(text: string): boolean {
  const l = (text || "").toLowerCase().trim();
  if (
    l === "yes" ||
    l === "y" ||
    l.startsWith("yes") ||
    l === "confirm" ||
    l.startsWith("confirm") ||
    l === "1" ||
    l.startsWith("1.") ||
    l.startsWith("1 ") ||
    l === "ow" ||
    l === "ඔව්" ||
    l === "ok" ||
    l === "done" ||
    l.includes("confirm booking") ||
    l.includes("yes, confirm") ||
    l.includes("yes confirm")
  ) {
    return true;
  }
  return false;
}

/**
 * Negative checks across Sinhala, English
 */
export function isNegativeInput(text: string): boolean {
  const l = (text || "").toLowerCase().trim();
  if (
    l === "no" ||
    l === "n" ||
    l.startsWith("no") ||
    l === "2" ||
    l.startsWith("2.") ||
    l.startsWith("2 ") ||
    l.includes("keep order") ||
    l.includes("keep") ||
    l === "cancel" ||
    l.startsWith("cancel") ||
    l.includes("cancel booking") ||
    l.includes("no, cancel") ||
    l.includes("no cancel") ||
    l === "epa" ||
    l === "ne" ||
    l === "නැත"
  ) {
    return true;
  }
  return false;
}

/**
 * Home page / Menu reset checks for confirmation steps
 */
export function isHomeOrResetInput(text: string): boolean {
  const l = (text || "").toLowerCase().trim();
  if (
    l === "3" ||
    l.startsWith("3.") ||
    l.startsWith("3 ") ||
    l === "home" ||
    l === "go to home page" ||
    l === "goto home page" ||
    l === "go to home" ||
    l === "goto home" ||
    l === "home page" ||
    l.includes("home page") ||
    l.includes("go to home") ||
    l.includes("goto home") ||
    l === "main menu" ||
    l === "menu" ||
    l === "reset" ||
    l === "restart" ||
    l === "start over" ||
    l === "back" ||
    l.includes("ප්‍රධාන මෙනුව") ||
    l.includes("මුල් මෙනුව")
  ) {
    return true;
  }
  return false;
}

export function isHelpChoice(text: string): boolean {
  const l = (text || "").toLowerCase().trim();
  if (
    l === "help" ||
    l === "help me" ||
    l === "faq" ||
    l === "faqs" ||
    l === "support" ||
    l === "doubt" ||
    l === "doubts" ||
    l === "question" ||
    l === "questions" ||
    l === "inquiry" ||
    l === "inquiries" ||
    l === "සහාය" ||
    l === "ප්‍රශ්න" ||
    l === "විස්තර" ||
    l.startsWith("1. ❓") ||
    l.startsWith("1.❓") ||
    l.startsWith("❓") ||
    (l.includes("help") && !l.includes("confirm"))
  ) {
    return true;
  }
  return false;
}

export function isResumeBookingChoice(text: string): boolean {
  const l = (text || "").toLowerCase().trim();
  return (
    l === "continue" ||
    l === "resume" ||
    l === "booking" ||
    l === "ride" ||
    l === "ඉදිරියට" ||
    l === "බුකින්" ||
    l === "go back"
  );
}

export function isTimingNowChoice(text: string): boolean {
  const l = (text || "").toLowerCase().trim();
  if (l === "1" || l.startsWith("1.") || l.startsWith("1 ") || l === "1)") return true;
  if (l.includes("now") || l.includes("immediate") || l.includes("urgent")) return true;
  if (l.includes("short") || l.includes("ලග") || l.includes("ලඟ") || l.includes("laga")) return true;
  if (l.includes("dan") || l.includes("damma") || l.includes("danma") || l.includes("දැන්")) return true;
  return false;
}

export function isTimingScheduleChoice(text: string): boolean {
  const l = (text || "").toLowerCase().trim();
  if (l === "2" || l.startsWith("2.") || l.startsWith("2 ") || l.startsWith("2)")) return true;
  if (l.includes("sched") || l.includes("schd") || l.includes("later") || l.includes("reserve") || l.includes("advance")) return true;
  if (l.includes("long") || l.includes("දුර") || l.includes("dura")) return true;
  if (l.includes("passe") || l.includes("pasuwata") || l.includes("පසුව") || l.includes("කාලය")) return true;
  return false;
}

// ============================================================================
// Poll Generators
// ============================================================================

export function getLanguagePoll(): PollDefinition {
  return {
    name: "Please choose your preferred language / කරුණාකර ඔබගේ භාෂාව තෝරන්න:",
    options: [
      "1. සිංහල (Sinhala) 🇱🇰",
      "2. English 🇬🇧",
    ],
    multipleAnswers: false,
  };
}

export function getCategoryPoll(lang?: SupportedLanguage): PollDefinition {
  if (lang === "en") {
    return {
      name: "Central Cabs & Services - Please select the service you need:",
      options: [
        "1. ⚡ Short Distance Trip (Motorbike / Three-wheeler)",
        "2. 🚗 Long Distance Trip (Car / Van / Lorry / Bus)",
        "3. 🚗 Rent a Car (Car Rental)",
        "4. 📦 Delivery (Order Items)",
        "5. ℹ️ More Details & Get App",
      ],
      multipleAnswers: false,
    };
  }
  // Default: Sinhala
  return {
    name: "Central Cabs & Services - ඔබට අවශ්‍ය සේවාව තෝරන්න:",
    options: [
      "1. ⚡ ළඟ ගමනක් යන්න (Motorbike / Three-wheel)",
      "2. 🚗 දුර ගමනක් යන්න (Car / Van / Lorry / Bus)",
      "3. 🚗 Rent a Car (කාර් කුලියට ගන්න)",
      "4. 📦 Delivery (භාණ්ඩ ඇණවුම් කරන්න)",
      "5. ℹ️ වැඩිවිස්තර සදහා සහ ඇප් එක ලබාගැනීමට",
    ],
    multipleAnswers: false,
  };
}

export function getTimingPoll(lang: SupportedLanguage = "si", isDelivery = false): PollDefinition {
  const resetOption = "🔄 Reset / Main Menu (මුල් මෙනුව)";
  if (lang === "en") {
    return {
      name: isDelivery
        ? "Do you need Delivery right now or would you like to schedule for later?"
        : "Do you need a Short Distance Trip or a Long Distance Trip?",
      options: [
        "1. Short Trip (Local Ride) ⚡",
        "2. Long Trip (Outstation) 🚗",
        resetOption,
      ],
      multipleAnswers: false,
    };
  }
  return {
    name: isDelivery
      ? "ඔබට Delivery පහසුකම දැන්ම අවශ්‍යද නැතහොත් Schedule කිරීමට අවශ්‍යද?"
      : "ඔබට අවශ්‍ය ලග ගමනක්ද නැතහොත් දුර ගමනක්ද?",
    options: [
      "1. ලග ගමනක් (Short Trip) ⚡",
      "2. දුර ගමනක් (Long Trip) 🚗",
      resetOption,
    ],
    multipleAnswers: false,
  };
}

export function getVehiclePoll(
  lang: SupportedLanguage = "si",
  isDelivery = false,
  bookingType: string = "now",
  pricingSettings?: any
): PollDefinition {
  const resetOption = "🔄 Reset / Main Menu (මුල් මෙනුව)";
  if (isDelivery) {
    if (lang === "en") {
      return {
        name: "Please choose delivery vehicle:",
        options: [
          "1. Motorbike 🏍️",
          "2. Three-wheeler 🛺",
          resetOption,
        ],
        multipleAnswers: false,
      };
    }
    return {
      name: "කරුණාකර Delivery සඳහා වාහනය තෝරන්න:",
      options: [
        "1. Motorbike 🏍️",
        "2. Three-wheeler 🛺",
        resetOption,
      ],
      multipleAnswers: false,
    };
  }

  // 1. Short Trip (Ride Now): Only Motorbike and Three-wheeler
  const isSchedule = bookingType === "schedule";
  if (!isSchedule) {
    if (lang === "en") {
      return {
        name: "Please choose vehicle for Short Distance Trip:",
        options: [
          "1. Motorbike 🏍️",
          "2. Three-wheeler 🛺",
          resetOption,
        ],
        multipleAnswers: false,
      };
    }
    return {
      name: "කරුණාකර ලග ගමනක් සඳහා වාහනය තෝරන්න:",
      options: [
        "1. Motorbike 🏍️",
        "2. Three-wheeler 🛺",
        resetOption,
      ],
      multipleAnswers: false,
    };
  }

  // 2. Long Trip (Schedule Ride): Dynamically read categories from pricingSettings if available
  let dynamicOptions: string[] = [];
  if (pricingSettings && typeof pricingSettings === "object") {
    const scheduleKeys = Object.keys(pricingSettings).filter(
      (k) => k !== "motorbike" && k !== "three_wheeler" && !pricingSettings[k]?.is_ride_now
    );
    if (scheduleKeys.length > 0) {
      dynamicOptions = scheduleKeys.map((k, idx) => {
        const item = pricingSettings[k];
        const label = item?.label || (
          k === "car" ? "Car" :
          k === "van" ? "Van" :
          k === "lorry" ? "Lorry" :
          k === "bus" ? "Bus" : k
        );
        const icon = item?.icon || (
          k === "car" ? "🚗" :
          k === "van" ? "🚐" :
          k === "lorry" ? "🚚" :
          k === "bus" ? "🚌" : "🚙"
        );
        return `${idx + 1}. ${label} ${icon}`;
      });
    }
  }

  if (dynamicOptions.length === 0) {
    dynamicOptions = [
      "1. Car 🚗",
      "2. Van 🚐",
      "3. Lorry 🚚",
      "4. Bus 🚌",
    ];
  }

  dynamicOptions.push(resetOption);

  if (lang === "en") {
    return {
      name: "Please choose vehicle for Long Distance Trip:",
      options: dynamicOptions,
      multipleAnswers: false,
    };
  }
  return {
    name: "කරුණාකර දුර ගමනක් සඳහා වාහනය තෝරන්න:",
    options: dynamicOptions,
    multipleAnswers: false,
  };
}

export function getVehicleModelPoll(
  vehicleKey: string,
  models: any[],
  lang: SupportedLanguage = "si",
  pricingSettings?: any
): PollDefinition {
  const resetOption = "🔄 Reset / Main Menu (මුල් මෙනුව)";
  const vName = pricingSettings?.[vehicleKey]?.label
    ? `${pricingSettings[vehicleKey].label} ${pricingSettings[vehicleKey].icon || "🚗"}`
    : vehicleKey === "car"
    ? "Car 🚗"
    : vehicleKey === "van"
    ? "Van 🚐"
    : vehicleKey === "lorry"
    ? "Lorry 🚚"
    : vehicleKey === "bus"
    ? "Bus 🚌"
    : vehicleKey;

  const title = lang === "en"
    ? `Central Cabs - Choose ${vName} model:`
    : `Central Cabs - ${vName} මාදිලිය තෝරන්න:`;

  const options = models.map((m, idx) => {
    const desc = m.description ? ` (${m.description})` : "";
    return `${idx + 1}. ${m.name}${desc}`;
  });

  options.push(resetOption);

  return {
    name: title.slice(0, 255),
    options: options.map((opt) => opt.slice(0, 100)),
    multipleAnswers: false,
  };
}

export function getRentVehiclePoll(lang: SupportedLanguage = "si"): PollDefinition {
  const resetOption = "🔄 Reset / Main Menu (මුල් මෙනුව)";
  if (lang === "en") {
    return {
      name: "Central Cabs - Please select rental vehicle category:",
      options: [
        "1. 🏍️ Bike",
        "2. 🛺 Three-Wheel",
        "3. 🚗 Car",
        "4. 🚐 Van",
        resetOption,
      ],
      multipleAnswers: false,
    };
  }
  return {
    name: "Central Cabs - කුලියට ගැනීමට අවශ්‍ය වාහන කාණ්ඩය තෝරන්න:",
    options: [
      "1. 🏍️ Bike (බයික්)",
      "2. 🛺 Three-Wheel (ත්‍රිරෝද රථ)",
      "3. 🚗 Car (කාර්)",
      "4. 🚐 Van (වෑන්)",
      resetOption,
    ],
    multipleAnswers: false,
  };
}

export function detectRentVehicleCategory(text: string): string {
  const t = (text || "").toLowerCase().trim();
  if (t.includes("bike") || t.includes("motorcycle") || t.includes("බයික්") || t.startsWith("1")) {
    return "Bike";
  }
  if (t.includes("three") || t.includes("tuk") || t.includes("ත්‍රිරෝද") || t.startsWith("2")) {
    return "Three-Wheel";
  }
  if (t.includes("car") || t.includes("කාර්") || t.startsWith("3")) {
    return "Car";
  }
  if (t.includes("van") || t.includes("වෑන්") || t.startsWith("4")) {
    return "Van";
  }
  return "Car";
}

export function getDeliveryCategoryPoll(lang: SupportedLanguage = "si"): PollDefinition {
  const resetOption = "🔄 Main Menu (මුල් මෙනුව)";
  if (lang === "en") {
    return {
      name: "Select Product Category (centralonline.lk):",
      options: [
        "1. Cakes 🎂",
        "2. Clothes & Fashion 👕",
        "3. Computer & Laptops 💻",
        "4. Cosmetics & Beauty 💄",
        "5. Gift Items 🎁",
        "6. Food & Drinks 🍔🥤",
        "7. Mobile & Phones 📱",
        "8. Party & School Items 🎉📚",
        "9. Electronics & Headphones 🎧",
        "10. Other Items 📦",
        resetOption,
      ],
      multipleAnswers: false,
    };
  }
  return {
    name: "භාණ්ඩ කාණ්ඩය තෝරන්න (centralonline.lk):",
    options: [
      "1. Cakes 🎂",
      "2. Cloth / ඇඳුම් 👕",
      "3. Computer & Laptops 💻",
      "4. Cosmetics 💄",
      "5. Gift Items 🎁",
      "6. Food & Drinks 🍔🥤",
      "7. Mobile & Phones 📱",
      "8. Party & School Items 🎉📚",
      "9. Electronics & Headphones 🎧",
      "10. Other Items 📦",
      resetOption,
    ],
    multipleAnswers: false,
  };
}

export function detectDeliveryCategory(text: string): string | null {
  const t = (text || "").toLowerCase().trim();
  if (t === "1" || t.startsWith("1.") || t.startsWith("1 ") || t.includes("cake")) return "Cakes 🎂";
  if (t === "2" || t.startsWith("2.") || t.startsWith("2 ") || t.includes("cloth") || t.includes("ඇඳුම්")) return "Cloth / Fashion 👕";
  if (t === "3" || t.startsWith("3.") || t.startsWith("3 ") || t.includes("comp") || t.includes("laptop")) return "Computer & Laptops 💻";
  if (t === "4" || t.startsWith("4.") || t.startsWith("4 ") || t.includes("cosmetic")) return "Cosmetics 💄";
  if (t === "5" || t.startsWith("5.") || t.startsWith("5 ") || t.includes("gift")) return "Gift Items 🎁";
  if (t === "6" || t.startsWith("6.") || t.startsWith("6 ") || t.includes("food") || t.includes("drink")) return "Food & Drinks 🍔🥤";
  if (t === "7" || t.startsWith("7.") || t.startsWith("7 ") || t.includes("mobile") || (t.includes("phone") && !t.includes("headphone")) || t.includes("දුරකථන")) return "Mobile & Phones 📱";
  if (t === "8" || t.startsWith("8.") || t.startsWith("8 ") || t.includes("party") || t.includes("school")) return "Party & School Items 🎉📚";
  if (t === "9" || t.startsWith("9.") || t.startsWith("9 ") || t.includes("electronic") || t.includes("headphone") || t.includes("විදුලි")) return "Electronics & Headphones 🎧";
  if (t === "10" || t.startsWith("10.") || t.startsWith("10 ") || t.includes("other")) return "General / Other Items 📦";
  if (t.length >= 2) return text.trim();
  return null;
}

export function getDropoffHelpPoll(lang: SupportedLanguage = "si"): PollDefinition {
  const resetOption = "🔄 Reset / Main Menu (මුල් මෙනුව)";
  if (lang === "en") {
    return {
      name: "Do you know how to share the drop-off location link?",
      options: [
        "1. I know (Share Link Directly) 🔗",
        "2. Don't know (Need Help Guide) ❓",
        resetOption,
      ],
      multipleAnswers: false,
    };
  }
  return {
    name: "ගමනාන්තයේ Link එක share කිරීමට දන්නවාද? (Drop Location):",
    options: [
      "1. මම දන්නවා (Direct Link යවන්න) 🔗",
      "2. මම දන්නේ නෑ (Help / උපදෙස්) ❓",
      resetOption,
    ],
    multipleAnswers: false,
  };
}

export function getDropoffHelpGuide(lang: SupportedLanguage): string {
  if (lang === "en") {
    return `🗺️ *How to Share a Google Maps Link (Guide):*\n━━━━━━━━━━━━━━━━━━━━\n1️⃣ Open the *Google Maps* app on your mobile phone.\n2️⃣ Search for your destination in the search bar (or long-press on the map to drop a pin 📍).\n3️⃣ Tap the *Share* button in the place details below.\n4️⃣ Tap *Copy link* to copy the location URL.\n5️⃣ Come back to this WhatsApp chat, Paste the link, and send it!\n━━━━━━━━━━━━━━━━━━━━\n👉 Now, please send your destination (Drop-off) *Google Maps Link* here:`;
  }
  return `🗺️ *Google Maps Link එක Share කරන්නේ කෙසේද? (උපදෙස්):*\n━━━━━━━━━━━━━━━━━━━━\n1️⃣ ඔබගේ දුරකථනයේ *Google Maps* App එක විවෘත කරන්න.\n2️⃣ Search bar එකේ ඔබ යා යුතු ස්ථානය Search කරන්න (හෝ Map එකේ අදාළ ස්ථානය Long Press කර Pin කරන්න 📍).\n3️⃣ පහතින් දිස්වන විස්තර අතරින් *Share* බොත්තම ඔබන්න.\n4️⃣ *Copy Link* තෝරාගෙන Link එක Copy කරගන්න.\n5️⃣ නැවත මෙම WhatsApp Chat එකට පැමිණ එම Link එක Paste කර එවන්න!\n━━━━━━━━━━━━━━━━━━━━\n👉 කරුණාකර ඔබගේ ගමනාන්තයේ (Drop-off) *Google Maps Link* එක මෙහි එවන්න:`;
}

export function getDropoffDirectLinkPrompt(lang: SupportedLanguage): string {
  if (lang === "en") {
    return `📍 Please share the *Google Maps Link* of your drop-off destination here:`;
  }
  return `📍 කරුණාකර ඔබගේ ගමනාන්තයේ (Drop-off Location) *Google Maps Link* එක මෙහි share කරන්න:`;
}

export function getLocationRejectMessage(
  lang: SupportedLanguage,
  type: "pickup" | "dropoff" | "delivery" = "pickup"
): string {
  if (type === "pickup") {
    if (lang === "en") {
      return `⚠️ Typing location names is not accepted.\n\nPlease share your live *WhatsApp Location Pin* or send a valid *Google Maps Link* directly.`;
    }
    return `⚠️ ස්ථානයේ නම Type කිරීම පිළිගත නොහැක.\n\nකරුණාකර ඔබගේ සජීවී *WhatsApp Location Pin* එකක් හෝ *Google Maps Link* එකක් පමණක් මෙහි share කරන්න.`;
  }

  if (type === "dropoff") {
    if (lang === "en") {
      return `⚠️ Typing location names is not accepted.\n\nPlease share the *Google Maps Link* of your destination directly.\nIf you don't know how to get the link, select *2. Don't know (Need Help)* below or type *Help*.`;
    }
    return `⚠️ ස්ථානයේ නම Type කිරීම පිළිගත නොහැක.\n\nකරුණාකර ඔබගේ ගමනාන්තයේ *Google Maps Link* එක පමණක් මෙහි share කරන්න.\nඔබට Link එක යැවීමට නොදන්නේ නම් පහත *2. මම දන්නේ නෑ (Help)* තෝරන්න හෝ *Help* ලෙස Type කරන්න.`;
  }

  // Delivery
  if (lang === "en") {
    return `⚠️ Typing location names is not accepted.\n\nPlease share your delivery location using a live *WhatsApp Location Pin* or a valid *Google Maps Link*.`;
  }
  return `⚠️ ස්ථානයේ නම Type කිරීම පිළිගත නොහැක.\n\nකරුණාකර භාණ්ඩ භාරදිය යුතු ඔබගේ ස්ථානයේ සජීවී *WhatsApp Location Pin* එකක් හෝ *Google Maps Link* එකක් මෙහි share කරන්න.`;
}

export function formatLocationLinkForCustomer(
  text?: string,
  coords?: { lat: number; lng: number } | null
): string {
  const clean = (text || "").trim();
  const urlMatch = clean.match(/https?:\/\/(?:maps\.google\.com|goo\.gl\/maps|maps\.app\.goo\.gl|www\.google\.com\/maps|google\.com\/maps)[^\s]*/i);
  
  if (urlMatch) {
    const namePart = clean
      .replace(urlMatch[0], "")
      .replace(/\s*\([-+]?\d{1,2}\.\d+,\s*[-+]?\d{1,3}\.\d+\)/g, "")
      .trim();
    if (namePart && !/^(location:?|gps:?|pin location)$/i.test(namePart)) {
      return `${namePart}\n🔗 ${urlMatch[0]}`;
    }
    return urlMatch[0];
  }

  let lat = coords?.lat;
  let lng = coords?.lng;
  if ((!lat || !lng) && clean) {
    const coordMatch = clean.match(/([-+]?\d{1,2}\.\d+)\s*,\s*([-+]?\d{1,3}\.\d+)/);
    if (coordMatch) {
      lat = parseFloat(coordMatch[1]);
      lng = parseFloat(coordMatch[2]);
    }
  }

  if (lat && lng) {
    let namePart = clean
      .replace(/\s*\([-+]?\d{1,2}\.\d+,\s*[-+]?\d{1,3}\.\d+\)/g, "")
      .replace(/^GPS:\s*[-+]?\d{1,2}\.\d+,\s*[-+]?\d{1,3}\.\d+/i, "")
      .trim();
    if (!namePart || /^(pin location|gps location|location:?|gps:?)$/i.test(namePart)) {
      namePart = "";
    }
    const mapUrl = `https://maps.google.com/?q=${lat},${lng}`;
    return namePart ? `${namePart}\n🔗 ${mapUrl}` : mapUrl;
  }

  return clean || "Location";
}

export function getTripTypePoll(lang: SupportedLanguage = "si"): PollDefinition {
  const resetOption = "🔄 Reset / Main Menu (මුල් මෙනුව)";
  if (lang === "en") {
    return {
      name: "Select Trip Type:",
      options: [
        "1. One-Way ➡️",
        "2. Round Trip (Up & Down) 🔄",
        resetOption,
      ],
      multipleAnswers: false,
    };
  }
  return {
    name: "ගමන් වර්ගය (Trip Type) තෝරන්න:",
    options: [
      "1. One-Way ➡️",
      "2. Round Trip (Up & Down) 🔄",
      resetOption,
    ],
    multipleAnswers: false,
  };
}

export function getBookingConfirmPoll(lang: SupportedLanguage = "si"): PollDefinition {
  const resetOption = "🔄 Reset / Main Menu (මුල් මෙනුව)";
  if (lang === "en") {
    return {
      name: "Please confirm your booking:",
      options: [
        "Yes, Confirm Booking ✅",
        "No, Cancel ❌",
        resetOption,
      ],
      multipleAnswers: false,
    };
  }
  return {
    name: "Booking එක Confirm කරන්න:",
    options: [
      "Yes, Confirm Booking ✅",
      "No, Cancel ❌",
      resetOption,
    ],
    multipleAnswers: false,
  };
}

export function getCancelConfirmPoll(lang: SupportedLanguage = "si"): PollDefinition {
  const resetOption = "🔄 Reset / Main Menu (මුල් මෙනුව)";
  if (lang === "en") {
    return {
      name: "Are you sure you want to cancel this booking?",
      options: [
        "Yes, Cancel Order ❌",
        "No, Keep Order ✅",
        resetOption,
      ],
      multipleAnswers: false,
    };
  }
  return {
    name: "Order එක Cancel කිරීමට අවශ්‍යද?",
    options: [
      "Yes, Cancel Order ❌",
      "No, Keep Order ✅",
      resetOption,
    ],
    multipleAnswers: false,
  };
}

export function getPostBookingPoll(lang: SupportedLanguage = "si"): PollDefinition {
  const resetOption = "🔄 Main Menu (මුල් මෙනුව)";
  if (lang === "en") {
    return {
      name: "Do you need any further assistance?",
      options: [
        "1. ❓ Help / Inquiries",
        "2. ❌ Cancel Booking",
        resetOption,
      ],
      multipleAnswers: false,
    };
  }
  return {
    name: "ඔබට වැඩිදුර සහායක් අවශ්‍යද?",
    options: [
      "1. ❓ සහාය / විමසීම් (Help)",
      "2. ❌ Booking එක අවලංගු කරන්න",
      resetOption,
    ],
    multipleAnswers: false,
  };
}

// ============================================================================
// Multi-lingual Text Prompts
// ============================================================================

export function getStepPromptText(flow: string, step: string, lang: SupportedLanguage): string {
  // 1. Language & Category selection
  if (step === "LANGUAGE_CHOICE") {
    return "Please select your language:\n1. සිංහල (Sinhala) 🇱🇰\n2. English 🇬🇧";
  }
  if (step === "CATEGORY_CHOICE") {
    if (lang === "en") {
      return "Central Cabs & Services - Please select the service you need:";
    }
    return "Central Cabs & Services - ඔබට අවශ්‍ය සේවාව තෝරන්න:";
  }

  // 2. Hire / Cab Flow
  if (flow === "CAB_FLOW") {
    switch (step) {
      case "CAB_TIMING_CHOICE":
        if (lang === "en") return "Do you need a Short Distance Trip or a Long Distance Trip?";
        return "ඔබට අවශ්‍ය ලග ගමනක්ද නැතහොත් දුර ගමනක්ද?";

      case "CAB_SCHEDULE_DATE":
        if (lang === "en") return "Please specify the date for your ride:\n(e.g., 2026/10/25, Tomorrow, or Friday)";
        return "කරුණාකර ඔබගේ ගමනට අවශ්‍ය දිනය (Date) සඳහන් කරන්න:\n(උදා: 2026/10/25, Tomorrow, හෝ හෙට)";

      case "CAB_SCHEDULE_TIME":
        if (lang === "en") return "Please specify the time for your pickup:\n(e.g., 10:30 AM, 04:00 PM, or 8:00 AM)";
        return "කරුණාකර ඔබගේ ගමනට අවශ්‍ය වේලාව (Time) සඳහන් කරන්න:\n(උදා: 10:30 AM, 04:00 PM, හෝ 8:00 AM)";

      case "CAB_NAME":
        if (lang === "en") return "Please enter your name:";
        return "කරුණාකර ඔබගේ නම ඇතුළත් කරන්න:";

      case "CAB_PHONE":
        if (lang === "en") return "Please provide your contact phone number:";
        return "කරුණාකර ඔබගේ Contact Number එක ලබා දෙන්න:";

      case "CAB_VEHICLE":
        if (lang === "en") return "Please choose your vehicle type:";
        return "කරුණාකර ඔබට අවශ්‍ය වාහනය තෝරන්න:";

      case "CAB_PICKUP":
        if (lang === "en") return "📍 Please share your Pickup Location using a live WhatsApp Location Pin or send a valid Google Maps Link:";
        return "📍 කරුණාකර ඔබගේ ආරම්භක ස්ථානය (Pickup Location) සජීවී WhatsApp Location Pin එකක් හෝ Google Maps Link එකක් මඟින් මෙහි share කරන්න:";

      case "CAB_DROPOFF":
        if (lang === "en") return "🏁 *Drop-off Location:*\n\nDo you know how to share your destination Google Maps Link, or do you need help/guide? Please choose below (or send the Google Maps Link directly):";
        return "🏁 *ගමනාන්තය (Drop-off Location):*\n\nඔබ යා යුතු ස්ථානයේ Google Maps Link එක share කිරීමට ඔබ දන්නවාද? නැතහොත් උපදෙස් අවශ්‍යද? කරුණාකර පහතින් තෝරන්න (හෝ Google Maps Link එක කෙලින්ම එවන්න):";

      case "CAB_TRIP_TYPE":
        if (lang === "en") return "Is this a One-Way ride or a Round Trip (Up & Down)?";
        return "මෙය One-Way ගමනක් ද නැතහොත් Round Trip (Up & Down) ගමනක් ද?";

      case "CAB_CONFIRM":
        return getBookingConfirmManualPrompt(lang);
    }
  }

  // 3. Delivery Flow
  if (flow === "DELIVERY_FLOW") {
    switch (step) {
      case "DELIVERY_CATEGORY":
        if (lang === "en") {
          return "📦 *Central Delivery Service*\n\nPlease visit our website *www.centralonline.lk* for more products information! 🌐\n\nPlease select your preferred product category:";
        }
        return "📦 *Central Delivery Service*\n\nඅපගේ *www.centralonline.lk* වෙබ් අඩවියට පිවිස වැඩිදුර නිෂ්පාදන තොරතුරු (More Products Information) ලබා ගත හැක! 🌐\n\nකරුණාකර ඔබට අවශ්‍ය භාණ්ඩ කාණ්ඩය (Product Category) තෝරන්න:";

      case "DELIVERY_ITEMS":
        if (lang === "en") {
          return "📝 Please type the specific products, items, or quantities you need:\n\n(e.g., 1kg Chocolate Cake, 2 Chicken Burgers, or Large T-shirt)";
        }
        return "📝 කරුණාකර ඔබට අවශ්‍ය විශේෂිත භාණ්ඩ මොනවාදැයි විස්තර (Product Name / Quantity) සමඟ මෙහි Type කරන්න:\n\n(උදා: 1kg Chocolate Cake, Burgers 2ක්, හෝ Large T-shirt)";

      case "DELIVERY_PHONE":
        if (lang === "en") {
          return "📞 Please enter your contact WhatsApp or phone number:\n(e.g., 0771234567)";
        }
        return "📞 ඔබව සම්බන්ධ කරගත හැකි WhatsApp හෝ දුරකථන අංකය ඇතුළත් කරන්න (Contact Number):\n(උදා: 0771234567)";

      case "DELIVERY_LOCATION":
        if (lang === "en") {
          return "📍 Please share your delivery location using a live WhatsApp Location Pin or send a valid Google Maps Link:";
        }
        return "📍 කරුණාකර භාණ්ඩ භාරදිය යුතු ඔබගේ ස්ථානය (Delivery Location) සජීවී WhatsApp Location Pin එකක් හෝ Google Maps Link එකක් මඟින් මෙහි share කරන්න:";

      case "DELIVERY_CONFIRM":
        return getBookingConfirmManualPrompt(lang);
    }
  }

  // 4. Rent a Car Flow
  if (flow === "RENT_A_CAR_FLOW") {
    switch (step) {
      case "RENT_VEHICLE_CHOICE":
        if (lang === "en") return "🚗 *Rent a Car & Vehicle Service*\nPlease select your vehicle category:";
        return "🚗 *Rent a Car & වාහන සේවාව*\nකරුණාකර ඔබට අවශ්‍ය වාහන කාණ්ඩය තෝරන්න:";

      case "RENT_NAME":
        if (lang === "en") return "👤 Please enter your name:";
        return "👤 කරුණාකර ඔබගේ නම ඇතුළත් කරන්න (Your Name):";

      case "RENT_PHONE":
        if (lang === "en") return "📞 Please enter your contact phone number:";
        return "📞 ඔබව සම්බන්ධ කරගත හැකි දුරකථන අංකය ඇතුළත් කරන්න (Contact Phone Number):";

      case "RENT_LOCATION":
        if (lang === "en") return "📍 Please enter the rental location or area (Location / City / Area):";
        return "📍 වාහනය අවශ්‍ය ස්ථානය / ප්‍රදේශය ඇතුළත් කරන්න (Location / City / Area):";

      case "RENT_MODEL":
        if (lang === "en") return "🚘 What vehicle model do you prefer?\n(e.g., Alto, Wagon R, Aqua, Prius, KDH Van, or Any Model):";
        return "🚘 ඔබ බලාපොරොත්තු වන වාහන මොඩලය කුමක්ද?\n(උදා: Alto, Wagon R, Aqua, Prius, KDH Van, හෝ Any Model):";

      case "RENT_DURATION":
        if (lang === "en") return "⏱️ For how many days or what duration do you need the vehicle?\n(e.g., 2 Days, 1 Week, 1 Month):";
        return "⏱️ වාහනය දින කීයකට හෝ කොපමණ කාලයකට අවශ්‍යද?\n(උදා: දින 2ක්, සති 1ක්, මාස 1ක්):";

      case "RENT_CONFIRM":
        return getBookingConfirmManualPrompt(lang);

      default:
        if (lang === "en") return "🚗 *Rent a Car Service*";
        return "🚗 *Rent a Car සේවාව*";
    }
  }

  // 5. Ask a Question / More Details & Get App Flow
  if (flow === "FAQ_FLOW" || step === "FAQ_ASK") {
    if (lang === "en") {
      return "ℹ️ *For More Details & Get App*\n\nPlease type your question or inquiry here, or visit our website (www.centralonline.lk) to download our app and learn more.\n\n(Type *Menu* anytime to return to main options)";
    }
    return "ℹ️ *වැඩිවිස්තර සදහා සහ ඇප් එක ලබාගැනීමට*\n\nඅපගේ සේවාවන් පිළිබඳ වැඩිවිස්තර සඳහා ඔබගේ ප්‍රශ්නය මෙහි Type කරන්න, නැතහොත් අපගේ ඇප් එක / වෙබ් අඩවිය (www.centralonline.lk) වෙත පිවිසෙන්න.\n\n(ප්‍රධාන මෙනුවට යාමට *Menu* Type කරන්න)";
  }

  return lang === "en" ? "Please provide your answer." : "කරුණාකර ඔබගේ පිළිතුර ලබා දෙන්න.";
}

export function getBookingConfirmManualPrompt(lang: SupportedLanguage = "si"): string {
  if (lang === "en") {
    return "📝 *Please reply to confirm your booking:*\n" +
      "1️⃣ *Yes* - Confirm Booking ✅\n" +
      "2️⃣ *Cancel* - Cancel Booking ❌\n" +
      "3️⃣ *Home* - Go to Home Page 🏠\n\n" +
      "👉 Type *1*, *2*, *3* or *Yes*, *Cancel*, *Home* to reply.";
  }
  return "📝 *Booking එක තහවුරු කිරීමට පිළිතුරු දෙන්න (Please Reply):*\n" +
    "1️⃣ *Yes* - Booking එක Confirm කරන්න ✅\n" +
    "2️⃣ *Cancel* - අවලංගු කරන්න ❌\n" +
    "3️⃣ *Home* - ප්‍රධාන මෙනුවට යන්න (Go to Home Page) 🏠\n\n" +
    "👉 *1*, *2*, *3* හෝ *Yes*, *Cancel*, *Home* ලෙස Type කරන්න.";
}

export function getRentBookingSummaryCard(data: any, lang: SupportedLanguage): string {
  const prompt = getBookingConfirmManualPrompt(lang);
  if (lang === "en") {
    return `🚗 *Rent a Car Booking Summary*\n━━━━━━━━━━━━━━━━━━━━\n👤 *Name:* ${data.customer_name || "Customer"}\n📞 *Contact:* ${data.customer_phone || "N/A"}\n🚗 *Category:* ${data.rent_vehicle_category || "Car"}\n🚘 *Model:* ${data.rent_model || "Any"}\n⏱️ *Duration:* ${data.rent_duration || "N/A"}\n📍 *Location:* ${data.rent_location || "N/A"}\n━━━━━━━━━━━━━━━━━━━━\n${prompt}`;
  }
  return `🚗 *Rent a Car ඉල්ලුම් විස්තරය (Summary)*\n━━━━━━━━━━━━━━━━━━━━\n👤 *නම:* ${data.customer_name || "පාරිභෝගිකයා"}\n📞 *දුරකථන:* ${data.customer_phone || "N/A"}\n🚗 *වාහන වර්ගය:* ${data.rent_vehicle_category || "Car"}\n🚘 *මොඩලය:* ${data.rent_model || "ඕනෑම මාදිලියක් (Any)"}\n⏱️ *කාල සීමාව:* ${data.rent_duration || "N/A"}\n📍 *ස්ථානය:* ${data.rent_location || "N/A"}\n━━━━━━━━━━━━━━━━━━━━\n${prompt}`;
}

export function getDeliveryOrderSummaryCard(data: any, lang: SupportedLanguage): string {
  const loc = formatLocationLinkForCustomer(data.delivery_location || data.dropoff_address || data.pickup_address, data.dropoff_coords);
  const prompt = getBookingConfirmManualPrompt(lang);
  if (lang === "en") {
    return `📦 *Delivery Order Summary*\n━━━━━━━━━━━━━━━━━━━━\n📂 *Category:* ${data.delivery_category || "General Items"}\n📝 *Products:* ${data.delivery_products || data.delivery_items || "N/A"}\n📞 *WhatsApp:* ${data.customer_phone || "N/A"}\n📍 *Delivery Location:*\n${loc}\n🌐 *Website:* www.centralonline.lk\n━━━━━━━━━━━━━━━━━━━━\n${prompt}`;
  }
  return `📦 *Delivery ඇණවුම් විස්තරය (Summary)*\n━━━━━━━━━━━━━━━━━━━━\n📂 *කාණ්ඩය (Category):* ${data.delivery_category || "General Items"}\n📝 *භාණ්ඩ (Products):* ${data.delivery_products || data.delivery_items || "N/A"}\n📞 *WhatsApp:* ${data.customer_phone || "N/A"}\n📍 *ස්ථානය (Delivery Location):*\n${loc}\n🌐 *Website:* www.centralonline.lk\n━━━━━━━━━━━━━━━━━━━━\n${prompt}`;
}

export function getVehicleLocalizedName(vehicleKey: string = "", lang: SupportedLanguage = "en"): string {
  const vk = (vehicleKey || "").toLowerCase();
  if (vk.includes("motor") || vk.includes("bike")) {
    if (lang === "en") return "Motorbike 🏍️";
    return "යතුරුපැදිය (Motorbike) 🏍️";
  }
  if (vk.includes("three") || vk.includes("tuk") || vk.includes("wheeler") || vk.includes("ත්‍රිරෝද")) {
    if (lang === "en") return "Three-wheeler 🛺";
    return "ත්‍රිරෝද රථය (Three-wheeler) 🛺";
  }
  if (vk.includes("van") || vk.includes("kdh") || vk.includes("වෑන්")) {
    if (lang === "en") return "Van 🚐";
    return "වෑන් (Van) 🚐";
  }
  if (vk.includes("lorry") || vk.includes("truck") || vk.includes("ලොරි")) {
    if (lang === "en") return "Lorry 🚚";
    return "ලොරි (Lorry) 🚚";
  }
  if (vk.includes("bus") || vk.includes("බස්")) {
    if (lang === "en") return "Bus 🚌";
    return "බස් (Bus) 🚌";
  }
  if (vk.includes("car") || vk.includes("කාර්")) {
    if (lang === "en") return "Car 🚗";
    return "කාර් (Car) 🚗";
  }
  return vehicleKey;
}

export function getBookingSummaryCard(data: any, lang: SupportedLanguage, isDelivery = false): string {
  const isScheduled = data.booking_type === "schedule" && data.scheduled_time;
  const pickup = formatLocationLinkForCustomer(data.pickup_address || data.pickup_text, data.pickup_coords);
  const dropoff = formatLocationLinkForCustomer(data.dropoff_address || data.dropoff_text, data.dropoff_coords);
  const prompt = getBookingConfirmManualPrompt(lang);
  
  const baseVehicleName = getVehicleLocalizedName(data.vehicle_key || data.vehicle_name || "car", lang);
  const vehicleText = data.vehicle_model?.name
    ? `${baseVehicleName} (${data.vehicle_model.name})`
    : baseVehicleName;

  if (lang === "en") {
    const timingHeader = isScheduled ? `📅 *Long Distance Trip (Schedule):* ${data.scheduled_time}\n` : `⚡ *Short Distance Trip (Short Trip)*\n`;
    return `📋 *Booking Summary*\n━━━━━━━━━━━━━━━━━━━━\n${timingHeader}👤 *Name:* ${data.customer_name}\n📱 *Contact:* ${data.customer_phone}\n🚗 *Vehicle:* ${vehicleText}\n📍 *Pickup Location:*\n${pickup}\n🏁 *Drop-off Location:*\n${dropoff}\n${isDelivery ? `📦 *Items:* ${data.delivery_items}\n` : `🔄 *Trip Type:* ${data.trip_type === "round_trip" ? "Round Trip (Up & Down)" : "One-Way"}\n`}🛣️ *Distance:* ${data.distance_text}\n💰 *Total Fare:* LKR ${Number(data.total_fare || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}\n━━━━━━━━━━━━━━━━━━━━\n${prompt}`;
  }

  const timingHeader = isScheduled ? `📅 *දුර ගමනක් (Schedule):* ${data.scheduled_time}\n` : `⚡ *ලග ගමනක් (Short Trip)*\n`;
  return `📋 *වෙන්කිරීමේ විස්තරය (Booking Summary)*\n━━━━━━━━━━━━━━━━━━━━\n${timingHeader}👤 *නම:* ${data.customer_name}\n📱 *දුරකථන:* ${data.customer_phone}\n🚗 *වාහනය:* ${vehicleText}\n📍 *ආරම්භක ස්ථානය (Pickup):*\n${pickup}\n🏁 *ගමනාන්තය (Drop-off):*\n${dropoff}\n${isDelivery ? `📦 *භාණ්ඩ:* ${data.delivery_items}\n` : `🔄 *ගමන් වර්ගය:* ${data.trip_type === "round_trip" ? "දෙපැත්තම (Round Trip)" : "එක් පැත්තක් (One-Way)"}\n`}🛣️ *දුර:* ${data.distance_text}\n💰 *ගාස්තුව:* LKR ${Number(data.total_fare || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}\n━━━━━━━━━━━━━━━━━━━━\n${prompt}`;
}

export function getBookingSuccessMessage(orderCode: string, lang: SupportedLanguage, category: string = ""): string {
  const code = (orderCode || "").toUpperCase();
  const cat = (category || "").toLowerCase();
  const isRent = cat.includes("rent") || code.startsWith("RNT");
  const isDelivery = cat.includes("delivery") || code.startsWith("DEL");

  if (isRent) {
    if (lang === "en") {
      return `✅ *Your booking has been successfully confirmed!*\n\n🏷️ *Order Code:* *${orderCode}*\n\nOur agent will contact you shortly with the vehicle photos and pricing details. If you have any questions, type *Help*, or type *Cancel* to cancel at any time.\n\nThank you! We are very glad you chose our service. 🚗`;
    }
    return `✅ *ඔබගේ Booking එක සාර්ථකව තහවුරු කරන ලදී!*\n\n🏷️ *Order Code:* *${orderCode}*\n\nඅපගේ නියෝජිතයෙකු (Agent) ඉක්මනින් ඔබව සම්බන්ධ කරගෙන, වාහනයේ ඡායාරූප සහ මිල ගණන් පිළිබඳ විස්තර ලබා දෙනු ඇත. Cancel කිරීමට අවශ්‍ය නම් ඕනෑම වේලාවක *Cancel* ලෙස Type කරන්න.\n\nස්තූතියි! අපගේ සේවාව තෝරා ගැනීම පිළිබඳව ඉතාමත් සතුටුයි. 🚗`;
  }

  if (isDelivery) {
    if (lang === "en") {
      return `✅ *Your delivery order has been successfully confirmed!*\n\n🏷️ *Order Code:* *${orderCode}*\n\nOur delivery driver will contact you shortly. If you wish to cancel at any time, simply type *Cancel*.\n\nThank you for choosing Central Delivery! 📦`;
    }
    return `✅ *ඔබගේ Delivery ඇණවුම සාර්ථකව තහවුරු කරන ලදී!*\n\n🏷️ *Order Code:* *${orderCode}*\n\nඅපගේ ඩිලිවරි රියදුරු ඔබව ඉක්මනින් සම්බන්ධ කරගනු ඇත. Cancel කිරීමට අවශ්‍ය නම් ඕනෑම වේලාවක *Cancel* ලෙස Type කරන්න.\n\nස්තූතියි! 📦`;
  }

  if (lang === "en") {
    return `✅ *Your booking has been successfully confirmed!*\n\n🏷️ *Order Code:* *${orderCode}*\n\nOur driver/provider will contact you shortly. If you wish to cancel at any time before arrival, simply type *Cancel*.\n\nThank you for choosing Central Cabs & Services! 🚕`;
  }
  return `✅ *ඔබගේ Booking එක සාර්ථකව තහවුරු කරන ලදී!*\n\n🏷️ *Order Code:* *${orderCode}*\n\nළඟම සිටින රියදුරු මහතා ඔබව ඉක්මනින් සම්බන්ධ කරගනු ඇත. ගමන Cancel කිරීමට අවශ්‍ය නම් ඕනෑම වේලාවක *Cancel* ලෙස Type කරන්න.\n\nස්තූතියි! අපගේ සේවාව තෝරා ගැනීම පිළිබඳව ඉතාමත් සතුටුයි. 🚕`;
}

export function getCancellationSuccessMessage(orderCode: string, lang: SupportedLanguage): string {
  if (lang === "en") {
    return `✅ Your booking (*${orderCode || ""}*) has been successfully cancelled.`;
  }
  return `✅ ඔබගේ Order එක (*${orderCode || ""}*) සාර්ථකව Cancel කරන ලදී.`;
}
