# Jhalak Studio

A mini editing studio for D2C brand teams: upload a long video, speak a brief, get on-brand YouTube Shorts and Instagram Reels with captions burned in, and a style card that learns from every edit.

Built for the Product Space × Wispr Flow AI Hackathon (31 Oct 2026), by voice.

- **Stack:** Next.js on Vercel, Supabase (Google sign-in + Postgres), ffmpeg.wasm in the browser, Groq Whisper, Claude.
- **Privacy:** the video file never leaves the browser. Only audio chunks and text go to the cloud.
- **Setup:** see [SETUP.md](./SETUP.md). Environment variables are listed in `.env.example`.

## Build modules
| Module | What it adds |
| --- | --- |
| M0 | App skeleton, Google sign-in, database schema, demo mode |
| M1 | Upload, audio extraction in the browser, chunked transcription |
| M2 | MP4 export with 9:16 crop and burned-in captions |
| M3 | Brand setup and style card |
| M4 | Voice brief, clip picks with reasons, 9:16 preview |
| M5 | Shorts and Reels copy, language toggle |
| M6 | Voice edits, versions, rule toggle |
| M7 | Results loop and posting plan |
