import { Client } from 'pg';
import * as faker from 'faker';
import { StatusCodes } from 'http-status-codes';

import { ENV } from '../../../src/utils/env';
import { request } from '../../server';
import { deleteAllMailHogEmails } from '../../utils';

describe('conceal error messages', () => {
  let client: Client;

  beforeAll(async () => {
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

    expect(attemptWithProtection.body).toMatchSnapshot();

    // * Send details error messages
    await request.post('/change-env').send({
      AUTH_CONCEAL_ERRORS: false,
    });

    const attemptWithoutProtection = await request
      .post('/signin/email-password')
      .send({ email, password: '123456' });

    expect(attemptWithoutProtection.body).toMatchSnapshot();
  });
});
