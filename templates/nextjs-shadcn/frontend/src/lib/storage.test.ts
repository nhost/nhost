import { describe, expect, it } from 'vitest';
import { withTransform } from '@/lib/storage';

describe('withTransform', () => {
  it('starts a query string when there is not one', () => {
    expect(withTransform('https://s.example/v1/files/abc', { w: 96 })).toBe(
      'https://s.example/v1/files/abc?w=96',
    );
  });

  // A presigned URL carries its signature in the query string. The signature
  // does not cover these parameters, which is what lets a private image be
  // resized the same way a public one is, but they have to be appended rather
  // than replace what is already there.
  it('keeps an existing query string', () => {
    expect(
      withTransform('https://s.example/v1/files/abc?X-Sig=xyz', {
        w: 96,
        q: 80,
      }),
    ).toBe('https://s.example/v1/files/abc?X-Sig=xyz&w=96&q=80');
  });

  it('leaves the URL alone when nothing was asked for', () => {
    expect(withTransform('https://s.example/v1/files/abc', {})).toBe(
      'https://s.example/v1/files/abc',
    );
    expect(
      withTransform('https://s.example/v1/files/abc', { w: undefined }),
    ).toBe('https://s.example/v1/files/abc');
  });

  it('encodes values', () => {
    expect(withTransform('https://s.example/v1/files/abc', { f: 'auto' })).toBe(
      'https://s.example/v1/files/abc?f=auto',
    );
  });
});
