import { ENV } from '../../src/env';
import crypto from 'crypto';
import * as faker from 'faker';
import { StatusCodes } from 'http-status-codes';
import { Client } from 'pg';
import { request, resetEnvironment } from '../../server';
import { deleteAllMailHogEmails } from '../../utils';

export const hash = (value: string) =>
  `\\x${crypto.createHash('sha256').update(value).digest('hex')}`;

describe('personal access token', () => {
  let client: Client;
  const email = faker.internet.email();
  const password = faker.internet.password();

  beforeAll(async () => {
    client = new Client({
      connectionString: ENV.HASURA_GRAPHQL_DATABASE_URL,
    });

    await resetEnvironment();
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: false,
    });

    await client.connect();
    await deleteAllMailHogEmails();
  });

  afterAll(async () => {
    await client.end();
  });

  beforeEach(async () => {
    await client.query(`DELETE FROM auth.users;`);
    await client.query(`DELETE FROM auth.refresh_tokens;`);

    await request.post('/signup/email-password').send({
      email,
      password,
    });
  });

  test('should not allow unauthenticated users to create a personal access token', async () => {
    await request
      .post('/pat')
      .send({ expiresAt: new Date() })
      .expect(StatusCodes.BAD_REQUEST);
  });

  test('should be able to add metadata to a personal access token', async () => {
    const response = await request.post('/signin/email-password').send({
      email,
      password,
    });

    const { accessToken } = response.body?.session;

    const patResponse = await request
      .post('/pat')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        metadata: { name: 'Test PAT' },
      })
      .expect(StatusCodes.OK);

    const { rows } = await client.query(
      'SELECT * FROM auth.refresh_tokens WHERE refresh_token_hash=$1;',
      [hash(patResponse.body?.personalAccessToken)]
    );

    expect(rows[0]?.metadata).toEqual({ name: 'Test PAT' });
  });

  test('should authenticate using the PAT workflow', async () => {
    const response = await request.post('/signin/email-password').send({
      email,
      password,
    });

    const { accessToken } = response.body?.session;

    const patResponse = await request
      .post('/pat')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })
      .expect(StatusCodes.OK);

    const { id, personalAccessToken } = patResponse.body;

    expect(id).toBeDefined();
    expect(personalAccessToken).toBeDefined();

    const patSignInResponse = await request
      .post('/signin/pat')
      .send({ personalAccessToken })
      .expect(StatusCodes.OK);

    expect(patSignInResponse.body?.session?.accessToken).toBeDefined();
  });

  test('should not be able to authenticate with a valid refresh token that is not a PAT', async () => {
    const response = await request.post('/signin/email-password').send({
      email,
      password,
    });

    const { user } = response.body?.session;
    const refreshToken = faker.datatype.uuid();

    await client.query(
      'INSERT INTO auth.refresh_tokens (user_id, expires_at, type, refresh_token_hash) VALUES ($1, $2, $3, $4);',
      [
        user.id,
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        'regular',
        hash(refreshToken),
      ]
    );

    // This is a valid refresh token, but it is not a PAT
    await request.post('/token').send({ refreshToken }).expect(StatusCodes.OK);

    // This should fail because the refresh token is not a PAT
    await request
      .post('/signin/pat')
      .send({ personalAccessToken: refreshToken })
      .expect(StatusCodes.UNAUTHORIZED);
  });

  test('should not be able to authenticate with an expired personal access token', async () => {
    const response = await request.post('/signin/email-password').send({
      email,
      password,
    });

    const { user } = response.body?.session;
    const expiredPersonalAccessToken = faker.datatype.uuid();

    await client.query(
      'INSERT INTO auth.refresh_tokens (user_id, expires_at, type, refresh_token_hash) VALUES ($1, $2, $3, $4);',
      [
        user.id,
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        'pat',
        hash(expiredPersonalAccessToken),
      ]
    );

    const expiredResponse = await request
      .post('/signin/pat')
      .send({ personalAccessToken: expiredPersonalAccessToken })
      .expect(StatusCodes.UNAUTHORIZED);

    expect(expiredResponse.body?.message).toBe(
      'Invalid or expired personal access token'
    );
  });
});
