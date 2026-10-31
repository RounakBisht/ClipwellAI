// One place to rename the product. Set NEXT_PUBLIC_APP_NAME in Vercel to override.
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Jhalak";
export const APP_TAGLINE = "Long videos in, on-brand Shorts and Reels out";

// When "true", the studio works without Google sign-in and keeps data in this browser only.
// Use it if Google sign-in setup stalls, so the build keeps moving.
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
export const SUPABASE_READY = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
