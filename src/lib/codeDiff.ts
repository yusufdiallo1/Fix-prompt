/** Simple line-aligned diff for side-by-side compare view. */
export function lineDiffMeta(original: string, fixed: string) {
  const oLines = original.split("\n");
  const fLines = fixed.split("\n");
  const n = Math.max(oLines.length, fLines.length);
  const originalHighlight: boolean[] = [];
  const fixedHighlight: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const ol = oLines[i] ?? "";
    const fl = fLines[i] ?? "";
    const changed = ol !== fl;
    originalHighlight.push(changed);
    fixedHighlight.push(changed);
  }
  return { oLines, fLines, originalHighlight, fixedHighlight };
}
