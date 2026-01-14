import { DateTime } from 'luxon';
import type { CursorDailyUsageResponse, CursorMembersResponse, CursorSpendResponse, CursorUsageEvent } from './cursorClient';

type TokenAgg = {
  total: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  costCents: number;
};

function num(x: unknown): number {
  if (typeof x === 'number' && Number.isFinite(x)) return x;
  if (typeof x === 'string' && x.trim() !== '' && Number.isFinite(Number(x))) return Number(x);
  return 0;
}

function eventTimestampMs(ev: CursorUsageEvent): number | null {
  const raw = ev.timestamp;

  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;

  if (typeof raw === 'string') {
    // Some responses use epoch milliseconds as a string
    const asNum = Number(raw);
    if (Number.isFinite(asNum) && asNum > 0) return asNum;

    // Fallback: ISO timestamp string
    const asDate = Date.parse(raw);
    if (Number.isFinite(asDate) && asDate > 0) return asDate;
  }

  // Last resort: try coercion
  const t = num(raw);
  return t > 0 ? t : null;
}

function aggregateTokens(events: CursorUsageEvent[]): TokenAgg {
  let input = 0;
  let output = 0;
  let cacheRead = 0;
  let cacheWrite = 0;
  let costCents = 0;

  for (const ev of events) {
    const tu = (ev.tokenUsage ?? {}) as any;
    input += num(tu.inputTokens);
    output += num(tu.outputTokens);
    cacheRead += num(tu.cacheReadTokens);
    cacheWrite += num(tu.cacheWriteTokens);
    costCents += num(tu.totalCents);
  }

  const total = input + output + cacheRead + cacheWrite;
  return { total, input, output, cacheRead, cacheWrite, costCents };
}

function distinctEmails(events: CursorUsageEvent[]): Set<string> {
  const set = new Set<string>();
  for (const ev of events) {
    const email = typeof ev.userEmail === 'string' ? ev.userEmail : undefined;
    if (email) set.add(email);
  }
  return set;
}

export type ComputedStats = {
  tokensToday: TokenAgg;
  tokensLast15m: TokenAgg;
  tokensLast60m: TokenAgg;

  costToday: { cents: number; usd: number };
  costLast60m: { cents: number; usd: number };

  cacheReadShareLast60m: number | null;

  activeUsersLast60m: number;
  activeUsersToday: number;

  topModelsLast60m: { model: string; tokens: number; usd: number; requests: number }[];
  topUsersLast60m: { email: string; tokens: number; requests: number }[];

  tokensPerMinuteLast60m: { minuteStart: number; tokens: number }[];

  // Daily usage aggregates (from /teams/daily-usage-data)
  acceptanceRateToday: number | null;
  linesAddedToday: number | null;
  daily: {
    chatRequests: number;
    composerRequests: number;
    agentRequests: number;
    cmdkUsages: number;
    totalTabsShown: number;
    totalTabsAccepted: number;
    usageBasedReqs: number;
    subscriptionIncludedReqs: number;
    apiKeyReqs: number;
    totalApplies: number;
    totalAccepts: number;
    totalRejects: number;
    totalLinesDeleted: number;
    acceptedLinesAdded: number;
    acceptedLinesDeleted: number;
  };

  // Spend aggregates (from /teams/spend)
  monthToDateSpend: { cents: number; usd: number };
  fastPremiumRequestsMonth: number;
  topSpendersMonth: { email: string; usd: number; cents: number }[];

  team: { members: number };
};

export function computeStats(opts: {
  timezone: string;
  nowMs: number;
  usageEvents: CursorUsageEvent[];
  dailyUsage?: CursorDailyUsageResponse | null;
  spend?: CursorSpendResponse | null;
  members?: CursorMembersResponse | null;
  shortWindowMinutes: number;
  longWindowMinutes: number;
}): ComputedStats {
  const tz = opts.timezone || 'UTC';
  const now = DateTime.fromMillis(opts.nowMs).setZone(tz);

  const startOfToday = now.startOf('day');
  const start15m = now.minus({ minutes: opts.shortWindowMinutes });
  const start60m = now.minus({ minutes: opts.longWindowMinutes });

  const events = opts.usageEvents ?? [];

  const inRange = (ev: CursorUsageEvent, from: DateTime, to: DateTime) => {
    const ts = eventTimestampMs(ev);
    if (ts == null) return false;
    return ts >= from.toMillis() && ts <= to.toMillis();
  };

  const eventsToday = events.filter((e) => inRange(e, startOfToday, now));
  const events15m = events.filter((e) => inRange(e, start15m, now));
  const events60m = events.filter((e) => inRange(e, start60m, now));

  const activeUsersToday = distinctEmails(eventsToday).size;

  const tokensToday = aggregateTokens(eventsToday);
  const tokensLast15m = aggregateTokens(events15m);
  const tokensLast60m = aggregateTokens(events60m);

  const costToday = { cents: tokensToday.costCents, usd: tokensToday.costCents / 100 };
  const costLast60m = { cents: tokensLast60m.costCents, usd: tokensLast60m.costCents / 100 };

  const denom = tokensLast60m.input + tokensLast60m.cacheRead;
  const cacheReadShareLast60m = denom > 0 ? tokensLast60m.cacheRead / denom : null;

  // Top models/users over 60m
  const byModel = new Map<string, { tokens: number; cents: number; requests: number }>();
  const byUser = new Map<string, { tokens: number; requests: number }>();

  for (const ev of events60m) {
    const model = typeof ev.model === 'string' && ev.model.trim() ? ev.model : 'unknown';
    const email = typeof ev.userEmail === 'string' && ev.userEmail.trim() ? ev.userEmail : 'unknown';

    const tu = (ev.tokenUsage ?? {}) as any;
    const t = num(tu.inputTokens) + num(tu.outputTokens) + num(tu.cacheReadTokens) + num(tu.cacheWriteTokens);
    const c = num(tu.totalCents);

    {
      const cur = byModel.get(model) ?? { tokens: 0, cents: 0, requests: 0 };
      cur.tokens += t;
      cur.cents += c;
      cur.requests += 1;
      byModel.set(model, cur);
    }

    {
      const cur = byUser.get(email) ?? { tokens: 0, requests: 0 };
      cur.tokens += t;
      cur.requests += 1;
      byUser.set(email, cur);
    }
  }

  const topModelsLast60m = Array.from(byModel.entries())
    .map(([model, v]) => ({ model, tokens: v.tokens, usd: v.cents / 100, requests: v.requests }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 12);

  const topUsersLast60m = Array.from(byUser.entries())
    .map(([email, v]) => ({ email, tokens: v.tokens, requests: v.requests }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 12);

  const activeUsersLast60m = distinctEmails(events60m).size;

  // Tokens per minute series (last 60m)
  const startMinute = Math.floor(start60m.toMillis() / 60000) * 60000;
  const endMinute = Math.floor(now.toMillis() / 60000) * 60000;

  const buckets = new Map<number, number>();
  for (let t = startMinute; t <= endMinute; t += 60000) buckets.set(t, 0);

  for (const ev of events60m) {
    const ts = eventTimestampMs(ev);
    if (ts == null) continue;
    const bucket = Math.floor(ts / 60000) * 60000;
    if (!buckets.has(bucket)) continue;

    const tu = (ev.tokenUsage ?? {}) as any;
    const t = num(tu.inputTokens) + num(tu.outputTokens) + num(tu.cacheReadTokens) + num(tu.cacheWriteTokens);
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + t);
  }

  const tokensPerMinuteLast60m = Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([minuteStart, tokens]) => ({ minuteStart, tokens }));

  // Daily usage aggregates for "today"
  let acceptanceRateToday: number | null = null;
  let linesAddedToday: number | null = null;

  const daily = {
    chatRequests: 0,
    composerRequests: 0,
    agentRequests: 0,
    cmdkUsages: 0,
    totalTabsShown: 0,
    totalTabsAccepted: 0,
    usageBasedReqs: 0,
    subscriptionIncludedReqs: 0,
    apiKeyReqs: 0,
    totalApplies: 0,
    totalAccepts: 0,
    totalRejects: 0,
    totalLinesDeleted: 0,
    acceptedLinesAdded: 0,
    acceptedLinesDeleted: 0,
  };

  if (opts.dailyUsage?.data?.length) {
    let totalLinesAdded = 0;

    for (const row of opts.dailyUsage.data as any[]) {
      const rowDay = DateTime.fromMillis(num(row.date)).setZone(tz);
      if (!rowDay.isValid) continue;
      if (!rowDay.hasSame(now, 'day')) continue;

      totalLinesAdded += num(row.totalLinesAdded);

      daily.totalLinesDeleted += num(row.totalLinesDeleted);
      daily.acceptedLinesAdded += num(row.acceptedLinesAdded);
      daily.acceptedLinesDeleted += num(row.acceptedLinesDeleted);

      daily.totalApplies += num(row.totalApplies);
      daily.totalAccepts += num(row.totalAccepts);
      daily.totalRejects += num(row.totalRejects);

      daily.totalTabsShown += num(row.totalTabsShown);
      daily.totalTabsAccepted += num(row.totalTabsAccepted);

      daily.composerRequests += num(row.composerRequests);
      daily.chatRequests += num(row.chatRequests);
      daily.agentRequests += num(row.agentRequests);
      daily.cmdkUsages += num(row.cmdkUsages);

      daily.subscriptionIncludedReqs += num(row.subscriptionIncludedReqs);
      daily.apiKeyReqs += num(row.apiKeyReqs);
      daily.usageBasedReqs += num(row.usageBasedReqs);
    }

    const denomAR = daily.totalAccepts + daily.totalRejects;
    acceptanceRateToday = denomAR > 0 ? daily.totalAccepts / denomAR : null;
    linesAddedToday = totalLinesAdded;
  }

  // Spend (current calendar month per API)
  const spendRows = opts.spend?.teamMemberSpend ?? [];
  const monthSpendCents = spendRows.reduce((acc, r: any) => acc + num(r.spendCents), 0);
  const monthToDateSpend = { cents: monthSpendCents, usd: monthSpendCents / 100 };

  const fastPremiumRequestsMonth = spendRows.reduce((acc, r: any) => acc + num(r.fastPremiumRequests), 0);

  const topSpendersMonth = spendRows
    .map((r: any) => ({
      email: String(r.email ?? r.name ?? 'unknown'),
      cents: num(r.spendCents),
      usd: num(r.spendCents) / 100,
    }))
    .sort((a, b) => b.cents - a.cents)
    .slice(0, 12);

  const teamMembersCount = opts.members?.teamMembers?.length ?? 0;

  return {
    tokensToday,
    tokensLast15m,
    tokensLast60m,
    costToday,
    costLast60m,
    cacheReadShareLast60m,
    activeUsersLast60m,
    activeUsersToday,
    topModelsLast60m,
    topUsersLast60m,
    tokensPerMinuteLast60m,
    acceptanceRateToday,
    linesAddedToday,
    daily,
    monthToDateSpend,
    fastPremiumRequestsMonth,
    topSpendersMonth,
    team: { members: teamMembersCount },
  };
}
