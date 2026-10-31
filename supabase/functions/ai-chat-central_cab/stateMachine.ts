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
    "price", "how much", "rate", "cost", "charge", "charges",
    "keeyada", "kiyada", "gaana", "gani", "mudal",
    "thiyenawada", "puluwanda", "puluwandha", "puluwan", "koheda", "wisthara", "visthara", "detail", "details",
    "ac", "aircon", "van ekak", "car ekak", "bus ekak",
    "what", "how", "when", "where", "why", "can you", "do you", "can i", "is it", "possible",
    "wrong", "incorrect", "distance", "pila", "waradi", "dura", "weradi",
    "mudiyuma", "mudiyatha", "ealuma", "theriyuma", "iruka", "irukka", "irukkuma", "vilai", "ethana", "evvalavu", "thavarana", "maathu",
    "help", "doubt", "santhegam", "kelvi", "inquiry", "support", "faq", "advance", "payment", "luggage", "driver"
  ];
  
  const sinWords = ["මිල", "කීයද", "ගාණ", "කොහෙද", "තියෙනවද", "පුළුවන්ද", "විස්තර", "වැරදි", "දුර", "අවලංගු", "ප්‍රශ්න", "සහාය"];

  const tamWords = [
    "கேள்வி", "சந்தேகம்", "உதவி", "விலை", "கட்டணம்", "முடியுமா", "முடியாதா",
    "இருக்கா", "இருக்குமா", "எப்படி", "எப்போது", "எங்கே", "என்ன", "எத்தனை",
    "ஏசி", "தள்ளுபடி", "ரத்து", "லக்கேஜ்", "முன்பணம்", "விபரம்", "பாதுகாப்பு"
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
        nextFlow: flow,
        nextStep: step,
        sessionData: data,
      };
    }
    return {
      replyText: aiReply,
      poll: stepPoll,
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

  // Fetch FAQs
  const { data: faqs } = await supabase
    .schema("central_cab")
    .from("faqs")
    .select("question, answer, category")
    .eq("is_active", true)
    .eq("user_id", userId);

  const faqText = (faqs || []).map((f: any) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");

  const pricingContext = `
Motorbike: LKR ${pricingSettings.motorbike.per_km_rate}/km (Base: LKR ${pricingSettings.motorbike.base_price})
Three-wheeler: LKR ${pricingSettings.three_wheeler.per_km_rate}/km (Base: LKR ${pricingSettings.three_wheeler.base_price})
Car: LKR ${pricingSettings.car.per_km_rate}/km (Base: LKR ${pricingSettings.car.base_price})
Van: LKR ${pricingSettings.van.per_km_rate}/km (Base: LKR ${pricingSettings.van.base_price})
Lorry: LKR ${pricingSettings.lorry.per_km_rate}/km (Base: LKR ${pricingSettings.lorry.base_price})
Bus: LKR ${pricingSettings.bus.per_km_rate}/km (Base: LKR ${pricingSettings.bus.base_price})
`;

  const langRule = lang === "ta"
    ? "7. CRITICAL LANGUAGE RULE: If you provide an answer, you MUST write your AI answer in conversational Tamil using Tamil script (தமிழ்)."
    : (lang === "en"
      ? "7. CRITICAL LANGUAGE RULE: If you provide an answer, you MUST write your AI answer in clear, polite English."
      : "7. CRITICAL LANGUAGE RULE: If you provide an answer, you MUST write your AI answer in conversational Sinhala using Sinhala script.");

  const cancelRule = lang === "ta"
    ? '1. If the user asks about cancellation policy or if cancellation is free, answer politely in Tamil (mentioning that they can cancel before the driver arrives for free by typing "cancel").'
    : (lang === "en"
      ? '1. If the user asks about cancellation policy or if cancellation is free, answer politely in English (mentioning that they can cancel before the driver arrives for free by typing "cancel").'
      : '1. If the user asks a question about cancellation policy or whether cancellation is possible/free, answer it politely and concisely in Sinhala using the FAQs (mentioning that they can cancel before the driver arrives for free by typing "cancel").');

  const systemPrompt = `You are a strict, hallucination-free assistant for Ceylon Central Cabs. 
The user said: "${userMessage}"

Your job is to determine if the user is asking a valid question that can be answered ONLY using the provided FAQs or Pricing Details below.

PRICING DETAILS:
${pricingContext}

FAQs:
${faqText || "No FAQs available"}

RULES:
${cancelRule}
2. If the user asks a clear question that can be answered by the Pricing Details or FAQs, answer it briefly in 1-2 sentences.
3. CRITICAL CANCEL INTENT: If the user explicitly demands, orders, or insists to cancel or abort their active booking right now (e.g., "cancel my booking", "cancel it now", "epa danma cancel karanna", "cancel pannunga", "stop booking"), you MUST reply EXACTLY with the text: "INTENT_CANCEL_ORDER".
4. CRITICAL WRONG LOCATION / DISTANCE INTENT: If the user complains that the "pickup location", "dropoff location", "distance", or "price" is incorrect or wrong (e.g., "distance is wrong", "wrong location", "not 180km", "location pila", "dura weradi", "location thavarana"), you MUST reply EXACTLY with the text: "INTENT_WRONG_LOCATION".
5. If the user asks something outside of the provided FAQs/Pricing, DO NOT guess or hallucinate. You MUST reply exactly with: "Sorry, I don't have that information."
6. If the user's message is NOT a question (e.g. it's just an answer to a booking step like a name, location, or 'yes'/'no'), you MUST reply exactly with the text: "NOT_A_QUESTION".
${langRule}
8. If you provide an answer or say "Sorry, I don't have that information.", you MUST append the original system prompt exactly as provided below at the very end of your response, separated by two newlines.

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
        body: JSON.stringify({ model: "google/gemini-2.5-flash", messages, max_tokens: 400 }),
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
