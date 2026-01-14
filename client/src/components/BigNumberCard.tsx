import WidgetFrame from './WidgetFrame';
import { formatValue } from '../utils/format';
import { useTweenedNumber } from '../hooks/useTweenedNumber';

export default function BigNumberCard(props: {
  title: string;
  value: number | null;
  format: 'integer' | 'compact' | 'currency';
  currency?: string;
  hint?: string;
}) {
  const raw = props.value ?? 0;
  const tweened = useTweenedNumber(raw);

  return (
    <WidgetFrame title={props.title} subtitle={props.hint}>
      <div className="bigNumber">
        <div className="bigNumber__value">
          {props.value == null ? '—' : formatValue(tweened, props.format, { currency: props.currency })}
        </div>
      </div>
    </WidgetFrame>
  );
}
