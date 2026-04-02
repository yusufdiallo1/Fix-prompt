type PromptMode = "coding" | "vibe";

interface ImproveInput {
  originalPrompt: string;
  platform: string;
  mode: PromptMode;
}

export interface ImproveOutput {
  improvedPrompt: string;
  alternatives: Array<{ style: string; prompt: string }>;
  keyChanges: string[];
  improvementSummary: string;
  needsDebug: boolean;
}

const DEBUG_SIGNALS = ["error", "bug", "broken", "crash", "failing", "doesn't work", "not working", "stack trace"];

export const detectModeFromPrompt = (prompt: string): PromptMode => {
  const lower = prompt.toLowerCase();
  const codingSignals = ["function", "api", "typescript", "react", "code", "refactor", "bug", "debug"];
  return codingSignals.some((s) => lower.includes(s)) ? "coding" : "vibe";
};

export const buildImprovedPrompt = ({ originalPrompt, platform, mode }: ImproveInput): ImproveOutput => {
  const cleaned = originalPrompt.trim();
  const lower = cleaned.toLowerCase();
  const needsDebug = DEBUG_SIGNALS.some((signal) => lower.includes(signal));

  const framing =
    mode === "coding"
      ? "You are a senior software engineer. Produce production-quality, testable code changes."
      : "You are a product-minded creator. Keep the output creative, clear, and user-centered.";

  const improvedPrompt = [
    framing,
    `Target platform: ${platform}.`,
    "",
    "Task:",
    cleaned,
    "",
    "Response requirements:",
    "1) Briefly restate the goal in one sentence.",
    "2) Provide a concrete implementation plan before output.",
    "3) Return the final result only after checking for edge cases.",
    mode === "coding"
      ? "4) Include exact code, imports, and a verification checklist."
      : "4) Keep tone and structure polished with practical detail.",
    "5) If assumptions are required, list them explicitly.",
  ].join("\n");

  const alternatives = [
    {
      style: "Minimal & Fast",
      prompt: `${improvedPrompt}\n\nOptimization: prioritize the fastest possible completion with minimal edits.`,
    },
    {
      style: "Robust & Safe",
      prompt: `${improvedPrompt}\n\nOptimization: prioritize resilience, edge-case coverage, and clear validation steps.`,
    },
    {
      style: "Teaching Style",
      prompt: `${improvedPrompt}\n\nOptimization: explain key decisions briefly so a teammate can learn from the result.`,
    },
  ];

  const keyChanges = [
    "Added explicit output format so the model responds predictably.",
    "Added platform and quality constraints to reduce vague outputs.",
    "Added assumptions + verification requirements before final answer.",
  ];

  const improvementSummary =
    "Your prompt is now clearer about scope, output format, and quality standards, which reduces ambiguity and improves consistency across AI tools.";

  return {
    improvedPrompt,
    alternatives,
    keyChanges,
    improvementSummary,
    needsDebug,
  };
};
