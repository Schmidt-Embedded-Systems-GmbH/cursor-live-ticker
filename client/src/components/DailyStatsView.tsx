import { getByPath } from '../utils/get';
import { formatValue } from '../utils/format';

type StatCardProps = {
  label: string;
  value: number | null;
  format?: 'integer' | 'compact' | 'percent';
  icon?: string;
  description?: string;
};

function StatCard({ label, value, format = 'integer', icon, description }: StatCardProps) {
  const displayValue = value != null ? formatValue(value, format) : '—';
  
  return (
    <div className="dailyStat">
      <div className="dailyStat__header">
        {icon && <span className="dailyStat__icon">{icon}</span>}
        <span className="dailyStat__label">{label}</span>
      </div>
      <div className="dailyStat__value">{displayValue}</div>
      {description && <div className="dailyStat__desc">{description}</div>}
    </div>
  );
}

function StatSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="dailySection">
      <h3 className="dailySection__title">{title}</h3>
      <div className="dailySection__grid">{children}</div>
    </div>
  );
}

export default function DailyStatsView({ stats }: { stats: Record<string, unknown> }) {
  // Extract daily stats
  const daily = (getByPath(stats, 'daily') ?? {}) as Record<string, number>;
  
  const linesAddedToday = getByPath(stats, 'linesAddedToday') as number | null;
  const acceptanceRateToday = getByPath(stats, 'acceptanceRateToday') as number | null;
  
  // Calculate some derived stats
  const tabAcceptRate = daily.totalTabsShown > 0 
    ? daily.totalTabsAccepted / daily.totalTabsShown 
    : null;
  
  const applyAcceptRate = (daily.totalAccepts + daily.totalRejects) > 0
    ? daily.totalAccepts / (daily.totalAccepts + daily.totalRejects)
    : null;

  return (
    <main className="dailyView">
      <StatSection title="Code Activity">
        <StatCard 
          label="Lines Added" 
          value={linesAddedToday} 
          format="compact"
          icon="➕"
          description="Total lines added today"
        />
        <StatCard 
          label="Lines Deleted" 
          value={daily.totalLinesDeleted} 
          format="compact"
          icon="➖"
          description="Total lines removed today"
        />
        <StatCard 
          label="AI Lines Added" 
          value={daily.acceptedLinesAdded} 
          format="compact"
          icon="🤖"
          description="Lines added via AI suggestions"
        />
        <StatCard 
          label="AI Lines Deleted" 
          value={daily.acceptedLinesDeleted} 
          format="compact"
          icon="🗑️"
          description="Lines deleted via AI suggestions"
        />
      </StatSection>

      <StatSection title="AI Suggestions">
        <StatCard 
          label="Accept Rate" 
          value={acceptanceRateToday} 
          format="percent"
          icon="✅"
          description="Suggestions accepted vs rejected"
        />
        <StatCard 
          label="Total Accepts" 
          value={daily.totalAccepts} 
          format="integer"
          icon="👍"
          description="AI suggestions accepted"
        />
        <StatCard 
          label="Total Rejects" 
          value={daily.totalRejects} 
          format="integer"
          icon="👎"
          description="AI suggestions rejected"
        />
        <StatCard 
          label="Total Applies" 
          value={daily.totalApplies} 
          format="integer"
          icon="⚡"
          description="Apply actions triggered"
        />
      </StatSection>

      <StatSection title="Tab Completions">
        <StatCard 
          label="Tabs Shown" 
          value={daily.totalTabsShown} 
          format="compact"
          icon="💭"
          description="Autocomplete suggestions shown"
        />
        <StatCard 
          label="Tabs Accepted" 
          value={daily.totalTabsAccepted} 
          format="compact"
          icon="⌨️"
          description="Autocomplete accepted with Tab"
        />
        <StatCard 
          label="Tab Accept Rate" 
          value={tabAcceptRate} 
          format="percent"
          icon="📈"
          description="% of shown tabs accepted"
        />
      </StatSection>

      <StatSection title="Feature Usage">
        <StatCard 
          label="Chat Requests" 
          value={daily.chatRequests} 
          format="integer"
          icon="💬"
          description="Chat panel interactions"
        />
        <StatCard 
          label="Composer Requests" 
          value={daily.composerRequests} 
          format="integer"
          icon="✏️"
          description="Inline edit (Cmd+K) requests"
        />
        <StatCard 
          label="Agent Requests" 
          value={daily.agentRequests} 
          format="integer"
          icon="🤖"
          description="Agent mode requests"
        />
        <StatCard 
          label="Cmd+K Usages" 
          value={daily.cmdkUsages} 
          format="integer"
          icon="⌘"
          description="Command palette AI usages"
        />
      </StatSection>

      <StatSection title="Request Types">
        <StatCard 
          label="Subscription Included" 
          value={daily.subscriptionIncludedReqs} 
          format="compact"
          icon="📦"
          description="Requests in subscription"
        />
        <StatCard 
          label="Usage-Based" 
          value={daily.usageBasedReqs} 
          format="integer"
          icon="💰"
          description="Extra billable requests"
        />
        <StatCard 
          label="API Key Requests" 
          value={daily.apiKeyReqs} 
          format="integer"
          icon="🔑"
          description="Requests via API keys"
        />
      </StatSection>
    </main>
  );
}
