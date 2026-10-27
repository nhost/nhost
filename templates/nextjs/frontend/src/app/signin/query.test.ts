import { afterEach, describe, expect, it } from 'vitest';
import { signInQuery } from '@/app/signin/query';

const size = Object.getOwnPropertyDescriptor(URLSearchParams.prototype, 'size');

describe('signInQuery', () => {
  afterEach(() => {
    if (size) {
      Object.defineProperty(URLSearchParams.prototype, 'size', size);
    }
  });

  it('carries next and intent together, next encoded', () => {
    const query = signInQuery('/account/settings?tab=1&q=a b', 'sign-in');

    expect(query).toBe(
      '?next=%2Faccount%2Fsettings%3Ftab%3D1%26q%3Da+b&intent=sign-in',
    );

    const params = new URLSearchParams(query);

    expect(params.get('next')).toBe('/account/settings?tab=1&q=a b');
    expect(params.get('intent')).toBe('sign-in');
  });
});
