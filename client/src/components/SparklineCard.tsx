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
}) {
  const values = props.values ?? [];
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const max = useMemo(() => Math.max(1, ...values), [values]);
  const mid = max / 2;

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

            {/* Bars container */}
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
                  return (
                    <div
                      key={idx}
                      className={`sparkline__bar ${isHovered ? 'sparkline__bar--hovered' : ''}`}
                      style={{ height: `${h}%` }}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      {isHovered && (
                        <div className="sparkline__tooltip">
                          {formatCompact(v)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </WidgetFrame>
  );
}
