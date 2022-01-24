import { Client } from 'pg';
import * as faker from 'faker';
import { reloadMetadata } from '@/metadata';
import { ENV } from '@/utils/env';
import { request } from '../../server';

describe('custom fields', () => {
  const firstName = faker.name.firstName();
  let client: Client;

  beforeAll(async () => {
    client = new Client({
      connectionString: ENV.HASURA_GRAPHQL_DATABASE_URL,
    });
    await client.connect();
    await reloadMetadata();
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: false,
    });
  });

  afterAll(async () => {
    await reloadMetadata();
  });

  beforeEach(async () => {
    await client.query(`DELETE FROM auth.users;`);
  });

  it('should add custom fields on user registration', async () => {
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
          custom: {
            first_name: firstName,
          },
        },
      })
      .expect(200);
    expect(session.user.custom.first_name).toEqual(firstName);
  });
});
