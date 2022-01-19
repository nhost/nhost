import { Client } from 'pg';

import { ENV } from '../../../src/utils/env';
import { request } from '../../server';
import { SignInResponse } from '../../../src/types';
import { mailHogSearch, deleteAllMailHogEmails } from '../../utils';

// TODO test options
describe('email-password', () => {
  let client: Client;

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
    await deleteAllMailHogEmails();
  });

  it('should be able to deanonymize user with email-password', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_ANONYMOUS_USERS_ENABLED: true,
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: true,
      AUTH_USER_SESSION_VARIABLE_FIELDS: '',
    });

    const { body }: { body: SignInResponse } = await request
      .post('/signin/anonymous')
      .expect(200);

    expect(body.session).toBeTruthy();

    if (!body.session) {
      throw new Error('session is not set');
    }

    const { accessToken, refreshToken } = body.session;

    const email = 'something@example.com'; //faker.internet.email();
    const password = '123123123'; //faker.internet.password();

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
    const redirectTo = message.Content.Headers['X-Redirect-To'][0];

    // should not be abel to login before email is verified
    await request
      .post('/signin/email-password')
      .send({ email, password })
      .expect(401);

    // should not be able to reuse old refresh token
    await request.post('/token').send({ refreshToken }).expect(401);

    // should verify email using ticket from email
    await request
      .get(
        `/verify?ticket=${ticket}&type=signinPasswordless&redirectTo=${redirectTo}`
      )
      .expect(302);

    // should be able to sign in after activated account
    await request
      .post('/signin/email-password')
      .send({ email, password })
      .expect(200);
  });

  it('should be able to deanonymize user with magic-link', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_EMAIL_PASSWORDLESS_ENABLED: true,
      AUTH_ANONYMOUS_USERS_ENABLED: true,
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: true,
      AUTH_USER_SESSION_VARIABLE_FIELDS: '',
    });

    const { body }: { body: SignInResponse } = await request
      .post('/signin/anonymous')
      .expect(200);

    expect(body.session).toBeTruthy();

    if (!body.session) {
      throw new Error('session is not set');
    }

    const { accessToken, refreshToken } = body.session;

    const email = 'joedoe@example.com';
    await request
      .post('/user/deanonymize')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        signInMethod: 'passwordless',
        connection: 'email',
        email,
        password: '1234567',
      })
      .expect(200);

    // make sure magic link email was sent
    const [message] = await mailHogSearch(email);
    expect(message).toBeTruthy();

    const ticket = message.Content.Headers['X-Ticket'][0];
    const redirectTo = message.Content.Headers['X-Redirect-To'][0];

    // should not be able to reuse old refresh token
    await request.post('/token').send({ refreshToken }).expect(401);

    // verify
    await request
      .get(
        `/verify?ticket=${ticket}&type=signinPasswordless&redirectTo=${redirectTo}`
      )
      .expect(302);

    // should be able to sign in using passwordless email
    await request
      .post('/signin/passwordless/email')
      .send({
        email,
      })
      .expect(200);
  });

  it('should fail to deanonymize user unacceptable sign in method', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_EMAIL_PASSWORDLESS_ENABLED: true,
      AUTH_ANONYMOUS_USERS_ENABLED: true,
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: true,
      AUTH_USER_SESSION_VARIABLE_FIELDS: '',
    });

    const { body }: { body: SignInResponse } = await request
      .post('/signin/anonymous')
      .expect(200);

    expect(body.session).toBeTruthy();

    if (!body.session) {
      throw new Error('session is not set');
    }

    const { accessToken } = body.session;

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

    const { body }: { body: SignInResponse } = await request
      .post('/signin/anonymous')
      .expect(200);

    expect(body.session).toBeTruthy();

    if (!body.session) {
      throw new Error('session is not set');
    }

    const { accessToken } = body.session;

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
