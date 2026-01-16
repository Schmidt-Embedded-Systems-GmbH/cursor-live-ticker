import type { NumberFormat } from '../types';

export function formatValue(
  value: unknown,
  format: NumberFormat,
  opts?: { currency?: string },
): string {
  if (value == null || value === '' || Number.isNaN(value as any)) return '—';

  const num = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(num)) return '—';

  switch (format) {
    case 'integer':
      return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(num);

    case 'compact':
      return new Intl.NumberFormat(undefined, {
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(num);

    case 'currency': {
      const currency = opts?.currency ?? 'USD';
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
        maximumFractionDigits: 2,
      }).format(num);
    }

    case 'percent':
      // expects 0..1
      return new Intl.NumberFormat(undefined, {
        style: 'percent',
        maximumFractionDigits: 0,
      }).format(num);

    default:
      return String(value);
  }
}

export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
