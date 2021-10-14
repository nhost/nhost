import { Client } from 'pg';

import { ENV } from '../../../src/utils/env';
import { request } from '../../server';
import { deleteAllMailHogEmails, isValidAccessToken } from '../../utils';

describe('email-password', () => {
  let client: any;

  beforeAll(async () => {
    client = new Client({
      connectionString: ENV.HASURA_GRAPHQL_DATABASE_URL,
    });
    await client.connect();
    await deleteAllMailHogEmails();
  });

  afterAll(() => {
    client.end();
  });

  beforeEach(async () => {
    await client.query(`DELETE FROM auth.users;`);
  });

  it('should sign in user and return valid tokens', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_SIGNIN_EMAIL_VERIFIED_REQUIRED: false,
      AUTH_ANONYMOUS_USERS_ENABLED: false,
      AUTH_USER_SESSION_VARIABLE_FIELDS: '',
    });

    await request
      .post('/signup/email-password')
      .send({ email: 'joedoe@example.com', password: '123456' })
      .expect(200);

    // const { status, body } = await request
    const { body } = await request
      .post('/signin/email-password')
      .send({ email: 'joedoe@example.com', password: '123456' })
      .expect(200);

    const { accessToken, accessTokenExpiresIn, refreshToken } = body.session;
    const { mfa } = body;

    expect(isValidAccessToken(accessToken)).toBe(true);
    expect(typeof accessTokenExpiresIn).toBe('number');
    expect(typeof refreshToken).toBe('string');
    expect(mfa).toBe(null);
  });

  it('should only allow emails that are allowed', async () => {
    // sign up
    await await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_ACCESS_CONTROL_ALLOWED_EMAILS: '',
      AUTH_ACCESS_CONTROL_ALLOWED_EMAIL_DOMAINS: '',
      AUTH_ACCESS_CONTROL_BLOCKED_EMAILS: '',
      AUTH_ACCESS_CONTROL_BLOCKED_EMAIL_DOMAINS: '',
    });

    await request
      .post('/signup/email-password')
      .send({ email: 'aaa@nhost.io', password: '123456' })
      .expect(200);

    await request
      .post('/signup/email-password')
      .send({ email: 'bbb@nhost.io', password: '123456' })
      .expect(200);

    // sign in
    await await request.post('/change-env').send({
      AUTH_ACCESS_CONTROL_ALLOWED_EMAILS: 'aaa@nhost.io',
      AUTH_ACCESS_CONTROL_ALLOWED_EMAIL_DOMAINS: '',
      AUTH_ACCESS_CONTROL_BLOCKED_EMAILS: '',
      AUTH_ACCESS_CONTROL_BLOCKED_EMAIL_DOMAINS: '',
    });

    await request
      .post('/signin/email-password')
      .send({ email: 'aaa@nhost.io', password: '123456' })
      .expect(200);

    await request
      .post('/signin/email-password')
      .send({ email: 'bbb@nhost.io', password: '123456' })
      .expect(403);
  });
});
