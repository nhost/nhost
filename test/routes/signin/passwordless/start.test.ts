// import { request } from "@/test/server";
import { request } from '../../../server';
import { Client } from 'pg';
import { mailHogSearch, deleteAllMailHogEmails } from '../../../utils';

describe('passwordless email (magic link)', () => {
  let client: any;

  beforeAll(async () => {
    client = new Client({
      connectionString: process.env.DATABASE_URL,
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
      DISABLE_NEW_USERS: false,
      VERIFY_EMAILS: true,
      WHITELIST_ENABLED: false,
      PASSWORDLESS_EMAIL_ENABLED: true,
      REGISTRATION_PROFILE_FIELDS: '',
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
      DISABLE_NEW_USERS: false,
      VERIFY_EMAILS: true,
      WHITELIST_ENABLED: false,
      PASSWORDLESS_EMAIL_ENABLED: false,
      REGISTRATION_PROFILE_FIELDS: '',
    });

    await request
      .post('/signin/passwordless/start')
      .send({
        connection: 'email',
        email: 'joedoe@example.com',
      })
      .expect(404);
  });

  it('should fail to sign if email is not whitelisted', async () => {
    // set env vars
    await request.post('/change-env').send({
      DISABLE_NEW_USERS: false,
      VERIFY_EMAILS: true,
      WHITELIST_ENABLED: true,
      PASSWORDLESS_EMAIL_ENABLED: true,
      REGISTRATION_PROFILE_FIELDS: '',
    });

    await request
      .post('/signin/passwordless/start')
      .send({
        connection: 'email',
        email: 'joedoe@example.com',
      })
      .expect(401);
  });

  it('should be able to sign in twice. First request will create the user', async () => {
    // set env vars
    await request.post('/change-env').send({
      DISABLE_NEW_USERS: false,
      VERIFY_EMAILS: true,
      WHITELIST_ENABLED: false,
      PASSWORDLESS_EMAIL_ENABLED: true,
      REGISTRATION_PROFILE_FIELDS: '',
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
      DISABLE_NEW_USERS: false,
      VERIFY_EMAILS: true,
      WHITELIST_ENABLED: false,
      PASSWORDLESS_EMAIL_ENABLED: true,
      REGISTRATION_PROFILE_FIELDS: '',
      DEFAULT_USER_ROLE: 'user',
      DEFAULT_ALLOWED_USER_ROLES: 'user',
    });

    await request
      .post('/signin/passwordless/start')
      .send({
        connection: 'email',
        email: 'joedoe@example.com',
        defaultRole: 'user',
      })
      .expect(200);
  });

  it('should fail to sign in with incorrect allowed roles', async () => {
    // set env vars
    await request.post('/change-env').send({
      DISABLE_NEW_USERS: false,
      VERIFY_EMAILS: true,
      WHITELIST_ENABLED: false,
      PASSWORDLESS_EMAIL_ENABLED: true,
      REGISTRATION_PROFILE_FIELDS: '',
      DEFAULT_USER_ROLE: 'user',
      DEFAULT_ALLOWED_USER_ROLES: 'user',
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
      DISABLE_NEW_USERS: false,
      VERIFY_EMAILS: true,
      WHITELIST_ENABLED: false,
      PASSWORDLESS_EMAIL_ENABLED: true,
      REGISTRATION_PROFILE_FIELDS: '',
      DEFAULT_USER_ROLE: 'user',
      DEFAULT_ALLOWED_USER_ROLES: 'user',
      EMAILS_ENABLED: false,
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
