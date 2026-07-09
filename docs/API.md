# Beach Intelligence API

Base URL: `/api`. All responses are JSON. Errors use
`{ "error": string }` with an appropriate HTTP status.

The risk score is `0–100` (higher = clearer beach). `riskLevel` is one of
`LOW` (90–100), `MODERATE` (60–89), `HIGH` (0–59).

---

## Beaches

### `GET /api/beaches`

Returns all beach conditions.

**Query params**

| Param       | Type   | Description                          |
| ----------- | ------ | ------------------------------------ |
| `country`   | string | Filter by country (case-insensitive) |
| `riskLevel` | enum   | `LOW` \| `MODERATE` \| `HIGH`        |

**200**

```json
{
  "beaches": [
    {
      "id": "clx...",
      "name": "Miami Beach",
      "country": "United States",
      "region": "Florida",
      "latitude": 25.7907,
      "longitude": -80.13,
      "riskScore": 93,
      "riskLevel": "LOW",
      "statusDescription": "Beach conditions currently appear favorable.",
      "source": "USF/NOAA",
      "notes": "Low sargassum presence reported.",
      "lastUpdated": "2026-07-09T12:00:00.000Z",
      "hotelsConnected": 1
    }
  ]
}
```

### `GET /api/beaches/[id]`

Returns a specific beach zone and its connected hotels.

**200** — `{ "beach": BeachZone, "hotels": [{ id, name, slug, city, rating }] }`
**404** — `{ "error": "Beach zone not found." }`

---

## Hotels

### `GET /api/hotels`

Hotel search with Beach Intelligence integration.

**Query params**

| Param       | Type   | Description                                              |
| ----------- | ------ | ------------------------------------------------------- |
| `q`         | string | Free-text match on hotel name / city                    |
| `city`      | string | Filter by city                                          |
| `country`   | string | Filter by country                                       |
| `riskLevel` | enum   | Repeatable: `?riskLevel=LOW&riskLevel=MODERATE`         |
| `minScore`  | int    | Only hotels with beach score ≥ `minScore`               |
| `sort`      | enum   | `beach` (default) \| `price` \| `rating`                |

**200**

```json
{
  "count": 1,
  "hotels": [
    {
      "id": "clx...",
      "name": "Hyatt Ziva Cancun",
      "slug": "hyatt-ziva-cancun",
      "city": "Cancun",
      "country": "Mexico",
      "pricePerNight": 500,
      "rating": 4.8,
      "imageUrl": "https://...",
      "beach": { "zone": "Cancun Hotel Zone", "score": 65, "level": "MODERATE" }
    }
  ]
}
```

### `GET /api/hotels/[id]/beach-condition`

Returns the beach condition for a specific hotel. `[id]` may be the hotel id
**or** its slug.

**200**

```json
{
  "condition": {
    "hotelId": "clx...",
    "hotelName": "Hyatt Ziva Cancun",
    "beachZoneId": "clx...",
    "beachZoneName": "Cancun Hotel Zone",
    "riskScore": 65,
    "riskLevel": "MODERATE",
    "statusDescription": "Possible seasonal sargassum presence.",
    "lastUpdated": "2026-07-09T12:00:00.000Z"
  }
}
```

**404** — hotel not found, or no condition recorded yet.

---

## Chatbot tools (Feature 5)

### `GET /api/chatbot/beach-condition`

Thin HTTP wrapper over the chatbot Beach Intelligence tools.

**Query params**

| Param         | Type    | Description                                     |
| ------------- | ------- | ----------------------------------------------- |
| `destination` | string  | **Required.** Destination / zone name.          |
| `hotels`      | boolean | `true` to also return ranked hotels.            |

**200**

```json
{
  "condition": {
    "destination": "Tulum",
    "matchedZone": "Tulum",
    "riskScore": 42,
    "riskLevel": "HIGH",
    "summary": "Tulum currently has a high risk of sargassum impact (beach score 42/100).",
    "alternatives": [
      { "destination": "Isla Mujeres", "riskScore": 91, "riskLevel": "LOW" },
      { "destination": "Costa Mujeres", "riskScore": 88, "riskLevel": "MODERATE" }
    ]
  }
}
```

The underlying functions `getBeachCondition(destination)` and
`rankHotelsByBeach(destination, limit)` live in `src/lib/chatbot-tools.ts`
and can be registered directly as chatbot tools (definitions exported as
`beachIntelligenceTools`).

---

## Admin (Feature 6)

### `PATCH /api/admin/beaches/[id]`

Manual override of a beach zone's risk. Cascades to every connected hotel's
cached condition.

> ⚠️ No authentication in the MVP — protect this route before production.

**Body**

```json
{
  "riskScore": 80,
  "statusDescription": "Cleared after storm.",
  "source": "Manual override",
  "notes": "Verified with local report."
}
```

`riskLevel` is recomputed from `riskScore` server-side.

**200** — `{ "beach": BeachZone }`
**400** — missing/invalid `riskScore`
**404** — zone not found
