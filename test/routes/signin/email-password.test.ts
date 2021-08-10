// import { request } from "@/test/server";
import { request } from '../../server';
import { Client } from 'pg';
import { deleteAllMailHogEmails } from '../../utils';

describe('email-password', () => {
  let client: any;

  beforeAll(async () => {
    client = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    await client.connect();
    await deleteAllMailHogEmails();
  });

  afterAll(() => {
    client.end();
  });

  beforeEach(async () => {
    await client.query(`DELETE FROM auth.users;`);
  });

  it('should sign in user and return valid tokens', async () => {
    // set env vars
    await request.post('/change-env').send({
      DISABLE_NEW_USERS: false,
      SIGNIN_EMAIL_VERIFIED_REQUIRED: false,
      VERIFY_EMAILS: false,
      WHITELIST_ENABLED: false,
      PROFILE_SESSION_VARIABLE_FIELDS: '',
      REGISTRATION_PROFILE_FIELDS: '',
    });

    await request
      .post('/signup/email-password')
      .send({ email: 'joedoe@example.com', password: '123456' })
      .expect(200);

    // const { status, body } = await request
    await request
      .post('/signin/email-password')
      .send({ email: 'joedoe@example.com', password: '123456' })
      .expect(200);

    // verify jwt token
    // check jwt espire value is number and more than 0
    // make sure refresh token is set
    // make sure MFA is null
  });
});
