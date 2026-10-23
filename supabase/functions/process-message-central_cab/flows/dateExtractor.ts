// ============================================================================
// Intelligent Multi-lingual Code-based Date & Time Extractor (0% AI Dependency)
// Parses Tamil, Sinhala, English calendar & relative dates and formats with "/"
// ============================================================================

export interface ParsedDate {
  raw: string;
  formatted: string;
  dateOnly: string;
  isRecognized: boolean;
}

export interface ParsedTime {
  raw: string;
  formatted: string;
  isRecognized: boolean;
}

export interface ParsedSchedule {
  raw: string;
  formatted: string;
  dateStr: string;
  timeStr: string;
  isRecognized: boolean;
}

/**
 * Extract and normalize date in pure code (no AI).
 * Separates date with "/" instead of "-" (e.g. YYYY/MM/DD).
 */
export function extractNaturalDate(input: string, now = new Date()): ParsedDate {
  const text = (input || "").trim();
  const lower = text.toLowerCase();
  
  // Sri Lanka standard time offset (UTC + 5:30 = 330 minutes)
  const slOffsetMinutes = 330;
  const localNow = new Date(now.getTime() + (slOffsetMinutes - now.getTimezoneOffset()) * 60000);

  let targetDate = new Date(localNow);
  let isRecognized = false;
  let dateLabel = "";

  // 1. Calendar Date matching
  // Format A: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = text.match(/\b(20\d{2})[-/.\s](0?[1-9]|1[0-2])[-/.\s](0?[1-9]|[12]\d|3[01])\b/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    targetDate = new Date(y, m, d);
    isRecognized = true;
    dateLabel = `${isoMatch[1]}/${String(isoMatch[2]).padStart(2, "0")}/${String(isoMatch[3]).padStart(2, "0")}`;
  } else {
    // Format B: DD-MM-YYYY or DD/MM/YYYY
    const dmyMatch = text.match(/\b(0?[1-9]|[12]\d|3[01])[-/.\s](0?[1-9]|1[0-2])[-/.\s](20\d{2}|2[5-9]|3\d)\b/);
    if (dmyMatch) {
      const d = parseInt(dmyMatch[1], 10);
      const m = parseInt(dmyMatch[2], 10) - 1;
      const rawY = parseInt(dmyMatch[3], 10);
      const y = rawY >= 2000 ? rawY : 2000 + rawY;
      targetDate = new Date(y, m, d);
      isRecognized = true;
      dateLabel = `${y}/${String(m + 1).padStart(2, "0")}/${String(d).padStart(2, "0")}`;
    } else {
      // Format C: DD-MM or DD/MM
      const dmMatch = text.match(/\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])\b/);
      if (dmMatch) {
        const d = parseInt(dmMatch[1], 10);
        const m = parseInt(dmMatch[2], 10) - 1;
        let y = localNow.getFullYear();
        if (m < localNow.getMonth()) y += 1;
        targetDate = new Date(y, m, d);
        isRecognized = true;
        dateLabel = `${y}/${String(m + 1).padStart(2, "0")}/${String(d).padStart(2, "0")}`;
      }
    }
  }

  // 2. Relative Day Keywords across Tamil, Sinhala, and English
  if (!isRecognized) {
    // Tomorrow
    if (
      lower.includes("nalaiku") || lower.includes("naalaiku") || lower.includes("nalai") ||
      lower.includes("naalai") || lower.includes("நாளை") || lower.includes("heta") ||
      lower.includes("හෙට") || lower.includes("tomorrow") || lower.includes("tmrw") ||
      lower.includes("tomo")
    ) {
      targetDate.setDate(targetDate.getDate() + 1);
      isRecognized = true;
      dateLabel = "Tomorrow";
    }
    // Day after tomorrow
    else if (
      lower.includes("anikaal") || lower.includes("anekal") || lower.includes("anidda") ||
      lower.includes("අනිද්දා") || lower.includes("day after tomorrow") ||
      lower.includes("mathanaal") || lower.includes("மறுநாள்")
    ) {
      targetDate.setDate(targetDate.getDate() + 2);
      isRecognized = true;
      dateLabel = "Day after tomorrow";
    }
    // Today
    else if (
      lower.includes("indaiku") || lower.includes("innaiku") || lower.includes("inraiku") ||
      lower.includes("indru") || lower.includes("இன்று") || lower.includes("ada") ||
      lower.includes("අද") || lower.includes("today") || lower.includes("tonight")
    ) {
      isRecognized = true;
      dateLabel = "Today";
    }
  }

  if (isRecognized) {
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, "0");
    const dd = String(targetDate.getDate()).padStart(2, "0");
    // ALWAYS separate date with "/" instead of "-"
    const dateFormatted = `${yyyy}/${mm}/${dd}`;
    const full = dateLabel && dateLabel !== dateFormatted
      ? `${dateFormatted} (${dateLabel})`
      : dateFormatted;
    return { raw: text, formatted: full, dateOnly: dateFormatted, isRecognized: true };
  }

  // Fallback: If raw text has "-" in a date-like pattern, convert "-" to "/"
  const sanitizedWithSlash = text.replace(/(\d{2,4})-(\d{1,2})-(\d{1,4})/g, "$1/$2/$3");
  return { raw: text, formatted: sanitizedWithSlash, dateOnly: sanitizedWithSlash, isRecognized: false };
}

/**
 * Intelligent Code-based Time Extractor
 */
export function extractNaturalTime(input: string): ParsedTime {
  const text = (input || "").trim();
  const lower = text.toLowerCase();

  // 1. Standard 12h or 24h Time matching
  const timeRegex = /\b(0?[1-9]|1[0-2])[:.]([0-5]\d)\s*(am|pm|a\.m\.|p\.m\.)?\b/i;
  const match12 = text.match(timeRegex);
  if (match12) {
    let hour = parseInt(match12[1], 10);
    const min = match12[2];
    const meridian = match12[3] ? match12[3].toLowerCase().replace(/\./g, "") : null;

    if (meridian === "pm" && hour < 12) hour += 12;
    if (meridian === "am" && hour === 12) hour = 0;

    const displayMeridian = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return {
      raw: text,
      formatted: `${displayHour}:${min} ${displayMeridian}`,
      isRecognized: true,
    };
  }

  // 2. 24-hour format: "14:30" or "08:00"
  const match24 = text.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  if (match24) {
    const hour = parseInt(match24[1], 10);
    const min = match24[2];
    const displayMeridian = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return {
      raw: text,
      formatted: `${displayHour}:${min} ${displayMeridian}`,
      isRecognized: true,
    };
  }

  // 3. Simple hour with AM/PM: "10am", "4 pm", "10 am"
  const hourAmPm = lower.match(/\b(0?[1-9]|1[0-2])\s*(am|pm)\b/);
  if (hourAmPm) {
    const h = parseInt(hourAmPm[1], 10);
    const m = hourAmPm[2].toUpperCase();
    return {
      raw: text,
      formatted: `${h}:00 ${m}`,
      isRecognized: true,
    };
  }

  // 4. Tamil / Sinhala Contextual Time
  const isMorning =
    lower.includes("kaalai") || lower.includes("kalai") || lower.includes("காலை") ||
    lower.includes("udeta") || lower.includes("udey") || lower.includes("උදේ") ||
    lower.includes("morning");

  const isAfternoon =
    lower.includes("madhyahana") || lower.includes("pinpakal") || lower.includes("மதியம்") ||
    lower.includes("dawal") || lower.includes("දවල්") || lower.includes("afternoon");

  const isEveningNight =
    lower.includes("maala") || lower.includes("saayantharam") || lower.includes("iravu") ||
    lower.includes("night") || lower.includes("இரவு") || lower.includes("hawasata") ||
    lower.includes("හවස") || lower.includes("reeta") || lower.includes("රෑ");

  const hourNumberMatch = text.match(/\b(0?[1-9]|1[0-2])\b/);
  if (hourNumberMatch && (isMorning || isAfternoon || isEveningNight)) {
    const h = parseInt(hourNumberMatch[1], 10);
    let meridian = "AM";
    if (isMorning) meridian = "AM";
    else if (isAfternoon) meridian = h === 12 ? "PM" : (h < 6 ? "PM" : "AM");
    else if (isEveningNight) meridian = "PM";

    return {
      raw: text,
      formatted: `${h}:00 ${meridian}`,
      isRecognized: true,
    };
  }

  // Fallback: If not recognized
  return { raw: text, formatted: text, isRecognized: false };
}

/**
 * Intelligent combined schedule parser
 */
export function extractNaturalSchedule(input: string, now = new Date()): ParsedSchedule {
  const dateResult = extractNaturalDate(input, now);
  const timeResult = extractNaturalTime(input);

  const isRecognized = dateResult.isRecognized || timeResult.isRecognized;
  let formatted = "";

  if (dateResult.isRecognized && timeResult.isRecognized) {
    formatted = `${dateResult.formatted} at ${timeResult.formatted}`;
  } else if (dateResult.isRecognized) {
    formatted = dateResult.formatted;
  } else if (timeResult.isRecognized) {
    formatted = timeResult.formatted;
  } else {
    formatted = input.trim();
  }

  return {
    raw: input,
    formatted,
    dateStr: dateResult.formatted,
    timeStr: timeResult.formatted,
    isRecognized,
  };
}
