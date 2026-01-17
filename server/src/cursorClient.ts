export type CursorTeamMember = {
  name: string;
  email: string;
  role: 'owner' | 'member' | 'free-owner' | string;
};

export type CursorMembersResponse = {
  teamMembers: CursorTeamMember[];
};

export type CursorDailyUsageRow = {
  date: number;
  isActive: boolean;
  totalLinesAdded: number;
  totalLinesDeleted: number;
  acceptedLinesAdded: number;
  acceptedLinesDeleted: number;
  totalApplies: number;
  totalAccepts: number;
  totalRejects: number;
  totalTabsShown: number;
  totalTabsAccepted: number;
  composerRequests: number;
  chatRequests: number;
  agentRequests: number;
  cmdkUsages: number;
  subscriptionIncludedReqs: number;
  apiKeyReqs: number;
  usageBasedReqs: number;
  bugbotUsages: number;
  mostUsedModel: string;
  applyMostUsedExtension?: string;
  tabMostUsedExtension?: string;
  clientVersion?: string;
  email?: string;
};

export type CursorDailyUsageResponse = {
  data: CursorDailyUsageRow[];
  period: { startDate: number; endDate: number };
};

export type CursorSpendRow = {
  spendCents: number;
  fastPremiumRequests: number;
  name: string;
  email: string;
  role: string;
  hardLimitOverrideDollars: number;
};

export type CursorSpendResponse = {
  teamMemberSpend: CursorSpendRow[];
  subscriptionCycleStart: number;
  totalMembers: number;
  totalPages: number;
};

export type CursorUsageEvent = {
  timestamp: string | number;
  model?: string;
  kind?: string;
  maxMode?: boolean;
  userEmail?: string;
  isTokenBasedCall?: boolean;
  usageBasedCosts?: string;
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    totalCents?: number;
  };
  // allow unknown fields
  [k: string]: unknown;
};

export type CursorUsageEventsResponse = {
  totalUsageEventsCount?: number;
  usageEventsDisplay?: CursorUsageEvent[];
  // Some versions may return different keys; keep flexible
  [k: string]: unknown;
};

/** Thrown when rate limited after all retries exhausted */
export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/** Thrown when request times out */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export interface CursorClientOptions {
  apiKey: string;
  baseUrl?: string;
  /** Request timeout in ms (default: 30000) */
  timeoutMs?: number;
  /** Max retries for 429 errors (default: 3) */
  maxRetries?: number;
  /** Base delay for exponential backoff in ms (default: 1000) */
  baseRetryDelayMs?: number;
}

export class CursorAdminClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly baseRetryDelayMs: number;

  /** Track if we're currently rate limited (for UI warnings) */
  public rateLimitedUntil: number | null = null;

  constructor(opts: CursorClientOptions) {
    this.baseUrl = opts.baseUrl ?? 'https://api.cursor.com';
    const token = Buffer.from(`${opts.apiKey}:`).toString('base64');
    this.authHeader = `Basic ${token}`;
    this.timeoutMs = opts.timeoutMs ?? 30000;
    this.maxRetries = opts.maxRetries ?? 3;
    this.baseRetryDelayMs = opts.baseRetryDelayMs ?? 1000;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private parseRetryAfter(header: string | null): number | null {
    if (!header) return null;

    // Retry-After can be seconds or HTTP-date
    const seconds = parseInt(header, 10);
    if (Number.isFinite(seconds) && seconds > 0) {
      return seconds * 1000;
    }

    // Try parsing as HTTP date
    const date = Date.parse(header);
    if (Number.isFinite(date)) {
      return Math.max(0, date - Date.now());
    }

    return null;
  }

  private async requestJson<T>(path: string, init: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const res = await fetch(url, {
          ...init,
          signal: controller.signal,
          headers: {
            Authorization: this.authHeader,
            ...(init.headers ?? {}),
          },
        });

        clearTimeout(timeoutId);

        // Handle rate limiting (429)
        if (res.status === 429) {
          const retryAfterMs = this.parseRetryAfter(res.headers.get('Retry-After'));
          const delayMs = retryAfterMs ?? this.baseRetryDelayMs * Math.pow(2, attempt);

          // Track rate limit for UI
          this.rateLimitedUntil = Date.now() + delayMs;

          if (attempt < this.maxRetries) {
            // eslint-disable-next-line no-console
            console.warn(
              `[cursor-client] Rate limited on ${path}, retrying in ${Math.round(delayMs / 1000)}s (attempt ${attempt + 1}/${this.maxRetries})`,
            );
            await this.sleep(delayMs);
            continue;
          }

          throw new RateLimitError(
            `Rate limited after ${this.maxRetries} retries on ${path}`,
            retryAfterMs ?? undefined,
          );
        }

        // Clear rate limit tracking on success
        this.rateLimitedUntil = null;

        if (!res.ok) {
          const body = await res.text().catch(() => '');
          const snippet = body.length > 400 ? `${body.slice(0, 400)}…` : body;
          throw new Error(`Cursor API ${init.method ?? 'GET'} ${path} failed: ${res.status} ${res.statusText} ${snippet}`);
        }

        return (await res.json()) as T;
      } catch (e: any) {
        clearTimeout(timeoutId);

        // Handle abort (timeout)
        if (e.name === 'AbortError') {
          lastError = new TimeoutError(`Request to ${path} timed out after ${this.timeoutMs}ms`);

          if (attempt < this.maxRetries) {
            // eslint-disable-next-line no-console
            console.warn(
              `[cursor-client] Timeout on ${path}, retrying (attempt ${attempt + 1}/${this.maxRetries})`,
            );
            await this.sleep(this.baseRetryDelayMs * Math.pow(2, attempt));
            continue;
          }

          throw lastError;
        }

        // Re-throw RateLimitError as-is
        if (e instanceof RateLimitError) {
          throw e;
        }

        // For other errors, retry with backoff
        lastError = e;

        if (attempt < this.maxRetries) {
          const delayMs = this.baseRetryDelayMs * Math.pow(2, attempt);
          // eslint-disable-next-line no-console
          console.warn(
            `[cursor-client] Error on ${path}: ${e.message}, retrying in ${Math.round(delayMs / 1000)}s (attempt ${attempt + 1}/${this.maxRetries})`,
          );
          await this.sleep(delayMs);
          continue;
        }

        throw e;
      }
    }

    throw lastError ?? new Error(`Request to ${path} failed after ${this.maxRetries} retries`);
  }

  async getMembers(): Promise<CursorMembersResponse> {
    return this.requestJson<CursorMembersResponse>('/teams/members', { method: 'GET' });
  }

  async getDailyUsageData(params: { startDate: number; endDate: number }): Promise<CursorDailyUsageResponse> {
    return this.requestJson<CursorDailyUsageResponse>('/teams/daily-usage-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  }

  async getSpend(params: {
    searchTerm?: string;
    sortBy?: 'amount' | 'date' | 'user' | string;
    sortDirection?: 'asc' | 'desc' | string;
    page?: number;
    pageSize?: number;
  }): Promise<CursorSpendResponse> {
    return this.requestJson<CursorSpendResponse>('/teams/spend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  }

  async getFilteredUsageEvents(params: {
    startDate?: number;
    endDate?: number;
    email?: string;
    userId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<CursorUsageEventsResponse> {
    return this.requestJson<CursorUsageEventsResponse>('/teams/filtered-usage-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  }
}
