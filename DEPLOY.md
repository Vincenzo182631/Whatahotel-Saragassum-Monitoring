# Deploying Beach Intelligence

This is the one-time runbook to take Beach Intelligence live and connect it to
the WhataHotel chatbot. It targets **Vercel + a serverless Postgres** (matches
the whatahotel app), but any Node host + Postgres works.

## Overview

```
1. Provision Postgres            → DATABASE_URL
2. Deploy this app to Vercel     → https://<your-app>.vercel.app
3. Create the schema + seed data → tables + 11 zones / 12 hotels
4. Set env vars (secrets, cron)  → CRON_SECRET, AFAI on
5. Point the chatbot at it       → BEACH_INTELLIGENCE_URL in whatahotel
6. Verify end-to-end
```

## 1. Provision Postgres

Pick one (all have free tiers):

- **Vercel Postgres** — Vercel dashboard → Storage → Create → Postgres. It sets
  `DATABASE_URL` (and friends) on the project automatically.
- **Neon** (https://neon.tech) or **Supabase** — create a database, copy the
  connection string (include `?sslmode=require`).

You need one value: **`DATABASE_URL`** =
`postgresql://USER:PASSWORD@HOST:5432/DB?schema=public`.

## 2. Deploy to Vercel

- New Project → import `Vincenzo182631/Whatahotel-Saragassum-Monitoring`.
- Framework preset: **Next.js** (auto-detected). No build overrides needed —
  `npm run build` runs `prisma generate && next build`.
- Add the env var `DATABASE_URL` (if not auto-added by Vercel Postgres).
- Deploy. You'll get a URL like `https://beach-intelligence.vercel.app`.

> CLI alternative: `npm i -g vercel && vercel && vercel --prod`.

## 3. Create the schema + seed

Run once, locally, pointed at the **production** `DATABASE_URL`:

```bash
# from the repo root, with prod DATABASE_URL exported
npm ci
DATABASE_URL="<prod url>" npm run db:push     # create tables
DATABASE_URL="<prod url>" npm run db:seed     # 11 zones + 12 hotels
```

`db:push` is fine for the MVP. To switch to versioned migrations later:
`prisma migrate dev --name init` (commit the migration), then
`prisma migrate deploy` in CI/deploy.

## 4. Environment variables (Vercel → Settings → Environment Variables)

| Var | Value | Why |
| --- | --- | --- |
| `DATABASE_URL` | Postgres connection string | Required |
| `CRON_SECRET` | `openssl rand -base64 32` | Protects `/api/cron/update-beaches` |
| `SARGASSUM_AFAI_ENABLED` | `true` (default) | Real USF/NOAA satellite feed |
| `ADMIN_PASSWORD` | a strong password | Admin dashboard login |
| `ADMIN_SESSION_SECRET` | `openssl rand -base64 32` | Signs admin sessions |

Redeploy after setting them. The `vercel.json` cron then refreshes conditions
every 12h automatically (Vercel Cron sends `CRON_SECRET` as a bearer token).
On Vercel Hobby, cron runs at most daily — Pro honors the 12h schedule; the
GitHub Actions fallback (`.github/workflows/update-beaches.yml`) also works.

Kick a first refresh manually (optional — the seed already has data):

```bash
curl -X POST https://<your-app>.vercel.app/api/cron/update-beaches \
  -H "Authorization: Bearer <CRON_SECRET>"
```

## 5. Connect the WhataHotel chatbot

In the **whatahotel** project (Vercel → Settings → Environment Variables):

```
BEACH_INTELLIGENCE_URL = https://<your-app>.vercel.app
```

Redeploy whatahotel. (This is the switch: until it's set, the chatbot has no
sargassum knowledge; once set, the three advisors gain it.) Requires the
whatahotel PR `claude/beach-intelligence-chatbot` to be merged first.

## 6. Verify end-to-end

```bash
# Beach Intelligence API returns data
curl "https://<your-app>.vercel.app/api/chatbot/beach-condition?destination=Tulum"
# → { "condition": { "riskLevel": "...", "riskScore": ..., "summary": "...", ... } }

# The chatbot uses it — in the whatahotel app, ask the advisor:
#   "Should I book Tulum? Is there seaweed right now?"
# It should mention current sargassum conditions and clearer nearby zones.
```

If the API returns data but the chatbot doesn't mention it, check that
`BEACH_INTELLIGENCE_URL` is set in whatahotel's **runtime** env (not just build)
and that the app was redeployed.
