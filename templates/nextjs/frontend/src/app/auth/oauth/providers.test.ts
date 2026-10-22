import { describe, expect, it } from 'vitest';
import { configuredProviders, providerNames } from '@/app/auth/oauth/providers';

const ids = (value: string | undefined) =>
  configuredProviders(value).map((provider) => provider.id);

describe('configuredProviders', () => {
  // A button for a provider nobody set up only leads to the auth service
  // refusing it.
  it('offers none when the variable is unset', () => {
    expect(ids(undefined)).toEqual([]);
    expect(ids('')).toEqual([]);
  });

  it('reads a comma-separated list, forgiving spaces and case', () => {
    expect(ids(' GitHub , google ')).toEqual(['github', 'google']);
  });

  it('ignores ids it does not know', () => {
    expect(ids('github,gitlab')).toEqual(['github']);
  });

  it('keeps the order of providers.ts', () => {
    expect(ids('google,github')).toEqual(['github', 'google']);
  });
});

describe('providerNames', () => {
  it('names one provider, or two joined by or', () => {
    expect(providerNames(configuredProviders('google'))).toBe('Google');
    expect(providerNames(configuredProviders('github,google'))).toBe(
      'GitHub or Google',
    );
  });
});
