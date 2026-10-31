import { APP_NAME } from "@/lib/config";

// Mark: three fanned reels (ink, teal, marigold) with a white C on the front reel.
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="22" y="8" width="20" height="36" rx="5" fill="#17262A" transform="rotate(-16 32 56)" />
      <rect x="22" y="8" width="20" height="36" rx="5" fill="#0F766E" transform="rotate(16 32 56)" />
      <rect x="21" y="9" width="22" height="38" rx="5.5" fill="#F6A21E" />
      <path d="M37 22.5 A7 7 0 1 0 37 33.5" fill="none" stroke="#FFFFFF" strokeWidth="3.6" strokeLinecap="round" />
    </svg>
  );
}

export default function Logo({ size = 32, suffix }: { size?: number; suffix?: string }) {
  const base = APP_NAME.replace(/AI$/, "");
  const ai = APP_NAME.endsWith("AI");
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={size} />
      <span className="font-display text-xl font-bold tracking-tight text-ink">
        {base}
        {ai && <span className="text-teal-700">AI</span>}
        {suffix && <span className="ml-1.5 hidden font-semibold text-stone-500 sm:inline">{suffix}</span>}
      </span>
    </span>
  );
}
