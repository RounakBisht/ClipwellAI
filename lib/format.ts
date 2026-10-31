export function fmtTime(s: number): string {
  if (!isFinite(s)) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? h + ":" : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

export const LANGUAGE_LABEL: Record<string, string> = {
  auto: "Auto-detect",
  en: "English",
  hinglish: "Hinglish (Roman script)",
  hi: "Hindi (Devanagari)",
};
