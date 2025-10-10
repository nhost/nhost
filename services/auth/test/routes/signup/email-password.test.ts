import { Client } from 'pg';
import * as faker from 'faker';
import { StatusCodes } from 'http-status-codes';

import { ENV } from '../../src/env';
import { request, resetEnvironment } from '../../server';
import {
  mailHogSearch,
  deleteAllMailHogEmails,
  verfiyUserTicket,
} from '../../utils';

describe('email-password', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({
      connectionString: ENV.HASURA_GRAPHQL_DATABASE_URL,
    });
    await client.connect();
    await deleteAllMailHogEmails();

    await resetEnvironment();
  });

  afterAll(async () => {
    await client.end();
  });

  beforeEach(async () => {
    await client.query(`DELETE FROM auth.users;`);
  });

  it('should sign up user', async () => {
    const email = faker.internet.email();
    const password = faker.internet.password();

    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
    });

    await request
      .post('/signup/email-password')
      .send({ email, password })
      .expect(StatusCodes.OK);
  });

  it('should fail to sign up with same email', async () => {
    const email = faker.internet.email();
    const password = faker.internet.password();

    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
    });

    await request
      .post('/signup/email-password')
      .send({ email, password })
      .expect(StatusCodes.OK);

    await request
      .post('/signup/email-password')
      .send({ email, password })
      .expect(StatusCodes.CONFLICT);
  });

  it('should fail with weak password', async () => {
    const email = faker.internet.email();
    const password = '123456';
    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_PASSWORD_HIBP_ENABLED: true,
    });

    await request
      .post('/signup/email-password')
      .send({ email, password })
      .expect(StatusCodes.BAD_REQUEST, {
        error: 'password-in-hibp-database',
        message: 'Password is in HIBP database',
        status: 400
      });
  });

  it('should succeed to sign up with different emails', async () => {
    const emailA = faker.internet.email();
    const passwordA = faker.internet.password();
    const emailB = faker.internet.email();
    const passwordB = faker.internet.password();
    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_PASSWORD_HIBP_ENABLED: false,
    });

    await request
      .post('/signup/email-password')
      .send({ email: emailA, password: passwordA })
      .expect(StatusCodes.OK);

    await request
      .post('/signup/email-password')
      .send({ email: emailB, password: passwordB })
      .expect(StatusCodes.OK);
  });

  it('should success with SMTP settings', async () => {
    const email = faker.internet.email();
    const password = faker.internet.password();

    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_HIBP_ENABLED: false,
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: true,
    });

    await request
      .post('/signup/email-password')
      .send({ email, password })
      .expect(StatusCodes.OK);

    // fetch email from mailhog and check ticket
    const [message] = await mailHogSearch(email);
    expect(message).toBeTruthy();
    const ticket = message.Content.Headers['X-Ticket'][0];
    expect(ticket.startsWith('verifyEmail:')).toBeTruthy();
  });

  it('default role must be part of allowed roles', async () => {
    const email = faker.internet.email();
    const password = faker.internet.password();

    await request
      .post('/signup/email-password')
      .send({
        email,
        password,
        options: {
          defaultRole: 'user',
          allowedRoles: ['editor'],
        },
      })
      .expect(StatusCodes.BAD_REQUEST, {
        status: StatusCodes.BAD_REQUEST,
        message:'Default role must be in allowed roles',
        error: 'default-role-must-be-in-allowed-roles',
      });
  });

  it('allowed roles must be subset of env var AUTH_USER_DEFAULT_ALLOWED_ROLES', async () => {
    const email = faker.internet.email();
    const password = faker.internet.password();
    await request
      .post('/signup/email-password')
      .send({
        email,
        password,
        options: {
          defaultRole: 'user',
          allowedRoles: ['user', 'some-other-role'],
        },
      })
      .expect(StatusCodes.BAD_REQUEST, {
        status: StatusCodes.BAD_REQUEST,
        message:
          'Role not allowed',
        error: 'role-not-allowed',
      });
  });

  it('user must verify email before being able to sign in', async () => {
    const email = faker.internet.email();
    const password = faker.internet.password();

    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: true,
    });

    await request
      .post('/signup/email-password')
      .send({ email, password })
      .expect((res) => (res.status != 200 ? console.log(res.body) : 0));

    await request
      .post('/signin/email-password')
      .send({ email, password })
      .expect(StatusCodes.UNAUTHORIZED);

    await verfiyUserTicket(email);

    // sign in should now work
    await request
      .post('/signin/email-password')
      .send({ email, password })
      .expect(StatusCodes.OK);
  });

  it('should return an error when asking an unauthorised redirection url', async () => {
    const email = faker.internet.email();
    const password = faker.internet.password();

    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: true,
    });

    const { body } = await request
      .post('/signup/email-password')
      .send({
        email,
        password,
        options: { redirectTo: 'http://this-redirection-url-is-forbidden.com' },
      })
      .expect(StatusCodes.BAD_REQUEST);
    expect(body.message).toEqual(
      'The value of "options.redirectTo" is not allowed.'
    );
  });

  it('should return an unauthorized error when signup is disabled', async () => {
    const email = faker.internet.email();
    const password = faker.internet.password();

    await request.post('/change-env').send({
      AUTH_DISABLE_SIGNUP: true,
    });

    const { body } = await request
      .post('/signup/email-password')
      .send({
        email,
        password,
      })
      .expect(StatusCodes.FORBIDDEN);

    expect(body.message).toEqual('Sign up is disabled.');
  });
});
