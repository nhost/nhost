import { Client } from 'pg';

import { ENV } from '../../../src/utils/env';
import { request } from '../../server';
import { decodeAccessToken, isValidAccessToken } from '../../utils';

describe('token', () => {
  let client: any;

  beforeAll(async () => {
    client = new Client({
      connectionString: ENV.HASURA_GRAPHQL_DATABASE_URL,
    });
    await client.connect();
  });

  afterAll(() => {
    client.end();
  });

  beforeEach(async () => {
    await client.query(`DELETE FROM auth.users;`);
  });

  it('should should sign in and get access token with standard claims', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_ANONYMOUS_USERS_ENABLED: true,
      AUTH_USER_SESSION_VARIABLE_FIELDS: '',
    });

    const { body } = await request.post('/signin/anonymous').send().expect(200);

    const { accessToken, accessTokenExpiresIn, refreshToken } = body.session;
    const { mfa } = body;

    expect(isValidAccessToken(accessToken)).toBe(true);
    expect(typeof accessTokenExpiresIn).toBe('number');
    expect(typeof refreshToken).toBe('string');
    expect(mfa).toBe(null);
  });

  it('should should sign in and get access token with email user fields', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_SIGNIN_EMAIL_VERIFIED_REQUIRED: false,
      AUTH_USER_SESSION_VARIABLE_FIELDS: 'email',
    });

    const email = 'joedoe@example.com';
    const password = '123123123123';

    await request
      .post('/signup/email-password')
      .send({
        email,
        password,
      })
      .expect(200);

    const { body } = await request
      .post('/signin/email-password')
      .send({
        email,
        password,
      })
      .expect(200);

    const token = decodeAccessToken(body.session.accessToken);

    if (!token) {
      throw new Error('Token not set');
    }

    expect(token['https://hasura.io/jwt/claims']['x-hasura-user-email']).toBe(
      email
    );
  });
});
