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

export class CursorAdminClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor(opts: { apiKey: string; baseUrl?: string }) {
    this.baseUrl = opts.baseUrl ?? 'https://api.cursor.com';
    const token = Buffer.from(`${opts.apiKey}:`).toString('base64');
    this.authHeader = `Basic ${token}`;
  }

  private async requestJson<T>(path: string, init: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: this.authHeader,
        ...(init.headers ?? {}),
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const snippet = body.length > 400 ? `${body.slice(0, 400)}…` : body;
      throw new Error(`Cursor API ${init.method ?? 'GET'} ${path} failed: ${res.status} ${res.statusText} ${snippet}`);
    }

    return (await res.json()) as T;
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
