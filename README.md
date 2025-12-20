# OmniScribe

Voice-first note taking PWA with AI transcription powered by Gemini. Records audio, transcribes with AI, parses into structured formats (journal entries, to-dos, meeting minutes), and syncs to cloud.

## Features

- **One-tap recording** - Optimized for iOS Safari PWA
- **AI transcription** - Powered by Google Gemini
- **Smart parsing** - Journal, To-Do, Meeting Minutes, or custom parsers
- **Offline-first** - Works without internet, syncs when online
- **Cloud sync** - Supabase for storage, Google Drive backup
- **PWA** - Install on home screen, works like a native app

## Quick Start (Local Development)

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your API keys
npm run dev
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `VITE_SUPABASE_URL` | For cloud | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | For cloud | Supabase anon key |
| `SUPABASE_URL` | For API | Same as VITE_SUPABASE_URL |
| `SUPABASE_SERVICE_KEY` | For API | Supabase service role key |
| `GOOGLE_CLIENT_ID` | For GDrive | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | For GDrive | Google OAuth secret |
| `GOOGLE_REDIRECT_URI` | For GDrive | OAuth callback URL |

## Supabase Setup

1. Create a new Supabase project
2. Run the migration in `supabase/migrations/001_initial.sql`
3. Create a storage bucket named `audio` (private)
4. Copy your project URL and keys to `.env.local`

## Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Set environment variables in Vercel dashboard.

## Google Drive Integration (Optional)

1. Create a Google Cloud project
2. Enable Google Drive API
3. Create OAuth 2.0 credentials (Web application)
4. Set redirect URI to `https://your-app.vercel.app/api/gdrive/auth`
5. Add credentials to environment variables

## Architecture

```
PWA (React) → Vercel API → Supabase (DB + Storage)
                   ↓
              Gemini API (transcription + parsing)
                   ↓
              Google Drive (backup)
```

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Backend**: Vercel Edge Functions
- **Database**: Supabase PostgreSQL
- **Storage**: Supabase Storage
- **AI**: Google Gemini API
- **Build**: Vite
