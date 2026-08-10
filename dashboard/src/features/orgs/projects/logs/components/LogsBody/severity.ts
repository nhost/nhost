export type Severity = 'error' | 'warn' | 'info' | 'debug' | 'unknown';

const SEVERITY_PATTERNS: RegExp[] = [
  /(?:^|[\s,;{(])(?:level|lvl|severity)=([a-zA-Z]+)/i,
  /["'](?:level|severity)["']\s*:\s*["']([a-zA-Z]+)["']/i,
  /^\[([a-zA-Z]+)\]/,
  /^([A-Z]+):/,
];

export function detectSeverity(log: string): Severity {
  for (const pattern of SEVERITY_PATTERNS) {
    const match = pattern.exec(log);
    if (!match) continue;
    const word = match[1].toLowerCase();
    if (word === 'error' || word === 'fatal' || word === 'critical') {
      return 'error';
    }
    if (word === 'warn' || word === 'warning') return 'warn';
    if (word === 'info' || word === 'notice' || word === 'log') return 'info';
    if (word === 'debug' || word === 'trace') return 'debug';
  }
  return 'unknown';
}

export const SEVERITY_TEXT: Record<Severity, string> = {
  error: 'text-red-600 dark:text-red-400',
  warn: 'text-amber-600 dark:text-amber-400',
  info: 'text-green-600 dark:text-green-400',
  debug: 'text-muted-foreground',
  unknown: 'text-slate-400 dark:text-muted-foreground/60',
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  error: 'ERROR',
  warn: 'WARN',
  info: 'INFO',
  debug: 'DEBUG',
  unknown: 'UNKNOWN',
};
