// import { request } from "@/test/server";
import { request } from '../../server';
import { Client } from 'pg';
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
      AUTO_ACTIVATE_NEW_USERS: false,
      VERIFY_EMAILS: true,
      WHITELIST_ENABLED: false,
      PROFILE_SESSION_VARIABLE_FIELDS: '',
      REGISTRATION_CUSTOM_FIELDS: '',
      ANONYMOUS_USERS_ENABLED: true,
    });

    const { body }: { body: SignInTokens } = await request
      .post('/signin/anonymous')
      .expect(200);

    const { accessToken, refreshToken } = body;

    const email = 'joedoe@example.com';
    const password = '1234567';

    await request
      .post('/user/deanonymize')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        signInMethod: 'email-password',
        email,
        password,
      })
      .expect(200);

    // make sure user activate email was sent
    const [message] = await mailHogSearch(email);
    expect(message).toBeTruthy();

    const ticket = message.Content.Headers['X-Ticket'][0];
    expect(ticket.startsWith('userActivate:')).toBeTruthy();

    const emailType = message.Content.Headers['X-Email-Type'][0];
    expect(emailType).toBe('activate-user');

    // should not be abel to login before activated
    await request
      .post('/signin/email-password')
      .send({ email, password })
      .expect(401);

    // should not be able to reuse old refresh token
    await request.post('/token').send({ refreshToken }).expect(401);

    // should be abel to activate account with ticket from email
    await request.post('/user/activate').send({ ticket }).expect(200);

    // should be able to sign in after activated account
    await request
      .post('/signin/email-password')
      .send({ email, password })
      .expect(200);
  });

  it('should be able to deanonymize user with magic-link', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTO_ACTIVATE_NEW_USERS: false,
      VERIFY_EMAILS: true,
      WHITELIST_ENABLED: false,
      PROFILE_SESSION_VARIABLE_FIELDS: '',
      REGISTRATION_CUSTOM_FIELDS: '',
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

    const ticket = message.Content.Headers['X-Ticket'][0];
    expect(ticket.startsWith('magicLink:')).toBeTruthy();

    const emailType = message.Content.Headers['X-Email-Type'][0];
    expect(emailType).toBe('magic-link');

    // should not be able to reuse old refresh token
    await request.post('/token').send({ refreshToken }).expect(401);

    // should be abel to activate account with ticket from email
    await request
      .post('/signin/magic-link/callback')
      .send({ ticket })
      .expect(200);
  });

  it('should fail to deanonymize user unacceptable sign in method', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTO_ACTIVATE_NEW_USERS: false,
      VERIFY_EMAILS: true,
      WHITELIST_ENABLED: false,
      PROFILE_SESSION_VARIABLE_FIELDS: '',
      REGISTRATION_CUSTOM_FIELDS: '',
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
      AUTO_ACTIVATE_NEW_USERS: false,
      VERIFY_EMAILS: true,
      WHITELIST_ENABLED: false,
      PROFILE_SESSION_VARIABLE_FIELDS: '',
      REGISTRATION_CUSTOM_FIELDS: '',
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
