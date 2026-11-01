// ============================================================================
// Ceylon Central Cabs & Delivery - Main Finite State Machine (FSM)
// Strict Conversational Booking Orchestrator with Modular Category Sub-Files
// ============================================================================

import { PricingSettings } from "./pricingEngine.ts";
import { CabSystemSettings } from "./adminHandler.ts";
import {
  SupportedLanguage,
  detectLanguageSelection,
  detectServiceCategory,
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
  if (lower.includes("?")) return true;
  if (text.includes("http://") || text.includes("https://")) return false;
  
  const engWords = [
    "price", "how much", "rate", "rates", "cost", "charge", "charges", "fare", "estimate", "calculation",
    "km", "kilometer", "distance", "keeyada", "kiyada", "gaana", "gani", "mudal",
    "thiyenawada", "puluwanda", "puluwandha", "puluwan", "koheda", "kohomada", "mokakda", "monawada", "wisthara", "visthara", "detail", "details",
    "ac", "aircon", "van", "car", "bus", "lorry", "bike", "tuk", "kdh", "alto", "wagonr", "prius", "aqua", "axio",
    "what", "how", "when", "where", "why", "who", "which", "can you", "do you", "can i", "is it", "possible", "available",
    "wrong", "incorrect", "pila", "waradi", "dura", "weradi",
    "mudiyuma", "mudiyatha", "ealuma", "theriyuma", "iruka", "irukka", "irukkuma", "vilai", "katnam", "ethana", "evvalavu", "thavarana", "maathu",
    "help", "doubt", "santhegam", "kelvi", "inquiry", "support", "faq", "advance", "payment", "luggage", "driver",
    "seating", "seats", "passenger", "passengers", "cancel", "safe", "service", "hours", "delivery", "rent", "hire", "cab", "cabs",
    "epadi", "eppadi", "enna", "enga", "eppo", "vahanam", "varuma", "tharuveengala", "varum", "wahanayak", "wahana"
  ];
  
  const sinWords = [
    "මිල", "කීයද", "ගාණ", "කොහෙද", "තියෙනවද", "පුළුවන්ද", "විස්තර", "වැරදි", "දුර", "අවලංගු", "ප්‍රශ්න", "සහාය",
    "මොකක්ද", "මොනවාද", "කොහොමද", "කවද්ද", "කීයටද", "වාහන", "ලොරි", "වෑන්", "කාර්", "බස්", "ත්‍රීවීල්", "බයික්",
    "ඒසී", "ඩ්‍රයිවර්", "කැබ්", "ගාස්තු", "ගාස්තුව", "කොමිස්", "ප්‍රවාහන", "ඩිලිවරි", "රෙන්ට්"
  ];

  const tamWords = [
    "கேள்வி", "சந்தேகம்", "உதவி", "விலை", "கட்டணம்", "முடியுமா", "முடியாதா",
    "இருக்கா", "இருக்குமா", "எப்படி", "எப்போது", "எங்கே", "என்ன", "எத்தனை",
    "ஏசி", "தள்ளுபடி", "ரத்து", "லக்கேஜ்", "முன்பணம்", "விபரம்", "பாதுகாப்பு",
    "வாகனம்", "கார்", "வேன்", "லொறி", "பஸ்", "பைக்", "ஆட்டோ", "டிரைவர்", "சாரதி",
    "வாடகை", "டெலிவரி", "முறை", "நேரம்", "எப்போ", "என்னென்ன", "யார்"
  ];

  if (text.length > 80 && !lower.startsWith("location:")) return true;

  for (const w of engWords) {
    const regex = new RegExp(`\\b${w.replace(/\//g, "\\/")}\\b`, "i");
    if (regex.test(lower)) return true;
  }
  
  for (const w of sinWords) {
    if (lower.includes(w)) return true;
  }

  for (const w of tamWords) {
    if (lower.includes(w)) return true;
  }
  
  return false;
}

function getWelcomeMessage(welcomeSetting?: any): string {
  if (welcomeSetting?.text?.trim()) {
    return welcomeSetting.text.trim();
  }
  return "Welcome to Central Cabs & Delivery / Central Cabs වෙත සාදරයෙන් පිළිගනිමු / Central Cabs-க்கு தங்களை அன்புடன் வரவேற்கிறோம்!";
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

  // Retrieve session language or allow explicit keyword switches (tamil, sinhala, english)
  if (lower === "tamil" || lower === "தமிழ்" || lower === "tamizh" || lower === "thamizh") {
    data.language = "ta";
  } else if (lower === "sinhala" || lower === "සිංහල" || lower === "singlish") {
    data.language = "si";
  } else if (lower === "english" || lower === "en") {
    data.language = "en";
  }
  let lang: SupportedLanguage = data.language || "si";

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
    lower === "மொழி" ||
    lower === "lang";
  if (isChangeLangCmd) {
    console.log(`[stateMachine] Language change requested by ${phoneNumber}`);
    return {
      replyText: "Please choose your preferred language / කරුණාකර ඔබගේ භාෂාව තෝරන්න / தயவுசெய்து உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்:",
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
  const isDirectCancelCommand = lower === "cancel" || lower === "cancel order" || lower === "අවලංගු" || lower === "ரத்து";
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
  if (isHelpCmd && !isConfirmationStep) {
    const isPausedFromBooking = (session.flow_type === "CAB_FLOW" || session.flow_type === "DELIVERY_FLOW" || session.flow_type === "RENT_A_CAR_FLOW");
    if (isPausedFromBooking) {
      data.paused_flow = session.flow_type;
      data.paused_step = session.current_step;
    }
    const helpPrompt = lang === "ta"
      ? (isPausedFromBooking
        ? "❓ *உங்களுக்கு என்ன சந்தேகம் அல்லது விபரம் தேவை?*\n\nஉங்கள் கேள்வியை இங்கே தட்டச்சு செய்யவும். பதில் அளித்தவுடன் நீங்கள் விட்ட இடத்தில் இருந்து முன்பதிவைத் தொடரலாம்.\n\n(முன்பதிவைத் தொடர *Continue* அல்லது மெனுவிற்குச் செல்ல *Menu* என தட்டச்சு செய்யவும்)"
        : "❓ *உங்களுக்கு என்ன சந்தேகம் அல்லது விபரம் தேவை?*\n\nஉங்கள் கேள்வியை இங்கே தட்டச்சு செய்யவும். எங்கள் FAQ மற்றும் சேவை விபரங்களின் அடிப்படையில் உங்களுக்கு உடனடியாகப் பதிலளிக்கப்படும்.\n\n(பிரதான மெனுவிற்குச் செல்ல *Menu* என தட்டச்சு செய்யவும்)")
      : (lang === "si"
        ? (isPausedFromBooking
          ? "❓ *ඔබට දැනගැනීමට අවශ්‍ය කුමක්ද?*\n\nඔබගේ ප්‍රශ්නය මෙහි Type කරන්න. පිළිතුර ලබා දුන් පසු ඔබ නැවතුණු තැනින්ම Booking එක ඉදිරියට ගෙන යා හැක.\n\n(Booking එක ඉදිරියට ගෙන යාමට *Continue* හෝ මෙනුවට යාමට *Menu* Type කරන්න)"
          : "❓ *ඔබට දැනගැනීමට අවශ්‍ය කුමක්ද?*\n\nඔබගේ ප්‍රශ්නය මෙහි Type කරන්න. අපගේ FAQ සහ සේවා විස්තර අනුව ඔබට වහාම පිළිතුරු ලබා දෙනු ඇත.\n\n(ප්‍රධාන මෙනුවට යාමට *Menu* Type කරන්න)")
        : (isPausedFromBooking
          ? "❓ *How can we help you?*\n\nPlease type your question or doubt here. Once answered, you can continue your booking right from where you left off.\n\n(Type *Continue* to resume booking, or *Menu* to return to main menu)"
          : "❓ *How can we help you?*\n\nPlease type your question or inquiry here. We will answer you right away based on our FAQs.\n\n(Type *Menu* anytime to return to main options)"));

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
    const aiReply = await handleAiFallback(supabase, userId, trimmed, fallbackStr, pricingSettings, lang);
    
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
        replyText: "ඔබගේ Location එක හෝ දුර ප්‍රමාණය වැරදි බව අපි හඳුනා ගත්තෙමු. කරුණාකර නැවත ඔබගේ Pickup Location එක ලබා දෙන්න:",
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
      finalAnswer = lang === "ta"
        ? "💡 எமது FAQ விபரங்களின்படி உங்கள் கேள்விக்கான நேரடித் தகவல் தற்போது கிடைக்கவில்லை. எமது முகவர் அல்லது சாரதி விரைவில் உங்களைத் தொடர்புகொண்டு தேவையான விபரங்களைத் தெரிவிப்பார்."
        : (lang === "si"
          ? "💡 අපගේ FAQ විස්තර වල ඔබගේ ප්‍රශ්නයට අදාළ තොරතුරු දැනට ඇතුළත් කර නොමැත. අපගේ නියෝජිතයෙකු හෝ රියදුරු මහතා ඔබව සම්බන්ධ කරගෙන අවශ්‍ය විස්තර ලබා දෙනු ඇත."
          : "💡 We do not currently have specific information for this query in our FAQs. Our customer agent will assist you shortly with the details.");
    }

    const resumeHeader = lang === "ta"
      ? "━━━━━━━━━━━━━━━━━━━━\n📌 *உங்கள் முன்பதிவைத் தொடரலாம்:*\n"
      : (lang === "si"
        ? "━━━━━━━━━━━━━━━━━━━━\n📌 *ඔබගේ Booking එක ඉදිරියට ගෙන යමු:*\n"
        : "━━━━━━━━━━━━━━━━━━━━\n📌 *Please continue your booking:*\n");

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
    || /[-+]?\d{1,2}\.\d+,\s*[-+]?\d{1,3}\.\d+/.test(trimmed);

  const isLocationStep = step === "DELIVERY_LOCATION" || step === "CAB_PICKUP" || step === "CAB_DROPOFF" || step === "RENT_LOCATION";
  const shouldInterceptQuestion = !isLocationMsg && (!isLocationStep || trimmed.includes("?"));

  // Question interception for active booking flows (Answers question and resumes flow!)
  if ((flow === "CAB_FLOW" || flow === "DELIVERY_FLOW" || flow === "RENT_A_CAR_FLOW") && shouldInterceptQuestion && isPossibleQuestion(trimmed, messageType)) {
    const answer = await queryFaqsAndAi(supabase, userId, trimmed, pricingSettings, lang, handleAiFallback);
    
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
        replyText: lang === "ta"
          ? "உங்கள் Location அல்லது தூரம் தவறாக உள்ளதை உணர்ந்தோம். தயவுசெய்து உங்கள் Pickup இடத்தை மீண்டும் உள்ளிடவும்:"
          : "ඔබගේ Location එක හෝ දුර ප්‍රමාණය වැරදි බව අපි හඳුනා ගත්තෙමු. කරුණාකර නැවත ඔබගේ Pickup Location එක ලබා දෙන්න:",
        nextFlow: flow,
        nextStep,
        sessionData: data,
      };
    }

    const stepPrompt = getStepPromptText(flow, step, lang);
    const stepPoll = getStepPollForCurrentStep(flow, step, data, lang, pricingSettings);
    const resumeHeader = lang === "ta"
      ? "━━━━━━━━━━━━━━━━━━━━\n📌 *உங்கள் முன்பதிவைத் தொடரலாம்:*\n"
      : (lang === "si"
        ? "━━━━━━━━━━━━━━━━━━━━\n📌 *ඔබගේ Booking එක ඉදිරියට ගෙන යමු:*\n"
        : "━━━━━━━━━━━━━━━━━━━━\n📌 *Please continue your booking:*\n");

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
      replyText: "Please choose your preferred language / කරුණාකර ඔබගේ භාෂාව තෝරන්න / தயவுசெய்து உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்:",
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
        replyText: lang === "ta"
          ? "❓ *உங்களுக்கு என்ன சந்தேகம் அல்லது விபரம் தேவை?*\n\nஉங்கள் கேள்வியை இங்கே தட்டச்சு செய்யவும். எங்கள் FAQ மற்றும் சேவை விபரங்களின் அடிப்படையில் உங்களுக்கு உடனடியாகப் பதிலளிக்கப்படும்.\n\n(பிரதான மெனுவிற்குச் செல்ல *Menu* என தட்டச்சு செய்யவும்)"
          : (lang === "si"
            ? "❓ *ඔබට දැනගැනීමට අවශ්‍ය කුමක්ද?*\n\nඔබගේ ප්‍රශ්නය මෙහි Type කරන්න. අපගේ FAQ සහ සේවා විස්තර අනුව ඔබට වහාම පිළිතුරු ලබා දෙනු ඇත.\n\n(ප්‍රධාන මෙනුවට යාමට *Menu* Type කරන්න)"
            : "❓ *How can we help you?*\n\nPlease type your question or inquiry here. We will answer you right away based on our FAQs.\n\n(Type *Menu* anytime to return to main options)"),
        nextFlow: "FAQ_FLOW",
        nextStep: "FAQ_ASK",
        sessionData: data,
      };
    }

    if (lower === "cancel" || lower.startsWith("2.") || lower === "2" || lower.includes("cancel")) {
      return await startCancelFlow(supabase, userId, phoneNumber, step, lang, welcomeSetting);
    }

    if (isPossibleQuestion(trimmed)) {
      const answer = await queryFaqsAndAi(supabase, userId, trimmed, pricingSettings, lang, handleAiFallback);
      const followUpNote = lang === "ta"
        ? "\n\n💡 மேலதிக கேள்வி கேட்கலாம் அல்லது பிரதான மெனுவிற்குச் செல்ல *Menu* என தட்டச்சு செய்யவும்."
        : (lang === "si"
          ? "\n\n💡 ඔබට වෙනත් ප්‍රශ්නයක් ඇත්නම් Type කරන්න හෝ මෙනුවට යාමට *Menu* Type කරන්න."
          : "\n\n💡 Feel free to ask another question or type *Menu* to return to main options.");
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
      const answer = await queryFaqsAndAi(supabase, userId, trimmed, pricingSettings, lang, handleAiFallback);
      const followUpNote = lang === "ta"
        ? "\n\n💡 மேலதிக கேள்வி கேட்கலாம் அல்லது கீழேயுள்ள தெரிவுகளில் இருந்து சேவையைத் தேர்ந்தெடுக்கவும்:"
        : (lang === "si"
          ? "\n\n💡 ඔබට වෙනත් ප්‍රශ්නයක් ඇත්නම් Type කරන්න හෝ පහත මෙනුවෙන් සේවාවක් තෝරන්න:"
          : "\n\n💡 Feel free to ask another question or select a service from the menu below:");
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
      handleAiFallback
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
  lang: SupportedLanguage = "si"
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

  // 2. Build Models and Pricing Context
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

  // 3. Service Architecture and Specifications Context
  const serviceKnowledge = `
=== CENTRAL CABS & DELIVERY SERVICE SPECIFICATIONS ===
1. Transport / Hire Cabs:
- Two Distinct Booking Options:
  a) 'ළඟ ගමනක් යන්න' (Ride Now / Local Trips): Immediate instant travel. Allowed vehicles are strictly Motorbike (1 passenger) and Three-wheeler (up to 3 passengers).
  b) 'දුර ගමනක් යන්න' (Ride Later / Scheduled Trips): Advance booking with date and time. Allowed vehicles: Car (Sedan/Hatchback, 4 passengers, AC), Van (KDH/Caravan, 6-14 passengers, AC), Lorry (Goods/House shifting), Bus (20-54 passengers, pilgrimages/tours).
- Trip Types: One-Way (එක් පැත්තක්) or Round Trip (දෙපැත්තම - Up & Down return journey).
- Booking Process in WhatsApp: Select Ride Now/Schedule -> Name -> Phone -> Vehicle & Model -> Pickup Location pin/address -> Drop-off Location pin/address -> Live fare calculated via Google Maps -> Order Confirmed -> Broadcasted to verified driver groups -> Driver assigned.
- Commission: 10% commission applies.
- Cancellation: Free cancellation anytime before the driver arrives by typing "cancel" or "අවලංගු" or "ரத்து".

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

  const langRule = lang === "ta"
    ? "CRITICAL LANGUAGE RULE: If you provide an answer, you MUST write your AI answer in natural, polite Tamil using Tamil script (தமிழ்)."
    : (lang === "en"
      ? "CRITICAL LANGUAGE RULE: If you provide an answer, you MUST write your AI answer in clear, polite English."
      : "CRITICAL LANGUAGE RULE: If you provide an answer, you MUST write your AI answer in natural, polite Sinhala using Sinhala script (සිංහල).");

  const systemPrompt = `You are the strict, hallucination-free virtual assistant for Ceylon Central Cabs & Delivery.
The customer sent: "${userMessage}"

${serviceKnowledge}

${pricingContext}

=== VERIFIED DATABASE FAQS ===
${faqText}

=== STRICT ZERO-HALLUCINATION RULES ===
1. Answer the customer's question ONLY using the factual details provided above in SERVICE SPECIFICATIONS, VEHICLE PRICING, VEHICLE CAPACITIES, and FAQS.
2. ZERO HALLUCINATION: DO NOT fabricate, guess, extrapolate, or invent any facts, numbers, phone numbers, vehicle models, or policies not explicitly written above.
3. If the user's question CANNOT be answered from the provided knowledge, DO NOT guess or make up an answer. You MUST reply EXACTLY with: "UNKNOWN_INFO".
4. If the message is NOT a question or inquiry (e.g. it is simply answering a booking step like giving a name, a phone number, an address, a date, or saying 'ok', 'yes', 'no'), you MUST reply EXACTLY with: "NOT_A_QUESTION".
5. INTENT TO CANCEL: If the customer explicitly demands or insists to cancel their active booking/order right now (e.g., "cancel my booking", "cancel it", "danma cancel karanna", "cancel pannunga"), you MUST reply EXACTLY with: "INTENT_CANCEL_ORDER".
6. INTENT WRONG LOCATION / DISTANCE: If the customer states or complains that their pickup location, dropoff location, distance, or price is wrong or calculated incorrectly (e.g., "wrong location", "location thavarana", "dura weradi", "location pila"), you MUST reply EXACTLY with: "INTENT_WRONG_LOCATION".
7. ${langRule}
8. Keep the answer concise (1 to 3 sentences maximum), friendly, and professional.
9. If you provide an answer or say "UNKNOWN_INFO", append the original system prompt exactly as provided below at the very end of your response, separated by two newlines.

SYSTEM PROMPT TO APPEND:
${fallbackErrorPrompt}`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage }
  ];

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
          maxTokens: 400
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
        body: JSON.stringify({ model: "google/gemini-2.5-flash", messages, temperature: 0.1, max_tokens: 400 }),
      });
      if (res.ok) {
        const j = await res.json();
        rawText = j.choices?.[0]?.message?.content || "";
      }
    }

    if (rawText.trim()) {
      return rawText.trim();
    }
  } catch (err) {
    console.warn("AI Fallback failed:", err);
  }

  return "NOT_A_QUESTION";
}
