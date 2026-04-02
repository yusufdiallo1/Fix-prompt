export interface ExportSessionAlternative {
  style: string;
  prompt: string;
}

export interface ExportSessionData {
  dateLabel: string;
  platform: string;
  promptType: string;
  originalPrompt: string;
  improvedPrompt: string;
  scoreBefore: string;
  scoreAfter: string;
  keyChanges: string[];
  alternatives: ExportSessionAlternative[];
}

const cleanList = (items: string[]) => items.filter((item) => item.trim().length > 0);

const buildAlternativesPlain = (alternatives: ExportSessionAlternative[]) => {
  if (!alternatives.length) return "No alternatives generated.";
  return alternatives
    .map((alt, index) => {
      const style = alt.style.trim() || `Alternative ${index + 1}`;
      return `### Alternative ${index + 1} - ${style}\n${alt.prompt.trim()}`;
    })
    .join("\n\n");
};

const buildAlternativesNotes = (alternatives: ExportSessionAlternative[]) => {
  if (!alternatives.length) return "- No alternatives generated.";
  return alternatives
    .map((alt, index) => {
      const style = alt.style.trim() || `Alternative ${index + 1}`;
      return [
        `- Alternative ${index + 1} - ${style}`,
        alt.prompt.trim(),
      ].join("\n");
    })
    .join("\n\n");
};

const buildAlternativesMarkdown = (alternatives: ExportSessionAlternative[]) => {
  if (!alternatives.length) return "No alternatives generated.";
  return alternatives
    .map((alt, index) => {
      const style = alt.style.trim() || `Alternative ${index + 1}`;
      return `### Alternative ${index + 1} - ${style}\n\`\`\`\n${alt.prompt.trim()}\n\`\`\``;
    })
    .join("\n\n");
};

export const formatSessionForNotion = (session: ExportSessionData) => {
  const keyChanges = cleanList(session.keyChanges);
  const keyChangesText = keyChanges.length ? keyChanges.map((item) => `- ${item}`).join("\n") : "- No key changes listed";

  return [
    `# PromptFix Session - ${session.dateLabel}`,
    `Platform: ${session.platform}`,
    `Prompt Type: ${session.promptType}`,
    "",
    "## Original Prompt",
    session.originalPrompt.trim() || "(empty)",
    `Score: ${session.scoreBefore} / 10`,
    "",
    "## Improved Prompt",
    session.improvedPrompt.trim() || "(empty)",
    `Score: ${session.scoreAfter} / 10`,
    "",
    "## What Changed",
    keyChangesText,
    "",
    "## Alternatives",
    buildAlternativesPlain(session.alternatives),
  ].join("\n");
};

export const formatSessionForNotes = (session: ExportSessionData) => {
  const keyChanges = cleanList(session.keyChanges);
  const keyChangesText = keyChanges.length ? keyChanges.map((item) => `- ${item}`).join("\n") : "- No key changes listed";

  return [
    `PromptFix Session - ${session.dateLabel}`,
    `Platform: ${session.platform}`,
    `Prompt Type: ${session.promptType}`,
    "",
    "- Original Prompt",
    session.originalPrompt.trim() || "(empty)",
    `Score: ${session.scoreBefore} / 10`,
    "",
    "- Improved Prompt",
    session.improvedPrompt.trim() || "(empty)",
    `Score: ${session.scoreAfter} / 10`,
    "",
    "- What Changed",
    keyChangesText,
    "",
    "- Alternatives",
    buildAlternativesNotes(session.alternatives),
  ].join("\n");
};

export const formatSessionForMarkdown = (session: ExportSessionData) => {
  const keyChanges = cleanList(session.keyChanges);
  const keyChangesText = keyChanges.length ? keyChanges.map((item) => `- ${item}`).join("\n") : "- No key changes listed";

  return [
    `# PromptFix Session - ${session.dateLabel}`,
    `Platform: ${session.platform}`,
    `Prompt Type: ${session.promptType}`,
    "",
    "## Original Prompt",
    "```",
    session.originalPrompt.trim() || "(empty)",
    "```",
    `Score: ${session.scoreBefore} / 10`,
    "",
    "## Improved Prompt",
    "```",
    session.improvedPrompt.trim() || "(empty)",
    "```",
    `Score: ${session.scoreAfter} / 10`,
    "",
    "## What Changed",
    keyChangesText,
    "",
    "## Alternatives",
    buildAlternativesMarkdown(session.alternatives),
  ].join("\n");
};

export const downloadSessionAsTxt = (content: string, dateToken: string) => {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `promptfix-session-${dateToken}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
