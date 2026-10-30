import { StatusCodes } from 'http-status-codes';
import * as jose from 'jose';
import { Client } from 'pg';

import { ENV } from '../../src/env';
import { request, resetEnvironment } from '../../server';
import { isValidAccessToken } from '../../utils';

describe('token', () => {
  let client: Client;

  beforeAll(async () => {
    await resetEnvironment();
    client = new Client({
      connectionString: ENV.HASURA_GRAPHQL_DATABASE_URL,
    });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  beforeEach(async () => {
    await client.query(`DELETE FROM auth.users;`);
  });

  it('should should sign in and get access token with standard claims', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_ANONYMOUS_USERS_ENABLED: true,
    });

    const { body } = await request
      .post('/signin/anonymous')
      .send()
      .expect(StatusCodes.OK);

    const { accessToken, accessTokenExpiresIn, refreshToken } = body.session;
    const { mfa } = body;

    expect(await isValidAccessToken(accessToken)).toBe(true);
    expect(typeof accessTokenExpiresIn).toBe('number');
    expect(typeof refreshToken).toBe('string');
    expect(mfa).toBe(undefined);
  });

  it('should keep sid and issue a new jti on refresh', async () => {
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_ANONYMOUS_USERS_ENABLED: true,
    });

    const { body } = await request
      .post('/signin/anonymous')
      .send()
      .expect(StatusCodes.OK);

    const { body: refreshed } = await request
      .post('/token')
      .send({ refreshToken: body.session.refreshToken })
      .expect(StatusCodes.OK);

    const initialClaims = jose.decodeJwt(body.session.accessToken);
    const refreshedClaims = jose.decodeJwt(refreshed.accessToken);
    expect(refreshedClaims.sid).toBe(body.session.refreshTokenId);
    expect(refreshedClaims.sid).toBe(initialClaims.sid);
    expect(refreshedClaims.jti).not.toBe(initialClaims.jti);
  });
});
