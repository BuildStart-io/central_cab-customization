// ============================================================================
// Central Cabs & Delivery - Shared Flow Types & Interfaces
// ============================================================================

export type SupportedLanguage = "ta" | "si" | "en";

export interface PollPayload {
  name: string;
  options: string[];
  multipleAnswers?: boolean;
}

export interface BotSessionState {
  phone_number: string;
  user_id: string;
  flow_type: string;
  current_step: string;
  session_data: any;
  last_interaction?: string;
  updated_at?: string;
}

export interface StepProcessResult {
  replyText: string;
  poll?: PollPayload;
  mediaUrl?: string;
  sendTextWithPoll?: boolean;
  nextFlow: string;
  nextStep: string;
  sessionData: any;
}

export type ServiceCategory =
  | "ride_now"
  | "ride_schedule"
  | "rent_a_car"
  | "delivery"
  | "ask_a_question";
