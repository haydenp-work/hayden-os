# HaydenOS

A personal operating system. Tasks, habits, journal, nutrition, goals, and finances in one dashboard, with Claude doing the thinking and a phone-to-cloud capture pipeline so nothing falls through the cracks.

This is the production build. It is the same idea as the V1 you saw in chat, but with a real backend you own, so your data is yours and portable, and capture works from your phone even when your laptop is closed.

## How it is wired

There are four parts, and only the first one is the real source. Everything else is replaceable.

1. Memory layer. A Supabase Postgres database. Every task, habit log, meal, journal entry, goal, note, and account lives here. This is the brain. You own it and can export it any time.
2. Reasoning layer. Claude (Anthropic API). Triages your captures into the right category and priority, estimates meal macros, summarizes journal entries, and reads your whole board to tell you the top 3 things to do.
3. Capture pipeline. A Telegram bot. Send a voice note or text from anywhere, it gets transcribed by Whisper, Claude classifies it, and it lands in the database. The dashboard updates on next load.
4. Front end. A Next.js app on Vercel. The dashboard you look at. You can redesign this any time without touching the memory underneath.

```
Phone (Telegram)  ->  Whisper  ->  Claude (classify)  ->  Supabase
                                                            |
Browser (web app) <-------- Next.js API routes <------------+
                                   |
                                Claude (estimate, summarize, advise)
```

## What you need

- A free Supabase account
- An Anthropic API key (console.anthropic.com)
- A Vercel account (free hobby tier is fine)
- Node 18 or newer for local dev
- Optional: a Telegram account and an OpenAI key (Whisper) for phone voice capture

## Setup, step by step

### 1. Install

```bash
cd hayden-os
npm install
```

### 2. Stand up the database

1. Create a new project at supabase.com.
2. Open the project, go to SQL Editor, paste the entire contents of `supabase/schema.sql`, and run it. This creates every table and seeds a generic set of habits you can edit later.
3. Go to Settings, API. Copy the Project URL and the service_role key (under Project API keys). The service role key is secret, treat it like a password.

### 3. Get a Claude key

1. Go to console.anthropic.com, API Keys, create one.
2. Add a little credit to the account. Triage and estimates use Sonnet and cost a fraction of a cent each.

### 4. Set your environment

Copy `.env.example` to `.env.local` and fill in at minimum:

```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...
APP_PASSWORD=pick-something-strong
AUTH_SECRET=any-long-random-string
```

`APP_PASSWORD` is what you type to unlock the dashboard. `AUTH_SECRET` signs the session, set it once and forget it.

### 5. Run it locally

```bash
npm run dev
```

Open http://localhost:3000, enter your password, and the dashboard loads. Capture, habits, nutrition, journal, goals, and finance all work against your live database now.

### 6. Deploy to Vercel

1. Push the repo to GitHub.
2. In Vercel, New Project, import the repo.
3. Add every variable from your `.env.local` under Settings, Environment Variables.
4. Deploy. You now have a URL like `https://hayden-os.vercel.app`.

Open it on your phone and add it to your home screen. The layout already collapses for mobile.

### 7. Telegram capture (optional but the best part)

1. In Telegram, message @BotFather, send `/newbot`, follow the prompts, and copy the bot token.
2. Add to your Vercel env and redeploy:
   - `TELEGRAM_BOT_TOKEN` the token from BotFather
   - `TELEGRAM_WEBHOOK_SECRET` any random string you make up
   - `TELEGRAM_ALLOWED_CHAT_ID` optional, your own chat id, so only you can post
3. Point the bot at your app. Run this once, swapping in your values:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -d "url=https://YOUR-APP.vercel.app/api/telegram" \
  -d "secret_token=YOUR_TELEGRAM_WEBHOOK_SECRET" \
  -d "allowed_updates=[\"message\"]"
```

Now text the bot "remind me to send the proposal tomorrow morning" and it files a task. To find your chat id, message the bot once, then open `https://api.telegram.org/bot<TOKEN>/getUpdates` and read the `chat.id`.

iPhone tip, same as the video: map the Action button to a Telegram shortcut so one press opens the bot ready to record.

### 8. Voice notes through Telegram (optional)

Claude has no speech model, so voice transcription uses Whisper. Add `OPENAI_API_KEY` to Vercel and redeploy. Now voice notes to the bot get transcribed, then classified by Claude. Without this key, the bot still handles typed messages, and the web app still does voice through the browser.

## How to use it day to day

- Morning. Open the dashboard, go to Tasks, star the 3 to 5 things that matter, then check Home to see them as Key Tasks. Tick off habits as you go.
- All day. When something comes up, type it in the capture bar or send a Telegram voice note. Claude files it. You never sort manually.
- Anytime. Hit "Top 3 right now" on Home and Claude reads everything and tells you where to spend your energy.
- Meals. Type what you ate in Nutrition. Claude estimates calories and protein.
- Night. Open Journal, speak or type how the day went, and save. Claude writes a one-line summary. Over weeks this becomes the memory the AI reasons over.

## Make it yours

- Categories. Edit `lib/categories.js`. These drive triage, the Brain tiles, and task filters.
- Habits. Edit them directly in Supabase (the `habits` and `habit_subtasks` tables) or add an editor UI later.
- Model. Set `CLAUDE_MODEL=claude-opus-4-8` for deeper strategic reads, keep Sonnet for cheap fast triage.
- Design. The whole look lives in the `Style()` block in `components/Dashboard.jsx`. Redesign freely, the memory does not care.

## Why the memory layer is the point

The dashboard is disposable. The value is that your entire life context sits in a database you own. You can query it, export it, or feed it into any model. Ask Claude "based on my last 30 journal entries, what pattern is hurting my productivity" by pulling those rows and handing them over. That is the part you cannot get from a chat window that forgets you.

## Roughly what it costs

- Supabase free tier is plenty for one person.
- Vercel hobby tier is free.
- Anthropic, pennies a day at normal use.
- OpenAI Whisper, only if you use voice, a fraction of a cent per note.

## Next things to build

- Google Calendar feed for a live calendar panel (OAuth, read-only events).
- Google Sheets sync for finance, exactly like the video.
- A habit editor in the UI so you stop touching the database.
- Wearable import (Oura, Whoop) into the Health view.

## Troubleshooting

- Stuck on the login screen. Your `os_session` cookie does not match. Confirm `APP_PASSWORD` and `AUTH_SECRET` are identical in local and Vercel, then log in again.
- Captures land as "Life Admin, medium" every time. Claude is erroring out. Check `ANTHROPIC_API_KEY` and that the account has credit. The app deliberately still files the task so nothing is lost.
- Telegram does nothing. Re-run setWebhook, confirm the URL is your real Vercel domain, and that `TELEGRAM_WEBHOOK_SECRET` matches the env var.
- 401 from the API. The middleware gate is doing its job. Make sure you are logged in, the cookie is set, and you are not calling the API from outside the app.
