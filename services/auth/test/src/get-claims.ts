import { Token } from './types';
import { jwtVerify } from 'jose';
import { getSecret } from './generate';

export const verifyJwt = async (jwt: string) => {
  const secret = await getSecret();
  const result = await jwtVerify(jwt, secret);
  return result.payload as unknown as Token;
};
