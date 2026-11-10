import type { ReactNode } from 'react';

const ACCENT_COLOR = 'text-sky-700 dark:text-sky-300';

const HTTP_METHODS = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
];

const FIELD_KEY_COLOR = 'text-indigo-500/80 dark:text-[#8b9dc099]';

interface Match {
  length: number;
  className: string;
}

function isWordBoundary(char: string | undefined): boolean {
  if (char === undefined) {
    return true;
  }
  return !/[A-Za-z0-9_]/.test(char);
}

const MATCHERS = {
  uuid: /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/y,
  traceId: /[0-9a-f]{32}\b/y,
  spanId: /[0-9a-f]{16}\b/y,
  jsonKey: /"([a-zA-Z_][a-zA-Z0-9_.-]*)"\s*:/y,
  logfmtKey: /([a-zA-Z_][a-zA-Z0-9_.-]*)=/y,
  duration:
    /\d+(?:\.\d+)?(?:ns|µs|us|ms|s|m|h)(?:\d+(?:\.\d+)?(?:ns|µs|us|ms|s|m|h))*\b/y,
  status: /[1-5]\d{2}(?!\.)\b/y,
};

function execAt(
  kind: keyof typeof MATCHERS,
  text: string,
  i: number,
): RegExpExecArray | null {
  const matcher = MATCHERS[kind];
  matcher.lastIndex = i;
  return matcher.exec(text);
}

function matchAt(text: string, i: number): Match | null {
  const prev = i > 0 ? text[i - 1] : undefined;
  if (!isWordBoundary(prev)) {
    return null;
  }

  const ch = text[i];

  // HTTP methods: G, P, D, H, O
  if (ch === 'G' || ch === 'P' || ch === 'D' || ch === 'H' || ch === 'O') {
    for (const method of HTTP_METHODS) {
      if (
        text.startsWith(method, i) &&
        isWordBoundary(text[i + method.length])
      ) {
        return { length: method.length, className: ACCENT_COLOR };
      }
    }
  }

  const isHex =
    (ch >= '0' && ch <= '9') ||
    (ch >= 'a' && ch <= 'f') ||
    (ch >= 'A' && ch <= 'F');
  const isDigit = ch >= '0' && ch <= '9';
  const isAlpha =
    (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';

  if (isHex) {
    const uuidMatch = execAt('uuid', text, i);
    if (uuidMatch) {
      return { length: uuidMatch[0].length, className: ACCENT_COLOR };
    }

    const lower = ch >= '0' && ch <= '9' ? true : ch >= 'a' && ch <= 'f';
    if (lower) {
      const traceIdMatch = execAt('traceId', text, i);
      if (traceIdMatch) {
        return { length: traceIdMatch[0].length, className: ACCENT_COLOR };
      }

      const spanIdMatch = execAt('spanId', text, i);
      if (spanIdMatch) {
        return { length: spanIdMatch[0].length, className: ACCENT_COLOR };
      }
    }
  }

  if (ch === '"') {
    const jsonKeyMatch = execAt('jsonKey', text, i);
    if (jsonKeyMatch) {
      return { length: jsonKeyMatch[1].length + 2, className: FIELD_KEY_COLOR };
    }
  }

  if (isAlpha) {
    const logfmtKeyMatch = execAt('logfmtKey', text, i);
    if (logfmtKeyMatch) {
      return { length: logfmtKeyMatch[1].length, className: FIELD_KEY_COLOR };
    }
  }

  if (isDigit) {
    const durationMatch = execAt('duration', text, i);
    if (durationMatch) {
      return { length: durationMatch[0].length, className: ACCENT_COLOR };
    }

    if (ch >= '1' && ch <= '5') {
      const statusMatch = execAt('status', text, i);
      if (statusMatch && (prev === undefined || /[\s=:]/.test(prev))) {
        return { length: statusMatch[0].length, className: ACCENT_COLOR };
      }
    }
  }

  return null;
}

export interface SearchRange {
  start: number;
  end: number;
  isCurrent: boolean;
}

const SEARCH_HIGHLIGHT_CLASS =
  'bg-yellow-300/70 text-foreground dark:bg-yellow-500/40';
const SEARCH_CURRENT_CLASS =
  'bg-orange-400/80 text-foreground dark:bg-orange-500/70';

function searchClassAt(
  ranges: SearchRange[] | undefined,
  index: number,
): string | null {
  if (!ranges) {
    return null;
  }
  for (const range of ranges) {
    if (index >= range.start && index < range.end) {
      return range.isCurrent ? SEARCH_CURRENT_CLASS : SEARCH_HIGHLIGHT_CLASS;
    }
  }
  return null;
}

function emitSpan(
  out: ReactNode[],
  text: string,
  start: number,
  end: number,
  syntaxClass: string | null,
  ranges: SearchRange[] | undefined,
): void {
  let cursor = start;
  let segmentStart = start;
  let segmentSearchClass = searchClassAt(ranges, start);

  while (cursor < end) {
    const nextSearchClass = searchClassAt(ranges, cursor);
    if (nextSearchClass !== segmentSearchClass) {
      out.push(
        renderSegment(
          text,
          segmentStart,
          cursor,
          syntaxClass,
          segmentSearchClass,
        ),
      );
      segmentStart = cursor;
      segmentSearchClass = nextSearchClass;
    }
    cursor += 1;
  }
  out.push(
    renderSegment(text, segmentStart, end, syntaxClass, segmentSearchClass),
  );
}

function renderSegment(
  text: string,
  start: number,
  end: number,
  syntaxClass: string | null,
  searchClass: string | null,
): ReactNode {
  const slice = text.slice(start, end);
  const effectiveClass = searchClass ?? syntaxClass;
  if (!effectiveClass) {
    return slice;
  }
  const isCurrent = searchClass === SEARCH_CURRENT_CLASS;
  return (
    <span
      key={start}
      className={effectiveClass}
      data-search-current={isCurrent ? 'true' : undefined}
    >
      {slice}
    </span>
  );
}

export function highlightLog(text: string, ranges?: SearchRange[]): ReactNode {
  const out: ReactNode[] = [];
  let plainStart = 0;
  let i = 0;

  while (i < text.length) {
    const match = matchAt(text, i);
    if (match) {
      if (plainStart < i) {
        emitSpan(out, text, plainStart, i, null, ranges);
      }
      emitSpan(out, text, i, i + match.length, match.className, ranges);
      i += match.length;
      plainStart = i;
    } else {
      i += 1;
    }
  }

  if (plainStart < text.length) {
    emitSpan(out, text, plainStart, text.length, null, ranges);
  }

  return out;
}
