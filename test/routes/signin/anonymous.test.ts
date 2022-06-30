import { Client } from 'pg';
import * as faker from 'faker';
import { StatusCodes } from 'http-status-codes';

import { ENV } from '../../../src/utils/env';
import { request } from '../../server';
import { isValidAccessToken } from '../../utils';
import { SignInResponse } from '../../../src/types';

describe('anonymous', () => {
  let client: Client;

  beforeAll(async () => {
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

  it('should sign in as anonymous', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_ANONYMOUS_USERS_ENABLED: true,
    });

    const { body }: { body: SignInResponse } = await request
      .post('/signin/anonymous')
      .expect(StatusCodes.OK);

    expect(body.session).toBeTruthy();

    if (!body.session) {
      throw new Error('session is not set');
    }

    const { accessToken, accessTokenExpiresIn, refreshToken } = body.session;
    const { mfa } = body;

    expect(isValidAccessToken(accessToken)).toBe(true);
    expect(typeof accessTokenExpiresIn).toBe('number');
    expect(typeof refreshToken).toBe('string');
    expect(mfa).toBe(null);
  });

  it('should fail to sign in anonymously with email', async () => {
    await request
      .post('/signin/anonymous')
      .send({
        email: faker.internet.email(),
      })
      .expect(StatusCodes.BAD_REQUEST);
  });

  it('should fail to sign in anonymously if not enabled', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_ANONYMOUS_USERS_ENABLED: false,
    });

    await request.post('/signin/anonymous').expect(StatusCodes.NOT_FOUND);
  });
});
