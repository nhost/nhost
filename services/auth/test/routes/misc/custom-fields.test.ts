import { Client } from 'pg';
import * as faker from 'faker';
import { StatusCodes } from 'http-status-codes';

import { ENV } from '../../src/env';
import { request, resetEnvironment } from '../../server';

describe('user metadata field', () => {
  const firstName = faker.name.firstName();
  let client: Client;

  beforeAll(async () => {
    client = new Client({
      connectionString: ENV.HASURA_GRAPHQL_DATABASE_URL,
    });
    await client.connect();

    await resetEnvironment();
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: false,
    });
  });

  afterAll(async () => {
    await client.end();
  });

  beforeEach(async () => {
    await client.query(`DELETE FROM auth.users;`);
  });

  it('should add metadata fields on user registration', async () => {
    const email = faker.internet.email();
    const password = faker.internet.password();

    const {
      body: { session },
    } = await request
      .post('/signup/email-password')
      .send({
        email,
        password,
        options: {
          metadata: {
            first_name: firstName,
          },
        },
      })
      .expect(StatusCodes.OK);
    expect(session.user.metadata.first_name).toEqual(firstName);
  });
});
