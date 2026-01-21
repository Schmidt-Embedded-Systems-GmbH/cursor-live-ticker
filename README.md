# Cursor Live Ticker

A beamer / kiosk-friendly dashboard that visualizes your **Cursor team** usage in near real time.

https://github.com/user-attachments/assets/ca0eb9bf-11d0-4548-a64a-77d118fd57b3

### What you get

- 📊 **Real-time token usage** — see who's using what, right now
- 🏆 **Leaderboards** — top users & spenders with animated podiums
- 📈 **Sparkline charts** — tokens/min over the last 60 minutes
- 🌙 **Dark & light mode** — toggle with one click
- 🔒 **Privacy modes** — mask emails for public displays
- 🐳 **One-command deploy** — Docker or Node, your choice

> **Note:** Not affiliated with Cursor. Uses the [Cursor Teams/Admin API](https://docs.cursor.com).

---

## Quick start (Docker)

1) Create a `.env` file:

```bash
cp .env.example .env
# then edit .env and set CURSOR_API_KEY=...
```

2) (Optional) Tweak `ticker.config.json` (layout, widgets, privacy, polling)

3) Run:

```bash
docker compose up --build
```

Open: `http://localhost:4000`

### LAN note

`docker compose` binds to **localhost only** by default (`127.0.0.1`).  
To expose on your local network (e.g., for a kiosk display), remove the prefix:

```yaml
ports:
  - "${PORT:-4000}:4000"
```

## Run locally (Node)

Requirements: Node 18+ (Node 20 recommended)

```bash
npm install
npm run dev
```

* UI: `http://localhost:5173`
* API: `http://localhost:4000`

Production build:

```bash
npm run build
npm run start
```

Open: `http://localhost:4000`

## Configuration

Edit `ticker.config.json` to change:

* refresh interval (`app.refreshIntervalMs`)
* “today” timezone (`app.timezone`)
* polling windows and page limits (`usageEvents`, `spend`, `dailyUsage`)
* dashboard grid layout + widget list (`dashboard.widgets`)
* privacy mode for user identifiers (`privacy.emailMode`)

### Privacy mode (recommended for beamers)

Set in `ticker.config.json`:

```json
{
  "privacy": { "emailMode": "firstNameOnly" }
}
```

Available values:

* `full`
* `masked`
* `firstNameOnly`
* `initials`

## Security notes (practical)

* The Cursor API key is read from `.env` on the **server** and is never sent to the browser.
* Don’t commit `.env` (it’s in `.gitignore`).
* If you expose the server to your LAN, anyone who can access it can see the dashboard.

## License

MIT
