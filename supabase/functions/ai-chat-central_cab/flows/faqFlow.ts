// ============================================================================
// Central Cabs - Category Sub-File: FAQ & Inquiries Flow
// Answers customer questions using verified FAQs and Pricing rules
// Supports pausing and resuming active booking flows seamlessly
// ============================================================================

import { PricingSettings } from "../pricingEngine.ts";
import {
  SupportedLanguage,
  getCategoryPoll,
  getVehiclePoll,
  getVehicleModelPoll,
  getTripTypePoll,
  getBookingConfirmPoll,
  getRentVehiclePoll,
  getDeliveryCategoryPoll,
  getStepPromptText,
  isResumeBookingChoice,
  PollDefinition,
} from "../i18n.ts";
import { StepProcessResult } from "./types.ts";

/**
 * Returns poll definition for a given booking step so it can be re-rendered
 * when answering questions in the middle of a flow.
 */
export function getStepPollForCurrentStep(
  flow: string,
  step: string,
  data: any,
  lang: SupportedLanguage,
  pricingSettings: PricingSettings
): PollDefinition | undefined {
  if (flow === "CAB_FLOW") {
    if (step === "CAB_VEHICLE") {
      return getVehiclePoll(lang, false, data.booking_type || "now");
    }
    if (step === "CAB_MODEL") {
      const vehicleKey = data.vehicle_key || "car";
      const models = pricingSettings[vehicleKey]?.models || [];
      if (models.length > 0) {
        return getVehicleModelPoll(vehicleKey, models, lang);
      }
    }
    if (step === "CAB_TRIP_TYPE") {
      return getTripTypePoll(lang);
    }
  }

  if (flow === "RENT_A_CAR_FLOW") {
    if (step === "RENT_VEHICLE_CHOICE") {
      return getRentVehiclePoll(lang);
    }
  }

  if (flow === "DELIVERY_FLOW") {
    if (step === "DELIVERY_CATEGORY") {
      return getDeliveryCategoryPoll(lang);
    }
  }

  return undefined;
}

/**
 * Smart FAQ & AI Query Engine:
 * 1. Matches against central_cab.faqs from database
 * 2. Falls back to Gemini AI with FAQ & Pricing context
 * 3. Provides graceful multilingual fallback
 */
export async function queryFaqsAndAi(
  supabase: any,
  userId: string,
  userMessage: string,
  pricingSettings: PricingSettings,
  lang: SupportedLanguage,
  handleAiFallback: (
    supabase: any,
    userId: string,
    message: string,
    fallbackPrompt: string,
    pricing: PricingSettings,
    lang: SupportedLanguage
  ) => Promise<string>
): Promise<string> {
  const trimmed = userMessage.trim();
  const lowerMsg = trimmed.toLowerCase();

  // 1. Fetch active FAQs from database
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
    console.warn("[queryFaqsAndAi] Error fetching FAQs:", err);
  }

  // 2. Direct Keyword / Token Matching against database FAQs
  if (faqs.length > 0) {
    const cleanTokens = lowerMsg
      .replace(/[?!,.:;()_]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 2);

    let bestFaq: { question: string; answer: string } | null = null;
    let highestScore = 0;

    for (const f of faqs) {
      const qLower = (f.question || "").toLowerCase();
      const aLower = (f.answer || "").toLowerCase();

      // Exact substring match
      if (qLower.includes(lowerMsg) || lowerMsg.includes(qLower)) {
        highestScore = 100;
        bestFaq = f;
        break;
      }

      // Keyword token overlap
      let score = 0;
      for (const token of cleanTokens) {
        if (qLower.includes(token)) score += 3;
        else if (aLower.includes(token)) score += 1;
      }

      if (score > highestScore && score >= 3) {
        highestScore = score;
        bestFaq = f;
      }
    }

    if (bestFaq && highestScore >= 3) {
      return bestFaq.answer;
    }
  }

  // 3. Fallback to Gemini AI with all FAQs and Pricing details
  try {
    const aiAnswer = await handleAiFallback(
      supabase,
      userId,
      trimmed,
      "",
      pricingSettings,
      lang
    );

    if (
      aiAnswer &&
      !aiAnswer.includes("NOT_A_QUESTION") &&
      !aiAnswer.includes("Sorry, I don't have that information")
    ) {
      const cleaned = aiAnswer.split("\n\nSYSTEM PROMPT TO APPEND:")[0].trim();
      if (cleaned) {
        return cleaned;
      }
    }
  } catch (err) {
    console.warn("[queryFaqsAndAi] AI fallback failed:", err);
  }

  // 4. Courteous fallback if no direct match or AI response
  if (lang === "ta") {
    return "💡 எமது FAQ விபரங்களின்படி உங்கள் கேள்விக்கான நேரடித் தகவல் தற்போது கிடைக்கவில்லை. எமது முகவர் அல்லது சாரதி விரைவில் உங்களைத் தொடர்புகொண்டு தேவையான விபரங்களைத் தெரிவிப்பார்.";
  }
  if (lang === "si") {
    return "💡 අපගේ FAQ විස්තර වල ඔබගේ ප්‍රශ්නයට අදාළ තොරතුරු දැනට ඇතුළත් කර නොමැත. අපගේ නියෝජිතයෙකු හෝ රියදුරු මහතා ඔබව සම්බන්ධ කරගෙන අවශ්‍ය විස්තර ලබා දෙනු ඇත.";
  }
  return "💡 We do not currently have specific information for this query in our FAQs. Our customer agent will assist you shortly with the details.";
}

export async function handleFaqFlowStep(
  supabase: any,
  userId: string,
  trimmed: string,
  data: any,
  lang: SupportedLanguage,
  pricingSettings: PricingSettings,
  handleAiFallback: (
    supabase: any,
    userId: string,
    message: string,
    fallbackPrompt: string,
    pricing: PricingSettings,
    lang: SupportedLanguage
  ) => Promise<string>
): Promise<StepProcessResult> {
  const lower = trimmed.toLowerCase();

  // 1. Main Menu Reset
  if (lower === "menu" || lower === "back" || lower === "home" || lower === "main") {
    delete data.paused_flow;
    delete data.paused_step;
    return {
      replyText: getStepPromptText("IDLE", "CATEGORY_CHOICE", lang),
      poll: getCategoryPoll(lang),
      nextFlow: "IDLE",
      nextStep: "CATEGORY_CHOICE",
      sessionData: { language: lang },
    };
  }

  // 2. Check if user came from a paused booking flow
  const pausedFlow = data.paused_flow;
  const pausedStep = data.paused_step;

  if (pausedFlow && pausedStep) {
    // If user explicitly chooses to resume booking without asking
    if (isResumeBookingChoice(trimmed)) {
      const resumedPrompt = getStepPromptText(pausedFlow, pausedStep, lang);
      const resumedPoll = getStepPollForCurrentStep(pausedFlow, pausedStep, data, lang, pricingSettings);
      delete data.paused_flow;
      delete data.paused_step;
      return {
        replyText: resumedPrompt,
        poll: resumedPoll,
        sendTextWithPoll: !!resumedPoll,
        nextFlow: pausedFlow,
        nextStep: pausedStep,
        sessionData: data,
      };
    }

    // Answer the user's question and automatically resume booking!
    const answer = await queryFaqsAndAi(
      supabase,
      userId,
      trimmed,
      pricingSettings,
      lang,
      handleAiFallback
    );

    const resumedPrompt = getStepPromptText(pausedFlow, pausedStep, lang);
    const resumedPoll = getStepPollForCurrentStep(pausedFlow, pausedStep, data, lang, pricingSettings);

    delete data.paused_flow;
    delete data.paused_step;

    const resumeHeader = lang === "ta"
      ? "━━━━━━━━━━━━━━━━━━━━\n🔄 *உங்கள் முன்பதிவைத் தொடர்வோம்:*\n"
      : (lang === "si"
        ? "━━━━━━━━━━━━━━━━━━━━\n🔄 *ඔබගේ Booking එක ඉදිරියට ගෙන යමු:*\n"
        : "━━━━━━━━━━━━━━━━━━━━\n🔄 *Let's continue your booking:*\n");

    return {
      replyText: `${answer}\n\n${resumeHeader}${resumedPrompt}`,
      poll: resumedPoll,
      sendTextWithPoll: !!resumedPoll,
      nextFlow: pausedFlow,
      nextStep: pausedStep,
      sessionData: data,
    };
  }

  // 3. Normal FAQ Flow (from Help command or 5. Ask a question)
  const answer = await queryFaqsAndAi(
    supabase,
    userId,
    trimmed,
    pricingSettings,
    lang,
    handleAiFallback
  );

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
