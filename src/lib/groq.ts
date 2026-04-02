import Groq from "groq-sdk";
import { env } from "./env";
import { supabase } from "./supabase";

const GROQ_MODEL = "llama-3.3-70b-versatile";
const REQUEST_LIMIT = 10;
const REQUEST_WINDOW_MS = 60_000;
const requestTimestamps: number[] = [];

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

export interface AnalyzeCodeInput {
  original_code: string;
  error_description: string;
  platform: string;
  user_id: string;
}

export interface AnalyzeCodeResponse {
  fixed_code: string;
  fix_explanation: string;
  bugs_found: string[];
  key_fixes: string[];
  alternative_one_code: string;
  alternative_one_label: string;
  alternative_one_explanation: string;
  alternative_two_code: string;
  alternative_two_label: string;
  alternative_two_explanation: string;
  alternative_three_code: string;
  alternative_three_label: string;
  alternative_three_explanation: string;
  score_readability_before: number;
  score_readability_after: number;
  score_efficiency_before: number;
  score_efficiency_after: number;
  score_structure_before: number;
  score_structure_after: number;
  overall_score_before: number;
  overall_score_after: number;
  language_detected: string;
  complexity_level: ComplexityLevel;
  prevention_tips: string[];
  session_id?: string;
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

const analyzeCodeSystemInstruction = `You are PromptFix Code Analyser, an expert software engineer who specialises in finding bugs, fixing code, and suggesting better approaches.

The user will give you broken, buggy, or poorly written code. Your job is to:
1. Identify every bug and problem in the code
2. Fix the code completely so it works correctly
3. Give three alternative approaches to solving the same problem in different ways
4. Score the original code quality honestly

Return only a valid JSON object with exactly these fields and no other text:

fixed_code: the complete corrected version of the code that works. Include every line, not just the changed parts. The user should be able to copy this and use it immediately.

fix_explanation: 2 to 3 plain English sentences explaining what was broken and what you fixed.

bugs_found: an array of 3 to 6 short strings each describing one specific bug or problem found in the original code.

key_fixes: an array of 3 to 5 short strings each describing one specific change made in the fix.

alternative_one_code: a complete alternative version of the fixed code using a different approach than the main fix. Must be fully working.

alternative_one_label: a short 3 to 4 word label describing the approach, for example "Cleaner Simplified Version" or "Using Modern Syntax" or "Performance Optimised"

alternative_one_explanation: one sentence explaining what makes this alternative different or better.

alternative_two_code: a second complete alternative using yet another different approach.

alternative_two_label: short label for this approach.

alternative_two_explanation: one sentence explanation.

alternative_three_code: a third complete alternative.

alternative_three_label: short label.

alternative_three_explanation: one sentence explanation.

score_readability_before: number 0 to 10 rating how readable and easy to understand the original code was.

score_efficiency_before: number 0 to 10 rating how efficient and performant the original code was.

score_structure_before: number 0 to 10 rating how well structured and organised the original code was.

score_readability_after: same rating for the fixed code.
score_efficiency_after: same for fixed code.
score_structure_after: same for fixed code.

overall_score_before: average of the three before scores rounded to one decimal place.

overall_score_after: average of the three after scores rounded to one decimal place.

language_detected: the programming language or framework detected, for example React, Python, JavaScript, TypeScript, Swift, Dart, CSS, SQL.

complexity_level: one of simple, medium, complex.

prevention_tips: array of 2 to 3 short strings describing how to avoid these bugs in future.

Return only valid JSON. No explanation before or after. No markdown code fences around the JSON.`;

const asStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/\n/).map((s) => s.trim()).filter(Boolean);
  return [];
};

const normalizeComplexity = (value: unknown): ComplexityLevel => {
  const v = String(value ?? "").toLowerCase();
  if (v === "simple" || v === "medium" || v === "complex") return v;
  return "medium";
};

const normalizeAnalyzeCodeResponse = (result: Record<string, unknown>): AnalyzeCodeResponse => {
  const rb = clampScore10(result.score_readability_before);
  const eb = clampScore10(result.score_efficiency_before);
  const sb = clampScore10(result.score_structure_before);
  const ra = Math.max(rb, clampScore10(result.score_readability_after));
  const ea = Math.max(eb, clampScore10(result.score_efficiency_after));
  const sa = Math.max(sb, clampScore10(result.score_structure_after));
  const overallBefore =
    typeof result.overall_score_before === "number" && Number.isFinite(result.overall_score_before)
      ? toOneDecimal(clampScore10(result.overall_score_before))
      : toOneDecimal((rb + eb + sb) / 3);
  const overallAfter =
    typeof result.overall_score_after === "number" && Number.isFinite(result.overall_score_after)
      ? toOneDecimal(clampScore10(result.overall_score_after))
      : toOneDecimal((ra + ea + sa) / 3);

  return {
    fixed_code: String(result.fixed_code ?? "").trim(),
    fix_explanation: String(result.fix_explanation ?? "").trim(),
    bugs_found: asStringArray(result.bugs_found),
    key_fixes: asStringArray(result.key_fixes),
    alternative_one_code: String(result.alternative_one_code ?? "").trim(),
    alternative_one_label: String(result.alternative_one_label ?? "").trim() || "Alternative 1",
    alternative_one_explanation: String(result.alternative_one_explanation ?? "").trim(),
    alternative_two_code: String(result.alternative_two_code ?? "").trim(),
    alternative_two_label: String(result.alternative_two_label ?? "").trim() || "Alternative 2",
    alternative_two_explanation: String(result.alternative_two_explanation ?? "").trim(),
    alternative_three_code: String(result.alternative_three_code ?? "").trim(),
    alternative_three_label: String(result.alternative_three_label ?? "").trim() || "Alternative 3",
    alternative_three_explanation: String(result.alternative_three_explanation ?? "").trim(),
    score_readability_before: rb,
    score_readability_after: ra,
    score_efficiency_before: eb,
    score_efficiency_after: ea,
    score_structure_before: sb,
    score_structure_after: sa,
    overall_score_before: overallBefore,
    overall_score_after: overallAfter,
    language_detected: String(result.language_detected ?? "").trim() || "Unknown",
    complexity_level: normalizeComplexity(result.complexity_level),
    prevention_tips: asStringArray(result.prevention_tips),
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

const insertWithRawFallback = async (
  table: "prompt_sessions" | "code_sessions",
  payload: Record<string, unknown>,
) => {
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

const buildCodeSessionTitle = (language: string, code: string) => {
  const trimmed = code.trim();
  const collapsed = trimmed.replace(/\s+/g, " ");
  const snippet = collapsed.length > 40 ? `${collapsed.slice(0, 40)}…` : collapsed;
  const lang = language.trim() || "Code";
  return trimTitle(`${lang} — ${snippet}`);
};

const saveCodeSession = async ({
  input,
  result,
  rawResponse,
}: {
  input: AnalyzeCodeInput;
  result: AnalyzeCodeResponse;
  rawResponse: string;
}) => {
  const title = buildCodeSessionTitle(result.language_detected, input.original_code);
  const row = await insertWithRawFallback("code_sessions", {
    user_id: input.user_id,
    title,
    original_code: input.original_code.trim(),
    error_description: input.error_description.trim() || null,
    language_detected: result.language_detected,
    platform: input.platform,
    fixed_code: result.fixed_code,
    fix_explanation: result.fix_explanation,
    alternative_one_code: result.alternative_one_code,
    alternative_one_label: result.alternative_one_label,
    alternative_one_explanation: result.alternative_one_explanation,
    alternative_two_code: result.alternative_two_code,
    alternative_two_label: result.alternative_two_label,
    alternative_two_explanation: result.alternative_two_explanation,
    alternative_three_code: result.alternative_three_code,
    alternative_three_label: result.alternative_three_label,
    alternative_three_explanation: result.alternative_three_explanation,
    score_readability_before: result.score_readability_before,
    score_readability_after: result.score_readability_after,
    score_efficiency_before: result.score_efficiency_before,
    score_efficiency_after: result.score_efficiency_after,
    score_structure_before: result.score_structure_before,
    score_structure_after: result.score_structure_after,
    overall_score_before: result.overall_score_before,
    overall_score_after: result.overall_score_after,
    bugs_found: result.bugs_found.join("\n"),
    key_fixes: result.key_fixes.join("\n"),
    prevention_tips: result.prevention_tips.join("\n"),
    complexity_level: result.complexity_level,
    status: "completed",
    raw_response: rawResponse,
  });
  if (row?.id) {
    await updateUserStreak(input.user_id);
  }
  return row?.id ?? null;
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

export const analyzeCode = async (input: AnalyzeCodeInput): Promise<AnalyzeCodeResponse> => {
  enforceRateLimit();
  const userPrompt = [
    `original_code:\n${input.original_code.trim()}`,
    `error_description:\n${input.error_description.trim() || "(none provided)"}`,
    `platform: ${input.platform}`,
  ].join("\n\n");

  try {
    const { parsed, raw } = await requestJsonCompletion<Record<string, unknown>>({
      system: analyzeCodeSystemInstruction,
      user: userPrompt,
    });
    const normalized = normalizeAnalyzeCodeResponse(parsed);
    const sessionId = await saveCodeSession({ input, result: normalized, rawResponse: raw });
    return { ...normalized, session_id: sessionId ?? undefined };
  } catch (error) {
    console.error("analyzeCode failed", { error, input });
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
