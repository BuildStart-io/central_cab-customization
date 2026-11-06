// ============================================================================
// Ceylon Central Cabs & Delivery - Main Finite State Machine (FSM)
// Strict Conversational Booking Orchestrator with Modular Category Sub-Files
// ============================================================================

import { PricingSettings, normalizeVehicleKey } from "./pricingEngine.ts";
import { CabSystemSettings } from "./adminHandler.ts";
import {
  SupportedLanguage,
  detectLanguageSelection,
  detectServiceCategory,
  detectRentVehicleCategory,
  detectDeliveryCategory,
  isAffirmativeInput,
  isNegativeInput,
  isHomeOrResetInput,
  isResetChoice,
  isHelpChoice,
  getLanguagePoll,
  getCategoryPoll,
  getRentVehiclePoll,
  getDeliveryCategoryPoll,
  getPostBookingPoll,
  getStepPromptText,
} from "./i18n.ts";
import { BotSessionState, StepProcessResult, PollPayload } from "./flows/types.ts";
import { handleCabFlowStep } from "./flows/cabFlow.ts";
import { handleDeliveryFlowStep } from "./flows/deliveryFlow.ts";
import { handleRentFlowStep } from "./flows/rentFlow.ts";
import { handleFaqFlowStep, queryFaqsAndAi, getStepPollForCurrentStep } from "./flows/faqFlow.ts";
import { handleCancelFlowStep, startCancelFlow } from "./flows/cancelFlow.ts";

export type { BotSessionState, StepProcessResult, PollPayload };

function isExpectedStepAnswer(
  flow: string,
  step: string,
  trimmed: string,
  data: any,
  pricingSettings: PricingSettings
): boolean {
  if (isHomeOrResetInput(trimmed)) return true;
  const lower = trimmed.toLowerCase();

  // Digit menu selections: e.g. "1", "2", "1. Car", "2. Van", "1 - One way"
  if (/^\s*\d+[\.\)\s-]/.test(lower) || /^\s*\d+\s*$/.test(lower)) {
    return true;
  }

  if (flow === "CAB_FLOW") {
    if (step === "CAB_VEHICLE") {
      const vKey = normalizeVehicleKey(trimmed, data.booking_type, pricingSettings);
      if (vKey) return true;
    } else if (step === "CAB_MODEL") {
      const vKey = data.vehicle_key || "car";
      const models = pricingSettings[vKey]?.models || [];
      if (models.some((m) => lower.includes(m.name.toLowerCase()))) return true;
    } else if (step === "CAB_DROPOFF") {
      if (
        lower === "1" || lower.startsWith("1.") || lower.includes("දන්නවා") || lower.includes("direct link") || lower.includes("i know") ||
        lower === "2" || lower.startsWith("2.") || lower.includes("දන්නේ නෑ") || lower.includes("help") || lower.includes("guide") ||
        /https?:\/\/(?:maps\.google\.com|goo\.gl\/maps|maps\.app\.goo\.gl|www\.google\.com\/maps|google\.com\/maps)[^\s]*/i.test(trimmed)
      ) {
        return true;
      }
    } else if (step === "CAB_TRIP_TYPE") {
      if (lower.includes("one-way") || lower.includes("one way") || lower.includes("round") || lower.includes("single")) return true;
    } else if (step === "CAB_CONFIRM") {
      if (isAffirmativeInput(trimmed) || isNegativeInput(trimmed)) return true;
    } else if (step === "CAB_PHONE") {
      const digits = trimmed.replace(/\D/g, "");
      if (digits.length >= 7) return true;
    }
  } else if (flow === "RENT_A_CAR_FLOW") {
    if (step === "RENT_VEHICLE_CHOICE") {
      const cat = detectRentVehicleCategory(trimmed);
      if (cat) return true;
    } else if (step === "RENT_CONFIRM") {
      if (isAffirmativeInput(trimmed) || isNegativeInput(trimmed)) return true;
    } else if (step === "RENT_PHONE") {
      const digits = trimmed.replace(/\D/g, "");
      if (digits.length >= 7) return true;
    }
  } else if (flow === "DELIVERY_FLOW") {
    if (step === "DELIVERY_CATEGORY") {
      const cat = detectDeliveryCategory(trimmed);
      if (cat) return true;
    } else if (step === "DELIVERY_CONFIRM") {
      if (isAffirmativeInput(trimmed) || isNegativeInput(trimmed)) return true;
    } else if (step === "DELIVERY_PHONE") {
      const digits = trimmed.replace(/\D/g, "");
      if (digits.length >= 7) return true;
    }
  }

  return false;
}

function isPossibleQuestion(text: string, messageType?: string): boolean {
  if (messageType === "location") return false;
  const lower = (text || "").toLowerCase().trim();
  if (
    lower.startsWith("location:") ||
    lower.includes("whatsapp location pin") ||
    /^location:\s*[-+]?\d/i.test(lower) ||
    /[-+]?\d{1,2}\.\d+,\s*[-+]?\d{1,3}\.\d+/.test(lower)
  ) {
    return false;
  }

  // Poll options and menu choices starting with digits (e.g. "1. Car", "2. Van", "1)") are NOT questions
  if (/^\s*\d+[\.\)\s-]/.test(lower) || /^\s*\d+\s*$/.test(lower)) {
    return false;
  }

  // Confirmation or reset inputs are NOT questions
  if (isAffirmativeInput(text) || isNegativeInput(text) || isHomeOrResetInput(text)) {
    return false;
  }

  if (lower.includes("?")) return true;
  if (text.includes("http://") || text.includes("https://")) return false;
  
  const engWords = [
    "price", "how much", "rate", "rates", "cost", "charge", "charges", "fare", "estimate", "calculation",
    "km", "kilometer", "distance", "keeyada", "kiyada", "gaana", "gani", "mudal",
    "thiyenawada", "puluwanda", "puluwandha", "puluwan", "koheda", "kohomada", "mokakda", "monawada", "wisthara", "visthara", "detail", "details",
    "ac", "aircon",
    "what", "how", "when", "where", "why", "who", "which", "can you", "do you", "can i", "is it", "possible", "available",
    "wrong", "incorrect", "pila", "waradi", "dura", "weradi",
    "mudiyuma", "mudiyatha", "ealuma", "theriyuma", "iruka", "irukka", "irukkuma", "vilai", "katnam", "ethana", "evvalavu", "thavarana", "maathu",
    "help", "doubt", "santhegam", "kelvi", "inquiry", "support", "faq", "advance", "payment", "luggage",
    "seating", "seats", "passenger", "passengers", "safe", "hours",
    "epadi", "eppadi", "enna", "enga", "eppo", "varuma", "tharuveengala", "wahanayak",
    "panam", "kaasu", "munpanam", "kattanuma", "petrol", "diesel", "toll", "highway", "expressway",
    "driver", "vanthutara", "call pannuvaara", "call seivaara", "solla mudiyuma", "sollunga"
  ];
  
  const sinWords = [
    "මිල", "කීයද", "ගාණ", "කොහෙද", "තියෙනවද", "පුළුවන්ද", "විස්තර", "වැරදි", "දුර", "අවලංගු", "ප්‍රශ්න", "සහාය",
    "මොකක්ද", "මොනවාද", "කොහොමද", "කවද්ද", "කීයටද", "ඒසී", "ගාස්තු", "ගාස්තුව", "කොමිස්"
  ];

  if (text.length > 80 && !lower.startsWith("location:")) return true;

  for (const w of engWords) {
    const regex = new RegExp(`\\b${w.replace(/\//g, "\\/")}\\b`, "i");
    if (regex.test(lower)) return true;
  }
  
  for (const w of sinWords) {
    if (lower.includes(w)) return true;
  }
  
  return false;
}

function getWelcomeMessage(welcomeSetting?: any): string {
  if (welcomeSetting?.text?.trim()) {
    return welcomeSetting.text.trim();
  }
  return "Welcome to Central Cabs & Delivery / Central Cabs වෙත සාදරයෙන් පිළිගනිමු!";
}

export async function processCustomerChatStep(
  supabase: any,
  supabaseUrl: string,
  supabaseServiceKey: string,
  userId: string,
  phoneNumber: string,
  messageText: string,
  messageType: string,
  rawPayload: any,
  session: BotSessionState,
  pricingSettings: PricingSettings,
  systemSettings: CabSystemSettings,
  sessionApiKey: string,
  welcomeSetting?: any
): Promise<StepProcessResult> {
  const trimmed = (messageText || "").trim();
  const lower = trimmed.toLowerCase();
  const data = session.session_data || {};

  // Retrieve session language or allow explicit keyword switches (sinhala, english)
  if (lower === "sinhala" || lower === "සිංහල" || lower === "singlish") {
    data.language = "si";
  } else if (lower === "english" || lower === "en") {
    data.language = "en";
  }
  let lang: SupportedLanguage = data.language === "en" ? "en" : "si";

  // =========================================================================
  // 1. GLOBAL RESET INTERCEPTION (Poll vote or text command)
  // =========================================================================
  if (isResetChoice(trimmed)) {
    console.log(`[stateMachine] Reset requested by ${phoneNumber}`);
    return {
      replyText: "",
      poll: getCategoryPoll(lang),
      nextFlow: "IDLE",
      nextStep: "CATEGORY_CHOICE",
      sessionData: { language: lang },
    };
  }

  // =========================================================================
  // GLOBAL CHANGE LANGUAGE INTERCEPTION
  // =========================================================================
  const isChangeLangCmd =
    lower === "language" ||
    lower === "change language" ||
    lower === "භාෂාව" ||
    lower === "lang";
  if (isChangeLangCmd) {
    console.log(`[stateMachine] Language change requested by ${phoneNumber}`);
    return {
      replyText: "Please choose your preferred language / කරුණාකර ඔබගේ භාෂාව තෝරන්න:",
      poll: getLanguagePoll(),
      sendTextWithPoll: true,
      nextFlow: "IDLE",
      nextStep: "LANGUAGE_CHOICE",
      sessionData: data,
    };
  }

  // =========================================================================
  // 2. GLOBAL CANCEL ORDER INTERCEPTION
  // =========================================================================
  const isDirectCancelCommand = lower === "cancel" || lower === "cancel order" || lower === "අවලංගු";
  const isConfirmationStep =
    (session.current_step || "WELCOME") === "CANCEL_CONFIRM" ||
    (session.current_step || "WELCOME") === "CAB_CONFIRM" ||
    (session.current_step || "WELCOME") === "DELIVERY_CONFIRM" ||
    (session.current_step || "WELCOME") === "RENT_CONFIRM";

  if (isDirectCancelCommand && !isConfirmationStep) {
    return await startCancelFlow(supabase, userId, phoneNumber, session.current_step, lang, welcomeSetting);
  }

  // =========================================================================
  // GLOBAL HELP / FAQ INTERCEPTION
  // =========================================================================
  const isHelpCmd = isHelpChoice(trimmed);
  if (isHelpCmd && !isConfirmationStep && (session.current_step || "WELCOME") !== "CAB_DROPOFF") {
    const isPausedFromBooking = (session.flow_type === "CAB_FLOW" || session.flow_type === "DELIVERY_FLOW" || session.flow_type === "RENT_A_CAR_FLOW");
    if (isPausedFromBooking) {
      data.paused_flow = session.flow_type;
      data.paused_step = session.current_step;
    }
    const helpPrompt = lang === "en"
      ? (isPausedFromBooking
        ? "❓ *How can we help you?*\n\nPlease type your question or doubt here. Once answered, you can continue your booking right from where you left off.\n\n(Type *Continue* to resume booking, or *Menu* to return to main menu)"
        : "❓ *How can we help you?*\n\nPlease type your question or inquiry here. We will answer you right away based on our FAQs.\n\n(Type *Menu* anytime to return to main options)")
      : (isPausedFromBooking
        ? "❓ *ඔබට දැනගැනීමට අවශ්‍ය කුමක්ද?*\n\nඔබගේ ප්‍රශ්නය මෙහි Type කරන්න. පිළිතුර ලබා දුන් පසු ඔබ නැවතුණු තැනින්ම Booking එක ඉදිරියට ගෙන යා හැක.\n\n(Booking එක ඉදිරියට ගෙන යාමට *Continue* හෝ මෙනුවට යාමට *Menu* Type කරන්න)"
        : "❓ *ඔබට දැනගැනීමට අවශ්‍ය කුමක්ද?*\n\nඔබගේ ප්‍රශ්නය මෙහි Type කරන්න. අපගේ FAQ සහ සේවා විස්තර අනුව ඔබට වහාම පිළිතුරු ලබා දෙනු ඇත.\n\n(ප්‍රධාන මෙනුවට යාමට *Menu* Type කරන්න)");

    return {
      replyText: helpPrompt,
      nextFlow: "FAQ_FLOW",
      nextStep: "FAQ_ASK",
      sessionData: data,
    };
  }

  // =========================================================================
  // 3. WELCOME & RESTART COMMANDS
  // =========================================================================
  const isRestartGreeting = lower === "hi" || lower === "hello" || lower === "hey" || lower === "start";
  if (isRestartGreeting) {
    console.log(`[stateMachine] Restart/Greeting received from ${phoneNumber}`);
    const welcomeMsg = getWelcomeMessage(welcomeSetting);
    const welcomeMedia = welcomeSetting?.media_url || (Array.isArray(welcomeSetting?.media_urls) && welcomeSetting.media_urls[0]) || undefined;
    return {
      replyText: welcomeMsg,
      poll: getLanguagePoll(),
      mediaUrl: welcomeMedia,
      sendTextWithPoll: true,
      nextFlow: "IDLE",
      nextStep: "LANGUAGE_CHOICE",
      sessionData: data,
    };
  }

  const flow = session.flow_type || "IDLE";
  const step = session.current_step || "WELCOME";

  // Invalid fallback helper
  const invalidFallback = async (fallbackStr: string, stepPoll?: PollPayload): Promise<StepProcessResult> => {
    const aiReply = await handleAiFallback(
      supabase,
      userId,
      trimmed,
      fallbackStr,
      pricingSettings,
      lang,
      session,
      phoneNumber
    );
    
    if (aiReply.includes("INTENT_CANCEL_ORDER")) {
      return await startCancelFlow(supabase, userId, phoneNumber, step, lang, welcomeSetting);
    }
    if (aiReply.includes("INTENT_WRONG_LOCATION")) {
      delete data.pickup_text;
      delete data.pickup_coords;
      delete data.dropoff_text;
      delete data.dropoff_coords;
      const nextStep = flow === "DELIVERY_FLOW" ? "DELIVERY_PICKUP" : "CAB_PICKUP";
      return {
        replyText: lang === "en"
          ? "We noticed your location or distance seems incorrect. Please enter your pickup location again:"
          : "ඔබගේ Location එක හෝ දුර ප්‍රමාණය වැරදි බව අපි හඳුනා ගත්තෙමු. කරුණාකර නැවත ඔබගේ Pickup Location එක ලබා දෙන්න:",
        nextFlow: flow,
        nextStep,
        sessionData: data,
      };
    }

    if (aiReply.includes("NOT_A_QUESTION")) {
      return {
        replyText: fallbackStr,
        poll: stepPoll,
        sendTextWithPoll: !!stepPoll,
        nextFlow: flow,
        nextStep: step,
        sessionData: data,
      };
    }

    // AI answered the question or returned unknown info: format clean resumption
    let finalAnswer = aiReply.split("\n\nSYSTEM PROMPT TO APPEND:")[0].trim();
    if (finalAnswer.includes("UNKNOWN_INFO") || finalAnswer.includes("Sorry, I don't have that information")) {
      finalAnswer = lang === "en"
        ? "💡 We do not currently have specific information for this query in our FAQs. Our customer agent will assist you shortly with the details."
        : "💡 අපගේ FAQ විස්තර වල ඔබගේ ප්‍රශ්නයට අදාළ තොරතුරු දැනට ඇතුළත් කර නොමැත. අපගේ නියෝජිතයෙකු හෝ රියදුරු මහතා ඔබව සම්බන්ධ කරගෙන අවශ්‍ය විස්තර ලබා දෙනු ඇත.";
    }

    const resumeHeader = lang === "en"
      ? "━━━━━━━━━━━━━━━━━━━━\n📌 *Please continue your booking:*\n"
      : "━━━━━━━━━━━━━━━━━━━━\n📌 *ඔබගේ Booking එක ඉදිරියට ගෙන යමු:*\n";

    const effectivePoll = stepPoll || getStepPollForCurrentStep(flow, step, data, lang, pricingSettings);

    return {
      replyText: `${finalAnswer}\n\n${resumeHeader}${fallbackStr}`,
      poll: effectivePoll,
      sendTextWithPoll: !!effectivePoll,
      nextFlow: flow,
      nextStep: step,
      sessionData: data,
    };
  };

  // Check if current message is a location pin/address or currently on a location input step
  const isLocationMsg = messageType === "location"
    || lower.startsWith("location:")
    || lower.includes("whatsapp location pin")
    || Boolean(rawPayload?.locationDetails)
    || /https?:\/\/(?:maps\.google\.com|goo\.gl\/maps|maps\.app\.goo\.gl|www\.google\.com\/maps|google\.com\/maps)[^\s]*/i.test(trimmed)
    || /[-+]?\d{1,2}\.\d+,\s*[-+]?\d{1,3}\.\d+/.test(trimmed);

  const isLocationStep = step === "DELIVERY_LOCATION" || step === "CAB_PICKUP" || step === "CAB_DROPOFF" || step === "RENT_LOCATION";
  const isExpectedAnswer = isExpectedStepAnswer(flow, step, trimmed, data, pricingSettings);
  const shouldInterceptQuestion = !isLocationMsg && !isExpectedAnswer && (!isLocationStep || trimmed.includes("?"));

  // Question interception for active booking flows (Answers question and resumes flow!)
  if ((flow === "CAB_FLOW" || flow === "DELIVERY_FLOW" || flow === "RENT_A_CAR_FLOW") && shouldInterceptQuestion && isPossibleQuestion(trimmed, messageType)) {
    const answer = await queryFaqsAndAi(
      supabase,
      userId,
      trimmed,
      pricingSettings,
      lang,
      handleAiFallback,
      session,
      phoneNumber
    );
    
    if (answer.includes("INTENT_CANCEL_ORDER")) {
      return await startCancelFlow(supabase, userId, phoneNumber, step, lang, welcomeSetting);
    }
    if (answer.includes("INTENT_WRONG_LOCATION")) {
      delete data.pickup_text;
      delete data.pickup_coords;
      delete data.dropoff_text;
      delete data.dropoff_coords;
      const nextStep = flow === "DELIVERY_FLOW" ? "DELIVERY_PICKUP" : "CAB_PICKUP";
      return {
        replyText: lang === "en"
          ? "We noticed your location or distance seems incorrect. Please enter your pickup location again:"
          : "ඔබගේ Location එක හෝ දුර ප්‍රමාණය වැරදි බව අපි හඳුනා ගත්තෙමු. කරුණාකර නැවත ඔබගේ Pickup Location එක ලබා දෙන්න:",
        nextFlow: flow,
        nextStep,
        sessionData: data,
      };
    }

    const stepPrompt = getStepPromptText(flow, step, lang);
    const stepPoll = getStepPollForCurrentStep(flow, step, data, lang, pricingSettings);
    const resumeHeader = lang === "en"
      ? "━━━━━━━━━━━━━━━━━━━━\n📌 *Please continue your booking:*\n"
      : "━━━━━━━━━━━━━━━━━━━━\n📌 *ඔබගේ Booking එක ඉදිරියට ගෙන යමු:*\n";

    return {
      replyText: `${answer}\n\n${resumeHeader}${stepPrompt}`,
      poll: stepPoll,
      sendTextWithPoll: !!stepPoll,
      nextFlow: flow,
      nextStep: step,
      sessionData: data,
    };
  }

  // =========================================================================
  // 4. WELCOME & LANGUAGE CHOICE
  // =========================================================================
  if (step === "WELCOME") {
    const welcomeMsg = getWelcomeMessage(welcomeSetting);
    const welcomeMedia = welcomeSetting?.media_url || (Array.isArray(welcomeSetting?.media_urls) && welcomeSetting.media_urls[0]) || undefined;
    return {
      replyText: welcomeMsg,
      poll: getLanguagePoll(),
      mediaUrl: welcomeMedia,
      sendTextWithPoll: true,
      nextFlow: "IDLE",
      nextStep: "LANGUAGE_CHOICE",
      sessionData: data,
    };
  }

  if (step === "LANGUAGE_CHOICE") {
    const chosenLang = detectLanguageSelection(trimmed);
    if (chosenLang) {
      data.language = chosenLang;
      lang = chosenLang;
      console.log(`[stateMachine] Language selected: ${chosenLang} for ${phoneNumber}`);
      return {
        replyText: "",
        poll: getCategoryPoll(lang),
        nextFlow: "IDLE",
        nextStep: "CATEGORY_CHOICE",
        sessionData: data,
      };
    }

    // Invalid language selection: re-prompt language poll
    return {
      replyText: "Please choose your preferred language / කරුණාකර ඔබගේ භාෂාව තෝරන්න:",
      poll: getLanguagePoll(),
      sendTextWithPoll: true,
      nextFlow: "IDLE",
      nextStep: "LANGUAGE_CHOICE",
      sessionData: data,
    };
  }

  // =========================================================================
  // POST-BOOKING COMPLETED STATE
  // =========================================================================
  if (step === "BOOKING_COMPLETED") {
    if (isHelpChoice(trimmed)) {
      return {
        replyText: lang === "en"
          ? "❓ *How can we help you?*\n\nPlease type your question or inquiry here. We will answer you right away based on our FAQs.\n\n(Type *Menu* anytime to return to main options)"
          : "❓ *ඔබට දැනගැනීමට අවශ්‍ය කුමක්ද?*\n\nඔබගේ ප්‍රශ්නය මෙහි Type කරන්න. අපගේ FAQ සහ සේවා විස්තර අනුව ඔබට වහාම පිළිතුරු ලබා දෙනු ඇත.\n\n(ප්‍රධාන මෙනුවට යාමට *Menu* Type කරන්න)",
        nextFlow: "FAQ_FLOW",
        nextStep: "FAQ_ASK",
        sessionData: data,
      };
    }

    if (lower === "cancel" || lower.startsWith("2.") || lower === "2" || lower.includes("cancel")) {
      return await startCancelFlow(supabase, userId, phoneNumber, step, lang, welcomeSetting);
    }

    if (isPossibleQuestion(trimmed)) {
      const answer = await queryFaqsAndAi(
        supabase,
        userId,
        trimmed,
        pricingSettings,
        lang,
        handleAiFallback,
        session,
        phoneNumber
      );
      const followUpNote = lang === "en"
        ? "\n\n💡 Feel free to ask another question or type *Menu* to return to main options."
        : "\n\n💡 ඔබට වෙනත් ප්‍රශ්නයක් ඇත්නම් Type කරන්න හෝ මෙනුවට යාමට *Menu* Type කරන්න.";
      return {
        replyText: `${answer}${followUpNote}`,
        nextFlow: "FAQ_FLOW",
        nextStep: "FAQ_ASK",
        sessionData: data,
      };
    }

    return {
      replyText: getStepPromptText("IDLE", "CATEGORY_CHOICE", lang),
      poll: getCategoryPoll(lang),
      nextFlow: "IDLE",
      nextStep: "CATEGORY_CHOICE",
      sessionData: { language: lang },
    };
  }

  if (step === "CATEGORY_CHOICE" || (flow === "IDLE" && step !== "LANGUAGE_CHOICE" && step !== "WELCOME")) {
    const cat = detectServiceCategory(trimmed);

    // 1. Ride Now: immediately enter CAB_FLOW and ask Name directly
    if (cat === "ride_now") {
      data.service_type = "transport";
      data.booking_type = "now";
      data.scheduled_time = "Immediate / Now";
      return {
        replyText: getStepPromptText("CAB_FLOW", "CAB_NAME", lang),
        nextFlow: "CAB_FLOW",
        nextStep: "CAB_NAME",
        sessionData: data,
      };
    }

    // 2. Schedule Ride: immediately enter CAB_FLOW and ask Date directly
    if (cat === "ride_schedule") {
      data.service_type = "transport";
      data.booking_type = "schedule";
      return {
        replyText: getStepPromptText("CAB_FLOW", "CAB_SCHEDULE_DATE", lang),
        nextFlow: "CAB_FLOW",
        nextStep: "CAB_SCHEDULE_DATE",
        sessionData: data,
      };
    }

    // 3. Rent a Car
    if (cat === "rent_a_car") {
      data.service_type = "rent_a_car";
      return {
        replyText: getStepPromptText("RENT_A_CAR_FLOW", "RENT_VEHICLE_CHOICE", lang),
        poll: getRentVehiclePoll(lang),
        sendTextWithPoll: true,
        nextFlow: "RENT_A_CAR_FLOW",
        nextStep: "RENT_VEHICLE_CHOICE",
        sessionData: data,
      };
    }

    // 4. Delivery
    if (cat === "delivery") {
      data.service_type = "delivery";
      return {
        replyText: getStepPromptText("DELIVERY_FLOW", "DELIVERY_CATEGORY", lang),
        poll: getDeliveryCategoryPoll(lang),
        sendTextWithPoll: true,
        nextFlow: "DELIVERY_FLOW",
        nextStep: "DELIVERY_CATEGORY",
        sessionData: data,
      };
    }

    // 5. Ask a question
    if (cat === "ask_a_question") {
      data.service_type = "ask_a_question";
      return {
        replyText: getStepPromptText("FAQ_FLOW", "FAQ_ASK", lang),
        nextFlow: "FAQ_FLOW",
        nextStep: "FAQ_ASK",
        sessionData: data,
      };
    }

    // If user asked a question at the Main Menu, answer it and re-display Category Poll
    if (isPossibleQuestion(trimmed)) {
      const answer = await queryFaqsAndAi(
        supabase,
        userId,
        trimmed,
        pricingSettings,
        lang,
        handleAiFallback,
        session,
        phoneNumber
      );
      const followUpNote = lang === "en"
        ? "\n\n💡 Feel free to ask another question or select a service from the menu below:"
        : "\n\n💡 ඔබට වෙනත් ප්‍රශ්නයක් ඇත්නම් Type කරන්න හෝ පහත මෙනුවෙන් සේවාවක් තෝරන්න:";
      return {
        replyText: `${answer}${followUpNote}`,
        poll: getCategoryPoll(lang),
        sendTextWithPoll: true,
        nextFlow: "IDLE",
        nextStep: "CATEGORY_CHOICE",
        sessionData: data,
      };
    }

    // Unrecognized selection: re-display Main Category Poll
    return {
      replyText: getStepPromptText("IDLE", "CATEGORY_CHOICE", lang),
      poll: getCategoryPoll(lang),
      nextFlow: "IDLE",
      nextStep: "CATEGORY_CHOICE",
      sessionData: data,
    };
  }

  // =========================================================================
  // 5. ROUTE TO MODULAR CATEGORY SUB-FILES
  // =========================================================================
  if (flow === "CAB_FLOW") {
    return await handleCabFlowStep(
      supabase,
      supabaseUrl,
      supabaseServiceKey,
      userId,
      phoneNumber,
      trimmed,
      messageType,
      rawPayload,
      step,
      data,
      lang,
      pricingSettings,
      systemSettings,
      sessionApiKey,
      invalidFallback
    );
  }

  if (flow === "DELIVERY_FLOW") {
    return await handleDeliveryFlowStep(
      supabase,
      supabaseUrl,
      supabaseServiceKey,
      userId,
      phoneNumber,
      trimmed,
      messageType,
      rawPayload,
      step,
      data,
      lang,
      pricingSettings,
      systemSettings,
      sessionApiKey,
      invalidFallback
    );
  }

  if (flow === "RENT_A_CAR_FLOW") {
    return await handleRentFlowStep(
      supabase,
      supabaseUrl,
      supabaseServiceKey,
      userId,
      phoneNumber,
      trimmed,
      step,
      data,
      lang,
      systemSettings,
      sessionApiKey,
      invalidFallback
    );
  }

  if (flow === "FAQ_FLOW") {
    return await handleFaqFlowStep(
      supabase,
      userId,
      trimmed,
      data,
      lang,
      pricingSettings,
      handleAiFallback,
      session,
      phoneNumber
    );
  }

  if (flow === "CANCEL_FLOW") {
    return await handleCancelFlowStep(
      supabase,
      supabaseUrl,
      supabaseServiceKey,
      userId,
      phoneNumber,
      trimmed,
      step,
      data,
      lang,
      systemSettings,
      sessionApiKey,
      invalidFallback
    );
  }

  // Default Fallback
  return {
    replyText: getWelcomeMessage(welcomeSetting),
    poll: getCategoryPoll(lang),
    nextFlow: "IDLE",
    nextStep: "CATEGORY_CHOICE",
    sessionData: {},
  };
}

async function handleAiFallback(
  supabase: any,
  userId: string,
  userMessage: string,
  fallbackErrorPrompt: string,
  pricingSettings: PricingSettings,
  lang: SupportedLanguage = "si",
  session?: BotSessionState,
  phoneNumber?: string,
  matchedFaqHint?: { question: string; answer: string } | null
): Promise<string> {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  const aiGenerateUrl = Deno.env.get("AI_GENERATE_URL");
  const botApiKey = Deno.env.get("BOT_API_KEY");

  if (!lovableApiKey && !(aiGenerateUrl && botApiKey)) {
    return "NOT_A_QUESTION";
  }

  // 1. Fetch FAQs from database
  let faqText = "No custom FAQs available in database.";
  try {
    const { data: faqs, error } = await supabase
      .schema("central_cab")
      .from("faqs")
      .select("question, answer, category")
      .eq("is_active", true)
      .eq("user_id", userId);

    if (!error && Array.isArray(faqs) && faqs.length > 0) {
      faqText = faqs.map((f: any) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");
    }
  } catch (err) {
    console.warn("[handleAiFallback] Error fetching faqs:", err);
  }

  // 2. Fetch Recent Conversation History (Last 10 messages)
  let recentChat: Array<{ role: string; content: string }> = [];
  if (phoneNumber) {
    try {
      const { data: convs } = await supabase
        .schema("central_cab")
        .from("conversations")
        .select("direction, message, created_at")
        .eq("user_id", userId)
        .eq("phone_number", phoneNumber)
        .order("created_at", { ascending: false })
        .limit(10);

      if (convs && convs.length > 0) {
        const chronological = convs.reverse();
        for (const c of chronological) {
          const raw = (c.message || "").trim();
          if (!raw) continue;
          if (raw.startsWith("[locationDetails") || (raw.startsWith("{") && raw.endsWith("}"))) continue;

          let text = raw;
          if (text.startsWith("[Poll]")) {
            text = text.replace(/^\[Poll\]\s*/i, "Options: ");
          }

          const role = c.direction === "inbound" ? "user" : "assistant";
          recentChat.push({ role, content: text });
        }

        // Avoid duplicating the user message if it's already the last element
        if (recentChat.length > 0) {
          const last = recentChat[recentChat.length - 1];
          if (last.role === "user" && last.content.toLowerCase() === userMessage.trim().toLowerCase()) {
            recentChat.pop();
          }
        }
      }
    } catch (err) {
      console.warn("[handleAiFallback] Error fetching conversations:", err);
    }
  }

  // 3. Build User Live Progress & Context
  let userLiveContext = "";
  if (session) {
    const d = session.session_data || {};
    const flowName = session.flow_type || "IDLE";
    const stepName = session.current_step || "WELCOME";

    let stepDescription = stepName;
    if (stepName === "CAB_TIMING_CHOICE") stepDescription = "Choosing between Ride Now (immediate) or Schedule Ride (advance reservation)";
    else if (stepName === "CAB_SCHEDULE_DATE") stepDescription = "Entering date for scheduled trip";
    else if (stepName === "CAB_SCHEDULE_TIME") stepDescription = "Entering time for scheduled trip";
    else if (stepName === "CAB_NAME") stepDescription = "Providing customer name";
    else if (stepName === "CAB_PHONE") stepDescription = "Confirming customer phone number";
    else if (stepName === "CAB_VEHICLE") stepDescription = "Selecting vehicle type (Motorbike, Three-wheeler, Car, Van, Lorry, Bus)";
    else if (stepName === "CAB_MODEL") stepDescription = "Selecting specific car/van model";
    else if (stepName === "CAB_PICKUP") stepDescription = "Sharing pickup location (GPS Pin / Google Maps link)";
    else if (stepName === "CAB_DROPOFF") stepDescription = "Sharing drop-off destination location";
    else if (stepName === "CAB_TRIP_TYPE") stepDescription = "Choosing One-Way or Round Trip";
    else if (stepName === "CAB_CONFIRM") stepDescription = "Reviewing calculated fare and confirming ride";
    else if (stepName === "BOOKING_COMPLETED") stepDescription = "Ride or order completed and dispatched to drivers";
    else if (stepName === "RENT_VEHICLE_CHOICE") stepDescription = "Selecting rental vehicle";
    else if (stepName === "RENT_DURATION") stepDescription = "Specifying rental duration (days/weeks)";
    else if (stepName === "DELIVERY_CATEGORY") stepDescription = "Selecting delivery category (Food/Grocery/Medicine/Parcel)";
    else if (stepName === "DELIVERY_ITEMS") stepDescription = "Listing items to purchase or deliver";
    else if (stepName === "DELIVERY_LOCATION") stepDescription = "Providing delivery drop-off location";

    userLiveContext = `
=== CURRENT CUSTOMER LIVE BOOKING STATE ===
- Active Service Flow: ${flowName}
- Current Stage / Step: ${stepDescription}
- Booking Timing: ${d.booking_type === "schedule" ? "Scheduled / Advance Ride" : (d.booking_type === "now" ? "Immediate Ride Now" : "Not yet selected")}
- Customer Name: ${d.customer_name || "Not entered yet"}
- Customer Contact: ${d.customer_phone || phoneNumber || "Not entered yet"}
- Selected Vehicle: ${d.vehicle_key ? `${d.vehicle_key.toUpperCase()}${d.selected_model ? ` (${d.selected_model})` : ""}` : "Not selected yet"}
- Pickup Location: ${d.pickup_text || "Not set yet"}
- Dropoff Location: ${d.dropoff_text || "Not set yet"}
- Scheduled Time: ${d.scheduled_time || "None"}
- Trip Type: ${d.trip_type ? (d.trip_type === "round_trip" ? "Round Trip (Return journey)" : "One-Way") : "Not selected yet"}
`;
  }

  // 4. Matched FAQ candidate section
  const matchedFaqSection = matchedFaqHint ? `
=== HIGH RELEVANCE DATABASE FAQ MATCH ===
Question: ${matchedFaqHint.question}
Answer: ${matchedFaqHint.answer}
(Instruction: Use this verified answer as your primary source of truth. Translate and adapt it smoothly into the customer's selected language, taking into account their current vehicle and booking status).
` : "";

  // 5. Build Models and Pricing Context
  const carModels = (pricingSettings.car?.models || []).map((m: any) => m.name).join(", ") || "Alto, WagonR, Prius, Axio, Aqua";
  const vanModels = (pricingSettings.van?.models || []).map((m: any) => m.name).join(", ") || "KDH (High Roof / Flat Roof), Caravan, Dolphin";
  const lorryModels = (pricingSettings.lorry?.models || []).map((m: any) => m.name).join(", ") || "Dimo Batta, Canter, Light Trucks";

  const pricingContext = `
=== DYNAMIC VEHICLE PRICING (LKR) ===
- Motorbike: Base LKR ${pricingSettings.motorbike?.base_price || 200} (covers first ${pricingSettings.motorbike?.coverage_km || 2} km), then LKR ${pricingSettings.motorbike?.per_km_rate || 80}/km
- Three-wheeler: Base LKR ${pricingSettings.three_wheeler?.base_price || 300} (covers first ${pricingSettings.three_wheeler?.coverage_km || 2} km), then LKR ${pricingSettings.three_wheeler?.per_km_rate || 100}/km
- Car: Base LKR ${pricingSettings.car?.base_price || 600} (covers first ${pricingSettings.car?.coverage_km || 3} km), then LKR ${pricingSettings.car?.per_km_rate || 150}/km | Models: ${carModels}
- Van: Base LKR ${pricingSettings.van?.base_price || 900} (covers first ${pricingSettings.van?.coverage_km || 3} km), then LKR ${pricingSettings.van?.per_km_rate || 200}/km | Models: ${vanModels}
- Lorry: Base LKR ${pricingSettings.lorry?.base_price || 1500} (covers first ${pricingSettings.lorry?.coverage_km || 5} km), then LKR ${pricingSettings.lorry?.per_km_rate || 300}/km | Models: ${lorryModels}
- Bus: Base LKR ${pricingSettings.bus?.base_price || 3000} (covers first ${pricingSettings.bus?.coverage_km || 10} km), then LKR ${pricingSettings.bus?.per_km_rate || 500}/km
(Note: Live trip total fare is computed live via Google Maps once pickup and dropoff points are provided).
`;

  // 6. Service Architecture and Specifications Context
  const serviceKnowledge = `
=== CENTRAL CABS & DELIVERY SERVICE SPECIFICATIONS ===
1. Transport / Hire Cabs:
- Two Distinct Booking Options:
  a) 'ළඟ ගමනක් යන්න' (Ride Now / Local Trips): Immediate instant travel. Allowed vehicles are strictly Motorbike (1 passenger) and Three-wheeler (up to 3 passengers).
  b) 'දුර ගමනක් යන්න' (Ride Later / Scheduled Trips): Advance booking with date and time. Allowed vehicles: Car (Sedan/Hatchback, 4 passengers, AC), Van (KDH/Caravan, 6-14 passengers, AC), Lorry (Goods/House shifting), Bus (20-54 passengers, pilgrimages/tours).
- Trip Types: One-Way (එක් පැත්තක්) or Round Trip (දෙපැත්තම - Up & Down return journey).
- Booking Process in WhatsApp: Select Ride Now/Schedule -> Name -> Phone -> Vehicle & Model -> Pickup Location pin/address -> Drop-off Location pin/address -> Live fare calculated via Google Maps -> Order Confirmed -> Broadcasted to verified driver groups -> Driver assigned.
- Commission: 10% commission applies.
- Cancellation: Free cancellation anytime before the driver arrives by typing "cancel" or "අවලංගු".

2. Rent a Car (Self-drive / With Driver Rentals):
- Customer chooses vehicle category (Car, Van, etc.) and model preference.
- Customer specifies rental duration (days/weeks) and pickup location.
- Order is broadcasted to verified rent a car providers. A dedicated rental agent will contact the customer directly on WhatsApp/Phone with photos, vehicle options, pricing, and deposit details.
- 10% commission applies.

3. Delivery Service:
- Delivery of food, groceries, medicine/pharmacy, parcels, documents, and retail items.
- Products can be browsed on www.centralonline.lk or customer can specify custom items list & drop-off location.
- Admin verifies and sets the shop pickup location, and dispatches the order to verified Delivery Riders.
- Delivery rider picks up items from the shop and delivers directly to the customer.

4. Vehicle Capacities & Features:
- Motorbike: 1 passenger, budget/quick local rides or small parcel delivery.
- Three-wheeler (Tuk Tuk): Up to 3 passengers, local rides, moderate luggage.
- Car (Sedan / Hatchback): Up to 4 passengers, 2-3 bags/suitcases, fully air-conditioned (AC). Models: Alto, WagonR, Prius, Axio, Aqua. Available for Scheduled trips and Rent.
- Van: 6 to 14 passengers, spacious luggage room, fully air-conditioned (AC). Models: KDH (High Roof / Flat Roof), Caravan, Dolphin. Ideal for tours, family trips, airport drops/pickups.
- Lorry: Goods, furniture, house shifting, heavy parcels. Models: Dimo Batta, Canter, etc.
- Bus: 20 to 54 passengers, AC and non-AC options, ideal for pilgrimages, staff transport, school trips, and large tour groups.
`;

  const langRule = lang === "en"
    ? "CRITICAL LANGUAGE RULE: If you provide an answer, you MUST write your AI answer in clear, polite English."
    : "CRITICAL LANGUAGE RULE: If you provide an answer, you MUST write your AI answer in natural, polite Sinhala using Sinhala script (සිංහල).";

  const systemPrompt = `You are the helpful, hallucination-free virtual assistant for Ceylon Central Cabs & Delivery.
The customer's current message: "${userMessage}"

${userLiveContext}

${matchedFaqSection}

${serviceKnowledge}

${pricingContext}

=== VERIFIED DATABASE FAQS ===
${faqText}

=== STRICT INSTRUCTIONS & CONTEXT-AWARE RULES ===
1. MULTILINGUAL & SINGLISH/ENGLISH TOLERANCE: Customers frequently write in Singlish (Sinhala words in English script, e.g. "Car eke AC thiyeda?", "Kiyada yanne?") or English. Semantically interpret their intent accurately.
2. CONTEXTUAL RESOLUTION: Use the "CURRENT CUSTOMER LIVE BOOKING STATE" and chat history to resolve pronouns ("it", "this car", "my ride"). For example, if they ask "Does it have AC?" and they have selected a Car/Van, confirm that their chosen vehicle is air-conditioned. If they ask about cost or time, refer specifically to their selected vehicle and route status.
3. FACTUAL BOUNDARY: Answer the customer's question using the factual details provided above in SERVICE SPECIFICATIONS, VEHICLE PRICING, VEHICLE CAPACITIES, LIVE BOOKING STATE, and FAQS. Do NOT fabricate facts, phone numbers, or unlisted policies.
4. If the user's question CANNOT be answered from the provided knowledge, DO NOT guess or make up an answer. Reply EXACTLY with: "UNKNOWN_INFO".
5. If the message is NOT a question or inquiry (e.g. it is simply answering a booking step like giving a name, a phone number, an address, a date, or saying 'ok', 'yes', 'no'), reply EXACTLY with: "NOT_A_QUESTION".
6. INTENT TO CANCEL: If the customer explicitly demands or insists to cancel their active booking/order right now (e.g., "cancel my booking", "cancel it", "danma cancel karanna"), reply EXACTLY with: "INTENT_CANCEL_ORDER".
7. INTENT WRONG LOCATION / DISTANCE: If the customer states or complains that their pickup location, dropoff location, distance, or price is wrong or calculated incorrectly (e.g., "wrong location", "dura weradi"), reply EXACTLY with: "INTENT_WRONG_LOCATION".
8. ${langRule}
9. Keep the answer concise (1 to 3 sentences maximum), friendly, and professional.
10. OUTPUT ONLY the direct answer. DO NOT output internal thinking, notes, thoughts, or explanations.`;

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemPrompt }
  ];

  for (const m of recentChat) {
    messages.push({
      role: m.role,
      content: m.content
    });
  }

  messages.push({ role: "user", content: userMessage });

  try {
    let rawText = "";
    if (aiGenerateUrl && botApiKey) {
      const res = await fetch(aiGenerateUrl, {
        method: "POST",
        headers: {
          "x-bot-key": botApiKey,
          "x-bot-api-key": botApiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages,
          model: "google/gemini-2.5-flash",
          temperature: 0.1,
          maxTokens: 1200
        }),
      });
      if (res.ok) {
        const j = await res.json();
        rawText = j.text || j.choices?.[0]?.message?.content || "";
      } else {
        console.warn("AI Generate gateway error:", res.status, await res.text());
      }
    } else if (lovableApiKey) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-2.5-flash", messages, temperature: 0.1, max_tokens: 1200 }),
      });
      if (res.ok) {
        const j = await res.json();
        rawText = j.choices?.[0]?.message?.content || "";
      }
    }

    let cleaned = rawText.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "").trim();
    }

    if (cleaned) {
      return cleaned;
    }
  } catch (err) {
    console.warn("AI Fallback failed:", err);
  }

  return "NOT_A_QUESTION";
}
