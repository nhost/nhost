import {
  highlightLog,
  type SearchRange,
} from '@/features/orgs/projects/logs/components/LogsBody/highlightLog';
import { renderToStaticMarkup } from 'react-dom/server';
import { Fragment, createElement, type ReactNode } from 'react';

function render(node: ReactNode): string {
  return renderToStaticMarkup(createElement(Fragment, null, node));
}

function highlight(text: string, ranges?: SearchRange[]): string {
  return render(highlightLog(text, ranges));
}

const ACCENT = 'text-sky-700 dark:text-sky-300';
const FIELD = 'text-indigo-500/80 dark:text-[#8b9dc099]';
const SEARCH = 'bg-yellow-300/70 text-foreground dark:bg-yellow-500/40';
const CURRENT = 'bg-orange-400/80 text-foreground dark:bg-orange-500/70';

describe('highlightLog', () => {
  describe('plain text', () => {
    it('returns empty output for empty input', () => {
      expect(highlight('')).toBe('');
    });

    it('returns the original text when nothing matches', () => {
      expect(highlight('just a plain message')).toBe('just a plain message');
    });

    it('returns the original text when ranges is empty', () => {
      expect(highlight('just a plain message', [])).toBe(
        'just a plain message',
      );
    });
  });

  describe('token detection', () => {
    it('highlights a UUID', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      const html = highlight(`id ${uuid} end`);
      expect(html).toBe(
        `id <span class="${ACCENT}">${uuid}</span> end`,
      );
    });

    it('highlights a 32-hex trace ID', () => {
      const trace = '0af7651916cd43dd8448eb211c80319c';
      const html = highlight(`trace ${trace} end`);
      expect(html).toBe(
        `trace <span class="${ACCENT}">${trace}</span> end`,
      );
    });

    it('highlights a 16-hex span ID', () => {
      const span = 'b7ad6b7169203331';
      const html = highlight(`span ${span} end`);
      expect(html).toBe(
        `span <span class="${ACCENT}">${span}</span> end`,
      );
    });

    it('highlights a JSON key including quotes', () => {
      const html = highlight('{"level":"info"}');
      expect(html).toContain(`<span class="${FIELD}">&quot;level&quot;</span>`);
    });

    it('highlights a logfmt key', () => {
      const html = highlight('level=info other=1');
      expect(html).toContain(`<span class="${FIELD}">level</span>=`);
      expect(html).toContain(`<span class="${FIELD}">other</span>=`);
    });

    it('highlights durations', () => {
      expect(highlight('took 1.5ms done')).toBe(
        `took <span class="${ACCENT}">1.5ms</span> done`,
      );
      expect(highlight('took 2m30s done')).toBe(
        `took <span class="${ACCENT}">2m30s</span> done`,
      );
    });

    it.each(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])(
      'highlights HTTP method %s',
      (method) => {
        const html = highlight(`req ${method} /path`);
        expect(html).toBe(
          `req <span class="${ACCENT}">${method}</span> /path`,
        );
      },
    );

    it('highlights an HTTP status after whitespace', () => {
      const html = highlight('status 404 not found');
      expect(html).toBe(
        `status <span class="${ACCENT}">404</span> not found`,
      );
    });
  });

  describe('word boundaries', () => {
    it('does not highlight GET when not at a word boundary', () => {
      expect(highlight('xGET /path')).toBe('xGET /path');
    });

    it('does not highlight a UUID-like sequence when prefix is alphanumeric', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      expect(highlight(`x${uuid}`)).toBe(`x${uuid}`);
    });

    it('does not highlight a status with an alphanumeric prefix', () => {
      expect(highlight('x404 oops')).toBe('x404 oops');
    });
  });

  describe('search ranges', () => {
    it('wraps the full token in the search class when range covers it', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      const text = `id ${uuid} end`;
      const start = text.indexOf(uuid);
      const html = highlight(text, [
        { start, end: start + uuid.length, isCurrent: false },
      ]);
      expect(html).toBe(`id <span class="${SEARCH}">${uuid}</span> end`);
    });

    it('splits a token when the search range only covers part of it', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      const text = `id ${uuid} end`;
      const tokenStart = text.indexOf(uuid);
      const splitAt = tokenStart + 8;
      const html = highlight(text, [
        { start: tokenStart, end: splitAt, isCurrent: false },
      ]);
      expect(html).toBe(
        `id <span class="${SEARCH}">${uuid.slice(0, 8)}</span>` +
          `<span class="${ACCENT}">${uuid.slice(8)}</span> end`,
      );
    });

    it('renders isCurrent ranges with data-search-current and current class', () => {
      const text = 'hello world';
      const html = highlight(text, [
        { start: 0, end: 5, isCurrent: true },
        { start: 6, end: 11, isCurrent: false },
      ]);
      expect(html).toBe(
        `<span class="${CURRENT}" data-search-current="true">hello</span>` +
          ` <span class="${SEARCH}">world</span>`,
      );
    });

    it('highlights search matches over plain text without syntax tokens', () => {
      const html = highlight('foo bar baz', [
        { start: 4, end: 7, isCurrent: false },
      ]);
      expect(html).toBe(`foo <span class="${SEARCH}">bar</span> baz`);
    });
  });
});
