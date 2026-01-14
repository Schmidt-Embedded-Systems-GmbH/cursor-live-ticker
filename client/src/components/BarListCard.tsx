import WidgetFrame from './WidgetFrame';
import { formatValue } from '../utils/format';
import { useMemo } from 'react';

export type BarItem = { label: string; value: number };

export default function BarListCard(props: {
  title: string;
  items: BarItem[] | null;
  format?: 'integer' | 'compact';
  hint?: string;
}) {
  const items = props.items ?? [];
  const max = useMemo(() => Math.max(1, ...items.map((i) => i.value)), [items]);

  return (
    <WidgetFrame title={props.title} subtitle={props.hint}>
      <div className="barList">
        {items.length === 0 ? (
          <div className="muted">—</div>
        ) : (
          items.map((item) => {
            const w = Math.max(0, Math.min(100, (item.value / max) * 100));
            return (
              <div className="barList__row" key={item.label}>
                <div className="barList__label" title={item.label}>
                  {item.label}
                </div>
                <div className="barList__bar">
                  <div className="barList__barFill" style={{ width: `${w}%` }} />
                </div>
                <div className="barList__value">
                  {formatValue(item.value, props.format ?? 'compact')}
                </div>
              </div>
            );
          })
        )}
      </div>
    </WidgetFrame>
  );
}
