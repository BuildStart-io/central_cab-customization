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
import { extractNaturalDate, extractNaturalTime } from "./flows/dateExtractor.ts";

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
    } else if (step === "CAB_SCHEDULE_DATE") {
      if (extractNaturalDate(trimmed).isRecognized) return true;
    } else if (step === "CAB_SCHEDULE_TIME") {
      if (extractNaturalTime(trimmed).isRecognized) return true;
    } else if (step === "CAB_PICKUP" || step === "CAB_DROPOFF") {
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
    "thiyenawada", "thiyanawada", "thiyeda", "puluwanda", "puluwandha", "puluwan", "baeda", "baedha", "epada",
    "koheda", "kohomada", "mokakda", "monawada", "mokada", "mokatada", "wisthara", "visthara", "detail", "details",
    "danaganna", "danagannada", "thanagannadha", "thanaganna", "dhanaganna", "avashyada", "avashya", "avashava", "oneda", "one", "ona", "onee",
    "karannada", "yannada", "gannada", "ewannada", "kamak nadda", "hariyada", "kawadda", "kavadada", "kavadha", "ai", "ei",
    "mandatory", "required", "need", "needed", "must",
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
    "මොකක්ද", "මොනවාද", "කොහොමද", "කවද්ද", "කීයටද", "ඒසී", "ගාස්තු", "ගාස්තුව", "කොමිස්",
    "දැනගන්න", "දැනගන්නද", "අවශ්‍ය", "අවශ්‍යද", "ඕනෙද", "ඕන", "ඕනේද", "ඇයි", "මොකටද", "බැරිද", "එපාද"
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
  if (isResetChoice(trimmed) || isHomeOrResetInput(trimmed, session.current_step)) {
    console.log(`[stateMachine] Reset/Menu requested by ${phoneNumber}`);
    return {
      replyText: "Please choose your preferred language / කරුණාකර ඔබගේ භාෂාව තෝරන්න:",
      poll: getLanguagePoll(),
      sendTextWithPoll: true,
      nextFlow: "IDLE",
      nextStep: "LANGUAGE_CHOICE",
      sessionData: {},
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

  // 0. Global Menu / Reset handler - Immediately returns to Language Choice
  if (isHomeOrResetInput(trimmed, step)) {
    console.log(`[stateMachine] Reset/Menu requested by ${phoneNumber} from ${flow}/${step}`);
    return {
      replyText: "Please choose your preferred language / කරුණාකර ඔබගේ භාෂාව තෝරන්න:",
      poll: getLanguagePoll(),
      sendTextWithPoll: true,
      nextFlow: "IDLE",
      nextStep: "LANGUAGE_CHOICE",
      sessionData: {},
    };
  }

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

  const isExpectedAnswer = isExpectedStepAnswer(flow, step, trimmed, data, pricingSettings);
  const shouldEvaluateWithAi = !isLocationMsg && !isExpectedAnswer;

  // AI-first tool calling decision for active booking flows
  if ((flow === "CAB_FLOW" || flow === "DELIVERY_FLOW" || flow === "RENT_A_CAR_FLOW") && shouldEvaluateWithAi) {
    const aiResult = await classifyAndAnswerWithAi(
      supabase,
      userId,
      trimmed,
      pricingSettings,
      lang,
      session,
      phoneNumber
    );

    if (aiResult.action === "cancel") {
      return await startCancelFlow(supabase, userId, phoneNumber, step, lang, welcomeSetting);
    }
    if (aiResult.action === "main_menu") {
      return {
        replyText: "Please choose your preferred language / කරුණාකර ඔබගේ භාෂාව තෝරන්න:",
        poll: getLanguagePoll(),
        sendTextWithPoll: true,
        nextFlow: "IDLE",
        nextStep: "LANGUAGE_CHOICE",
        sessionData: {},
      };
    }
    if (aiResult.action === "answer_question" && aiResult.reply) {
      if (aiResult.reply.includes("INTENT_WRONG_LOCATION")) {
        delete data.pickup_text;
        delete data.pickup_coords;
        delete data.dropoff_text;
        delete data.dropoff_coords;
        const nextStep = flow === "DELIVERY_FLOW" ? "DELIVERY_PICKUP" : "CAB_PICKUP";
        return {
          replyText: lang === "en"
            ? "We noticed your location or distance seems incorrect. Please enter your pickup location again as shown in the guide above:"
            : "ඔබගේ Location එක හෝ දුර ප්‍රමාණය වැරදි බව අපි හඳුනා ගත්තෙමු. කරුණාකර ඉහත Guide එකේ පරිදි ඔබගේ Pickup Location එක නැවත ලබා දෙන්න:",
          mediaUrl: "https://app.buildstart.io/guides/pickup_guide.jpg",
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
        replyText: `${aiResult.reply}\n\n${resumeHeader}${stepPrompt}`,
        poll: stepPoll,
        sendTextWithPoll: !!stepPoll,
        nextFlow: flow,
        nextStep: step,
        sessionData: data,
      };
    }
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

    // Explicit request to return to Main Menu / Restart
    if (isHomeOrResetInput(trimmed, step) || lower === "3" || lower.startsWith("3.") || lower.includes("menu") || lower.includes("main menu")) {
      return {
        replyText: "Please choose your preferred language / කරුණාකර ඔබගේ භාෂාව තෝරන්න:",
        poll: getLanguagePoll(),
        sendTextWithPoll: true,
        nextFlow: "IDLE",
        nextStep: "LANGUAGE_CHOICE",
        sessionData: {},
      };
    }

    // AI Intent Classifier & Answer Engine for all other typed messages
    const aiResult = await classifyAndAnswerWithAi(
      supabase,
      userId,
      trimmed,
      pricingSettings,
      lang,
      session,
      phoneNumber
    );

    if (aiResult.action === "cancel") {
      return await startCancelFlow(supabase, userId, phoneNumber, step, lang, welcomeSetting);
    }
    if (aiResult.action === "main_menu") {
      return {
        replyText: "Please choose your preferred language / කරුණාකර ඔබගේ භාෂාව තෝරන්න:",
        poll: getLanguagePoll(),
        sendTextWithPoll: true,
        nextFlow: "IDLE",
        nextStep: "LANGUAGE_CHOICE",
        sessionData: {},
      };
    }

    const followUpNote = lang === "en"
      ? "\n\n💡 Feel free to ask another question or type *Menu* to return to main options."
      : "\n\n💡 ඔබට වෙනත් ප්‍රශ්නයක් ඇත්නම් Type කරන්න හෝ මෙනුවට යාමට *Menu* Type කරන්න.";

    let reply = aiResult.reply;
    if (!reply || aiResult.action === "continue_flow") {
      reply = lang === "en"
        ? `✅ Your booking (*${data.last_order_code || "Confirmed"}*) has been dispatched to nearby drivers. Our driver will contact you shortly.`
        : `✅ ඔබගේ Booking එක (*${data.last_order_code || "තහවුරු කරන ලදී"}*) ළඟම සිටින රියදුරු වෙත යොමු කර ඇත. රියදුරු මහතා ඔබව ඉක්මනින් සම්බන්ධ කර ගනු ඇත.`;
    }

    return {
      replyText: `${reply}${followUpNote}`,
      poll: getPostBookingPoll(lang),
      sendTextWithPoll: true,
      nextFlow: "IDLE",
      nextStep: "BOOKING_COMPLETED",
      sessionData: data,
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

export interface AiIntentResult {
  action: "answer_question" | "continue_flow" | "cancel" | "main_menu";
  reply: string;
}

export async function classifyAndAnswerWithAi(
  supabase: any,
  userId: string,
  userMessage: string,
  pricingSettings: PricingSettings,
  lang: SupportedLanguage = "si",
  session?: BotSessionState,
  phoneNumber?: string
): Promise<AiIntentResult> {
  const trimmed = (userMessage || "").trim();
  const lower = trimmed.toLowerCase();

  // Fast bypass for explicit reset or cancel commands
  if (isHomeOrResetInput(trimmed) || lower === "menu" || lower === "main menu") {
    return { action: "main_menu", reply: "" };
  }
  if (lower === "cancel" || lower === "cancel order" || lower === "cancel booking") {
    return { action: "cancel", reply: "" };
  }

  // 1. Fetch FAQs from database
  let faqs: Array<{ question: string; answer: string; category?: string }> = [];
  try {
    const { data: dbFaqs, error } = await supabase
      .schema("central_cab")
      .from("faqs")
      .select("question, answer, category")
      .eq("is_active", true)
      .eq("user_id", userId);
    if (!error && Array.isArray(dbFaqs)) {
      faqs = dbFaqs;
    }
  } catch (err) {
    console.warn("[classifyAndAnswerWithAi] Error fetching faqs:", err);
  }

  let faqText = "No custom FAQs available in database.";
  if (faqs.length > 0) {
    faqText = faqs.map((f: any) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");
  }

  let matchedFaqHint: { question: string; answer: string } | null = null;
  if (faqs.length > 0) {
    const cleanTokens = lower
      .replace(/[?!,.:;()_]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 2);

    let bestFaq: { question: string; answer: string } | null = null;
    let highestScore = 0;

    for (const f of faqs) {
      const qLower = (f.question || "").toLowerCase();
      const aLower = (f.answer || "").toLowerCase();

      if (qLower.includes(lower) || lower.includes(qLower)) {
        highestScore = 100;
        bestFaq = f;
        break;
      }

      let score = 0;
      for (const token of cleanTokens) {
        if (qLower.includes(token)) score += 3;
        else if (aLower.includes(token)) score += 1;
      }

      if (score > highestScore && score >= 2) {
        highestScore = score;
        bestFaq = f;
      }
    }

    if (bestFaq && highestScore >= 10) {
      const hasSinhalaChars = /[\u0D80-\u0DFF]/.test(bestFaq.answer);
      const langMatches = (lang === "si" && hasSinhalaChars) || (lang === "en" && !hasSinhalaChars);
      if (langMatches) {
        return { action: "answer_question", reply: bestFaq.answer };
      }
    }

    if (bestFaq && highestScore >= 2) {
      matchedFaqHint = bestFaq;
    }
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

        if (recentChat.length > 0) {
          const last = recentChat[recentChat.length - 1];
          if (last.role === "user" && last.content.toLowerCase() === trimmed.toLowerCase()) {
            recentChat.pop();
          }
        }
      }
    } catch (err) {
      console.warn("[classifyAndAnswerWithAi] Error fetching conversations:", err);
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
    else if (stepName === "CAB_NAME") stepDescription = "Providing customer personal name";
    else if (stepName === "CAB_PHONE") stepDescription = "Confirming customer phone number";
    else if (stepName === "CAB_VEHICLE") stepDescription = "Selecting vehicle type (Motorbike, Three-wheeler, Car, Van, Lorry, Bus)";
    else if (stepName === "CAB_MODEL") stepDescription = "Selecting specific car/van model";
    else if (stepName === "CAB_PICKUP") stepDescription = "Sharing pickup location (GPS Pin / Google Maps link)";
    else if (stepName === "CAB_DROPOFF") stepDescription = "Sharing drop-off destination location";
    else if (stepName === "CAB_TRIP_TYPE") stepDescription = "Choosing One-Way or Round Trip";
    else if (stepName === "CAB_CONFIRM") stepDescription = "Reviewing calculated fare and confirming ride";
    else if (stepName === "BOOKING_COMPLETED") stepDescription = `Ride/order confirmed and dispatched to driver group! Order Code: ${d.last_order_code || "Confirmed"}`;
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
- Distance: ${d.distance_km ? `${d.distance_km} km` : "Pending dropoff calculation"}
- Total Fare: ${d.total_fare ? `LKR ${d.total_fare}` : "Pending calculation"}
- Scheduled Time: ${d.scheduled_time || "None"}
- Trip Type: ${d.trip_type ? (d.trip_type === "round_trip" ? "Round Trip (Return journey)" : "One-Way") : "Not selected yet"}
- Confirmed Order Code: ${d.last_order_code || "None"}
`;
  }

  // 4. Matched FAQ candidate section
  const matchedFaqSection = matchedFaqHint ? `
=== HIGH RELEVANCE DATABASE FAQ MATCH ===
Question: ${matchedFaqHint.question}
Answer: ${matchedFaqHint.answer}
` : "";

  // 5. Vehicle & Pricing Context
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
`;

  const serviceKnowledge = `
=== CENTRAL CABS & DELIVERY SERVICE SPECIFICATIONS ===
1. Transport / Hire Cabs:
- Two Distinct Booking Options:
  a) 'ළඟ ගමනක් යන්න' (Ride Now / Local Trips): Immediate instant travel. Allowed vehicles: Motorbike (1 passenger), Three-wheeler (up to 3 passengers).
  b) 'දුර ගමනක් යන්න' (Ride Later / Scheduled Trips): Advance booking with date and time. Allowed vehicles: Car (4 passengers, AC), Van (6-14 passengers, AC), Lorry (Goods/House shifting), Bus (20-54 passengers).
- Trip Types: One-Way or Round Trip (Up & Down return journey).
- Booking Confirmation & Driver Dispatch: Once confirmed, order is dispatched to verified driver groups. A nearby driver will call or arrive within 5 to 10 minutes.
- Travel Time / Duration: In Sri Lanka, road travel speed averages approximately 40-50 km/h. For instance, 100-120 km takes roughly 2.5 to 3.5 hours.
- Cancellation: Free cancellation anytime before the driver arrives by typing "cancel" or "අවලංගු".
- Payment: Cash to driver or Bank Transfer.

2. Rent a Car:
- Self-drive or with driver rentals. Customer selects vehicle and rental duration. Dedicated rental agent contacts customer directly with photos, pricing, and deposit details.

3. Delivery Service:
- Food, groceries, pharmacy/medicine, parcels. Verified Delivery Rider assigned after shop pickup confirmation.
`;

  const langRule = lang === "en"
    ? "CRITICAL LANGUAGE RULE: If action is 'answer_question', write your reply in clear, polite English."
    : "CRITICAL LANGUAGE RULE: If action is 'answer_question', write your reply in natural, polite Sinhala using Sinhala script (සිංහල).";

  const systemPrompt = `You are the intelligent intent classifier and virtual assistant for Ceylon Central Cabs & Delivery.
The customer's message: "${trimmed}"

${userLiveContext}

${matchedFaqSection}

${serviceKnowledge}

${pricingContext}

=== VERIFIED DATABASE FAQS ===
${faqText}

=== TOOL CALLING & INTENT CLASSIFICATION INSTRUCTIONS ===
Evaluate the customer's message in the context of their CURRENT LIVE BOOKING STATE and chat history.
Customers frequently write in Singlish (Sinhala in English script, e.g. "Kochchara welawak yaida", "Car eke AC thiyeda?", "Kiyada yanne?"), English, or Sinhala.

You MUST return a JSON object with this exact schema:
{
  "action": "answer_question" | "continue_flow" | "cancel" | "main_menu",
  "reply": "string"
}

Actions:
1. "answer_question":
   The customer is asking a doubt, question, travel duration inquiry (e.g. "Kochchara welawak yaida", "how long will it take?"), driver arrival inquiry (e.g. "driver kawadda enne?"), pricing question, vehicle feature question, payment question, or asking why an input is needed (e.g. "Thanagannadha avashava Enna").
   - If asking about travel time/duration, use their route distance and Sri Lankan conditions (approx 40-50 km/h) to provide a helpful, realistic estimate, and reassure them that the driver will call in 5-10 minutes.
   - If asking when driver will arrive or call, explain that their order has been dispatched and a nearby driver will call within 5-10 minutes.
   - Answer directly and helpfully in "reply" in 1-3 sentences following ${langRule}.
   - Do NOT say "information is unavailable" if you can give a realistic travel or driver estimate based on the service specs above.

2. "continue_flow":
   The customer is NOT asking a question. They are attempting to answer the current booking step (e.g. typing an address name like "Galle Face Green" at drop-off step, or typing their personal name like "Kapi" at name step, or typing a date/time). Set "reply" to "".

3. "cancel":
   The customer explicitly demands or insists to cancel their active booking or order (e.g. "cancel my booking", "cancel it", "danma cancel karanna"). Set "reply" to "".

4. "main_menu":
   The customer explicitly requests to go back to the main menu or home (e.g. "menu", "home", "main menu"). Set "reply" to "".

OUTPUT ONLY THE JSON OBJECT. No markdown code blocks, no backticks, no extra explanations.`;

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemPrompt },
    ...recentChat,
    { role: "user", content: trimmed }
  ];

  const aiGenerateUrl = Deno.env.get("AI_GENERATE_URL");
  const botApiKey = Deno.env.get("BOT_API_KEY");
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

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
          temperature: 0.4,
          maxTokens: 800
        }),
      });
      if (res.ok) {
        const j = await res.json();
        rawText = j.text || j.choices?.[0]?.message?.content || "";
      }
    } else if (lovableApiKey) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-2.5-flash", messages, temperature: 0.4, max_tokens: 800 }),
      });
      if (res.ok) {
        const j = await res.json();
        rawText = j.choices?.[0]?.message?.content || "";
      }
    }

    let cleaned = rawText.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
    }

    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed.action === "string") {
      return {
        action: parsed.action as any,
        reply: parsed.reply || ""
      };
    }
  } catch (err) {
    console.warn("[classifyAndAnswerWithAi] AI call or JSON parse error:", err);
  }

  // Graceful Offline / Unit Test Fallback
  if (matchedFaqHint) {
    return { action: "answer_question", reply: matchedFaqHint.answer };
  }

  if (isPossibleQuestion(trimmed)) {
    const fallbackAnswer = lang === "en"
      ? "💡 Our customer agent or driver will contact you shortly to provide the necessary details."
      : "💡 අපගේ නියෝජිතයෙකු හෝ රියදුරු මහතා ඔබව ඉක්මනින් සම්බන්ධ කරගෙන අවශ්‍ය විස්තර ලබා දෙනු ඇත.";
    return { action: "answer_question", reply: fallbackAnswer };
  }

  return { action: "continue_flow", reply: "" };
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
  const result = await classifyAndAnswerWithAi(
    supabase,
    userId,
    userMessage,
    pricingSettings,
    lang,
    session,
    phoneNumber
  );
  if (result.action === "cancel") return "INTENT_CANCEL_ORDER";
  if (result.action === "continue_flow") return "NOT_A_QUESTION";
  if (result.action === "main_menu") return "INTENT_MAIN_MENU";
  return result.reply || "NOT_A_QUESTION";
}
