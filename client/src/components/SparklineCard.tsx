import WidgetFrame from './WidgetFrame';
import { useMemo } from 'react';

export default function SparklineCard(props: {
  title: string;
  values: number[] | null;
  hint?: string;
}) {
  const values = props.values ?? [];

  const max = useMemo(() => Math.max(1, ...values), [values]);

  return (
    <WidgetFrame title={props.title} subtitle={props.hint}>
      <div className="sparkline">
        {values.length === 0 ? (
          <div className="muted">—</div>
        ) : (
          <div className="sparkline__bars" aria-hidden>
            {values.map((v, idx) => {
              const h = Math.max(2, (v / max) * 100);
              return <div key={idx} className="sparkline__bar" style={{ height: `${h}%` }} />;
            })}
          </div>
        )}
      </div>
    </WidgetFrame>
  );
}
