import { HTTP_METHOD_CHART_COLORS } from '@/features/orgs/projects/serverless-functions/constants';
import type { HttpMethod } from '@/features/orgs/projects/serverless-functions/types';

export const CHART_COLOR_PALETTE = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
] as const;

export function colorForMethod(method: string, index = 0): string {
  return (
    HTTP_METHOD_CHART_COLORS[method as HttpMethod] ??
    CHART_COLOR_PALETTE[index % CHART_COLOR_PALETTE.length]
  );
}

export function colorForStatus(status: string): string {
  const prefix = status.charAt(0);
  switch (prefix) {
    case '2':
      return 'hsl(142 71% 45%)';
    case '3':
      return 'hsl(200 88% 50%)';
    case '4':
      return 'hsl(38 92% 50%)';
    case '5':
      return 'hsl(0 72% 51%)';
    default:
      return 'hsl(var(--muted-foreground))';
  }
}
