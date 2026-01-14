import WidgetFrame from './WidgetFrame';
import { clamp01, formatValue } from '../utils/format';
import { useTweenedNumber } from '../hooks/useTweenedNumber';

export default function GaugeCard(props: { title: string; value: number | null; hint?: string }) {
  const v = clamp01(props.value ?? 0);
  const tweened = useTweenedNumber(v, 700);

  const pctText = props.value == null ? '—' : formatValue(tweened, 'percent');

  return (
    <WidgetFrame title={props.title} subtitle={props.hint}>
      <div className="gauge">
        <div className="gauge__row">
          <div className="gauge__value">{pctText}</div>
          <div className="gauge__bar">
            <div className="gauge__barFill" style={{ width: `${tweened * 100}%` }} />
          </div>
        </div>
      </div>
    </WidgetFrame>
  );
}
