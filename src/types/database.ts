export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  plan_tier: string;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  preferred_platform: string | null;
  preferred_mode: string | null;
  total_sessions: number;
  prompts_improved: number;
  created_at: string;
  updated_at: string;
}

export interface PromptSession {
  id: string;
  user_id: string;
  parent_session_id: string | null;
  title: string;
  original_prompt: string | null;
  improved_prompt: string | null;
  alternative_one: string | null;
  alternative_two: string | null;
  alternative_three: string | null;
  alternative_one_style: string | null;
  alternative_two_style: string | null;
  alternative_three_style: string | null;
  improvement_summary: string | null;
  key_changes: string | null;
  platform: string | null;
  prompt_type: string | null;
  word_count_before: number | null;
  word_count_after: number | null;
  clarity_score_before: number | null;
  clarity_score_after: number | null;
  score_clarity_before: number | null;
  score_specificity_before: number | null;
  score_detail_before: number | null;
  score_clarity_after: number | null;
  score_specificity_after: number | null;
  score_detail_after: number | null;
  overall_score_before: number | null;
  overall_score_after: number | null;
  mode: string | null;
  raw_response: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
}

export interface CodeSession {
  id: string;
  user_id: string;
  title: string;
  original_code: string;
  error_description: string | null;
  language_detected: string | null;
  platform: string | null;
  fixed_code: string | null;
  fix_explanation: string | null;
  alternative_one_code: string | null;
  alternative_one_label: string | null;
  alternative_one_explanation: string | null;
  alternative_two_code: string | null;
  alternative_two_label: string | null;
  alternative_two_explanation: string | null;
  alternative_three_code: string | null;
  alternative_three_label: string | null;
  alternative_three_explanation: string | null;
  score_readability_before: number | null;
  score_readability_after: number | null;
  score_efficiency_before: number | null;
  score_efficiency_after: number | null;
  score_structure_before: number | null;
  score_structure_after: number | null;
  overall_score_before: number | null;
  overall_score_after: number | null;
  bugs_found: string | null;
  key_fixes: string | null;
  prevention_tips: string | null;
  complexity_level: string | null;
  status: string | null;
  raw_response: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedPrompt {
  id: string;
  user_id: string;
  session_id: string | null;
  code_session_id: string | null;
  saved_type: string;
  prompt_text: string;
  prompt_type: string | null;
  label: string | null;
  quick_note: string | null;
  is_favourite: boolean;
  source_alternative: string | null;
  platform: string | null;
  created_at: string;
}

export interface UserStats {
  id: string;
  user_id: string;
  sessions_this_week: number;
  most_used_mode: string | null;
  favorite_platform: string | null;
  total_prompts_improved: number;
  total_alternatives_generated: number;
  current_streak: number | null;
  longest_streak: number | null;
  last_session_date: string | null;
  streak_updated_at: string | null;
  last_active: string | null;
  stt_language: string | null;
  stt_auto_improve: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface PromptTemplateRecord {
  id: string;
  category: string;
  title: string;
  description: string;
  template_text: string;
  platform: string | null;
  prompt_type: string | null;
  usage_count: number;
  created_at: string;
}
