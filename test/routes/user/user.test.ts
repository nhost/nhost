import { Client } from 'pg';
import * as faker from 'faker';

import { request } from '../../server';
import { SignInTokens } from '../../../src/utils/tokens';

describe('user password', () => {
  let client: any;

  beforeAll(async () => {
    client = new Client({
      connectionString: process.env.DATABASE_URL,
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
      DISABLE_NEW_USERS: false,
      SIGNIN_EMAIL_VERIFIED_REQUIRED: false,
    });

    const email = faker.internet.email();
    const password = faker.internet.password();
    const displayName = `${faker.name.firstName()} ${faker.name.lastName()}`;

    await request
      .post('/signup/email-password')
      .send({
        email,
        password,
        displayName,
      })
      .expect(200);

    const {
      body: { accessToken },
    }: { body: SignInTokens } = await request
      .post('/signin/email-password')
      .send({
        email,
        password,
      })
      .expect(200);

    const { body } = await request
      .get('/user')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(typeof body.id).toBe('string');
    expect(body.email).toBe(email);
    expect(body.displayName).toBe(displayName);
    expect(typeof body.avatarUrl).toBe('string');
  });
});
