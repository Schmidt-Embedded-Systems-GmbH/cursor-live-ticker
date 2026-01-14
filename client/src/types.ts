export type NumberFormat = 'integer' | 'compact' | 'currency' | 'percent';

export type Widget =
  | BigNumberWidget
  | GaugeWidget
  | BarListWidget
  | SparklineWidget;

export interface BigNumberWidget {
  id: string;
  type: 'bigNumber';
  label: string;
  valueKey: string;
  format: 'integer' | 'compact' | 'currency';
  currency?: string;
  colSpan: number;
  rowSpan: number;
}

export interface GaugeWidget {
  id: string;
  type: 'gauge';
  label: string;
  valueKey: string; // expects a 0..1 number
  format: 'percent';
  colSpan: number;
  rowSpan: number;
}

export interface BarListWidget {
  id: string;
  type: 'barList';
  label: string;
  itemsKey: string;
  labelField: string;
  valueField: string;
  maxItems?: number;
  colSpan: number;
  rowSpan: number;
}

export interface SparklineWidget {
  id: string;
  type: 'sparkline';
  label: string;
  seriesKey: string;
  valueField: string;
  colSpan: number;
  rowSpan: number;
}

export interface TickerConfig {
  app: {
    title: string;
    refreshIntervalMs: number;
    timezone?: string;
  };
  dashboard: {
    columns: number;
    gapPx: number;
    widgets: Widget[];
  };
}

export interface StatsResponse {
  generatedAt: number;
  timezone: string;
  stats: Record<string, unknown>;
  sources?: Record<string, unknown>;
  warnings?: string[];
}
