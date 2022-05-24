import { Client } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { StatusCodes } from 'http-status-codes';
import * as faker from 'faker';

import { ENV } from '../../../src/utils/env';
import { request } from '../../server';
import { SignInResponse } from '../../../src/types';
import {
  expectUrlParameters,
  mailHogSearch,
  getUrlParameters,
} from '../../utils';
import { ERRORS } from '@/errors';

describe('user email', () => {
  let client: Client;
  let accessToken: string | undefined;
  let body: SignInResponse | undefined;
  const email = faker.internet.email();
  const password = faker.internet.password(8);

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
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: false,
    });

    await request
      .post('/signup/email-password')
      .send({ email, password })
      .expect(StatusCodes.OK);

    const response = await request
      .post('/signin/email-password')
      .send({ email, password })
      .expect(StatusCodes.OK);
    body = response.body;

    if (!body?.session) {
      throw new Error('session is not set');
    }

    accessToken = body.session.accessToken;
  });

  it('change email', async () => {
    expect(body?.session).toBeTruthy();

    // request to reset (to-change) email

    const newEmail = faker.internet.email();

    await request
      .post('/user/email/change')
      // .set('Authorization', `Bearer ${accessToken}`)
      .send({ newEmail })
      .expect(StatusCodes.UNAUTHORIZED);

    await request
      .post('/user/email/change')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newEmail })
      .expect(StatusCodes.OK);

    // get ticket on new email
    const [message] = await mailHogSearch(newEmail);
    expect(message).toBeTruthy();

    const redirectTo = message.Content.Headers['X-Redirect-To'][0];
    const link = message.Content.Headers['X-Link'][0];

    const emailType = message.Content.Headers['X-Email-Template'][0];
    expect(emailType).toBe('email-confirm-change');

    // wrong ticket should fail
    const res = await request
      .get(
        `/verify?ticket=${uuidv4()}&type=emailConfirmChange&redirectTo=${redirectTo}`
      )
      .expect(StatusCodes.MOVED_TEMPORARILY);

    expectUrlParameters(res).toIncludeAllMembers(['error', 'errorDescription']);

    // confirm change email
    const res2 = await request
      .get(link.replace('http://localhost:4000', ''))
      .expect(StatusCodes.MOVED_TEMPORARILY);

    expectUrlParameters(res2).not.toIncludeAnyMembers([
      'error',
      'errorDescription',
    ]);

    // fail to signin with old email
    await request
      .post('/signin/email-password')
      .send({ email, password })
      .expect(StatusCodes.UNAUTHORIZED);

    // sign in with new email
    await request
      .post('/signin/email-password')
      .send({ email: newEmail, password })
      .expect(StatusCodes.OK);
  });
  it('should not allow changing the email to one that is already used by another user', async () => {
    expect(body?.session).toBeTruthy();

    // * Create another account
    const existingEmail = faker.internet.email();
    await request
      .post('/signup/email-password')
      .send({ email: existingEmail, password: faker.internet.password(8) })
      .expect(StatusCodes.OK);

    const res = await request
      .post('/user/email/change')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newEmail: existingEmail })
      .expect(StatusCodes.CONFLICT);
    expect(res.body).toMatchObject(ERRORS['email-already-in-use']);
  });

  it('should not allow changing the email to one that has been created after sending the verification link', async () => {
    expect(body?.session).toBeTruthy();

    const existingEmail = faker.internet.email();

    await request
      .post('/user/email/change')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newEmail: existingEmail })
      .expect(StatusCodes.OK);

    // * In the meantime, create another account with the same email
    await request
      .post('/signup/email-password')
      .send({ email: existingEmail, password: faker.internet.password(8) })
      .expect(StatusCodes.OK);

    // get ticket on new email
    const [message] = await mailHogSearch(existingEmail);
    expect(message).toBeTruthy();

    const link = message.Content.Headers['X-Link'][0];

    // wrong ticket should fail
    const res = await request
      .get(link.replace('http://localhost:4000', ''))
      .expect(StatusCodes.MOVED_TEMPORARILY);

    const urlParams = getUrlParameters(res);
    expect(urlParams.get('error')).toEqual('email-already-in-use');
    expect(urlParams.get('errorDescription')).toEqual(
      ERRORS['email-already-in-use'].message
    );
  });

  it('change email with redirect', async () => {
    expect(body?.session).toBeTruthy();

    const options = {
      redirectTo: 'http://localhost:3000/email-redirect',
    };

    const newEmail = faker.internet.email();

    await request
      .post('/user/email/change')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newEmail, options })
      .expect(StatusCodes.OK);

    // get ticket on new email
    const [message] = await mailHogSearch(newEmail);
    expect(message).toBeTruthy();

    const link = message.Content.Headers['X-Link'][0];
    const redirectTo = message.Content.Headers['X-Redirect-To'][0];
    const emailType = message.Content.Headers['X-Email-Template'][0];
    expect(emailType).toBe('email-confirm-change');

    // confirm change email
    const res = await request
      .get(link.replace('http://localhost:4000', ''))
      .expect(StatusCodes.MOVED_TEMPORARILY);

    expectUrlParameters(res).not.toIncludeAnyMembers([
      'error',
      'errorDescription',
    ]);

    expect(redirectTo).toStrictEqual(options.redirectTo);
  });

  it('send email verification', async () => {
    await request
      .post('/user/email/send-verification-email')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ email })
      .expect(StatusCodes.OK);

    // get ticket on new email
    const [message] = await mailHogSearch(email);
    expect(message).toBeTruthy();

    const redirectTo = message.Content.Headers['X-Redirect-To'][0];
    const emailType = message.Content.Headers['X-Email-Template'][0];
    const link = message.Content.Headers['X-Link'][0];
    expect(emailType).toBe('email-verify');

    const res = await request
      .get(
        `/verify?ticket=${uuidv4()}&type=emailConfirmChange&redirectTo=${redirectTo}`
      )
      .expect(StatusCodes.MOVED_TEMPORARILY);
    expectUrlParameters(res).toIncludeAllMembers(['error', 'errorDescription']);

    // confirm change email
    const res2 = await request
      .get(link.replace('http://localhost:4000', ''))
      .expect(StatusCodes.MOVED_TEMPORARILY);
    expectUrlParameters(res2).not.toIncludeAnyMembers([
      'error',
      'errorDescription',
    ]);
  });

  it('send email verification with redirect', async () => {
    const options = {
      redirectTo: 'http://localhost:3000/validation-email-redirect',
    };

    await request
      .post('/user/email/send-verification-email')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ email, options })
      .expect(StatusCodes.OK);

    // get ticket on new email
    const [message] = await mailHogSearch(email);
    expect(message).toBeTruthy();

    const redirectTo = message.Content.Headers['X-Redirect-To'][0];
    const link = message.Content.Headers['X-Link'][0];
    expect(redirectTo).toStrictEqual(options.redirectTo);
    // confirm change email
    const res = await request
      .get(link.replace('http://localhost:4000', ''))
      .expect(StatusCodes.MOVED_TEMPORARILY);
    expectUrlParameters(res).not.toIncludeAnyMembers([
      'error',
      'errorDescription',
    ]);
  });
});
