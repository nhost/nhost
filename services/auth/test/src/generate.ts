import { importPKCS8, KeyLike } from 'jose';
import { ENV } from './env';
import { createSecretKey } from 'crypto';

export const getSecret = async (): Promise<KeyLike> => {
  const { key, signing_key, type } = ENV.HASURA_GRAPHQL_JWT_SECRET;

  let secret: KeyLike;
  if (type.startsWith('HS')) {
    // For HMAC algorithms (HS256, HS384, HS512)
    secret = createSecretKey(key, 'utf-8');
  } else if (type.startsWith('RS')) {
    // For RSA algorithms (RS256, RS384, RS512)
    // The key should be in PEM format
    if (!signing_key) {
      throw new Error('RSA Private key not provided');
    }

    secret = await importPKCS8(signing_key, type);
  } else {
    throw new Error(`Unsupported algorithm type: ${type}`);
  }

  return secret;
}
