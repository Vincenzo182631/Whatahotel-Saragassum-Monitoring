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

## Notes & next steps

- The admin endpoint (`PATCH /api/admin/beaches/[id]`) has **no auth** yet —
  add authentication/authorization middleware before production.
- Phase 7 roadmap: automated NOAA/USF fetch job, weather/wind/current signals,
  guest photo reports, webcam AI analysis, predictive forecasting.
