import WidgetFrame from './WidgetFrame';
import { formatValue } from '../utils/format';
import { useMemo, useRef, useEffect, useState } from 'react';

export type PodiumItem = { label: string; value: number };

function extractName(email: string): string {
  const local = email.split('@')[0] ?? email;
  return local
    .replace(/[._]/g, ' ')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

type Position = 1 | 2 | 3;

function Place({
  rank,
  item,
  height,
  animationClass,
}: {
  rank: Position;
  item: PodiumItem | null;
  height: number;
  animationClass: string;
}) {
  const colors: Record<Position, { bg: string; border: string; glow: string; text: string }> = {
    1: {
      bg: 'linear-gradient(180deg, rgba(255, 215, 80, 0.32) 0%, rgba(255, 180, 50, 0.18) 100%)',
      border: 'rgba(255, 200, 100, 0.5)',
      glow: 'rgba(255, 200, 80, 0.25)',
      text: 'rgba(255, 225, 150, 1)',
    },
    2: {
      bg: 'linear-gradient(180deg, rgba(200, 210, 230, 0.28) 0%, rgba(160, 175, 200, 0.15) 100%)',
      border: 'rgba(200, 210, 230, 0.45)',
      glow: 'rgba(180, 195, 220, 0.18)',
      text: 'rgba(210, 220, 235, 1)',
    },
    3: {
      bg: 'linear-gradient(180deg, rgba(205, 150, 110, 0.28) 0%, rgba(180, 120, 80, 0.15) 100%)',
      border: 'rgba(200, 150, 100, 0.45)',
      glow: 'rgba(200, 150, 100, 0.15)',
      text: 'rgba(220, 180, 140, 1)',
    },
  };

  const c = colors[rank];

  return (
    <div className={`podium__place ${animationClass}`} data-rank={rank}>
      <div className="podium__user">
        {item ? (
          <div className="podium__userContent" key={item.label}>
            <div className="podium__name" title={item.label}>
              {extractName(item.label)}
            </div>
            <div className="podium__tokens">{formatValue(item.value, 'compact')}</div>
          </div>
        ) : (
          <div className="podium__empty">—</div>
        )}
      </div>
      <div
        className="podium__bar"
        style={{
          height: `${height}px`,
          background: c.bg,
          borderColor: c.border,
          boxShadow: `0 0 20px ${c.glow}`,
        }}
      >
        <div className="podium__rank" style={{ color: c.text }}>
          {rank}
        </div>
      </div>
    </div>
  );
}

export default function PodiumCard(props: { title: string; items: PodiumItem[] | null; hint?: string }) {
  const items = props.items ?? [];

  const first = items[0] ?? null;
  const second = items[1] ?? null;
  const third = items[2] ?? null;

  // Track previous positions for swap detection
  const prevPositionsRef = useRef<Record<string, Position>>({});
  const [animations, setAnimations] = useState<Record<Position, string>>({
    1: '',
    2: '',
    3: '',
  });

  // Detect position changes and trigger animations
  useEffect(() => {
    const currentPositions: Record<string, Position> = {};
    const newAnimations: Record<Position, string> = { 1: '', 2: '', 3: '' };

    // Build current position map
    if (first?.label) currentPositions[first.label] = 1;
    if (second?.label) currentPositions[second.label] = 2;
    if (third?.label) currentPositions[third.label] = 3;

    // Check for swaps
    const prevPos = prevPositionsRef.current;

    // For each current user, check if they moved from a different position
    Object.entries(currentPositions).forEach(([label, newPos]) => {
      const oldPos = prevPos[label];
      if (oldPos && oldPos !== newPos) {
        // User moved! Determine animation direction
        if (oldPos < newPos) {
          // Moved down (e.g., 1 -> 2): slide from left
          newAnimations[newPos] = 'podium__place--slideFromLeft';
        } else {
          // Moved up (e.g., 2 -> 1): slide from right
          newAnimations[newPos] = 'podium__place--slideFromRight';
        }
      } else if (!oldPos && label) {
        // New user appeared
        newAnimations[newPos] = 'podium__place--fadeIn';
      }
    });

    // Update animations
    setAnimations(newAnimations);

    // Clear animations after they complete
    const timer = setTimeout(() => {
      setAnimations({ 1: '', 2: '', 3: '' });
    }, 1500);

    // Store current positions for next comparison
    prevPositionsRef.current = currentPositions;

    return () => clearTimeout(timer);
  }, [first?.label, second?.label, third?.label]);

  // Calculate heights based on relative values
  const maxHeight = 150;
  const minHeight = 50;

  const heights = useMemo(() => {
    const firstVal = first?.value ?? 0;
    const secondVal = second?.value ?? 0;
    const thirdVal = third?.value ?? 0;

    if (firstVal === 0) {
      return { 1: maxHeight, 2: 70, 3: 45 };
    }

    const scaleHeight = (val: number) => {
      if (val === 0) return minHeight;
      const ratio = val / firstVal;
      return Math.max(minHeight, Math.round(ratio * maxHeight));
    };

    return {
      1: maxHeight,
      2: secondVal > 0 ? scaleHeight(secondVal) : minHeight,
      3: thirdVal > 0 ? scaleHeight(thirdVal) : minHeight,
    };
  }, [first, second, third]);

  return (
    <WidgetFrame title={props.title} subtitle={props.hint}>
      <div className="podium">
        <Place rank={2} item={second} height={heights[2]} animationClass={animations[2]} />
        <Place rank={1} item={first} height={heights[1]} animationClass={animations[1]} />
        <Place rank={3} item={third} height={heights[3]} animationClass={animations[3]} />
      </div>
    </WidgetFrame>
  );
}
