import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_DESTINATION } from '$lib/signin/destination';
import { DEFAULT_INTENT } from '$lib/signin/intent';
import { signInQuery } from '$lib/signin/query';

const size = Object.getOwnPropertyDescriptor(URLSearchParams.prototype, 'size');

describe('signInQuery', () => {
  afterEach(() => {
    if (size) {
      Object.defineProperty(URLSearchParams.prototype, 'size', size);
    }
  });

  it('is empty when it carries only defaults', () => {
    expect(signInQuery(DEFAULT_DESTINATION, DEFAULT_INTENT)).toBe('');
  });

  it('leaves off a default intent', () => {
    expect(signInQuery('/protected', DEFAULT_INTENT)).toBe(
      '?next=%2Fprotected',
    );
  });

  it('leaves off a default next', () => {
    expect(signInQuery(DEFAULT_DESTINATION, 'sign-in')).toBe('?intent=sign-in');
  });

  it('carries next and intent together, next encoded', () => {
    const query = signInQuery('/protected/settings?tab=1&q=a b', 'sign-in');

    expect(query).toBe(
      '?next=%2Fprotected%2Fsettings%3Ftab%3D1%26q%3Da+b&intent=sign-in',
    );

    const params = new URLSearchParams(query);

    expect(params.get('next')).toBe('/protected/settings?tab=1&q=a b');
    expect(params.get('intent')).toBe('sign-in');
  });

  // Safari 16 is still a build target and has no `size`.
  it('works where URLSearchParams has no size', () => {
    Reflect.deleteProperty(URLSearchParams.prototype, 'size');

    expect('size' in URLSearchParams.prototype).toBe(false);
    expect(signInQuery('/protected', 'sign-in')).toBe(
      '?next=%2Fprotected&intent=sign-in',
    );
    expect(signInQuery(DEFAULT_DESTINATION, DEFAULT_INTENT)).toBe('');
  });
});
