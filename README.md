# Cursor Live Ticker

A kiosk / beamer-friendly **"live ticker"** dashboard that shows your Cursor team's usage in near real time:
- **Tokens** (today + rolling windows)
- **Cost** (from usage events where available)
- **Active users**
- **Top models** (with brand-specific colors for Claude, GPT, Gemini, etc.)
- **Top users podium** (with animated ranking changes)
- **Cache read share**
- **Interactive sparkline** (with Y-axis scale, time labels, and hover tooltips)
- A few fun "team productivity" signals from Cursor's **Daily Usage Data** (acceptance rate, lines added, etc.)

### Live / Daily Toggle

The dashboard has two views:
- **Live** — Real-time metrics with auto-refresh countdown
- **Daily** — Comprehensive daily statistics (code activity, AI suggestions, tab completions, feature usage)

This project is designed to be hosted publicly (e.g. on your company GitHub org) while keeping secrets safe:
✅ Users run it themselves and provide their own `CURSOR_API_KEY` via env vars.  
✅ The key never touches the browser (the Node server proxies requests).

---

## What it uses

It calls the Cursor **Admin API** endpoints (team admin API key required):

- `GET /teams/members`
- `POST /teams/daily-usage-data`
- `POST /teams/spend`
- `POST /teams/filtered-usage-events` (for tokens/cost over short windows)

> Note: Cursor's docs mention that some usage-event data can be **aggregated hourly**; polling more frequently may not always yield newer numbers. This project includes server-side caching so your display can refresh smoothly without hammering the API.

---

## Quickstart (Docker)

1) Create a Cursor **team admin API key**:
- Cursor dashboard → **Settings** → **Cursor Admin API Keys** → create key

2) Copy `.env.example` → `.env` and set:

```bash
CURSOR_API_KEY=key_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Optional:
PORT=4000
TICKER_TIMEZONE=Europe/Berlin
```

3) Run:

```bash
docker compose up --build
```

Open: **http://localhost:4000**

### Docker notes / troubleshooting

- **First build can take a while**: Docker may need to download the Node base image layers the first time, which can look like a "hang".
- **If the build looks stuck**: run a plain-progress build to see where time is going:

```bash
docker compose build --no-cache --progress=plain
```

- **Build context is intentionally small**: this repo includes a `.dockerignore` so `node_modules/`, `dist/`, and `.env*` are not sent into the Docker build context.
- **Tip**: adding a lockfile (e.g. `package-lock.json`) makes Docker installs faster and deterministic.

---

## Quickstart (Node)

Requirements:
- Node.js **18+** (Node 20 recommended)

```bash
npm install
cp .env.example .env
# edit .env
npm run dev
```

- Client dev server: http://localhost:5173
- API server: http://localhost:4000

---

## Configuration

Edit: **`ticker.config.json`**

You can configure:
- How often the **browser** refreshes (`app.refreshIntervalMs`)
- How often the **server** calls Cursor (`data.*.pollIntervalMs`)
- Dashboard widgets and layout (`dashboard.widgets`)

### Available widget types

| Type | Description |
|------|-------------|
| `bigNumber` | Large numeric display (tokens, cost, counts) |
| `gauge` | Percentage with progress bar (accept rate, cache share) |
| `sparkline` | Time-series mini chart with Y-axis scale and hover tooltips |
| `barList` | Ranked list with bars (top models with brand colors) |
| `podium` | Top 3 users podium with animated ranking changes |

After editing config, restart the server.

---

## Privacy

The dashboard displays user activity (top users, top spenders). To avoid "name-and-shame" situations or accidentally leaking emails, configure the `privacy.emailMode` option in `ticker.config.json`:

| Mode | Example Output | Use Case |
|------|----------------|----------|
| `full` | `john.doe@example.com` | Internal team only |
| `masked` | `j***@example.com` | Semi-anonymous |
| `firstNameOnly` | `John` | Friendly, screenshot-safe (default) |
| `initials` | `JD` | Most anonymous |

```json
{
  "privacy": {
    "emailMode": "firstNameOnly"
  }
}
```

---

## Security notes

- This repo intentionally **does not** provide a "front-end only" mode.  
  A browser-only approach would expose your API key to anyone who opens DevTools.
- The server never logs the API key.
- No data is stored on disk by default (in-memory cache only).

---

## Project structure

```
cursor-live-ticker/
  client/           # React + Vite UI
    src/
      components/   # Widget components (BigNumber, Gauge, Sparkline, BarList, Podium, DailyStatsView)
  server/           # Express API proxy + aggregation
  ticker.config.json
  docker-compose.yml
  Dockerfile
  .dockerignore
```

---

## License

MIT. See `LICENSE`.
