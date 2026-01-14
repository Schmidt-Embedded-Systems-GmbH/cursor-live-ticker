import { useEffect, useRef, useState } from 'react';

export function useTweenedNumber(target: number, durationMs = 800): number {
  const [value, setValue] = useState<number>(target);

  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const fromRef = useRef<number>(target);
  const toRef = useRef<number>(target);

  useEffect(() => {
    fromRef.current = value;
    toRef.current = target;
    startRef.current = performance.now();

    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);

    const tick = (t: number) => {
      const elapsed = t - startRef.current;
      const p = Math.min(1, elapsed / durationMs);

      // Ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3);

      const next = fromRef.current + (toRef.current - fromRef.current) * eased;
      setValue(next);

      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return value;
}
