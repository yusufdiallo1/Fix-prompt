import Groq from "groq-sdk";
import { env } from "./env";
import { supabase } from "./supabase";

const GROQ_MODEL = "llama-3.3-70b-versatile";
const REQUEST_LIMIT = 10;
const REQUEST_WINDOW_MS = 60_000;
const requestTimestamps: number[] = [];

type RootCause =
  | "MISSING_CONTEXT"
  | "AMBIGUOUS_REQUIREMENTS"
  | "PLATFORM_LIMITATION"
  | "SCOPE_CREEP"
  | "TECH_MISMATCH"
  | "MISSING_DEPENDENCY"
  | "LOGIC_ERROR"
  | "STYLE_CONFLICT";

type ErrorType = "RUNTIME" | "BUILD" | "LOGIC" | "STYLE" | "UNKNOWN";
type ComplexityLevel = "simple" | "medium" | "complex";

export interface ImprovePromptInput {
  original_prompt: string;
  platform: string;
  prompt_type: string;
  user_id: string;
  parent_session_id?: string | null;
}

export interface ImprovePromptResponse {
  improved_prompt: string;
  alternative_one: string;
  alternative_one_style: string;
  alternative_two: string;
  alternative_two_style: string;
  alternative_three: string;
  alternative_three_style: string;
  improvement_summary: string;
  key_changes: string[];
  weaknesses: string[];
  score_clarity: number;
  score_specificity: number;
  score_detail: number;
  score_clarity_after: number;
  score_specificity_after: number;
  score_detail_after: number;
  overall_score_before: number;
  overall_score_after: number;
  improvement_insight: string;
  platform_tip: string;
  session_id?: string;
}

export interface DebugPromptInput {
  original_prompt: string;
  broken_code: string;
  error_message: string;
  platform: string;
  user_id: string;
}

export interface DebugPromptResponse {
  root_cause: RootCause;
  diagnosis_summary: string;
  specific_issues: string[];
  confidence_score: number;
  fix_prompt: string;
  fixed_code: string;
  fixed_code_explanation: string;
  fix_key_changes: string[];
  alternative_fix_one: string;
  alternative_fix_one_style: string;
  alternative_fix_two: string;
  alternative_fix_two_style: string;
  alternative_code_one: string;
  alternative_code_two: string;
  platform_tips: string;
  prevention_tips: string[];
  framework_detected: string;
  error_type: ErrorType;
  complexity_level: ComplexityLevel;
}

const improveSystemInstruction = `You are PromptFix, an expert prompt engineer who specializes in rewriting weak or vague prompts into clear, powerful, production-ready prompts for AI tools like Lovable, Cursor, Replit, ChatGPT, and Claude.

Your job is to analyze the original prompt and return a JSON object with exactly these fields:

improved_prompt: a single rewritten version of the prompt that is dramatically clearer, more specific, and more likely to get the right result from the AI tool

alternative_one: a completely different approach to achieving the same goal, focused on being more detailed and comprehensive

alternative_one_style: a short 3 word label describing the style of alternative one, for example "More Detailed Version"

alternative_two: a second different approach that is shorter and more direct than the original

alternative_two_style: a short 3 word label describing the style of alternative two, for example "Concise Direct Version"

alternative_three: a third approach that breaks the goal into clear numbered steps the AI should follow

alternative_three_style: a short 3 word label for alternative three, for example "Step By Step Version"

improvement_summary: one sentence explaining the main reason the original prompt was weak

key_changes: an array of 3 to 5 short strings each describing one specific improvement made

weaknesses: an array of 3 short strings each describing one weakness found in the original prompt

score_clarity: a number from 0 to 10 rating how clear and easy to understand the original prompt was

score_specificity: a number from 0 to 10 rating how specific and detailed the original prompt was

score_detail: a number from 0 to 10 rating how much useful context and information the original prompt included

score_clarity_after: same as score_clarity but for the improved prompt, and should not be lower than score_clarity

score_specificity_after: same as score_specificity but for the improved prompt, and should not be lower than score_specificity

score_detail_after: same as score_detail but for the improved prompt, and should not be lower than score_detail

overall_score_before: the average of score_clarity, score_specificity, and score_detail, rounded to one decimal place

overall_score_after: the average of score_clarity_after, score_specificity_after, and score_detail_after, rounded to one decimal place

improvement_insight: one short plain English sentence that explains the single biggest improvement made

platform_tip: one specific tip for writing prompts on the platform the user selected

Return only valid JSON. No explanation text before or after the JSON. No markdown code fences.`;

const debugSystemInstruction = `You are PromptFix Debug, an expert code fixer. Your job is to diagnose broken code, produce corrected code, explain what changed, and provide alternative working code options.

Your job is to analyze all three inputs and return a JSON object with exactly these fields:

root_cause: exactly one of these categories:
MISSING_CONTEXT, AMBIGUOUS_REQUIREMENTS,
PLATFORM_LIMITATION, SCOPE_CREEP, TECH_MISMATCH,
MISSING_DEPENDENCY, LOGIC_ERROR, STYLE_CONFLICT

diagnosis_summary: 2 to 3 plain English sentences explaining exactly why the prompt produced broken code

specific_issues: an array of 3 to 5 short strings each describing one specific problem found

confidence_score: a number from 0 to 100 showing how confident the diagnosis is

fix_prompt: short summary sentence of the debugging strategy in plain English

fixed_code: the full corrected version of the user's broken code that should run better than the input

fixed_code_explanation: 2 to 4 short sentences explaining exactly what was changed and why

fix_key_changes: an array of 3 to 5 short strings each describing one change made in the fix prompt

alternative_fix_one: short summary sentence for alternative approach one

alternative_fix_one_style: a short 3 word label like "Minimal Safe Approach"

alternative_fix_two: short summary sentence for alternative approach two

alternative_fix_two_style: a short 3 word label like "Smaller Scoped Steps"

alternative_code_one: full alternative code version for approach one

alternative_code_two: full alternative code version for approach two

platform_tips: one specific practical tip for avoiding this error on the platform the user selected

prevention_tips: an array of 2 to 3 short strings each describing how to prevent this problem in future

framework_detected: the programming framework or language detected in the broken code, for example React, Vue, Python, or Unknown

error_type: one of these: RUNTIME, BUILD, LOGIC, STYLE, UNKNOWN

complexity_level: one of these: simple, medium, complex

Return only valid JSON. No explanation text. No markdown.`;

const normalizeDebugResponse = (result: DebugPromptResponse): DebugPromptResponse => {
  const fixedCode = (result.fixed_code ?? "").trim() || result.fix_prompt;
  const altCodeOne = (result.alternative_code_one ?? "").trim() || result.alternative_fix_one;
  const altCodeTwo = (result.alternative_code_two ?? "").trim() || result.alternative_fix_two;

  return {
    ...result,
    fixed_code: fixedCode,
    fixed_code_explanation: (result.fixed_code_explanation ?? "").trim() || result.diagnosis_summary,
    alternative_code_one: altCodeOne,
    alternative_code_two: altCodeTwo,
  };
};

const trimTitle = (text: string) => {
  const trimmed = text.trim();
  return trimmed.length > 60 ? `${trimmed.slice(0, 60)}...` : trimmed;
};

const getWordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

const getGroqClient = () => {
  if (!env.groqApiKey) {
    throw new Error("Groq API key is missing. Please set VITE_GROQ_API_KEY.");
  }
  return new Groq({
    apiKey: env.groqApiKey,
    dangerouslyAllowBrowser: true,
  });
};

const enforceRateLimit = () => {
  const now = Date.now();
  while (requestTimestamps.length && now - requestTimestamps[0] > REQUEST_WINDOW_MS) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length >= REQUEST_LIMIT) {
    throw new Error("Slow down a little, you are sending too many requests.");
  }
  requestTimestamps.push(now);
};

const safeJsonParse = <T>(value: string): T | null => {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.error("Failed to parse AI JSON response", { error, value });
    return null;
  }
};

const clampScore10 = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(10, numeric));
};

const toOneDecimal = (value: number) => Math.round(value * 10) / 10;

const normalizeImproveResponse = (result: ImprovePromptResponse): ImprovePromptResponse => {
  const scoreClarity = clampScore10(result.score_clarity);
  const scoreSpecificity = clampScore10(result.score_specificity);
  const scoreDetail = clampScore10(result.score_detail);
  const scoreClarityAfter = Math.max(scoreClarity, clampScore10(result.score_clarity_after));
  const scoreSpecificityAfter = Math.max(scoreSpecificity, clampScore10(result.score_specificity_after));
  const scoreDetailAfter = Math.max(scoreDetail, clampScore10(result.score_detail_after));

  return {
    ...result,
    score_clarity: scoreClarity,
    score_specificity: scoreSpecificity,
    score_detail: scoreDetail,
    score_clarity_after: scoreClarityAfter,
    score_specificity_after: scoreSpecificityAfter,
    score_detail_after: scoreDetailAfter,
    overall_score_before: toOneDecimal((scoreClarity + scoreSpecificity + scoreDetail) / 3),
    overall_score_after: toOneDecimal((scoreClarityAfter + scoreSpecificityAfter + scoreDetailAfter) / 3),
    improvement_insight: (result.improvement_insight ?? "").trim() || result.improvement_summary,
  };
};

const toClearApiError = (error: unknown) => {
  console.error("Groq API error", error);
  const message = error instanceof Error ? error.message : "Unknown Groq API error";
  return new Error(`AI request failed: ${message}`);
};

const insertWithRawFallback = async (table: "prompt_sessions" | "debug_sessions", payload: Record<string, unknown>) => {
  if (!supabase) return null;
  const { data, error } = await supabase.from(table).insert(payload).select("id").single();
  if (!error) return data as { id: string };

  const message = error.message ?? "";
  if (message.toLowerCase().includes("raw_response")) {
    const fallbackPayload = { ...payload };
    delete fallbackPayload.raw_response;
    const fallback = await supabase.from(table).insert(fallbackPayload).select("id").single();
    if (!fallback.error) return fallback.data as { id: string };
    console.error(`Failed inserting fallback row in ${table}`, fallback.error);
    return null;
  }

  console.error(`Failed inserting row in ${table}`, error);
  return null;
};

const toLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const updateUserStreak = async (userId: string) => {
  if (!supabase) return;

  const today = new Date();
  const todayStr = toLocalDateString(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toLocalDateString(yesterday);

  const { data, error } = await supabase
    .from("user_stats")
    .select("id,current_streak,longest_streak,last_session_date")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed loading user_stats for streak update", error);
    return;
  }

  const row = data as
    | {
        id: string;
        current_streak: number | null;
        longest_streak: number | null;
        last_session_date: string | null;
      }
    | null;

  const prevCurrent = row?.current_streak ?? 0;
  const prevLongest = row?.longest_streak ?? 0;
  const lastSessionDate = row?.last_session_date;

  let nextCurrent = prevCurrent;

  if (!lastSessionDate) {
    nextCurrent = 1;
  } else if (lastSessionDate === todayStr) {
    nextCurrent = prevCurrent;
  } else if (lastSessionDate === yesterdayStr) {
    nextCurrent = Math.max(1, prevCurrent + 1);
  } else {
    nextCurrent = 1;
  }

  const nextLongest = Math.max(prevLongest, nextCurrent);
  const streakPayload = {
    user_id: userId,
    current_streak: nextCurrent,
    longest_streak: nextLongest,
    last_session_date: todayStr,
    streak_updated_at: new Date().toISOString(),
    last_active: new Date().toISOString(),
  };

  const { error: upsertError } = await supabase.from("user_stats").upsert(streakPayload, { onConflict: "user_id" });
  if (upsertError) {
    console.error("Failed upserting streak in user_stats", upsertError);
  }
};

const requestJsonCompletion = async <T>(params: { system: string; user: string }): Promise<{ parsed: T; raw: string }> => {
  const client = getGroqClient();
  const runRequest = async (jsonOnlyRetry = false) => {
    const retrySuffix = jsonOnlyRetry ? "\n\nCRITICAL: Return only valid JSON. Do not include any other text." : "";
    try {
      const completion = await client.chat.completions.create({
        model: GROQ_MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: `${params.user}${retrySuffix}` },
        ],
      });
      return completion.choices[0]?.message?.content ?? "";
    } catch (error) {
      throw toClearApiError(error);
    }
  };

  const firstRaw = await runRequest(false);
  const firstParsed = safeJsonParse<T>(firstRaw);
  if (firstParsed) {
    return { parsed: firstParsed, raw: firstRaw };
  }

  const retryRaw = await runRequest(true);
  const retryParsed = safeJsonParse<T>(retryRaw);
  if (retryParsed) {
    return { parsed: retryParsed, raw: retryRaw };
  }

  throw new Error("AI response was invalid, please try again.");
};

const saveImproveSession = async ({
  input,
  result,
  rawResponse,
}: {
  input: ImprovePromptInput;
  result: ImprovePromptResponse;
  rawResponse: string;
}) => {
  const title = trimTitle(input.original_prompt);
  const wordCountBefore = getWordCount(input.original_prompt);
  const wordCountAfter = getWordCount(result.improved_prompt);

  const promptSession = await insertWithRawFallback("prompt_sessions", {
    user_id: input.user_id,
    parent_session_id: input.parent_session_id ?? null,
    title,
    original_prompt: input.original_prompt.trim(),
    improved_prompt: result.improved_prompt,
    alternative_one: result.alternative_one,
    alternative_two: result.alternative_two,
    alternative_three: result.alternative_three,
    alternative_one_style: result.alternative_one_style,
    alternative_two_style: result.alternative_two_style,
    alternative_three_style: result.alternative_three_style,
    improvement_summary: result.improvement_summary,
    key_changes: result.key_changes.join("\n"),
    platform: input.platform,
    prompt_type: input.prompt_type,
    word_count_before: wordCountBefore,
    word_count_after: wordCountAfter,
    clarity_score_before: result.score_clarity,
    clarity_score_after: result.score_clarity_after,
    score_clarity_before: result.score_clarity,
    score_specificity_before: result.score_specificity,
    score_detail_before: result.score_detail,
    score_clarity_after: result.score_clarity_after,
    score_specificity_after: result.score_specificity_after,
    score_detail_after: result.score_detail_after,
    overall_score_before: result.overall_score_before,
    overall_score_after: result.overall_score_after,
    mode: "improve",
    status: "completed",
    raw_response: rawResponse,
  });
  if (promptSession?.id) {
    await updateUserStreak(input.user_id);
  }
  return promptSession?.id ?? null;
};

const saveDebugSession = async ({
  input,
  result,
  rawResponse,
}: {
  input: DebugPromptInput;
  result: DebugPromptResponse;
  rawResponse: string;
}) => {
  const title = trimTitle(input.original_prompt);
  const promptSession = await insertWithRawFallback("prompt_sessions", {
    user_id: input.user_id,
    title,
    original_prompt: input.original_prompt.trim(),
    improved_prompt: result.fixed_code,
    alternative_one: result.alternative_code_one,
    alternative_two: result.alternative_code_two,
    alternative_three: null,
    alternative_one_style: result.alternative_fix_one_style,
    alternative_two_style: result.alternative_fix_two_style,
    alternative_three_style: null,
    improvement_summary: result.diagnosis_summary,
    key_changes: result.fix_key_changes.join("\n"),
    platform: input.platform,
    prompt_type: "debug",
    word_count_before: getWordCount(input.original_prompt),
    word_count_after: getWordCount(result.fixed_code),
    clarity_score_before: null,
    clarity_score_after: null,
    score_clarity_before: null,
    score_specificity_before: null,
    score_detail_before: null,
    score_clarity_after: null,
    score_specificity_after: null,
    score_detail_after: null,
    overall_score_before: null,
    overall_score_after: null,
    mode: "debug",
    status: "completed",
    raw_response: rawResponse,
  });
  if (promptSession?.id) {
    await updateUserStreak(input.user_id);
  }

  await insertWithRawFallback("debug_sessions", {
    user_id: input.user_id,
    prompt_session_id: promptSession?.id ?? null,
    original_prompt: input.original_prompt.trim(),
    broken_code: input.broken_code.trim(),
    error_message: input.error_message.trim(),
    platform: input.platform,
    root_cause: result.root_cause,
    diagnosis_summary: result.diagnosis_summary,
    specific_issues: result.specific_issues.join("\n"),
    fix_prompt: result.fixed_code,
    key_changes: result.fix_key_changes.join("\n"),
    platform_tips: result.platform_tips,
    prevention_tips: result.prevention_tips.join("\n"),
    confidence_score: result.confidence_score,
    framework_detected: result.framework_detected,
    error_type: result.error_type,
    complexity_level: result.complexity_level,
    status: "completed",
    raw_response: rawResponse,
  });
};

export const improvePrompt = async (input: ImprovePromptInput): Promise<ImprovePromptResponse> => {
  enforceRateLimit();
  const userPrompt = [
    `original_prompt:\n${input.original_prompt.trim()}`,
    `platform: ${input.platform}`,
    `prompt_type: ${input.prompt_type}`,
  ].join("\n\n");

  try {
    const { parsed, raw } = await requestJsonCompletion<ImprovePromptResponse>({
      system: improveSystemInstruction,
      user: userPrompt,
    });
    const normalized = normalizeImproveResponse(parsed);
    const savedSessionId = await saveImproveSession({ input, result: normalized, rawResponse: raw });
    return { ...normalized, session_id: savedSessionId ?? undefined };
  } catch (error) {
    console.error("improvePrompt failed", { error, input });
    if (error instanceof Error) throw error;
    throw new Error("AI request failed. Please try again.");
  }
};

export const debugPrompt = async (input: DebugPromptInput): Promise<DebugPromptResponse> => {
  enforceRateLimit();
  const userPrompt = [
    `original_prompt:\n${input.original_prompt.trim()}`,
    `broken_code:\n${input.broken_code.trim()}`,
    `error_message:\n${input.error_message.trim()}`,
    `platform: ${input.platform}`,
  ].join("\n\n");

  try {
    const { parsed, raw } = await requestJsonCompletion<DebugPromptResponse>({
      system: debugSystemInstruction,
      user: userPrompt,
    });
    const normalized = normalizeDebugResponse(parsed);
    await saveDebugSession({ input, result: normalized, rawResponse: raw });
    return normalized;
  } catch (error) {
    console.error("debugPrompt failed", { error, input });
    if (error instanceof Error) throw error;
    throw new Error("AI request failed. Please try again.");
  }
};

export const streamImprovePrompt = async function* (
  input: ImprovePromptInput,
): AsyncGenerator<string, ImprovePromptResponse, void> {
  enforceRateLimit();
  const client = getGroqClient();
  const userPrompt = [
    `original_prompt:\n${input.original_prompt.trim()}`,
    `platform: ${input.platform}`,
    `prompt_type: ${input.prompt_type}`,
  ].join("\n\n");

  let fullRaw = "";
  let streamFailed = false;

  try {
    const stream = await client.chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      stream: true,
      messages: [
        { role: "system", content: improveSystemInstruction },
        { role: "user", content: userPrompt },
      ],
    });

    for await (const chunk of stream) {
      const textChunk = chunk.choices[0]?.delta?.content ?? "";
      if (!textChunk) continue;
      fullRaw += textChunk;
      yield textChunk;
    }
  } catch (error) {
    streamFailed = true;
    console.error("streamImprovePrompt API error", { error, input });
    throw toClearApiError(error);
  }

  if (streamFailed) {
    throw new Error("AI request failed. Please try again.");
  }

  const firstParsed = safeJsonParse<ImprovePromptResponse>(fullRaw);
  if (firstParsed) {
    const normalized = normalizeImproveResponse(firstParsed);
    const savedSessionId = await saveImproveSession({ input, result: normalized, rawResponse: fullRaw });
    return { ...normalized, session_id: savedSessionId ?? undefined };
  }

  try {
    const retry = await requestJsonCompletion<ImprovePromptResponse>({
      system: improveSystemInstruction,
      user: `${userPrompt}\n\nCRITICAL: Return only valid JSON.`,
    });
    const normalized = normalizeImproveResponse(retry.parsed);
    const savedSessionId = await saveImproveSession({ input, result: normalized, rawResponse: retry.raw });
    return { ...normalized, session_id: savedSessionId ?? undefined };
  } catch (error) {
    console.error("streamImprovePrompt JSON retry failed", { error, fullRaw });
    throw new Error("AI response was invalid, please try again.");
  }
};
