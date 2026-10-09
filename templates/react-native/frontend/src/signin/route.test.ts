import { describe, expect, it } from 'vitest';
import { DEFAULT_DESTINATION } from '@/signin/destination';
import { DEFAULT_INTENT } from '@/signin/intent';
import { signInRoute } from '@/signin/route';

describe('signInRoute', () => {
  it('is the bare path when it carries only defaults', () => {
    expect(signInRoute('/signin', DEFAULT_DESTINATION, DEFAULT_INTENT)).toBe(
      '/signin',
    );
  });

  it('leaves off a default intent when next is not the default', () => {
    expect(signInRoute('/signin', '/protected', DEFAULT_INTENT)).toEqual({
      pathname: '/signin',
      params: { next: '/protected' },
    });
  });

  it('carries next and intent to the path it is given', () => {
    expect(signInRoute('/somewhere', '/protected', 'sign-in')).toEqual({
      pathname: '/somewhere',
      params: { next: '/protected', intent: 'sign-in' },
    });
  });
});
