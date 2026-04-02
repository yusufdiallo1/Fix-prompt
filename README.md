# FixPrompt

FixPrompt is a React + TypeScript + Vite web app with Tailwind CSS and Supabase authentication/database.

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- Supabase (Auth + Postgres)
- Vercel deployment

## Project Structure

- `src/components` reusable UI pieces
- `src/pages` app screens/routes
- `src/hooks` reusable logic
- `src/lib` Supabase and shared client utilities
- `src/types` data definitions
- `supabase/schema.sql` database schema, RLS policies, and signup trigger

## Environment Variables

Create `.env` from `.env.example`:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
GROQ_API_KEY=...
```

## Supabase Setup

1. Create a new Supabase project.
2. In SQL editor, run `supabase/schema.sql`.
3. In Auth > Providers:
   - Enable Email provider (email/password).
   - Enable Google provider and set OAuth credentials.
4. In Auth > URL Configuration:
   - Add local URL (for example `http://localhost:5173`).
   - Add deployed URL (your Vercel domain).

When a user signs up, `handle_new_user` trigger auto-creates rows in:
- `users_profiles`
- `user_stats`

## Run Locally

```bash
npm install
npm run dev
```

## Deploy to Vercel

1. Import this repo into Vercel.
2. Add the three environment variables in Vercel project settings.
3. Deploy.

`vercel.json` includes a rewrite so SPA routes like `/sessions/:id` resolve correctly.
