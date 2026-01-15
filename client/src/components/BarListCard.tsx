import WidgetFrame from './WidgetFrame';
import { formatValue } from '../utils/format';
import { useMemo } from 'react';

export type BarItem = { label: string; value: number };

// Model brand colors (researched from official branding)
function getModelColor(label: string): string {
  const l = label.toLowerCase();
  
  // Claude (Anthropic) - Warm orange/amber
  if (l.includes('claude')) {
    return 'linear-gradient(90deg, rgba(232, 121, 53, 0.9), rgba(217, 119, 6, 0.7))';
  }
  
  // GPT / OpenAI - Teal green
  if (l.includes('gpt') || l.includes('openai') || l.includes('o1') || l.includes('o3')) {
    return 'linear-gradient(90deg, rgba(16, 163, 127, 0.9), rgba(5, 150, 105, 0.7))';
  }
  
  // Gemini (Google) - Blue
  if (l.includes('gemini') || l.includes('google') || l.includes('bard')) {
    return 'linear-gradient(90deg, rgba(66, 133, 244, 0.9), rgba(59, 130, 246, 0.7))';
  }
  
  // Llama (Meta) - Purple
  if (l.includes('llama') || l.includes('meta')) {
    return 'linear-gradient(90deg, rgba(124, 58, 237, 0.9), rgba(139, 92, 246, 0.7))';
  }
  
  // Mistral - Red/Orange
  if (l.includes('mistral')) {
    return 'linear-gradient(90deg, rgba(255, 107, 53, 0.9), rgba(239, 68, 68, 0.7))';
  }
  
  // Grok (xAI) - Cool gray/silver
  if (l.includes('grok') || l.includes('xai')) {
    return 'linear-gradient(90deg, rgba(156, 163, 175, 0.9), rgba(107, 114, 128, 0.7))';
  }
  
  // DeepSeek - Cyan/Teal
  if (l.includes('deepseek')) {
    return 'linear-gradient(90deg, rgba(6, 182, 212, 0.9), rgba(20, 184, 166, 0.7))';
  }
  
  // Default - Current blue
  return 'linear-gradient(90deg, rgba(120, 180, 255, 0.8), rgba(100, 160, 255, 0.65))';
}

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
            const barColor = getModelColor(item.label);
            return (
              <div className="barList__row" key={item.label}>
                <div className="barList__label" title={item.label}>
                  {item.label}
                </div>
                <div className="barList__bar">
                  <div
                    className="barList__barFill"
                    style={{ width: `${w}%`, background: barColor }}
                  />
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
