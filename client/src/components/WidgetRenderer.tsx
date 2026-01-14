import type { Widget } from '../types';
import { getByPath } from '../utils/get';
import BigNumberCard from './BigNumberCard';
import GaugeCard from './GaugeCard';
import BarListCard from './BarListCard';
import SparklineCard from './SparklineCard';
import PodiumCard from './PodiumCard';

function asNumber(x: unknown): number | null {
  if (typeof x === 'number' && Number.isFinite(x)) return x;
  if (typeof x === 'string' && x.trim() !== '' && Number.isFinite(Number(x))) return Number(x);
  return null;
}

export default function WidgetRenderer(props: {
  widget: Widget;
  stats: Record<string, unknown>;
}) {
  const w = props.widget;

  if (w.type === 'bigNumber') {
    const raw = getByPath(props.stats, w.valueKey);
    const isLarge = w.rowSpan >= 2;
    return (
      <div style={{ gridColumn: `span ${w.colSpan}`, gridRow: `span ${w.rowSpan}` }}>
        <BigNumberCard
          title={w.label}
          value={asNumber(raw)}
          format={w.format}
          currency={w.currency}
          large={isLarge}
        />
      </div>
    );
  }

  if (w.type === 'gauge') {
    const raw = getByPath(props.stats, w.valueKey);
    return (
      <div style={{ gridColumn: `span ${w.colSpan}`, gridRow: `span ${w.rowSpan}` }}>
        <GaugeCard title={w.label} value={asNumber(raw)} />
      </div>
    );
  }

  if (w.type === 'barList') {
    const raw = getByPath(props.stats, w.itemsKey);

    const arr = Array.isArray(raw) ? raw : [];
    const maxItems = w.maxItems ?? 8;

    const items = arr
      .map((it: any) => ({
        label: String(it?.[w.labelField] ?? '—'),
        value: Number(it?.[w.valueField] ?? 0),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, maxItems);

    return (
      <div style={{ gridColumn: `span ${w.colSpan}`, gridRow: `span ${w.rowSpan}` }}>
        <BarListCard title={w.label} items={items} />
      </div>
    );
  }

  if (w.type === 'sparkline') {
    const raw = getByPath(props.stats, w.seriesKey);
    const arr = Array.isArray(raw) ? raw : [];
    const values = arr.map((it: any) => Number(it?.[w.valueField] ?? 0));

    return (
      <div style={{ gridColumn: `span ${w.colSpan}`, gridRow: `span ${w.rowSpan}` }}>
        <SparklineCard title={w.label} values={values} />
      </div>
    );
  }

  if (w.type === 'podium') {
    const raw = getByPath(props.stats, w.itemsKey);

    const arr = Array.isArray(raw) ? raw : [];

    const items = arr
      .map((it: any) => ({
        label: String(it?.[w.labelField] ?? '—'),
        value: Number(it?.[w.valueField] ?? 0),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);

    return (
      <div style={{ gridColumn: `span ${w.colSpan}`, gridRow: `span ${w.rowSpan}` }}>
        <PodiumCard title={w.label} items={items} />
      </div>
    );
  }

  return null;
}
