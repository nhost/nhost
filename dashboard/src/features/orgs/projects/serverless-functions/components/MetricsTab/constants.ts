export const CHART_COLOR_PALETTE = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
] as const;

export const METHOD_COLOR: Record<string, string> = {
  GET: 'hsl(var(--chart-1))',
  POST: 'hsl(var(--chart-2))',
  PUT: 'hsl(var(--chart-3))',
  PATCH: 'hsl(var(--chart-4))',
  DELETE: 'hsl(var(--chart-5))',
  HEAD: 'hsl(215 28% 55%)',
  OPTIONS: 'hsl(260 45% 60%)',
};

export function colorForMethod(method: string, index = 0): string {
  return (
    METHOD_COLOR[method] ??
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
