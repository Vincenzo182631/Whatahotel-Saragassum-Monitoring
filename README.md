# WhataHotel Beach Intelligence™

Sargassum risk monitoring for beachfront hotels. Every beachfront hotel gets a
live **Beach Intelligence score (0–100)** so travelers know what to expect
before they book.

> **MVP scope.** Uses **free / public data only** (USF & NOAA sargassum
> monitoring). No paid APIs. Informational only.

## Risk model

The score is **0–100 where a higher score means a clearer beach** (less
sargassum):

| Score   | Level         | Indicator |
| ------- | ------------- | --------- |
| 90–100  | LOW RISK      | 🟢        |
| 60–89   | MODERATE RISK | 🟡        |
| 0–59    | HIGH RISK     | 🔴        |

Risk level is **always derived from the score** (`riskLevelFromScore` in
`src/lib/risk.ts`) so the two can never drift apart.

## Tech stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS**
- **PostgreSQL** + **Prisma ORM**
- Next.js API routes for the backend

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure the database
cp .env.example .env          # then edit DATABASE_URL

# 3. Create the schema and generate the client
npm run db:push               # or: npm run db:migrate
npm run db:generate

# 4. Load sample beach zones + hotels
npm run db:seed

# 5. Run
npm run dev                   # http://localhost:3000
```

## What's included (by phase / feature)

| Feature | Where |
| ------- | ----- |
| **Database** — `BeachZone`, `Hotel`, `HotelBeachCondition` | `prisma/schema.prisma` |
| **Risk scoring** | `src/lib/risk.ts` |
| **Beach Intelligence API** | `src/app/api/beaches`, `src/app/api/hotels/[id]/beach-condition` |
| **Hotel integration component** | `src/components/BeachIntelligence.tsx`, `src/app/hotels/[slug]` |
| **Search + filters** | `src/app/api/hotels/route.ts`, `src/app/search` |
| **Chatbot tools** | `src/lib/chatbot-tools.ts`, `src/app/api/chatbot/beach-condition` |
| **Admin dashboard** | `src/app/admin/beaches`, `src/app/api/admin/beaches/[id]` |
| **Data import service** | `src/lib/beach-data-service.ts`, `src/data/*.json` |
| **Automated update job (Phase 2)** | `src/lib/beach-update-job.ts`, `src/lib/providers/*`, `src/app/api/cron/update-beaches` |

## Pages

- `/` — overview + monitored beach zones
- `/search` — hotel search with Beach Intelligence filters & sorting
- `/hotels/[slug]` — hotel page with the Beach Intelligence card
- `/admin/beaches` — internal monitoring dashboard with manual overrides

## API

See [`docs/API.md`](docs/API.md) for the full endpoint reference.

## Data import (Feature 7)

`BeachDataService` is the single ingestion point. For the MVP it reads
manually-curated JSON (`src/data/beach-zones.json`). Records take the shape:

```json
{ "destination": "Cancun Hotel Zone", "riskScore": 75, "riskLevel": "MODERATE" }
```

The service is structured so future providers (a NOAA/USF fetcher on a 12-hour
schedule, tourism feeds, user reports) can be added behind the same
`importRecords` contract without changing callers. `riskLevel` is recomputed
from `riskScore` on import, so it can be omitted.

## Automated data collection (Phase 2)

The update pipeline runs **every 12 hours**:

```
Fetch Data → Analyze Report → Assign Risk Score → Update Database → Update Hotels
```

- **Orchestrator:** `runBeachUpdate()` in `src/lib/beach-update-job.ts` tries
  each enabled provider in priority order and imports the first non-empty
  result through `BeachDataService` (which recomputes risk levels and cascades
  to every connected hotel).
- **Providers** (`src/lib/providers/`) implement a single `SargassumProvider`
  interface, so new sources drop in without touching callers. They run in
  priority order:
  1. `FeedSargassumProvider` — optional custom JSON feed (`SARGASSUM_FEED_URL`);
     accepts a `riskScore` (0–100) or a raw `densityIndex` (0–1). Overrides the
     others when set.
  2. `UsfNoaaAfaiProvider` — **the real, free data source (on by default).**
     Queries NOAA/AOML's CoastWatch ERDDAP for the 7-day cumulative **USF AFAI**
     (Alternative Floating Algae Index) satellite product, samples a box around
     each beach, takes the median AFAI over valid ocean pixels, and maps it to a
     0–100 score (`src/lib/analysis/afai.ts`). Disable with
     `SARGASSUM_AFAI_ENABLED=false`.
  3. `SeasonalModelProvider` — deterministic seasonal estimate from latitude +
     month; opt-in last resort (`SARGASSUM_USE_SEASONAL_MODEL=true`).
- If no provider is enabled, the job **safely no-ops** (`status: "skipped"`) —
  it never invents data.

**AFAI → score.** AFAI is a satellite reflectance index (higher = more floating
sargassum). The `AFAI_CLEAR` / `AFAI_HEAVY` thresholds in
`src/lib/analysis/afai.ts` calibrate the raw index to a consumer clarity score
and can be tuned as ground-truth improves. Data credit: USF Optical
Oceanography Lab (Chuanmin Hu) via NOAA/AOML CoastWatch — free for use, not for
legal/navigational use.

**Scheduling** — two free options, pick one:

- **Vercel Cron** (`vercel.json`) hits `/api/cron/update-beaches` on
  `0 */12 * * *`. Set `CRON_SECRET`; Vercel sends it as a bearer token.
  (Vercel's Hobby plan runs crons at most daily; Pro honors the 12h schedule.)
- **GitHub Actions** (`.github/workflows/update-beaches.yml`) curls the endpoint
  every 12h. Set repo secrets `APP_URL` and `CRON_SECRET`.

Run it manually:

```bash
npm run beaches:update              # use configured providers (AFAI by default)
npm run beaches:update -- --afai       # force the USF/NOAA satellite provider
npm run beaches:update -- --seasonal   # force the seasonal estimator
```

## Admin authentication

The admin area (`/admin/*` pages and `/api/admin/*` routes) is gated by
`src/middleware.ts`, which requires a signed admin session cookie
(`src/lib/auth.ts` — HMAC-SHA256, no external deps).

```bash
# .env
ADMIN_PASSWORD="choose-a-strong-password"
ADMIN_SESSION_SECRET="$(openssl rand -base64 32)"
```

Sign in at `/admin/login`. When these vars are **unset**, the admin area is
open in development but **locked in production** (fail-closed). Sessions last
8 hours; log out from the dashboard header.

## Notes & next steps

- Phase 7 roadmap: weather/wind/current signals, guest photo reports, webcam AI
  analysis, predictive forecasting.
- Consider per-user accounts/roles if more than one admin is needed (the MVP
  uses a single shared password).
