import type { JwtSecretFragment } from '@/utils/__generated__/graphql';
import { test } from 'vitest';
import getJwtSecretsWithoutFalsyValues from './getJwtSecretsWithoutFalsyValues';

test('returns array of objects without falsy values and __typename property', () => {
  const input: JwtSecretFragment[] = [
    {
      __typename: 'ConfigJWTSecret',
      issuer: 'test',
      key: null,
      type: undefined,
      jwk_url: '',
      header: 'Authorization',
      claims_namespace_path: '/auth/claims',
      claims_namespace: 'https://example.com/claims',
      claims_format: 'json',
      audience: '',
      allowed_skew: 300,
    },
    {
      __typename: 'ConfigJWTSecret',
      issuer: 'test',
      key: 'test',
      type: 'HS256',
      jwk_url: '',
      header: 'Authorization',
      claims_namespace_path: '/auth/claims',
      claims_namespace: 'https://example.com/claims',
      claims_format: 'json',
      audience: 'audience',
      allowed_skew: 300,
    },
  ];

  expect(getJwtSecretsWithoutFalsyValues(input)).toEqual([
    {
      issuer: 'test',
      header: 'Authorization',
      claims_namespace_path: '/auth/claims',
      claims_namespace: 'https://example.com/claims',
      claims_format: 'json',
      allowed_skew: 300,
    },
    {
      issuer: 'test',
      key: 'test',
      type: 'HS256',
      header: 'Authorization',
      claims_namespace_path: '/auth/claims',
      claims_namespace: 'https://example.com/claims',
      claims_format: 'json',
      audience: 'audience',
      allowed_skew: 300,
    },
  ]);
});
