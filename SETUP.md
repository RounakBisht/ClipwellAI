# Setup checklist (block A)

Kartik owns steps 2–4, Rounak owns steps 1 and 5. Total time: about 30–40 minutes. Never paste keys into the chat; they go only into Supabase and Vercel.

## 1. GitHub (Rounak, 5 min)
1. Rounak creates a new **empty** repository on his **personal** GitHub (no README, no .gitignore), e.g. `clippedai`. Public is easier for judges to open.
2. Repo → Settings → Collaborators → Add people → Kartik's GitHub username. Kartik accepts the email invite.
3. Rounak connects the repo to Claude and pastes `username/clippedai` into the chat. Claude pushes the code to it.

## 2. Supabase (10 min)
1. supabase.com → New project → Region: **Mumbai (ap-south-1)** → set a database password → Create.
2. When it's ready: **SQL Editor → New query →** paste all of `supabase/schema.sql` → **Run**. It should say "Success".
3. **Project Settings → API**: keep the **Project URL** and the **anon public key** handy for Vercel.

## 3. Google sign-in (10–15 min)
1. console.cloud.google.com → create or pick a project.
2. **APIs & Services → OAuth consent screen**: External, app name = the product name, your email as support and developer contact. Scopes: leave the defaults (email, profile). Then click **Publish app** so anyone can sign in, not only test users.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application.**
   - Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback` (Supabase shows this exact URL on its Google provider page).
4. Copy the **Client ID** and **Client secret**.
5. Supabase → **Authentication → Sign In / Providers → Google** → enable, paste the ID and secret → Save.

## 4. API keys (5 min)
- Groq: console.groq.com → API Keys → Create. Free, no card.
- Anthropic: console.anthropic.com → API Keys → Create (uses your credits).

## 5. Vercel (Rounak, 5 min, after Claude has pushed the code)
The repo lives on Rounak's personal GitHub, so Rounak creates the Vercel project from his own Vercel account. Kartik sends him the Supabase URL, anon key, Groq key and Anthropic key privately (WhatsApp, not this chat).
1. vercel.com → Add New → Project → import the GitHub repo (approve Vercel's access to it). Framework: Next.js (auto-detected).
2. **Environment Variables**: add every name from `.env.example` with its value.
3. Deploy. Copy the live domain (e.g. `jhalak-studio.vercel.app`).
4. Back in Supabase → **Authentication → URL Configuration**:
   - Site URL: `https://<your-vercel-domain>`
   - Redirect URLs: add `https://<your-vercel-domain>/**`
5. Open the live URL → Sign in with Google → you should land on the Studio page.

## If Google sign-in stalls
Set `NEXT_PUBLIC_DEMO_MODE=true` in Vercel and redeploy. The studio opens without sign-in and keeps data in the browser, so the build keeps moving. Switch it back to `false` once sign-in works.
