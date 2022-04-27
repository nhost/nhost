import { Client } from 'pg';
import { StatusCodes } from 'http-status-codes';

import { ENV } from '../../../src/utils/env';
import { request } from '../../server';
import { SignInResponse } from '../../../src/types';
import {
  mailHogSearch,
  deleteAllMailHogEmails,
  expectUrlParameters,
} from '../../utils';

// TODO: test options
describe('email-password', () => {
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
    await deleteAllMailHogEmails();
  });

  it('should be able to deanonymize user with email-password', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_ANONYMOUS_USERS_ENABLED: true,
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: true,
    });

    const { body }: { body: SignInResponse } = await request
      .post('/signin/anonymous')
      .expect(StatusCodes.OK);

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
      .expect(StatusCodes.OK);

    // make sure user activate email was sent
    const [message] = await mailHogSearch(email);

    expect(message).toBeTruthy();

    const link = message.Content.Headers['X-Link'][0];

    // should not be abel to login before email is verified
    await request
      .post('/signin/email-password')
      .send({ email, password })
      .expect(StatusCodes.UNAUTHORIZED);

    // should not be able to reuse old refresh token
    await request
      .post('/token')
      .send({ refreshToken })
      .expect(StatusCodes.UNAUTHORIZED);

    // should verify email using ticket from email
    const res = await request
      .get(link.replace('http://localhost:4000', ''))
      .expect(StatusCodes.MOVED_TEMPORARILY);

    expectUrlParameters(res).not.toIncludeAnyMembers([
      'error',
      'errorDescription',
    ]);
    // should be able to sign in after activated account
    await request
      .post('/signin/email-password')
      .send({ email, password })
      .expect(StatusCodes.OK);
  });

  it('should be able to deanonymize user with magic-link', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_EMAIL_PASSWORDLESS_ENABLED: true,
      AUTH_ANONYMOUS_USERS_ENABLED: true,
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: true,
    });

    const { body }: { body: SignInResponse } = await request
      .post('/signin/anonymous')
      .expect(StatusCodes.OK);

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
      .expect(StatusCodes.OK);

    // make sure magic link email was sent
    const [message] = await mailHogSearch(email);
    expect(message).toBeTruthy();

    const link = message.Content.Headers['X-Link'][0];

    // should not be able to reuse old refresh token
    await request
      .post('/token')
      .send({ refreshToken })
      .expect(StatusCodes.UNAUTHORIZED);

    // verify
    const res = await request
      .get(link.replace('http://localhost:4000', ''))
      .expect(StatusCodes.MOVED_TEMPORARILY);

    expectUrlParameters(res).not.toIncludeAnyMembers([
      'error',
      'errorDescription',
    ]);

    // should be able to sign in using passwordless email
    await request
      .post('/signin/passwordless/email')
      .send({
        email,
      })
      .expect(StatusCodes.OK);
  });

  it('should fail to deanonymize user unacceptable sign in method', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_EMAIL_PASSWORDLESS_ENABLED: true,
      AUTH_ANONYMOUS_USERS_ENABLED: true,
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: true,
    });

    const { body }: { body: SignInResponse } = await request
      .post('/signin/anonymous')
      .expect(StatusCodes.OK);

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
      .expect(StatusCodes.BAD_REQUEST);
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
      .expect(StatusCodes.OK);

    const { body }: { body: SignInResponse } = await request
      .post('/signin/anonymous')
      .expect(StatusCodes.OK);

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
      .expect(StatusCodes.CONFLICT);
  });
});
