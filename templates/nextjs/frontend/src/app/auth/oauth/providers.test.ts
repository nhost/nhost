import { describe, expect, it } from 'vitest';
import { configuredProviders } from '@/app/auth/oauth/providers';

const ids = (value: string | undefined) =>
  configuredProviders(value).map((provider) => provider.id);

describe('configuredProviders', () => {
  it('reads a comma-separated list, forgiving spaces and case', () => {
    expect(ids(' GitHub , google ')).toEqual(['github', 'google']);
  });
});
