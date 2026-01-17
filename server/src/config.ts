import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
// Also try the repo root when running via npm workspaces (cwd may be /server)
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });

const EnvSchema = z.object({
  CURSOR_API_KEY: z.string().min(1),
  PORT: z.coerce.number().int().positive().optional(),
  TICKER_TIMEZONE: z.string().min(1).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

function resolveConfigFile(filename: string): string {
  const candidates = [path.resolve(process.cwd(), filename), path.resolve(process.cwd(), '..', filename)];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error(`Missing ${filename}. Looked in: ${candidates.join(', ')}`);
}

const WidgetSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['bigNumber', 'gauge', 'barList', 'sparkline', 'podium']),
  label: z.string().min(1),
  colSpan: z.number().int().positive(),
  rowSpan: z.number().int().positive(),
}).passthrough();

const TickerConfigSchema = z.object({
  app: z.object({
    title: z.string().default('Cursor Live Ticker'),
    refreshIntervalMs: z.number().int().positive().default(5000),
    timezone: z.string().optional().default('UTC'),
  }),
  privacy: z
    .object({
      // How to display emails/user identifiers
      // - "full": show full email (john.doe@example.com)
      // - "masked": show partial (j***@example.com)
      // - "firstNameOnly": extract first name (John)
      // - "initials": show initials (JD)
      emailMode: z.enum(['full', 'masked', 'firstNameOnly', 'initials']).default('masked'),
    })
    .default({}),
  data: z.object({
    usageEvents: z.object({
      pollIntervalMs: z.number().int().positive().default(60000),
      pageSize: z.number().int().positive().default(500),
      maxPages: z.number().int().positive().default(40),
      shortWindowMinutes: z.number().int().positive().default(15),
      longWindowMinutes: z.number().int().positive().default(60),
    }),
    dailyUsage: z.object({
      pollIntervalMs: z.number().int().positive().default(300000),
      lookbackDays: z.number().int().positive().default(7),
    }),
    spend: z.object({
      pollIntervalMs: z.number().int().positive().default(300000),
      pageSize: z.number().int().positive().default(100),
    }),
    members: z.object({
      pollIntervalMs: z.number().int().positive().default(3600000),
    }),
  }),
  dashboard: z.object({
    columns: z.number().int().positive().default(12),
    gapPx: z.number().int().positive().default(18),
    widgets: z.array(WidgetSchema).default([]),
  }),
});

export type TickerConfig = z.infer<typeof TickerConfigSchema>;

export function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment variables: ${msg}`);
  }
  return parsed.data;
}

export function loadTickerConfig(): TickerConfig {
  const file = resolveConfigFile('ticker.config.json');
  const raw = fs.readFileSync(file, 'utf-8');
  const json = JSON.parse(raw);

  const parsed = TickerConfigSchema.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid ticker.config.json: ${msg}`);
  }
  return parsed.data;
}
