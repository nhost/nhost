// import { request } from "@/test/server";
import { request } from '../../../server';
import { Client } from 'pg';
import { mailHogSearch } from '../../../utils';

describe('magic link', () => {
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

  it('should sign in with otp', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTO_ACTIVATE_NEW_USERS: false,
      VERIFY_EMAILS: true,
      WHITELIST_ENABLED: false,
      MAGIC_LINK_ENABLED: true,
      REGISTRATION_PROFILE_FIELDS: '',
    });

    const email = 'joedoe@example.com';

    await request
      .post('/signin/magic-link')
      .send({
        email,
      })
      .expect(200);

    // get OTP from email
    const [message] = await mailHogSearch(email);
    expect(message).toBeTruthy();

    const otp = message.Content.Headers['X-Otp'][0];
    expect(typeof otp).toBe('string');

    const emailType = message.Content.Headers['X-Email-Template'][0];
    expect(emailType).toBe('magic-link');

    // signin with magic-link/otp
    await request
      .post('/signin/magic-link/otp')
      .send({ email, otp })
      .expect(200);
  });
});
