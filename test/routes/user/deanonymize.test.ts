// import { request } from "@/test/server";
import { Client } from 'pg';
import * as faker from 'faker';

import { request } from '../../server';
import { SignInTokens } from '../../../src/utils/tokens';
import { mailHogSearch } from '../../utils';

describe('email-password', () => {
  let client: any;

  beforeAll(async () => {
    client = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    await client.connect();
  });

  afterAll(() => {
    client.end();
  });

  beforeEach(async () => {
    await client.query(`DELETE FROM auth.users;`);
  });

  it('should be able to deanonymize user with email-password', async () => {
    // set env vars
    await request.post('/change-env').send({
      DISABLE_NEW_USERS: false,
      SIGNIN_EMAIL_VERIFIED_REQUIRED: true,
      VERIFY_EMAILS: true,
      WHITELIST_ENABLED: false,
      PROFILE_SESSION_VARIABLE_FIELDS: '',
      REGISTRATION_PROFILE_FIELDS: '',
      ANONYMOUS_USERS_ENABLED: true,
    });

    const { body }: { body: SignInTokens } = await request
      .post('/signin/anonymous')
      .expect(200);

    const { accessToken, refreshToken } = body;

    const email = faker.internet.email();
    const password = faker.internet.password();

    await request
      .post('/user/deanonymize')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        signInMethod: 'email-password',
        email,
        password,
      })
      .expect(200);

    await delay(2000);

    // make sure user activate email was sent
    const [message] = await mailHogSearch(email);
    expect(message).toBeTruthy();

    const ticket = message.Content.Headers['X-Ticket'][0];
    expect(ticket.startsWith('verifyEmail:')).toBeTruthy();

    const emailType = message.Content.Headers['X-Email-Template'][0];
    expect(emailType).toBe('verify-email');

    // should not be abel to login before activated
    await request
      .post('/signin/email-password')
      .send({ email, password })
      .expect(401);

    // should not be able to reuse old refresh token
    await request.post('/token').send({ refreshToken }).expect(401);

    // should verify email using ticket from email
    await request
      .post('/user/email/verify')
      .send({ email, ticket })
      .expect(200);

    // should be able to sign in after activated account
    await request
      .post('/signin/email-password')
      .send({ email, password })
      .expect(200);
  });

  it('should be able to deanonymize user with magic-link', async () => {
    // set env vars
    await request.post('/change-env').send({
      DISABLE_NEW_USERS: false,
      MAGIC_LINK_ENABLED: true,
      VERIFY_EMAILS: true,
      WHITELIST_ENABLED: false,
      PROFILE_SESSION_VARIABLE_FIELDS: '',
      REGISTRATION_PROFILE_FIELDS: '',
      ANONYMOUS_USERS_ENABLED: true,
    });

    const { body }: { body: SignInTokens } = await request
      .post('/signin/anonymous')
      .expect(200);

    const { accessToken, refreshToken } = body;

    const email = 'joedoe@example.com';
    await request
      .post('/user/deanonymize')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        signInMethod: 'magic-link',
        email,
        password: '1234567',
      })
      .expect(200);

    // make sure magic link email was sent
    const [message] = await mailHogSearch(email);
    expect(message).toBeTruthy();

    const otp = message.Content.Headers['X-Otp'][0];
    expect(typeof otp).toBe('string');

    const emailType = message.Content.Headers['X-Email-Template'][0];
    expect(emailType).toBe('magic-link');

    // should not be able to reuse old refresh token
    await request.post('/token').send({ refreshToken }).expect(401);

    // should be abel to sign in with otp from magic link
    await request
      .post('/signin/magic-link/otp')
      .send({ email, otp })
      .expect(200);
  });

  it('should fail to deanonymize user unacceptable sign in method', async () => {
    // set env vars
    await request.post('/change-env').send({
      DISABLE_NEW_USERS: false,
      VERIFY_EMAILS: true,
      WHITELIST_ENABLED: false,
      PROFILE_SESSION_VARIABLE_FIELDS: '',
      REGISTRATION_PROFILE_FIELDS: '',
      ANONYMOUS_USERS_ENABLED: true,
    });

    const { body }: { body: SignInTokens } = await request
      .post('/signin/anonymous')
      .expect(200);

    const { accessToken } = body;

    await request
      .post('/user/deanonymize')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        signInMethod: 'incorrect',
        email: 'joedoe@example.com',
        password: '1234567',
      })
      .expect(400);
  });

  it('should fail to deanonymize user with already existing email', async () => {
    // set env vars
    await request.post('/change-env').send({
      DISABLE_NEW_USERS: false,
      VERIFY_EMAILS: true,
      WHITELIST_ENABLED: false,
      PROFILE_SESSION_VARIABLE_FIELDS: '',
      REGISTRATION_PROFILE_FIELDS: '',
      ANONYMOUS_USERS_ENABLED: true,
    });

    const email = 'joedoe@example.com';
    const password = '1234567';

    await request
      .post('/signup/email-password')
      .send({
        email,
        password,
      })
      .expect(200);

    const { body }: { body: SignInTokens } = await request
      .post('/signin/anonymous')
      .expect(200);

    const { accessToken } = body;

    await request
      .post('/user/deanonymize')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        signInMethod: 'email-password',
        email,
        password,
      })
      .expect(409);
  });
});
