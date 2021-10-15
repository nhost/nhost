import { Client } from 'pg';

import { ENV } from '../../../src/utils/env';
import { request } from '../../server';
import { mailHogSearch, deleteAllMailHogEmails } from '../../utils';

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

  it('should sign up user', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_EMAILS_ENABLED: true,
    });

    await request
      .post('/signup/email-password')
      .send({ email: 'joedoe@example.com', password: '123456' })
      .expect(200);
  });

  it('should fail to sign up with same email', async () => {
    // set env vars
    await await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
    });

    await request
      .post('/signup/email-password')
      .send({ email: 'joedoe@example.com', password: '123456' })
      .expect(200);

    await request
      .post('/signup/email-password')
      .send({ email: 'joedoe@example.com', password: '123456' })
      .expect(409);
  });

  it('should fail with weak password', async () => {
    // set env vars
    await await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_HIBP_ENABLED: true,
    });

    await request
      .post('/signup/email-password')
      .send({ email: 'joedoe@example.com', password: '123456' })
      .expect(400);
  });

  it('should succeed to sign up with different emails', async () => {
    // set env vars
    await await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_HIBP_ENABLED: false,
    });

    await request
      .post('/signup/email-password')
      .send({ email: 'joedoe@example.com', password: '123456' })
      .expect(200);

    await request
      .post('/signup/email-password')
      .send({ email: 'joedoes@example.com', password: '123456' })
      .expect(200);
  });

  it('should success with SMTP settings', async () => {
    // set env vars
    await await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_HIBP_ENABLED: false,
      AUTH_SIGNIN_EMAIL_VERIFIED_REQUIRED: true,
    });

    const email = 'joedoe@example.com';

    await request
      .post('/signup/email-password')
      .send({ email, password: '123456' })
      .expect(200);

    // fetch email from mailhog and check ticket
    const [message] = await mailHogSearch(email);
    expect(message).toBeTruthy();
    const ticket = message.Content.Headers['X-Ticket'][0];
    expect(ticket.startsWith('verifyEmail:')).toBeTruthy();
  });

  it('default role must be part of allowed roles', async () => {
    const email = 'joedoe@example.com';

    await request
      .post('/signup/email-password')
      .send({
        email,
        password: '123456',
        defaultRole: 'user',
        allowedRoles: ['editor'],
      })
      .expect(400);
  });

  it('allowed roles must be subset of env var ALLOWED_USER_ROLES', async () => {
    // set env vars
    await await request.post('/change-env').send({
      ALLOWED_USER_ROLES: 'user,editor',
    });

    const email = 'joedoe@example.com';

    await request
      .post('/signup/email-password')
      .send({
        email,
        password: '123456',
        defaultRole: 'user',
        allowedRoles: ['user', 'some-other-role'],
      })
      .expect(400);
  });

  it('user must verify email before being able to sign in', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_SIGNIN_EMAIL_VERIFIED_REQUIRED: true,
    });

    const email = 'joedoe@example.com';
    const password = '123123';

    await request
      .post('/signup/email-password')
      .send({ email, password })
      .expect(200);

    await request
      .post('/signin/email-password')
      .send({ email, password })
      .expect(401);

    // get ticket from email
    const [message] = await mailHogSearch(email);
    expect(message).toBeTruthy();
    const ticket = message.Content.Headers['X-Ticket'][0];

    // use ticket to verify email
    await request
      .get(`/verify?ticket=${ticket}&type=signinPasswordless`)
      .expect(302);

    // sign in should now work
    await request
      .post('/signin/email-password')
      .send({ email, password })
      .expect(200);
  });
});
