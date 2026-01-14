import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { DateTime } from 'luxon';

import { loadEnv, loadTickerConfig } from './config';
import { CursorAdminClient } from './cursorClient';
import { AsyncCache } from './cache';
import { computeStats } from './stats';

function extractUsageEvents(resp: any): any[] {
  if (!resp || typeof resp !== 'object') return [];
  if (Array.isArray(resp.usageEventsDisplay)) return resp.usageEventsDisplay;
  if (Array.isArray(resp.usageEvents)) return resp.usageEvents;
  if (Array.isArray(resp.data)) return resp.data;
  return [];
}

async function fetchAllUsageEvents(opts: {
  client: CursorAdminClient;
  startDate: number;
  endDate: number;
  pageSize: number;
  maxPages: number;
}): Promise<any[]> {
  const all: any[] = [];
  for (let page = 1; page <= opts.maxPages; page++) {
    const resp = await opts.client.getFilteredUsageEvents({
      startDate: opts.startDate,
      endDate: opts.endDate,
      page,
      pageSize: opts.pageSize,
    });

    const events = extractUsageEvents(resp);
    all.push(...events);

    if (events.length < opts.pageSize) break;
  }
  return all;
}

async function fetchAllSpend(opts: {
  client: CursorAdminClient;
  pageSize: number;
}): Promise<any> {
  const first = await opts.client.getSpend({ page: 1, pageSize: opts.pageSize, sortBy: 'amount', sortDirection: 'desc' });
  const totalPages = Number((first as any).totalPages ?? 1);

  if (!Number.isFinite(totalPages) || totalPages <= 1) return first;

  const rows = [...((first as any).teamMemberSpend ?? [])];

  for (let page = 2; page <= totalPages; page++) {
    const r = await opts.client.getSpend({ page, pageSize: opts.pageSize, sortBy: 'amount', sortDirection: 'desc' });
    rows.push(...((r as any).teamMemberSpend ?? []));
  }

  return { ...first, teamMemberSpend: rows };
}

async function main() {
  const env = loadEnv();
  const tickerConfig = loadTickerConfig();

  const timezone = env.TICKER_TIMEZONE ?? tickerConfig.app.timezone ?? 'UTC';
  const port = env.PORT ?? Number(process.env.PORT) ?? 4000;

  const client = new CursorAdminClient({ apiKey: env.CURSOR_API_KEY });
  const cache = new AsyncCache();

  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, now: Date.now() });
  });

  app.get('/api/config', (_req, res) => {
    res.json({
      app: {
        ...tickerConfig.app,
        timezone,
      },
      dashboard: tickerConfig.dashboard,
    });
  });

  app.get('/api/stats', async (_req, res) => {
    try {
      const nowMs = Date.now();
      const now = DateTime.fromMillis(nowMs).setZone(timezone);

      const startOfTodayMs = now.startOf('day').toMillis();

      const usageKey = `usageEvents:${startOfTodayMs}`;
      const usage = await cache.get(
        usageKey,
        tickerConfig.data.usageEvents.pollIntervalMs,
        async () =>
          fetchAllUsageEvents({
            client,
            startDate: startOfTodayMs,
            endDate: nowMs,
            pageSize: tickerConfig.data.usageEvents.pageSize,
            maxPages: tickerConfig.data.usageEvents.maxPages,
          }),
      );

      const dailyStart = now.minus({ days: tickerConfig.data.dailyUsage.lookbackDays }).startOf('day').toMillis();
      const dailyEnd = now.endOf('day').toMillis();
      const dailyKey = `dailyUsage:${dailyStart}:${dailyEnd}`;
      const daily = await cache.get(dailyKey, tickerConfig.data.dailyUsage.pollIntervalMs, async () =>
        client.getDailyUsageData({ startDate: dailyStart, endDate: dailyEnd }),
      );

      const spendKey = `spend:${now.toFormat('yyyy-MM')}`;
      const spend = await cache.get(spendKey, tickerConfig.data.spend.pollIntervalMs, async () =>
        fetchAllSpend({ client, pageSize: tickerConfig.data.spend.pageSize }),
      );

      const members = await cache.get('members', tickerConfig.data.members.pollIntervalMs, async () => client.getMembers());

      const stats = computeStats({
        timezone,
        nowMs,
        usageEvents: usage.value,
        dailyUsage: daily.value,
        spend: spend.value,
        members: members.value,
        shortWindowMinutes: tickerConfig.data.usageEvents.shortWindowMinutes,
        longWindowMinutes: tickerConfig.data.usageEvents.longWindowMinutes,
      });

      res.json({
        generatedAt: nowMs,
        timezone,
        stats,
        sources: {
          usageEvents: { fetchedAt: usage.fetchedAt, count: usage.value.length },
          dailyUsage: { fetchedAt: daily.fetchedAt, rows: (daily.value as any)?.data?.length ?? 0 },
          spend: { fetchedAt: spend.fetchedAt, rows: (spend.value as any)?.teamMemberSpend?.length ?? 0 },
          members: { fetchedAt: members.fetchedAt, rows: (members.value as any)?.teamMembers?.length ?? 0 },
        },
      });
    } catch (e: any) {
      res.status(500).json({
        error: e?.message ?? String(e),
      });
    }
  });

  // Static UI (only if built)
  const clientDist = path.resolve(__dirname, '../../dist/client');
  const hasStatic = fs.existsSync(path.join(clientDist, 'index.html'));

  if (hasStatic) {
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[cursor-live-ticker] listening on http://localhost:${port} (tz=${timezone})`);
  });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
