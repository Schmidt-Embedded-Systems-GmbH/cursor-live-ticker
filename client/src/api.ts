import type { StatsResponse, TickerConfig } from './types';

export async function fetchConfig(): Promise<TickerConfig> {
  const res = await fetch('/api/config');
  if (!res.ok) throw new Error(`Config request failed: ${res.status}`);
  return res.json();
}

export async function fetchStats(): Promise<StatsResponse> {
  const res = await fetch('/api/stats');
  if (!res.ok) throw new Error(`Stats request failed: ${res.status}`);
  return res.json();
}
