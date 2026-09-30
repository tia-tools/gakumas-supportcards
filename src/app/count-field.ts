/**
 * The rule of a count field being typed into (./CountField.tsx). The page stores a
 * count only as an override, and emptying a field used to mean "back to the
 * default", which the field then showed again at once: a one-digit count could not
 * be retyped on a phone, where there are no spinner buttons, and a capped count
 * could not be changed at all, since a second digit only went over the cap. So an
 * empty field is now a field being retyped: it stays empty and hands nothing on.
 * Pure.
 */

export interface CountEdit {
  /** What the field shows while it has focus. */
  text: string;
  /** What is handed on as the new count, or null for nothing. */
  commit: string | null;
}

/** An edit of the field to `raw`: empty hands nothing on; a whole number over `max` shows and hands on `max`. */
export function editCount(raw: string, max: number | null): CountEdit {
  if (raw === "") return { text: "", commit: null };
  const n = Number(raw);
  if (max !== null && Number.isInteger(n) && n > max) return { text: String(max), commit: String(max) };
  return { text: raw, commit: raw };
}
