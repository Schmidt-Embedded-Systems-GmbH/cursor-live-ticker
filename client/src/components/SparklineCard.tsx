import WidgetFrame from './WidgetFrame';
import { useMemo, useState } from 'react';
import { formatValue } from '../utils/format';

function formatCompact(n: number): string {
  return formatValue(n, 'compact');
}

export default function SparklineCard(props: {
  title: string;
  values: number[] | null;
  hint?: string;
  /** Total time window in minutes (default 60) */
  windowMinutes?: number;
}) {
  const values = props.values ?? [];
  const windowMinutes = props.windowMinutes ?? 60;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const max = useMemo(() => Math.max(1, ...values), [values]);
  const mid = max / 2;

  // Calculate minutes ago for a given bar index
  const getMinutesAgo = (idx: number): number => {
    if (values.length <= 1) return 0;
    const minutesPerBar = windowMinutes / values.length;
    return Math.round(windowMinutes - idx * minutesPerBar);
  };

  return (
    <WidgetFrame title={props.title} subtitle={props.hint}>
      <div className="sparkline">
        {values.length === 0 ? (
          <div className="muted">—</div>
        ) : (
          <>
            {/* Y-axis scale */}
            <div className="sparkline__yaxis">
              <span className="sparkline__yaxis-label">{formatCompact(max)}</span>
              <span className="sparkline__yaxis-label">{formatCompact(mid)}</span>
              <span className="sparkline__yaxis-label">0</span>
            </div>

            {/* Chart area (bars + x-axis) */}
            <div className="sparkline__chart">
              {/* Grid lines */}
              <div className="sparkline__gridlines">
                <div className="sparkline__gridline" />
                <div className="sparkline__gridline" />
                <div className="sparkline__gridline" />
              </div>

              {/* Bars */}
              <div className="sparkline__bars">
                {values.map((v, idx) => {
                  const h = Math.max(2, (v / max) * 100);
                  const isHovered = hoveredIndex === idx;
                  const minutesAgo = getMinutesAgo(idx);
                  return (
                    <div
                      key={idx}
                      className={`sparkline__bar ${isHovered ? 'sparkline__bar--hovered' : ''}`}
                      style={{ height: `${h}%` }}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      {/* Tooltip is always rendered, visibility controlled by CSS */}
                      <div className={`sparkline__tooltip ${isHovered ? 'sparkline__tooltip--visible' : ''}`}>
                        <span className="sparkline__tooltip-value">{formatCompact(v)}</span>
                        <span className="sparkline__tooltip-time">
                          {minutesAgo === 0 ? 'now' : `${minutesAgo}m ago`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* X-axis time labels */}
              <div className="sparkline__xaxis">
                <span className="sparkline__xaxis-label">-{windowMinutes}m</span>
                <span className="sparkline__xaxis-label">-{Math.round(windowMinutes / 2)}m</span>
                <span className="sparkline__xaxis-label">now</span>
              </div>
            </div>
          </>
        )}
      </div>
    </WidgetFrame>
  );
}
