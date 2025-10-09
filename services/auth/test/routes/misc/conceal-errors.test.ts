import { Client } from 'pg';
import * as faker from 'faker';
import { StatusCodes } from 'http-status-codes';

import { ENV } from '../../src/env';
import { request, resetEnvironment } from '../../server';
import { deleteAllMailHogEmails } from '../../utils';

describe('conceal error messages', () => {
  let client: Client;

  beforeAll(async () => {
    await resetEnvironment();

    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: false,
      AUTH_ANONYMOUS_USERS_ENABLED: false,
    });
    client = new Client({
      connectionString: ENV.HASURA_GRAPHQL_DATABASE_URL,
    });
    await client.connect();
    await deleteAllMailHogEmails();
  });

  afterAll(async () => {
    await request.post('/change-env').send({
      AUTH_CONCEAL_ERRORS: false,
    });
    await client.end();
  });

  beforeEach(async () => {
    await client.query(`DELETE FROM auth.users;`);
  });

  it('should conceal errors', async () => {
    const email = faker.internet.email();
    const password = faker.internet.password();
    const user = {
      email,
      password,
    };

    await request
      .post('/signup/email-password')
      .send(user)
      .expect(StatusCodes.OK);

    // * Conceal error messages
    await request.post('/change-env').send({
      AUTH_CONCEAL_ERRORS: true,
    });

    const attemptWithProtection = await request
      .post('/signin/email-password')
      .send({ email, password: '123456' });

    expect(attemptWithProtection.status).toBe(StatusCodes.BAD_REQUEST);
    expect(attemptWithProtection.body).toEqual({
      status: StatusCodes.BAD_REQUEST,
      message: 'The request payload is incorrect',
      error: 'invalid-request',
    });

    // * Send details error messages
    await request.post('/change-env').send({
      AUTH_CONCEAL_ERRORS: false,
    });

    const attemptWithoutProtection = await request
      .post('/signin/email-password')
      .send({ email, password: '123456' });

    expect(attemptWithoutProtection.status).toBe(StatusCodes.UNAUTHORIZED);
    expect(attemptWithoutProtection.body).toEqual({
      status: StatusCodes.UNAUTHORIZED,
      message: 'Incorrect email or password',
      error: 'invalid-email-password',
    });
  });
});
