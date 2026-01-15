import { useEffect, useMemo, useState, useRef } from 'react';
import { fetchConfig, fetchStats } from './api';
import type { StatsResponse, TickerConfig } from './types';
import WidgetRenderer from './components/WidgetRenderer';
import ErrorBanner from './components/ErrorBanner';

function formatTime(ts: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleTimeString();
  }
}

export default function App() {
  const [config, setConfig] = useState<TickerConfig | null>(null);
  const [statsResp, setStatsResp] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const lastFetchRef = useRef<number>(Date.now());

  // Load config once
  useEffect(() => {
    let cancelled = false;
    fetchConfig()
      .then((c) => {
        if (cancelled) return;
        setConfig(c);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message ?? String(e));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshMs = config?.app.refreshIntervalMs ?? 5000;

  // Poll stats
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetchStats();
        if (cancelled) return;
        setStatsResp(res);
        setError(null);
        lastFetchRef.current = Date.now();
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? String(e));
      }
    };

    // immediate load
    load();

    const id = window.setInterval(load, refreshMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [refreshMs]);

  // Countdown timer
  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - lastFetchRef.current;
      const remaining = Math.max(0, Math.ceil((refreshMs - elapsed) / 1000));
      setCountdown(remaining);
    };

    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [refreshMs]);

  const title = config?.app.title ?? 'Cursor Live Ticker';

  const stats = useMemo(() => statsResp?.stats ?? {}, [statsResp]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand__title">{title}</div>
          <div className="brand__sub">
            {statsResp ? (
              <>
                Updated {formatTime(statsResp.generatedAt)} · TZ {statsResp.timezone}
                <span className="countdown"> · {countdown}s</span>
              </>
            ) : (
              <>Loading…</>
            )}
          </div>
        </div>

        <div className="topbar__right">
          <div className="pill">
            <span className="dot" />
            Live
          </div>
        </div>
      </header>

      {error ? <ErrorBanner message={error} /> : null}

      <main
        className="dashboard"
        style={{
          gridTemplateColumns: `repeat(${config?.dashboard.columns ?? 12}, 1fr)`,
          gap: `${config?.dashboard.gapPx ?? 18}px`,
        }}
      >
        {(config?.dashboard.widgets ?? []).map((w) => (
          <WidgetRenderer key={w.id} widget={w} stats={stats} />
        ))}
      </main>

      <footer className="footer">
        <div className="muted">Powered by Cursor Admin API · Tip: open in full screen for beamer/kiosk mode</div>
      </footer>
    </div>
  );
}
