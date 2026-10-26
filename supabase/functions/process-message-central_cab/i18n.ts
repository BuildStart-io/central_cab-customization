// ============================================================================
// Ceylon Central Cabs & Delivery - Multi-Lingual Engine (i18n)
// Strict Native Support for Tamil, Sinhala, and English
// ============================================================================

export type SupportedLanguage = "ta" | "si" | "en";

export interface PollDefinition {
  name: string;
  options: string[];
  multipleAnswers?: boolean;
}

/**
 * Normalize and detect selected language from user input or poll vote
 */
export function detectLanguageSelection(input: string): SupportedLanguage | null {
  const text = (input || "").trim().toLowerCase();
  
  // Tamil indicators
  if (
    text === "1" ||
    text.startsWith("1.") ||
    text.startsWith("1 ") ||
    text.includes("tamil") ||
    text.includes("தமிழ்") ||
    text.includes("tamizh") ||
    text.includes("thamizh") ||
    text.includes("tamil 🇱🇰")
  ) {
    return "ta";
  }

  // Sinhala indicators
  if (
    text === "2" ||
    text.startsWith("2.") ||
    text.startsWith("2 ") ||
    text.includes("sinhala") ||
    text.includes("සිංහල") ||
    text.includes("singlish") ||
    text.includes("sinhala 🇱🇰")
  ) {
    return "si";
  }

  // English indicators
  if (
    text === "3" ||
    text.startsWith("3.") ||
    text.startsWith("3 ") ||
    text.includes("english") ||
    text.includes("eng") ||
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
    text.includes("மீண்டும்") ||
    text.includes("ප්‍රධාන මෙනුව") ||
    text.includes("මුල් මෙනුව")
  ) {
    return true;
  }
  return false;
}


export function detectServiceCategory(input: string): ServiceCategory | null {
  const text = (input || "").trim().toLowerCase();

  // 1. Ride Now (Immediate)
  if (
    text === "1" ||
    text.startsWith("1.") ||
    text.startsWith("1 ") ||
    text.includes("ride now") ||
    text.includes("now ride") ||
    text.includes("இப்போதே") ||
    text.includes("இப்போது") ||
    text.includes("உடனே") ||
    text.includes("දැන්ම") ||
    text.includes("danma") ||
    text.includes("damma") ||
    text.includes("ipo ride") ||
    text.includes("ipova")
  ) {
    return "ride_now";
  }

  // 2. Schedule Ride (Advance reservation)
  if (
    text === "2" ||
    text.startsWith("2.") ||
    text.startsWith("2 ") ||
    text.includes("schedule ride") ||
    text.includes("schedule") ||
    text.includes("முன்பதிவு") ||
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
    text.includes("வாடகை கார்") ||
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
    text.includes("டெலிவரி") ||
    text.includes("பார்சல்") ||
    text.includes("භාණ්ඩ") ||
    text.includes("පාර්සල්")
  ) {
    return "delivery";
  }

  // 5. Ask a question
  if (
    text === "5" ||
    text.startsWith("5.") ||
    text.startsWith("5 ") ||
    text.includes("ask") ||
    text.includes("question") ||
    text.includes("help") ||
    text.includes("inquiry") ||
    text.includes("கேள்வி") ||
    text.includes("விபரம்") ||
    text.includes("ප්‍රශ්න") ||
    text.includes("විස්තර")
  ) {
    return "ask_a_question";
  }

  // Fallback keyword matching for transport without explicit timing
  if (text.includes("cab") || text.includes("taxi") || text.includes("வாகன சவாரி") || text.includes("ප්‍රවාහන")) {
    return "ride_now";
  }

  return null;
}

/**
 * Affirmative checks across Tamil, Sinhala, English
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
    l === "ஆம்" ||
    l === "சரி" ||
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
 * Negative checks across Tamil, Sinhala, English
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
    l === "නැත" ||
    l === "இல்லை" ||
    l === "வேண்டாம்"
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
    l.includes("முதன்மை") ||
    l.includes("ප්‍රධාන මෙනුව") ||
    l.includes("මුල් මෙනුව") ||
    l.includes("மீண்டும்")
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
    l === "santhegam" ||
    l === "sandhegam" ||
    l === "kelvi" ||
    l === "kelvigal" ||
    l === "question" ||
    l === "questions" ||
    l === "inquiry" ||
    l === "inquiries" ||
    l === "உதவி" ||
    l === "சந்தேகம்" ||
    l === "சந்தேகங்கள்" ||
    l === "கேள்வி" ||
    l === "கேள்விகள்" ||
    l === "விபரம்" ||
    l === "விபரங்கள்" ||
    l === "සහාය" ||
    l === "ප්‍රශ්න" ||
    l === "විස්තර" ||
    l.startsWith("1. ❓") ||
    l.startsWith("1.❓") ||
    l.startsWith("❓") ||
    (l.includes("help") && !l.includes("confirm")) ||
    l.includes("சந்தேகம்") ||
    l.includes("santhegam")
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
    l === "தொடர" ||
    l === "முன்பதிவு" ||
    l === "இடத்துக்கு போ" ||
    l === "ඉදිරියට" ||
    l === "බුකින්" ||
    l === "go back"
  );
}

export function isTimingNowChoice(text: string): boolean {
  const l = (text || "").toLowerCase().trim();
  if (l === "1" || l.startsWith("1.") || l.startsWith("1 ") || l === "1)") return true;
  if (l.includes("now") || l.includes("immediate") || l.includes("urgent")) return true;
  if (l.includes("ipo") || l.includes("ipova") || l.includes("ipove") || l.includes("இப்போது") || l.includes("உடனே")) return true;
  if (l.includes("dan") || l.includes("damma") || l.includes("danma") || l.includes("දැන්")) return true;
  return false;
}

export function isTimingScheduleChoice(text: string): boolean {
  const l = (text || "").toLowerCase().trim();
  if (l === "2" || l.startsWith("2.") || l.startsWith("2 ") || l.startsWith("2)")) return true;
  if (l.includes("sched") || l.includes("schd") || l.includes("later") || l.includes("reserve") || l.includes("advance")) return true;
  if (l.includes("passe") || l.includes("pasuwata") || l.includes("පසුව") || l.includes("කාලය")) return true;
  if (l.includes("naeram") || l.includes("neram") || l.includes("முன்பதிவு") || l.includes("பின்னே")) return true;
  return false;
}

// ============================================================================
// Poll Generators
// ============================================================================

export function getLanguagePoll(): PollDefinition {
  return {
    name: "Please choose your preferred language / ඔබගේ භාෂාව තෝරන්න / உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்:",
    options: [
      "1. தமிழ் (Tamil) 🇱🇰",
      "2. සිංහල (Sinhala) 🇱🇰",
      "3. English 🇬🇧",
    ],
    multipleAnswers: false,
  };
}

export function getCategoryPoll(lang?: SupportedLanguage): PollDefinition {
  if (lang === "ta") {
    return {
      name: "Central Cabs & Services - நீங்கள் விரும்பும் சேவையைத் தேர்ந்தெடுக்கவும்:",
      options: [
        "1. ⚡ இப்போதே பயணம் (Ride Now)",
        "2. 📅 முன்பதிவு பயணம் (Schedule Ride)",
        "3. 🚗 வாடகை கார் (Rent a Car)",
        "4. 📦 டெலிவரி (Delivery)",
        "5. ❓ கேள்வி கேட்க (Ask a question)",
      ],
      multipleAnswers: false,
    };
  }
  if (lang === "si") {
    return {
      name: "Central Cabs & Services - ඔබට අවශ්‍ය සේවාව තෝරන්න:",
      options: [
        "1. ⚡ දැන්ම Ride එකක් (Ride Now)",
        "2. 📅 පසුවට Ride එකක් (Schedule Ride)",
        "3. 🚗 Rent a Car (කාර් කුලියට)",
        "4. 📦 Delivery (භාණ්ඩ ප්‍රවාහනය)",
        "5. ❓ ප්‍රශ්නයක් අසන්න (Ask a question)",
      ],
      multipleAnswers: false,
    };
  }
  if (lang === "en") {
    return {
      name: "Central Cabs & Services - Please select the service you need:",
      options: [
        "1. ⚡ Ride Now",
        "2. 📅 Schedule Ride",
        "3. 🚗 Rent a Car",
        "4. 📦 Delivery Service",
        "5. ❓ Ask a question",
      ],
      multipleAnswers: false,
    };
  }
  // Multi-lingual default when language is not yet fixed
  return {
    name: "Welcome to Central Cabs & Delivery / සාදරයෙන් පිළිගනිමු / அன்புடன் வரவேற்கிறோம்!",
    options: [
      "1. ⚡ Ride Now (இப்போதே / දැන්ම)",
      "2. 📅 Schedule Ride (முன்பதிவு / පසුවට)",
      "3. 🚗 Rent a Car (வாடகை கார் / කුලියට)",
      "4. 📦 Delivery (டெலிவரி / පාර්சල්)",
      "5. ❓ Ask a question (விபரம் / විස්තර)",
    ],
    multipleAnswers: false,
  };
}

export function getTimingPoll(lang: SupportedLanguage = "si", isDelivery = false): PollDefinition {
  const resetOption = "🔄 Reset / Main Menu (මුල් මෙනුව / மீண்டும்)";
  if (lang === "ta") {
    return {
      name: isDelivery
        ? "டெலிவரி சேவை இப்போது வேண்டுமா அல்லது குறிப்பிட்ட நேரத்திற்கு முன்பதிவு செய்ய வேண்டுமா?"
        : "வாகன சவாரி இப்போது தேவையா அல்லது குறிப்பிட்ட நேரத்திற்கு முன்பதிவு செய்ய வேண்டுமா?",
      options: [
        "1. Now (இப்போது) ⚡",
        "2. Schedule (முன்பதிவு) 📅",
        resetOption,
      ],
      multipleAnswers: false,
    };
  }
  if (lang === "si") {
    return {
      name: isDelivery
        ? "ඔබට Delivery පහසුකම දැන්ම අවශ්‍යද නැතහොත් Schedule කිරීමට අවශ්‍යද?"
        : "ඔබට ප්‍රවාහනය දැන්ම අවශ්‍යද නැතහොත් Ride එකක් Schedule කිරීමට අවශ්‍යද?",
      options: [
        "1. Now (දැන්ම) ⚡",
        "2. Schedule (පසුවට) 📅",
        resetOption,
      ],
      multipleAnswers: false,
    };
  }
  return {
    name: isDelivery
      ? "Do you need Delivery right now or would you like to schedule for later?"
      : "Do you need a ride right now or would you like to schedule for later?",
    options: [
      "1. Now (Immediate) ⚡",
      "2. Schedule (Later) 📅",
      resetOption,
    ],
    multipleAnswers: false,
  };
}

export function getVehiclePoll(
  lang: SupportedLanguage = "si",
  isDelivery = false,
  bookingType: string = "now"
): PollDefinition {
  const resetOption = "🔄 Reset / Main Menu (මුල් මෙනුව / மீண்டும்)";
  if (isDelivery) {
    if (lang === "ta") {
      return {
        name: "டெலிவரிக்கான வாகனத்தைத் தேர்ந்தெடுக்கவும்:",
        options: [
          "1. Motorbike 🏍️",
          "2. Three-wheeler 🛺",
          resetOption,
        ],
        multipleAnswers: false,
      };
    }
    if (lang === "si") {
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

  // 1. Ride Now: Only Motorbike and Three-wheeler
  const isSchedule = bookingType === "schedule";
  if (!isSchedule) {
    if (lang === "ta") {
      return {
        name: "உடனடி சவாரிக்கு (Ride Now) வாகனத்தைத் தேர்ந்தெடுக்கவும்:",
        options: [
          "1. Motorbike 🏍️",
          "2. Three-wheeler 🛺",
          resetOption,
        ],
        multipleAnswers: false,
      };
    }
    if (lang === "si") {
      return {
        name: "කරුණාකර දැන් ගමන් කිරීමට (Ride Now) වාහනය තෝරන්න:",
        options: [
          "1. Motorbike 🏍️",
          "2. Three-wheeler 🛺",
          resetOption,
        ],
        multipleAnswers: false,
      };
    }
    return {
      name: "Please choose vehicle for Ride Now:",
      options: [
        "1. Motorbike 🏍️",
        "2. Three-wheeler 🛺",
        resetOption,
      ],
      multipleAnswers: false,
    };
  }

  // 2. Schedule Ride: The other 4 (Car, Van, Lorry, Bus)
  if (lang === "ta") {
    return {
      name: "முன்பதிவு சவாரிக்கு (Schedule Ride) வாகனத்தைத் தேர்ந்தெடுக்கவும்:",
      options: [
        "1. Car 🚗",
        "2. Van 🚐",
        "3. Lorry 🚚",
        "4. Bus 🚌",
        resetOption,
      ],
      multipleAnswers: false,
    };
  }
  if (lang === "si") {
    return {
      name: "කරුණාකර Schedule Ride සඳහා වාහනය තෝරන්න:",
      options: [
        "1. Car 🚗",
        "2. Van 🚐",
        "3. Lorry 🚚",
        "4. Bus 🚌",
        resetOption,
      ],
      multipleAnswers: false,
    };
  }
  return {
    name: "Please choose vehicle for Schedule Ride:",
    options: [
      "1. Car 🚗",
      "2. Van 🚐",
      "3. Lorry 🚚",
      "4. Bus 🚌",
      resetOption,
    ],
    multipleAnswers: false,
  };
}

export function getVehicleModelPoll(
  vehicleKey: string,
  models: any[],
  lang: SupportedLanguage = "si"
): PollDefinition {
  const resetOption = "🔄 Reset / Main Menu (මුල් මෙනුව / மீண்டும்)";
  const vName =
    vehicleKey === "car"
      ? "Car 🚗"
      : vehicleKey === "van"
      ? "Van 🚐"
      : vehicleKey === "lorry"
      ? "Lorry 🚚"
      : vehicleKey === "bus"
      ? "Bus 🚌"
      : vehicleKey;

  let title = `Central Cabs - Choose ${vName} model:`;
  if (lang === "ta") {
    title = `Central Cabs - ${vName} மாடலைத் தேர்ந்தெடுக்கவும்:`;
  } else if (lang === "si") {
    title = `Central Cabs - ${vName} මාදිලිය තෝරන්න:`;
  }

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
  const resetOption = "🔄 Reset / Main Menu (මුල් මෙනුව / மீண்டும்)";
  if (lang === "ta") {
    return {
      name: "Central Cabs - வாடகைக்கு தேவையான வாகன வகையைத் தேர்ந்தெடுக்கவும்:",
      options: [
        "1. 🏍️ Bike (பைக்)",
        "2. 🛺 Three-Wheel (முச்சக்கர வண்டி)",
        "3. 🚗 Car (கார்)",
        "4. 🚐 Van (வேன்)",
        resetOption,
      ],
      multipleAnswers: false,
    };
  }
  if (lang === "si") {
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

export function detectRentVehicleCategory(text: string): string {
  const t = (text || "").toLowerCase().trim();
  if (t.includes("bike") || t.includes("motorcycle") || t.includes("பைக்") || t.includes("බයික්") || t.startsWith("1")) {
    return "Bike";
  }
  if (t.includes("three") || t.includes("tuk") || t.includes("முச்சக்கர") || t.includes("ත්‍රිරෝද") || t.startsWith("2")) {
    return "Three-Wheel";
  }
  if (t.includes("car") || t.includes("கார்") || t.includes("කාර්") || t.startsWith("3")) {
    return "Car";
  }
  if (t.includes("van") || t.includes("வேன்") || t.includes("වෑන්") || t.startsWith("4")) {
    return "Van";
  }
  return "Car";
}

export function getDeliveryCategoryPoll(lang: SupportedLanguage = "si"): PollDefinition {
  const resetOption = "🔄 Main Menu (මුල් මෙනුව / மீண்டும்)";
  if (lang === "ta") {
    return {
      name: "தயாரிப்பு பிரிவைத் தேர்ந்தெடுக்கவும் (centralonline.lk):",
      options: [
        "1. Cakes 🎂",
        "2. Cloth / ஆடைகள் 👕",
        "3. Computer & Laptops 💻",
        "4. Cosmetics / அழகுசாதனம் 💄",
        "5. Gift Items 🎁",
        "6. Food & Drinks 🍔🥤",
        "7. Mobile & Phones 📱",
        "8. Party & School Items 🎉📚",
        "9. Electronics & Headphones 🎧",
        "10. Other Items / ஏனையவை 📦",
        resetOption,
      ],
      multipleAnswers: false,
    };
  }
  if (lang === "si") {
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

export function detectDeliveryCategory(text: string): string | null {
  const t = (text || "").toLowerCase().trim();
  if (t === "1" || t.startsWith("1.") || t.startsWith("1 ") || t.includes("cake")) return "Cakes 🎂";
  if (t === "2" || t.startsWith("2.") || t.startsWith("2 ") || t.includes("cloth") || t.includes("ஆடை") || t.includes("ඇඳුම්")) return "Cloth / Fashion 👕";
  if (t === "3" || t.startsWith("3.") || t.startsWith("3 ") || t.includes("comp") || t.includes("laptop")) return "Computer & Laptops 💻";
  if (t === "4" || t.startsWith("4.") || t.startsWith("4 ") || t.includes("cosmetic") || t.includes("அழகு")) return "Cosmetics 💄";
  if (t === "5" || t.startsWith("5.") || t.startsWith("5 ") || t.includes("gift")) return "Gift Items 🎁";
  if (t === "6" || t.startsWith("6.") || t.startsWith("6 ") || t.includes("food") || t.includes("drink") || t.includes("உணவு")) return "Food & Drinks 🍔🥤";
  if (t === "7" || t.startsWith("7.") || t.startsWith("7 ") || t.includes("mobile") || t.includes("phone")) return "Mobile & Phones 📱";
  if (t === "8" || t.startsWith("8.") || t.startsWith("8 ") || t.includes("party") || t.includes("school")) return "Party & School Items 🎉📚";
  if (t === "9" || t.startsWith("9.") || t.startsWith("9 ") || t.includes("electronic") || t.includes("headphone")) return "Electronics & Headphones 🎧";
  if (t === "10" || t.startsWith("10.") || t.startsWith("10 ") || t.includes("other") || t.includes("ஏனைய")) return "General / Other Items 📦";
  if (t.length >= 2) return text.trim();
  return null;
}

export function getTripTypePoll(lang: SupportedLanguage = "si"): PollDefinition {
  const resetOption = "🔄 Reset / Main Menu (මුල් මෙනුව / மீண்டும்)";
  if (lang === "ta") {
    return {
      name: "பயண வகையைத் தேர்ந்தெடுக்கவும் (Trip Type):",
      options: [
        "1. One-Way (ஒரு வழி) ➡️",
        "2. Round Trip (இரு வழி Up & Down) 🔄",
        resetOption,
      ],
      multipleAnswers: false,
    };
  }
  if (lang === "si") {
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

export function getBookingConfirmPoll(lang: SupportedLanguage = "si"): PollDefinition {
  const resetOption = "🔄 Reset / Main Menu (මුල් මෙනුව / மீண்டும்)";
  if (lang === "ta") {
    return {
      name: "முன்பதிவை உறுதிப்படுத்தவும் (Confirm Booking):",
      options: [
        "Yes, Confirm Booking ✅",
        "No, Cancel ❌",
        resetOption,
      ],
      multipleAnswers: false,
    };
  }
  if (lang === "si") {
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

export function getCancelConfirmPoll(lang: SupportedLanguage = "si"): PollDefinition {
  const resetOption = "🔄 Reset / Main Menu (මුල් මෙනුව / மீண்டும்)";
  if (lang === "ta") {
    return {
      name: "முன்பதிவை ரத்து (Cancel) செய்ய விரும்புகிறீர்களா?",
      options: [
        "Yes, Cancel Order ❌",
        "No, Keep Order ✅",
        resetOption,
      ],
      multipleAnswers: false,
    };
  }
  if (lang === "si") {
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
  return {
    name: "Are you sure you want to cancel this booking?",
    options: [
      "Yes, Cancel Order ❌",
      "No, Keep Order ✅",
    ],
    multipleAnswers: false,
  };
}

export function getPostBookingPoll(lang: SupportedLanguage = "si"): PollDefinition {
  const resetOption = "🔄 Main Menu (මුල් මෙනුව / மீண்டும்)";
  if (lang === "ta") {
    return {
      name: "உங்களுக்கு மேலதிக உதவி தேவைப்படுகிறதா?",
      options: [
        "1. ❓ Help / சந்தேகங்கள்",
        "2. ❌ Cancel Booking",
        resetOption,
      ],
      multipleAnswers: false,
    };
  }
  if (lang === "si") {
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

// ============================================================================
// Multi-lingual Text Prompts
// ============================================================================

export function getStepPromptText(flow: string, step: string, lang: SupportedLanguage): string {
  // 1. Language & Category selection
  if (step === "LANGUAGE_CHOICE") {
    return "Please select your language:\n1. தமிழ் (Tamil) 🇱🇰\n2. සිංහල (Sinhala) 🇱🇰\n3. English 🇬🇧";
  }
  if (step === "CATEGORY_CHOICE") {
    if (lang === "ta") {
      return "Central Cabs & Services - நீங்கள் விரும்பும் சேவையைத் தேர்ந்தெடுக்கவும்:";
    }
    if (lang === "si") {
      return "Central Cabs & Services - ඔබට අවශ්‍ය සේවාව තෝරන්න:";
    }
    return "Central Cabs & Services - Please select the service you need:";
  }

  // 2. Hire / Cab Flow
  if (flow === "CAB_FLOW") {
    switch (step) {
      case "CAB_TIMING_CHOICE":
        if (lang === "ta") return "வாகன சவாரி இப்போது தேவையா அல்லது முன்பதிவு செய்ய வேண்டுமா?";
        if (lang === "si") return "ඔබට ප්‍රවාහනය දැන්ම අවශ්‍යද නැතහොත් Ride එකක් Schedule කිරීමට අවශ්‍යද?";
        return "Do you need a ride right now or would you like to schedule for later?";

      case "CAB_SCHEDULE_DATE":
        if (lang === "ta") return "உங்கள் பயணத்திற்கான திகதியை (Date) குறிப்பிடவும்:\n(உதாரணம்: 2026/10/25, Tomorrow, அல்லது நாளை)";
        if (lang === "si") return "කරුණාකර ඔබගේ ගමනට අවශ්‍ය දිනය (Date) සඳහන් කරන්න:\n(උදා: 2026/10/25, Tomorrow, හෝ හෙට)";
        return "Please specify the date for your ride:\n(e.g., 2026/10/25, Tomorrow, or Friday)";

      case "CAB_SCHEDULE_TIME":
        if (lang === "ta") return "உங்கள் பயணத்திற்கான நேரத்தைக் (Time) குறிப்பிடவும்:\n(உதாரணம்: 10:30 AM, 04:00 PM, அல்லது 8:00 AM)";
        if (lang === "si") return "කරුණාකර ඔබගේ ගමනට අවශ්‍ය වේලාව (Time) සඳහන් කරන්න:\n(උදා: 10:30 AM, 04:00 PM, හෝ 8:00 AM)";
        return "Please specify the time for your pickup:\n(e.g., 10:30 AM, 04:00 PM, or 8:00 AM)";

      case "CAB_NAME":
        if (lang === "ta") return "தயவுசெய்து உங்கள் பெயரை உள்ளிடவும்:";
        if (lang === "si") return "කරුණාකර ඔබගේ නම ඇතුළත් කරන්න:";
        return "Please enter your name:";

      case "CAB_PHONE":
        if (lang === "ta") return "தயவுசெய்து உங்கள் தொடர்பு இலக்கத்தை (Contact Number) வழங்கவும்:";
        if (lang === "si") return "කරුණාකර ඔබගේ Contact Number එක ලබා දෙන්න:";
        return "Please provide your contact phone number:";

      case "CAB_VEHICLE":
        if (lang === "ta") return "உங்களுக்குத் தேவையான வாகனத்தைத் தேர்ந்தெடுக்கவும்:";
        if (lang === "si") return "කරුණාකර ඔබට අවශ්‍ය වාහනය තෝරන්න:";
        return "Please choose your vehicle type:";

      case "CAB_PICKUP":
        if (lang === "ta") return "தயவுசெய்து உங்கள் தற்போதைய இடத்தை WhatsApp Location Pin (Live/Current Location) மூலம் பகிரவும்.\nஅல்லது உங்கள் அருகிலுள்ள நகரம் மற்றும் மாவட்டத்தைத் தட்டச்சு செய்யவும்:";
        if (lang === "si") return "කරුණාකර ඔබගේ Live/Current location එක WhatsApp හරහා share කරන්න. ඔබට එය share කිරීමට අපහසු නම්, කරුණාකර ඔබගේ ළඟම ඇති නගරය සහ දිස්ත්‍රික්කය Type කරන්න:";
        return "Please share your current/pickup location via WhatsApp Location pin.\nOr type your nearest city & district:";

      case "CAB_DROPOFF":
        if (lang === "ta") return "தயவுசெய்து நீங்கள் இறங்க வேண்டிய இடத்தை (Drop-off Location) பகிரவும் அல்லது அருகிலுள்ள நகரம் மற்றும் மாவட்டத்தைத் தட்டச்சு செய்யவும்:";
        if (lang === "si") return "කරුණාකර ඔබගේ Drop-off location එක WhatsApp හරහා share කරන්න හෝ ඔබගේ ළඟම ඇති නගරය සහ දිස්ත්‍රික්කය Type කරන්න:";
        return "Please share your drop-off location or type the destination city & district:";

      case "CAB_TRIP_TYPE":
        if (lang === "ta") return "இது ஒரு வழிப் பயணமா அல்லது இரு வழிப் பயணமா (Round Trip Up & Down)?";
        if (lang === "si") return "මෙය One-Way ගමනක් ද නැතහොත් Round Trip (Up & Down) ගමනක් ද?";
        return "Is this a One-Way ride or a Round Trip (Up & Down)?";

      case "CAB_CONFIRM":
        return getBookingConfirmManualPrompt(lang);
    }
  }

  // 3. Delivery Flow
  if (flow === "DELIVERY_FLOW") {
    switch (step) {
      case "DELIVERY_CATEGORY":
        if (lang === "ta") {
          return "📦 *Central Delivery Service*\n\nஎமது *www.centralonline.lk* இணையதளத்தைப் பார்வையிட்டு மேலதிக தயாரிப்பு விபரங்களைப் (More Products Information) பெற்றுக்கொள்ளலாம்! 🌐\n\nதயவுசெய்து உங்களுக்குத் தேவையான தயாரிப்பு பிரிவைத் (Product Category) தேர்ந்தெடுக்கவும்:";
        }
        if (lang === "si") {
          return "📦 *Central Delivery Service*\n\nඅපගේ *www.centralonline.lk* වෙබ් අඩවියට පිවිස වැඩිදුර නිෂ්පාදන තොරතුරු (More Products Information) ලබා ගත හැක! 🌐\n\nකරුණාකර ඔබට අවශ්‍ය භාණ්ඩ කාණ්ඩය (Product Category) තෝරන්න:";
        }
        return "📦 *Central Delivery Service*\n\nPlease visit our website *www.centralonline.lk* for more products information! 🌐\n\nPlease select your preferred product category:";

      case "DELIVERY_ITEMS":
        if (lang === "ta") {
          return "📝 தயவுசெய்து உங்களுக்குத் தேவையான குறிப்பிட்ட பொருட்கள் என்னென்ன என்பதை அவற்றின் விபரங்களுடன் (Product Name / Description / Quantity) இங்கே தட்டச்சு செய்யவும்:\n\n(உதாரணம்: 1kg Chocolate Cake, 2 Chicken Burgers, அல்லது Large T-shirt)";
        }
        if (lang === "si") {
          return "📝 කරුණාකර ඔබට අවශ්‍ය විශේෂිත භාණ්ඩ මොනවාදැයි විස්තර (Product Name / Quantity) සමඟ මෙහි Type කරන්න:\n\n(උදා: 1kg Chocolate Cake, Burgers 2ක්, හෝ Large T-shirt)";
        }
        return "📝 Please type the specific products, items, or quantities you need:\n\n(e.g., 1kg Chocolate Cake, 2 Chicken Burgers, or Large T-shirt)";

      case "DELIVERY_PHONE":
        if (lang === "ta") {
          return "📞 உங்களைத் தொடர்புகொள்ள வேண்டிய WhatsApp அல்லது தொலைபேசி இலக்கத்தை உள்ளிடவும் (Contact Number):\n(உதாரணம்: 0771234567)";
        }
        if (lang === "si") {
          return "📞 ඔබව සම්බන්ධ කරගත හැකි WhatsApp හෝ දුරකථන අංකය ඇතුළත් කරන්න (Contact Number):\n(උදා: 0771234567)";
        }
        return "📞 Please enter your contact WhatsApp or phone number:\n(e.g., 0771234567)";

      case "DELIVERY_LOCATION":
        if (lang === "ta") {
          return "📍 தயவுசெய்து பொருட்கள் டெலிவரி செய்யப்பட வேண்டிய உங்கள் தற்போதைய இடத்தை (Delivery / Current Location) WhatsApp Location Pin மூலம் பகிரவும் அல்லது முகவரி/நகரத்தைத் தட்டச்சு செய்யவும்:";
        }
        if (lang === "si") {
          return "📍 කරුණාකර භාණ්ඩ භාරදිය යුතු ඔබගේ ස්ථානය (Delivery Location) WhatsApp Location Pin මඟින් share කරන්න හෝ ලිපිනය/නගරය Type කරන්න:";
        }
        return "📍 Please share your delivery location pin via WhatsApp or type the delivery address / city:";

      case "DELIVERY_CONFIRM":
        return getBookingConfirmManualPrompt(lang);
    }
  }

  // 4. Rent a Car Flow
  if (flow === "RENT_A_CAR_FLOW") {
    switch (step) {
      case "RENT_VEHICLE_CHOICE":
        if (lang === "ta") return "🚗 *வாடகை கார் & வாகன சேவை (Rent a Car)*\nதயவுசெய்து உங்களுக்குத் தேவையான வாகன வகையைத் தேர்ந்தெடுக்கவும்:";
        if (lang === "si") return "🚗 *Rent a Car & වාහන සේවාව*\nකරුණාකර ඔබට අවශ්‍ය වාහන කාණ්ඩය තෝරන්න:";
        return "🚗 *Rent a Car & Vehicle Service*\nPlease select your vehicle category:";

      case "RENT_NAME":
        if (lang === "ta") return "👤 தயவுசெய்து உங்கள் பெயரை உள்ளிடவும் (Your Name):";
        if (lang === "si") return "👤 කරුණාකර ඔබගේ නම ඇතුළත් කරන්න (Your Name):";
        return "👤 Please enter your name:";

      case "RENT_PHONE":
        if (lang === "ta") return "📞 உங்களை தொடர்பு கொள்ள வேண்டிய தொலைபேசி எண்ணை உள்ளிடவும் (Contact Phone Number):";
        if (lang === "si") return "📞 ඔබව සම්බන්ධ කරගත හැකි දුරකථන අංකය ඇතුළත් කරන්න (Contact Phone Number):";
        return "📞 Please enter your contact phone number:";

      case "RENT_LOCATION":
        if (lang === "ta") return "📍 வாகனம் தேவைப்படும் இடம் / பகுதியை உள்ளிடவும் (Location / City / Area):";
        if (lang === "si") return "📍 වාහනය අවශ්‍ය ස්ථානය / ප්‍රදේශය ඇතුළත් කරන්න (Location / City / Area):";
        return "📍 Please enter the rental location or area (Location / City / Area):";

      case "RENT_MODEL":
        if (lang === "ta") return "🚘 நீங்கள் விரும்பும் குறிப்பிட்ட வாகனம் / மாடல் எது?\n(உதாரணம்: Alto, Wagon R, Aqua, Prius, KDH Van, அல்லது Any Model):";
        if (lang === "si") return "🚘 ඔබ බලාපොරොත්තු වන වාහන මොඩලය කුමක්ද?\n(උදා: Alto, Wagon R, Aqua, Prius, KDH Van, හෝ Any Model):";
        return "🚘 What vehicle model do you prefer?\n(e.g., Alto, Wagon R, Aqua, Prius, KDH Van, or Any Model):";

      case "RENT_DURATION":
        if (lang === "ta") return "⏱️ வாகனம் எத்தனை நாட்கள் அல்லது எவ்வளவு காலத்திற்கு தேவை?\n(உதாரணம்: 2 நாட்கள், 1 வாரம், 1 மாதம்):";
        if (lang === "si") return "⏱️ වාහනය දින කීයකට හෝ කොපමණ කාලයකට අවශ්‍යද?\n(උදා: දින 2ක්, සති 1ක්, මාස 1ක්):";
        return "⏱️ For how many days or what duration do you need the vehicle?\n(e.g., 2 Days, 1 Week, 1 Month):";

      case "RENT_CONFIRM":
        return getBookingConfirmManualPrompt(lang);

      default:
        if (lang === "ta") return "🚗 *வாடகை கார் சேவை (Rent a Car)*";
        if (lang === "si") return "🚗 *Rent a Car සේවාව*";
        return "🚗 *Rent a Car Service*";
    }
  }

  // 5. Ask a Question Flow
  if (flow === "FAQ_FLOW" || step === "FAQ_ASK") {
    if (lang === "ta") {
      return "❓ *உங்களுக்கு என்ன சந்தேகம் அல்லது விபரம் தேவை?*\n\nஉங்கள் கேள்வியை இங்கே தட்டச்சு செய்யவும். எங்கள் FAQ மற்றும் சேவை விபரங்களின் அடிப்படையில் உங்களுக்கு உடனடியாகப் பதிலளிக்கப்படும்.\n\n(பிரதான மெனுவிற்குச் செல்ல *Menu* என தட்டச்சு செய்யவும்)";
    }
    if (lang === "si") {
      return "❓ *ඔබට දැනගැනීමට අවශ්‍ය කුමක්ද?*\n\nඔබගේ ප්‍රශ්නය මෙහි Type කරන්න. අපගේ FAQ සහ සේවා විස්තර අනුව ඔබට වහාම පිළිතුරු ලබා දෙනු ඇත.\n\n(ප්‍රධාන මෙනුවට යාමට *Menu* Type කරන්න)";
    }
    return "❓ *How can we help you?*\n\nPlease type your question or inquiry here. We will answer you right away based on our FAQs.\n\n(Type *Menu* anytime to return to main options)";
  }

  return lang === "ta" ? "தயவுசெய்து உங்கள் பதிலை வழங்கவும்." : (lang === "si" ? "කරුණාකර ඔබගේ පිළිතුර ලබා දෙන්න." : "Please provide your answer.");
}

export function getBookingConfirmManualPrompt(lang: SupportedLanguage = "si"): string {
  if (lang === "ta") {
    return "📝 *முன்பதிவை உறுதிப்படுத்த பதிலளிக்கவும் (Please Reply):*\n" +
      "1️⃣ *Yes* - முன்பதிவை உறுதிப்படுத்த (Confirm Booking) ✅\n" +
      "2️⃣ *Cancel* - ரத்து செய்ய (Cancel) ❌\n" +
      "3️⃣ *Home* - முதன்மைப் பக்கத்திற்கு செல்ல (Go to Home Page) 🏠\n\n" +
      "👉 *1*, *2*, *3* அல்லது *Yes*, *Cancel*, *Home* என தட்டச்சு செய்யவும்.";
  }
  if (lang === "si") {
    return "📝 *Booking එක තහවුරු කිරීමට පිළිතුරු දෙන්න (Please Reply):*\n" +
      "1️⃣ *Yes* - Booking එක Confirm කරන්න ✅\n" +
      "2️⃣ *Cancel* - අවලංගු කරන්න ❌\n" +
      "3️⃣ *Home* - ප්‍රධාන මෙනුවට යන්න (Go to Home Page) 🏠\n\n" +
      "👉 *1*, *2*, *3* හෝ *Yes*, *Cancel*, *Home* ලෙස Type කරන්න.";
  }
  return "📝 *Please reply to confirm your booking:*\n" +
    "1️⃣ *Yes* - Confirm Booking ✅\n" +
    "2️⃣ *Cancel* - Cancel Booking ❌\n" +
    "3️⃣ *Home* - Go to Home Page 🏠\n\n" +
    "👉 Type *1*, *2*, *3* or *Yes*, *Cancel*, *Home* to reply.";
}

export function getRentBookingSummaryCard(data: any, lang: SupportedLanguage): string {
  const prompt = getBookingConfirmManualPrompt(lang);
  if (lang === "ta") {
    return `🚗 *வாடகை வாகன முன்பதிவு விபரம் (Rent Summary)*\n━━━━━━━━━━━━━━━━━━━━\n👤 *பெயர்:* ${data.customer_name || "Customer"}\n📞 *தொடர்பு:* ${data.customer_phone || "N/A"}\n🚗 *வாகன வகை:* ${data.rent_vehicle_category || "Car"}\n🚘 *மாடல் விருப்பம்:* ${data.rent_model || "Any"}\n⏱️ *கால அளவு:* ${data.rent_duration || "N/A"}\n📍 *இடம்:* ${data.rent_location || "N/A"}\n━━━━━━━━━━━━━━━━━━━━\n${prompt}`;
  }
  if (lang === "si") {
    return `🚗 *Rent a Car ඉල්ලුම් විස්තරය (Summary)*\n━━━━━━━━━━━━━━━━━━━━\n👤 *නම:* ${data.customer_name || "Customer"}\n📞 *දුරකථන:* ${data.customer_phone || "N/A"}\n🚗 *වාහන වර්ගය:* ${data.rent_vehicle_category || "Car"}\n🚘 *මොඩලය:* ${data.rent_model || "Any"}\n⏱️ *කාල සීමාව:* ${data.rent_duration || "N/A"}\n📍 *ස්ථානය:* ${data.rent_location || "N/A"}\n━━━━━━━━━━━━━━━━━━━━\n${prompt}`;
  }
  return `🚗 *Rent a Car Booking Summary*\n━━━━━━━━━━━━━━━━━━━━\n👤 *Name:* ${data.customer_name || "Customer"}\n📞 *Contact:* ${data.customer_phone || "N/A"}\n🚗 *Category:* ${data.rent_vehicle_category || "Car"}\n🚘 *Model:* ${data.rent_model || "Any"}\n⏱️ *Duration:* ${data.rent_duration || "N/A"}\n📍 *Location:* ${data.rent_location || "N/A"}\n━━━━━━━━━━━━━━━━━━━━\n${prompt}`;
}

export function getDeliveryOrderSummaryCard(data: any, lang: SupportedLanguage): string {
  const loc = data.delivery_location || data.dropoff_address || data.pickup_address || "Delivery Location";
  const prompt = getBookingConfirmManualPrompt(lang);
  if (lang === "ta") {
    return `📦 *டெலிவரி முன்பதிவு விபரம் (Delivery Order Summary)*\n━━━━━━━━━━━━━━━━━━━━\n📂 *பிரிவு (Category):* ${data.delivery_category || "General Items"}\n📝 *பொருட்கள் (Products):* ${data.delivery_products || data.delivery_items || "N/A"}\n📞 *WhatsApp:* ${data.customer_phone || "N/A"}\n📍 *டெலிவரி இடம்:* ${loc}\n🌐 *Website:* www.centralonline.lk\n━━━━━━━━━━━━━━━━━━━━\n${prompt}`;
  }
  if (lang === "si") {
    return `📦 *Delivery ඇණවුම් විස්තරය (Summary)*\n━━━━━━━━━━━━━━━━━━━━\n📂 *කාණ්ඩය (Category):* ${data.delivery_category || "General Items"}\n📝 *භාණ්ඩ (Products):* ${data.delivery_products || data.delivery_items || "N/A"}\n📞 *WhatsApp:* ${data.customer_phone || "N/A"}\n📍 *ස්ථානය (Location):* ${loc}\n🌐 *Website:* www.centralonline.lk\n━━━━━━━━━━━━━━━━━━━━\n${prompt}`;
  }
  return `📦 *Delivery Order Summary*\n━━━━━━━━━━━━━━━━━━━━\n📂 *Category:* ${data.delivery_category || "General Items"}\n📝 *Products:* ${data.delivery_products || data.delivery_items || "N/A"}\n📞 *WhatsApp:* ${data.customer_phone || "N/A"}\n📍 *Delivery Location:* ${loc}\n🌐 *Website:* www.centralonline.lk\n━━━━━━━━━━━━━━━━━━━━\n${prompt}`;
}

export function getBookingSummaryCard(data: any, lang: SupportedLanguage, isDelivery = false): string {
  const isScheduled = data.booking_type === "schedule" && data.scheduled_time;
  const pickup = data.pickup_address || data.pickup_text || "Pickup Point";
  const dropoff = data.dropoff_address || data.dropoff_text || "Drop-off Point";
  const prompt = getBookingConfirmManualPrompt(lang);
  
  if (lang === "ta") {
    const timingHeader = isScheduled ? `📅 *முன்பதிவு திகதி/நேரம்:* ${data.scheduled_time}\n` : `⚡ *உடனடி சேவை (Now)*\n`;
    return `📋 *முன்பதிவு விபரம் (Booking Summary)*\n━━━━━━━━━━━━━━━━━━━━\n${timingHeader}👤 *பெயர்:* ${data.customer_name}\n📱 *தொடர்பு:* ${data.customer_phone}\n🚗 *வாகனம்:* ${data.vehicle_name}\n📍 *புறப்படும் இடம்:* ${pickup}\n🏁 *சேரும் இடம்:* ${dropoff}\n${isDelivery ? `📦 *பொருட்கள்:* ${data.delivery_items}\n` : `🔄 *பயண வகை:* ${data.trip_type === "round_trip" ? "இரு வழி (Round Trip)" : "ஒரு வழி (One-Way)"}\n`}🛣️ *பயண தூரம்:* ${data.distance_text}\n💰 *கட்டணம்:* LKR ${Number(data.total_fare || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}\n━━━━━━━━━━━━━━━━━━━━\n${prompt}`;
  }

  if (lang === "si") {
    const timingHeader = isScheduled ? `📅 *SCHEDULED FOR:* ${data.scheduled_time}\n` : `⚡ *RIDE NOW*\n`;
    return `📋 *Booking Summary*\n━━━━━━━━━━━━━━━━━━━━\n${timingHeader}👤 *නම:* ${data.customer_name}\n📱 *දුරකථන:* ${data.customer_phone}\n🚗 *වාහනය:* ${data.vehicle_name}\n📍 *Pickup:* ${pickup}\n🏁 *Drop-off:* ${dropoff}\n${isDelivery ? `📦 *භාණ්ඩ:* ${data.delivery_items}\n` : `🔄 *ගමන් වර්ගය:* ${data.trip_type === "round_trip" ? "Round Trip (Up & Down)" : "One-Way"}\n`}🛣️ *දුර:* ${data.distance_text}\n💰 *ගාස්තුව:* LKR ${Number(data.total_fare || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}\n━━━━━━━━━━━━━━━━━━━━\n${prompt}`;
  }

  const timingHeader = isScheduled ? `📅 *Scheduled for:* ${data.scheduled_time}\n` : `⚡ *Immediate Ride*\n`;
  return `📋 *Booking Summary*\n━━━━━━━━━━━━━━━━━━━━\n${timingHeader}👤 *Name:* ${data.customer_name}\n📱 *Contact:* ${data.customer_phone}\n🚗 *Vehicle:* ${data.vehicle_name}\n📍 *Pickup:* ${pickup}\n🏁 *Drop-off:* ${dropoff}\n${isDelivery ? `📦 *Items:* ${data.delivery_items}\n` : `🔄 *Trip Type:* ${data.trip_type === "round_trip" ? "Round Trip (Up & Down)" : "One-Way"}\n`}🛣️ *Distance:* ${data.distance_text}\n💰 *Total Fare:* LKR ${Number(data.total_fare || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}\n━━━━━━━━━━━━━━━━━━━━\n${prompt}`;
}


export function getBookingSuccessMessage(orderCode: string, lang: SupportedLanguage, category: string = ""): string {
  const code = (orderCode || "").toUpperCase();
  const cat = (category || "").toLowerCase();
  const isRent = cat.includes("rent") || code.startsWith("RNT");
  const isDelivery = cat.includes("delivery") || code.startsWith("DEL");

  if (isRent) {
    if (lang === "ta") {
      return `✅ *உங்கள் முன்பதிவு வெற்றிகரமாகப் பதிவாகியது!*\n\n🏷️ *Order Code:* *${orderCode}*\n\nஎமது முகவர் (Agent) விரைவில் உங்களைத் தொடர்புகொண்டு, வாகனத்தின் புகைப்படங்கள் மற்றும் விலை சம்பந்தப்பட்ட விபரங்களைத் தெரிவிப்பார். ஏதேனும் சந்தேகங்கள் இருந்தால் *Help* என தட்டச்சு செய்யவும் அல்லது ரத்து செய்ய *Cancel* என தட்டச்சு செய்யவும்.\n\nநன்றி! எமது சேவையைத் தெரிவு செய்தமைக்கு மிக்க மகிழ்ச்சி. 🚗`;
    }
    if (lang === "si") {
      return `✅ *ඔබගේ Booking එක සාර්ථකව තහවුරු කරන ලදී!*\n\n🏷️ *Order Code:* *${orderCode}*\n\nඅපගේ නියෝජිතයෙකු (Agent) ඉක්මනින් ඔබව සම්බන්ධ කරගෙන, වාහනයේ ඡායාරූප සහ මිල ගණන් පිළිබඳ විස්තර ලබා දෙනු ඇත. Cancel කිරීමට අවශ්‍ය නම් ඕනෑම වේලාවක *Cancel* ලෙස Type කරන්න.\n\nස්තූතියි! අපගේ සේවාව තෝරා ගැනීම පිළිබඳව ඉතාමත් සතුටුයි. 🚗`;
    }
    return `✅ *Your booking has been successfully confirmed!*\n\n🏷️ *Order Code:* *${orderCode}*\n\nOur agent will contact you shortly with the vehicle photos and pricing details. If you have any questions, type *Help*, or type *Cancel* to cancel at any time.\n\nThank you! We are very glad you chose our service. 🚗`;
  }

  if (isDelivery) {
    if (lang === "ta") {
      return `✅ *உங்கள் முன்பதிவு வெற்றிகரமாகப் பதிவாகியது!*\n\n🏷️ *Order Code:* *${orderCode}*\n\nஎமது டெலிவரி சாரதி / பிரதிநிதி விரைவில் உங்களைத் தொடர்புகொள்வார். ஏதேனும் சந்தேகங்கள் இருந்தால் *Help* என தட்டச்சு செய்யவும் அல்லது ரத்து செய்ய *Cancel* என தட்டச்சு செய்யவும்.\n\nநன்றி! எமது சேவையைத் தெரிவு செய்தமைக்கு மிக்க மகிழ்ச்சி. 📦`;
    }
    if (lang === "si") {
      return `✅ *ඔබගේ Delivery ඇණවුම සාර්ථකව තහවුරු කරන ලදී!*\n\n🏷️ *Order Code:* *${orderCode}*\n\nඅපගේ ඩිලිවරි රියදුරු ඔබව ඉක්මනින් සම්බන්ධ කරගනු ඇත. Cancel කිරීමට අවශ්‍ය නම් ඕනෑම වේලාවක *Cancel* ලෙස Type කරන්න.\n\nස්තූතියි! 📦`;
    }
    return `✅ *Your delivery order has been successfully confirmed!*\n\n🏷️ *Order Code:* *${orderCode}*\n\nOur delivery driver will contact you shortly. If you wish to cancel at any time, simply type *Cancel*.\n\nThank you for choosing Central Delivery! 📦`;
  }

  if (lang === "ta") {
    return `✅ *உங்கள் முன்பதிவு வெற்றிகரமாகப் பதிவாகியது!*\n\n🏷️ *Order Code:* *${orderCode}*\n\nஎமது சாரதி விரைவில் உங்களைத் தொடர்புகொள்வார். ஏதேனும் சந்தேகங்கள் இருந்தால் *Help* என தட்டச்சு செய்யவும் அல்லது ரத்து செய்ய *Cancel* என தட்டச்சு செய்யவும்.\n\nநன்றி! எமது சேவையைத் தெரிவு செய்தமைக்கு மிக்க மகிழ்ச்சி. 🚕`;
  }
  if (lang === "si") {
    return `✅ *ඔබගේ Booking එක සාර්ථකව තහවුරු කරන ලදී!*\n\n🏷️ *Order Code:* *${orderCode}*\n\nළඟම සිටින රියදුරු මහතා ඔබව ඉක්මනින් සම්බන්ධ කරගනු ඇත. ගමන Cancel කිරීමට අවශ්‍ය නම් ඕනෑම වේලාවක *Cancel* ලෙස Type කරන්න.\n\nස්තූතියි! අපගේ සේවාව තෝරා ගැනීම පිළිබඳව ඉතාමත් සතුටුයි. 🚕`;
  }
  return `✅ *Your booking has been successfully confirmed!*\n\n🏷️ *Order Code:* *${orderCode}*\n\nOur driver/provider will contact you shortly. If you wish to cancel at any time before arrival, simply type *Cancel*.\n\nThank you for choosing Central Cabs & Services! 🚕`;
}

export function getCancellationSuccessMessage(orderCode: string, lang: SupportedLanguage): string {
  if (lang === "ta") {
    return `✅ உங்கள் முன்பதிவு (*${orderCode || ""}*) வெற்றிகரமாக ரத்து செய்யப்பட்டது.`;
  }
  if (lang === "si") {
    return `✅ ඔබගේ Order එක (*${orderCode || ""}*) සාර්ථකව Cancel කරන ලදී.`;
  }
  return `✅ Your booking (*${orderCode || ""}*) has been successfully cancelled.`;
}
