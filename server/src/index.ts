import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { DateTime } from 'luxon';

import { loadEnv, loadTickerConfig, TickerConfig } from './config';
import { CursorAdminClient, RateLimitError, TimeoutError } from './cursorClient';
import { AsyncCache } from './cache';
import { computeStats, ComputedStats } from './stats';

type EmailMode = TickerConfig['privacy']['emailMode'];

/**
 * Transform an email based on the privacy mode
 */
function transformEmail(email: string, mode: EmailMode): string {
  if (!email || typeof email !== 'string') return 'Anonymous';

  const atIndex = email.indexOf('@');
  const localPart = atIndex > 0 ? email.slice(0, atIndex) : email;
  const domain = atIndex > 0 ? email.slice(atIndex) : '';

  switch (mode) {
    case 'full':
      return email;

    case 'masked': {
      if (localPart.length <= 1) return `${localPart}***${domain}`;
      return `${localPart[0]}***${domain}`;
    }

    case 'firstNameOnly': {
      // Try to extract first name from email (e.g., john.doe@ -> John)
      const namePart = localPart.split(/[._-]/)[0] ?? localPart;
      if (!namePart) return 'User';
      return namePart.charAt(0).toUpperCase() + namePart.slice(1).toLowerCase();
    }

    case 'initials': {
      // Try to extract initials (e.g., john.doe@ -> JD)
      const parts = localPart.split(/[._-]/).filter(Boolean);
      if (parts.length === 0) return '??';
      const initials = parts.map((p) => p.charAt(0).toUpperCase()).join('');
      return initials.slice(0, 2) || '??';
    }

    default:
      return email;
  }
}

/**
 * Apply privacy transformation to stats
 */
function applyPrivacy(stats: ComputedStats, mode: EmailMode): ComputedStats {
  return {
    ...stats,
    topUsersLast60m: stats.topUsersLast60m.map((u) => ({
      ...u,
      email: transformEmail(u.email, mode),
    })),
    topSpendersMonth: stats.topSpendersMonth.map((s) => ({
      ...s,
      email: transformEmail(s.email, mode),
    })),
  };
}

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

      const rawStats = computeStats({
        timezone,
        nowMs,
        usageEvents: usage.value,
        dailyUsage: daily.value,
        spend: spend.value,
        members: members.value,
        shortWindowMinutes: tickerConfig.data.usageEvents.shortWindowMinutes,
        longWindowMinutes: tickerConfig.data.usageEvents.longWindowMinutes,
      });

      // Apply privacy transformation based on config
      const stats = applyPrivacy(rawStats, tickerConfig.privacy.emailMode);

      // Check for rate limit warnings
      const warnings: string[] = [];
      if (client.rateLimitedUntil && client.rateLimitedUntil > nowMs) {
        const secondsLeft = Math.ceil((client.rateLimitedUntil - nowMs) / 1000);
        warnings.push(`Rate limited by Cursor API (retry in ${secondsLeft}s)`);
      }

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
        warnings: warnings.length > 0 ? warnings : undefined,
      });
    } catch (e: any) {
      // Provide specific error messages for known error types
      let errorMessage = e?.message ?? String(e);
      let statusCode = 500;

      if (e instanceof RateLimitError) {
        errorMessage = 'Cursor API rate limit exceeded. Data may be stale. Please wait before refreshing.';
        statusCode = 429;
      } else if (e instanceof TimeoutError) {
        errorMessage = 'Cursor API request timed out. The API may be slow or unavailable.';
        statusCode = 504;
      }

      res.status(statusCode).json({
        error: errorMessage,
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
