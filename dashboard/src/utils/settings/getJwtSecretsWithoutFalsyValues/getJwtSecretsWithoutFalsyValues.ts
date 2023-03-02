import type { JwtSecretFragment } from '@/utils/__generated__/graphql';

/**
 * Returns a new array of JWT secrets without the keys that had falsy values in
 * the original object. This function also removes the __typename key from the
 * original object.
 *
 * @param jwtSecrets - A list of JWT secrets.
 * @returns A new array of JWT secrets without the keys that had falsy values or
 * the __typename key.
 */
export default function getJwtSecretsWithoutFalsyValues(
  jwtSecrets: JwtSecretFragment[],
) {
  return jwtSecrets.map((secret) =>
    Object.keys(secret).reduce(
      (secretWithoutFalsyValues, key) =>
        secret[key] && key !== '__typename'
          ? { ...secretWithoutFalsyValues, [key]: secret[key] }
          : secretWithoutFalsyValues,
      {},
    ),
  );
}
