import { useEffect, useMemo, useState, useRef } from 'react';
import { fetchConfig, fetchStats } from './api';
import type { StatsResponse, TickerConfig } from './types';
import WidgetRenderer from './components/WidgetRenderer';
import ErrorBanner from './components/ErrorBanner';
import DailyStatsView from './components/DailyStatsView';

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

type ViewMode = 'live' | 'daily';
type Theme = 'dark' | 'light';

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return 'dark';
}

function getInitialSunEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem('sunEnabled');
  return stored !== 'false';
}

// Calculate sun position and color based on time (8:00 = start, 17:00 = end)
function getSunPosition(): { x: number; y: number; color: string; glowColor: string } {
  const now = new Date();
  const hours = now.getHours() + now.getMinutes() / 60;
  
  const startHour = 8;
  const endHour = 17;
  const duration = endHour - startHour;
  
  // Clamp to work hours
  const clampedHours = Math.max(startHour, Math.min(endHour, hours));
  const progress = (clampedHours - startHour) / duration; // 0 to 1
  
  // X: 10% to 90% of screen width
  const x = 10 + progress * 80;
  
  // Y: Arc using sine (0 at edges, peak at center) - flatter arc
  const arcHeight = Math.sin(progress * Math.PI);
  // Y: 55% at bottom, 25% at peak (flatter)
  const y = 55 - arcHeight * 30;
  
  // Color: Orange at edges (sunrise/sunset), bright yellow at noon
  // Use pow to make the orange phase shorter (quicker transition to yellow)
  const colorProgress = Math.pow(Math.sin(progress * Math.PI), 0.5); // faster transition
  
  // Sunrise/sunset: rgb(255, 140, 70) - warm orange
  // Noon: rgb(255, 235, 130) - bright yellow
  const r = 255;
  const g = Math.round(140 + colorProgress * 95); // 140 -> 235
  const b = Math.round(70 + colorProgress * 60);  // 70 -> 130
  
  const color = `rgb(${r}, ${g}, ${b})`;
  const glowColor = `rgba(${r}, ${g - 20}, ${b - 20}, 0.5)`;
  
  return { x, y, color, glowColor };
}

export default function App() {
  const [config, setConfig] = useState<TickerConfig | null>(null);
  const [statsResp, setStatsResp] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [viewMode, setViewMode] = useState<ViewMode>('live');
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [sunEnabled, setSunEnabled] = useState(getInitialSunEnabled);
  const [sunPos, setSunPos] = useState(getSunPosition);
  const lastFetchRef = useRef<number>(Date.now());

  // Apply theme to html element
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Persist sun preference
  useEffect(() => {
    localStorage.setItem('sunEnabled', String(sunEnabled));
  }, [sunEnabled]);

  // Update sun position every minute
  useEffect(() => {
    if (theme !== 'light') return;
    
    const updateSun = () => setSunPos(getSunPosition());
    updateSun();
    
    const id = setInterval(updateSun, 60000); // every minute
    return () => clearInterval(id);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

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
      {theme === 'light' && sunEnabled && (
        <>
          <div
            className="sun"
            style={{
              left: `${sunPos.x}%`,
              top: `${sunPos.y}%`,
              '--sun-color': sunPos.color,
              '--sun-glow': sunPos.glowColor,
            } as React.CSSProperties}
          />
          <div className="sun-timeline">
            <span className="sun-timeline__label">08:00</span>
            <div className="sun-timeline__track" />
            <span className="sun-timeline__label">17:00</span>
          </div>
        </>
      )}
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
          {theme === 'light' && (
            <button
              className={`themeToggle ${sunEnabled ? '' : 'themeToggle--muted'}`}
              onClick={() => setSunEnabled((s) => !s)}
              title={sunEnabled ? 'Hide sun animation' : 'Show sun animation'}
            >
              {sunEnabled ? '🌤️' : '🌥️'}
            </button>
          )}
          <div className="viewToggle">
            <button
              className={`viewToggle__btn ${viewMode === 'live' ? 'viewToggle__btn--active' : ''}`}
              onClick={() => setViewMode('live')}
            >
              <span className="dot" />
              Live
            </button>
            <button
              className={`viewToggle__btn ${viewMode === 'daily' ? 'viewToggle__btn--active' : ''}`}
              onClick={() => setViewMode('daily')}
            >
              <span className="viewToggle__icon">📊</span>
              Daily
            </button>
          </div>
          <button className="themeToggle" onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {error ? <ErrorBanner message={error} /> : null}
      {statsResp?.warnings?.map((w, i) => (
        <div key={i} className="warningBanner">⚠️ {w}</div>
      ))}

      {viewMode === 'live' ? (
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
      ) : (
        <DailyStatsView stats={stats} />
      )}

      <footer className="footer">
        <div className="muted">Powered by Cursor Admin API · Tip: open in full screen for beamer/kiosk mode</div>
      </footer>
    </div>
  );
}
