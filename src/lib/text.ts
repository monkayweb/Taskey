// ---------------------------------------------------------------------------
// Wording helpers. Kept apart from labels.ts because that file pulls in
// icons, and these are needed by code that runs on the server and in scripts.
// ---------------------------------------------------------------------------

/** "Thandi", "Thandi and Devon", "Thandi, Devon and Ayesha". */
export function nameList(names: string[]): string {
  if (names.length === 0) return "nobody";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** For a value that opens a line: relative dates arrive lowercase. */
export const capitalise = (s: string) =>
  s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
