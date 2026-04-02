/** Lightweight client-side guess for the language pill (debounced in UI). */
export function detectCodeLanguageHeuristic(code: string): string {
  const t = code.trim();
  if (!t) return "";

  if (/\b(jsx|tsx)\b/i.test(t) || /from\s+["']react["']/.test(t) || /<\/?[A-Z][A-Za-z]*/.test(t)) {
    return "React";
  }
  if (t.includes("interface ") && t.includes(": ") && (t.includes("export ") || t.includes("function "))) {
    return "TypeScript";
  }
  if (/^\s*(import|export|const|let|var|function|=>)/m.test(t) && /\.tsx?$/i.test(t) === false) {
    if (/:\s*(string|number|boolean|void|unknown)/m.test(t)) return "TypeScript";
    return "JavaScript";
  }
  if (/^\s*def\s+\w+\s*\(|import\s+\w+|from\s+[\w.]+/.test(t) && /:\s*\n/.test(t) === false) {
    return "Python";
  }
  if (/^\s*(func |var |let |import Swift)/m.test(t) || /struct\s+\w+\s*\{/.test(t)) {
    return "Swift";
  }
  if (/^\s*import\s+['"]package:/m.test(t) || /void\s+main\s*\(\)/m.test(t)) {
    return "Dart";
  }
  if (/^\s*(\.|#|\w+)\s*\{[^}]*\}/m.test(t) && /@media|@keyframes/.test(t)) {
    return "CSS";
  }
  if (/SELECT\s+.+\s+FROM/i.test(t) || /\bINSERT\s+INTO\b/i.test(t)) {
    return "SQL";
  }
  if (/^\s*<\?php/i.test(t)) return "PHP";
  if (/^\s*package\s+\w+/m.test(t) && /func\s+/.test(t)) return "Go";
  return "Code";
}
