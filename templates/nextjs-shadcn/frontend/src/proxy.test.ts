import { describe, expect, it } from 'vitest';
import { config } from '@/proxy';

// Next.js compiles config.matcher into a full-path matcher. We approximate it
// here to guard against the matcher silently skipping real application routes,
// which is what an unanchored exclusion term (e.g. a bare "public") caused.
const [pattern = ''] = config.matcher;
const matcher = new RegExp(`^${pattern}$`);

describe('proxy route matcher', () => {
  it('runs on application routes', () => {
    for (const path of [
      '/',
      '/protected',
      '/signin',
      '/publications',
      '/public-profile',
    ]) {
      expect(matcher.test(path)).toBe(true);
    }
  });

  it('skips framework internals and static assets', () => {
    for (const path of [
      '/_next/static/chunk.js',
      '/_next/image',
      '/api/todos',
      '/favicon.svg',
    ]) {
      expect(matcher.test(path)).toBe(false);
    }
  });
});
