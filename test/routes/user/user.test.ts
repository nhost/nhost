import { Client } from 'pg';
import * as faker from 'faker';

import { ENV } from '../../../src/utils/env';
import { request } from '../../server';
import { SignInResponse } from '../../../src/types';

describe('user password', () => {
  let client: any;

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
  });

  it('should not get user data if not signed in', async () => {
    await request.get('/user').expect(401);
  });

  it('should get user data if signed in', async () => {
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_SIGNIN_EMAIL_VERIFIED_REQUIRED: false,
    });

    const email = faker.internet.email();
    const password = faker.internet.password();
    const displayName = `${faker.name.firstName()} ${faker.name.lastName()}`;

    await request
      .post('/signup/email-password')
      .send({
        email,
        password,
        options: {
          displayName,
        },
      })
      .expect(200);

    const {
      body: { session },
    }: { body: SignInResponse } = await request
      .post('/signin/email-password')
      .send({
        email,
        password,
      })
      .expect(200);

    const { body } = await request
      .get('/user')
      .set('Authorization', `Bearer ${session?.accessToken}`)
      .expect(200);

    expect(typeof body.id).toBe('string');
    expect(body.email).toBe(email);
    expect(body.displayName).toBe(displayName);
    expect(typeof body.avatarUrl).toBe('string');
  });
});
