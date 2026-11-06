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
  getDropoffHelpPoll,
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
      return getVehiclePoll(lang, false, data.booking_type || "now", pricingSettings);
    }
    if (step === "CAB_MODEL") {
      const vehicleKey = data.vehicle_key || "car";
      const models = pricingSettings[vehicleKey]?.models || [];
      if (models.length > 0) {
        return getVehicleModelPoll(vehicleKey, models, lang, pricingSettings);
      }
    }
    if (step === "CAB_DROPOFF") {
      return getDropoffHelpPoll(lang);
    }
    if (step === "CAB_TRIP_TYPE") {
      return getTripTypePoll(lang);
    }
    if (step === "CAB_CONFIRM") {
      return getBookingConfirmPoll(lang);
    }
  }

  if (flow === "RENT_A_CAR_FLOW") {
    if (step === "RENT_VEHICLE_CHOICE") {
      return getRentVehiclePoll(lang);
    }
    if (step === "RENT_CONFIRM") {
      return getBookingConfirmPoll(lang);
    }
  }

  if (flow === "DELIVERY_FLOW") {
    if (step === "DELIVERY_CATEGORY") {
      return getDeliveryCategoryPoll(lang);
    }
    if (step === "DELIVERY_CONFIRM") {
      return getBookingConfirmPoll(lang);
    }
  }

  if (flow === "IDLE" || !flow) {
    if (step === "CATEGORY_CHOICE") {
      return getCategoryPoll(lang);
    }
  }

  return undefined;
}

/**
 * Smart FAQ & AI Query Engine:
 * 1. Matches against central_cab.faqs from database
 * 2. Falls back to Gemini AI with FAQ, Live User State & Conversation Context
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
    lang: SupportedLanguage,
    session?: any,
    phoneNumber?: string,
    matchedFaqHint?: { question: string; answer: string } | null
  ) => Promise<string>,
  session?: any,
  phoneNumber?: string
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
  let matchedFaqHint: { question: string; answer: string } | null = null;
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

      if (score > highestScore && score >= 2) {
        highestScore = score;
        bestFaq = f;
      }
    }

    // High confidence direct database match in matching script
    if (bestFaq && highestScore >= 10) {
      const hasSinhalaChars = /[\u0D80-\u0DFF]/.test(bestFaq.answer);
      const langMatches = (lang === "si" && hasSinhalaChars) || (lang === "en" && !hasSinhalaChars);
      if (langMatches) {
        return bestFaq.answer;
      }
    }

    // If candidate found (even across different language/script), pass as matched hint to AI
    if (bestFaq && highestScore >= 2) {
      matchedFaqHint = bestFaq;
    }
  }

  // 3. Fallback to Gemini AI with all FAQs, Live User State & Chat History
  try {
    const aiAnswer = await handleAiFallback(
      supabase,
      userId,
      trimmed,
      "",
      pricingSettings,
      lang,
      session,
      phoneNumber,
      matchedFaqHint
    );

    if (
      aiAnswer &&
      !aiAnswer.includes("NOT_A_QUESTION") &&
      !aiAnswer.includes("UNKNOWN_INFO") &&
      !aiAnswer.includes("Sorry, I don't have that information")
    ) {
      let cleaned = aiAnswer.split("\n\nSYSTEM PROMPT TO APPEND:")[0].trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "").trim();
      }
      if (cleaned) {
        return cleaned;
      }
    }
  } catch (err) {
    console.warn("[queryFaqsAndAi] AI fallback failed:", err);
  }

  // 4. Courteous fallback if no direct match or AI response
  if (lang === "en") {
    return "💡 We do not currently have specific information for this query in our FAQs. Our customer agent will assist you shortly with the details.";
  }
  return "💡 අපගේ FAQ විස්තර වල ඔබගේ ප්‍රශ්නයට අදාළ තොරතුරු දැනට ඇතුළත් කර නොමැත. අපගේ නියෝජිතයෙකු හෝ රියදුරු මහතා ඔබව සම්බන්ධ කරගෙන අවශ්‍ය විස්තර ලබා දෙනු ඇත.";
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
    lang: SupportedLanguage,
    session?: any,
    phoneNumber?: string,
    matchedFaqHint?: { question: string; answer: string } | null
  ) => Promise<string>,
  session?: any,
  phoneNumber?: string
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
      handleAiFallback,
      session,
      phoneNumber
    );

    const resumedPrompt = getStepPromptText(pausedFlow, pausedStep, lang);
    const resumedPoll = getStepPollForCurrentStep(pausedFlow, pausedStep, data, lang, pricingSettings);

    delete data.paused_flow;
    delete data.paused_step;

    const resumeHeader = lang === "en"
      ? "━━━━━━━━━━━━━━━━━━━━\n🔄 *Let's continue your booking:*\n"
      : "━━━━━━━━━━━━━━━━━━━━\n🔄 *ඔබගේ Booking එක ඉදිරියට ගෙන යමු:*\n";

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
