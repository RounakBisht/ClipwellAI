# Setting up ClipwellAI

About 30 minutes end to end. You need free accounts on Supabase, Google Cloud, Groq and Vercel, plus an Anthropic API key.

Keys only ever go into `.env.local` (on your machine) or Vercel's environment variables. Never commit them.

## 1. Supabase (database and sign-in)

1. [supabase.com](https://supabase.com) → **New project**. Pick the region closest to your users and set a database password.
2. **SQL Editor → New query** → paste all of [`supabase/schema.sql`](../supabase/schema.sql) → **Run**. It creates the tables and the row-level security policies, so each user only sees their own data.
3. **Project Settings → API**: copy the **Project URL** and the **anon public** key. (Never use the `service_role` key in this app.)

## 2. Google sign-in

1. [console.cloud.google.com](https://console.cloud.google.com) → create or pick a project.
2. **APIs & Services → OAuth consent screen**: External, add an app name and support email, keep the default scopes (email, profile), then **Publish app** so anyone can sign in.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application.**
   Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback` (Supabase shows the exact URL on its Google provider page).
4. Copy the **Client ID** and **Client secret** into Supabase → **Authentication → Sign In / Providers → Google**, enable it and save.

## 3. AI keys

- **Groq** (transcription): [console.groq.com](https://console.groq.com) → API Keys → Create. The free tier works; it has an hourly audio limit, which the app waits out automatically on long videos.
- **Anthropic** (clip picks and copy): [console.anthropic.com](https://console.anthropic.com) → API Keys → Create.

## 4. Run locally

```bash
npm install
cp .env.example .env.local   # paste the values from steps 1–3
npm run dev                  # http://localhost:3000
```

In Supabase → **Authentication → URL Configuration**, add `http://localhost:3000/**` to the redirect URLs so sign-in works locally.

## 5. Deploy to Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → import your fork of this repo. The framework (Next.js) is detected automatically.
2. **Environment Variables**: add every name from `.env.example` with its value, then deploy.
3. In Supabase → **Authentication → URL Configuration**, set the **Site URL** to your Vercel domain and add `https://<your-domain>/**` to the redirect URLs.
4. Open the live URL → **Sign in with Google** → you should land in the studio.

## Trying it without sign-in

Set `NEXT_PUBLIC_DEMO_MODE=true`. The studio opens without Google sign-in and keeps projects in the browser. The Groq and Anthropic keys are still needed for transcription and AI features.

## Notes

- Uploaded videos are processed in the browser with ffmpeg.wasm (about 30 MB, downloaded once). A laptop with Chrome or Edge gives the fastest exports.
- Vercel's Hobby plan limits request bodies to 4.5 MB, so audio is sent in small 5-minute parts.
