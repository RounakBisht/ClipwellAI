import { APP_NAME } from "@/lib/config";

// Mark: a marigold "clip" tile with a teal play triangle and a cut notch.
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="2" y="2" width="36" height="36" rx="11" fill="#F6A21E" />
      <path d="M2 27 L38 23 L38 29 Q38 38 29 38 L11 38 Q2 38 2 29 Z" fill="#E08A00" opacity="0.55" />
      <path d="M16 12.5 L28.5 20 L16 27.5 Z" fill="#0F766E" stroke="#0F766E" strokeWidth="2.4" strokeLinejoin="round" />
    </svg>
  );
}

export default function Logo({ size = 32, suffix }: { size?: number; suffix?: string }) {
  const base = APP_NAME.replace(/AI$/, "");
  const ai = APP_NAME.endsWith("AI");
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={size} />
      <span className="font-display text-xl font-extrabold tracking-tight text-ink">
        {base}
        {ai && <span className="text-teal-700">AI</span>}
        {suffix && <span className="ml-1.5 font-semibold text-stone-500">{suffix}</span>}
      </span>
    </span>
  );
}
