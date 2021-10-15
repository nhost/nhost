import { Client } from 'pg';

import { ENV } from '../../../../src/utils/env';
import { request } from '../../../server';
import { mailHogSearch, deleteAllMailHogEmails } from '../../../utils';

describe('passwordless email (magic link)', () => {
  let client: any;

  beforeAll(async () => {
    client = new Client({
      connectionString: ENV.HASURA_GRAPHQL_DATABASE_URL,
    });
    await client.connect();
    deleteAllMailHogEmails();
  });

  afterAll(() => {
    client.end();
  });

  beforeEach(async () => {
    await client.query(`DELETE FROM auth.users;`);
  });

  it('should sign in', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_PASSWORDLESS_EMAIL_ENABLED: true,
      AUTH_USER_SESSION_VARIABLE_FIELDS: '',
    });

    const email = 'joedoe@example.com';

    await request
      .post('/signin/passwordless/start')
      .send({
        connection: 'email',
        email,
      })
      .expect(200);

    // get magic link email
    const [message] = await mailHogSearch(email);
    expect(message).toBeTruthy();

    const emailTemplate = message.Content.Headers['X-Email-Template'][0];

    expect(emailTemplate).toBe('passwordless');

    const otp = message.Content.Headers['X-Otp'][0];

    // sign in using OTP
    await request
      .post('/signin/otp')
      .send({
        connection: 'email',
        email,
        otp,
      })
      .expect(200);
  });

  it('should fail to sign in if passworless email is not enabled', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_PASSWORDLESS_EMAIL_ENABLED: false,
      AUTH_USER_SESSION_VARIABLE_FIELDS: '',
    });

    await request
      .post('/signin/passwordless/start')
      .send({
        connection: 'email',
        email: 'joedoe@example.com',
      })
      .expect(404);
  });

  it('should fail to sign if email is not allowed', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_PASSWORDLESS_EMAIL_ENABLED: true,
      AUTH_USER_SESSION_VARIABLE_FIELDS: '',
      AUTH_ACCESS_CONTROL_ALLOWED_EMAILS: 'vip@example.com',
      AUTH_ACCESS_CONTROL_ALLOWED_EMAIL_DOMAINS: '',
      AUTH_ACCESS_CONTROL_BLOCKED_EMAILS: '',
      AUTH_ACCESS_CONTROL_BLOCKED_EMAIL_DOMAINS: '',
    });

    await request
      .post('/signin/passwordless/start')
      .send({
        connection: 'email',
        email: 'joedoe@example.com',
      })
      .expect(403);
  });

  it('should be able to sign in twice. First request will create the user', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_PASSWORDLESS_EMAIL_ENABLED: true,
      AUTH_USER_SESSION_VARIABLE_FIELDS: '',
      AUTH_ACCESS_CONTROL_ALLOWED_EMAILS: '',
      AUTH_ACCESS_CONTROL_ALLOWED_EMAIL_DOMAINS: '',
      AUTH_ACCESS_CONTROL_BLOCKED_EMAILS: '',
      AUTH_ACCESS_CONTROL_BLOCKED_EMAIL_DOMAINS: '',
    });

    await request
      .post('/signin/passwordless/start')
      .send({
        connection: 'email',
        email: 'joedoe@example.com',
      })
      .expect(200);

    await request
      .post('/signin/passwordless/start')
      .send({
        connection: 'email',
        email: 'joedoe@example.com',
      })
      .expect(200);
  });

  it('should succeed sign in with correct default role', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_PASSWORDLESS_EMAIL_ENABLED: true,
      AUTH_USER_SESSION_VARIABLE_FIELDS: '',
    });

    await request
      .post('/signin/passwordless/start')
      .send({
        connection: 'email',
        email: 'joedoe@example.com',
        options: {
          defaultRole: 'user',
        },
      })
      .expect(200);
  });

  it('should fail to sign in with incorrect allowed roles', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_PASSWORDLESS_EMAIL_ENABLED: true,
      AUTH_USER_SESSION_VARIABLE_FIELDS: '',
      AUTH_DEFAULT_USER_ROLE: 'user',
      AUTH_DEFAULT_ALLOWED_USER_ROLES: 'user',
    });

    await request
      .post('/signin/passwordless/start')
      .send({
        connection: 'email',
        email: 'joedoe@example.com',
        allowedRoles: ['incorrect'],
      })
      .expect(400);
  });

  it('should fail if sending emails is not enabled', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTH_EMAILS_ENABLED: false,
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_PASSWORDLESS_EMAIL_ENABLED: true,
      AUTH_USER_SESSION_VARIABLE_FIELDS: '',
    });

    await request
      .post('/signin/passwordless/start')
      .send({
        connection: 'email',
        email: 'joedoe@example.com',
      })
      .expect(500);
  });
});
