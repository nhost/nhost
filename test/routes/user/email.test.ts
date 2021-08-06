import { Client } from 'pg';
import { v4 as uuidv4 } from 'uuid';

import { request } from '../../server';
import { SignInTokens } from '../../../src/utils/tokens';
import { mailHogSearch } from '../../utils';

describe('user email', () => {
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

  it('change email', async () => {
    await request.post('/change-env').send({
      MFA_ENABLED: true,
      DISABLE_NEW_USERS: false,
      SIGNIN_EMAIL_VERIFIED_REQUIRED: false,
      WHITELIST_ENABLED: false,
    });

    let accessToken = '';

    const email = 'asdasd@asdasd.com';
    const password = '123123123';

    await request
      .post('/signup/email-password')
      .send({ email, password })
      .expect(200);

    const { body }: { body: SignInTokens } = await request
      .post('/signin/email-password')
      .send({ email, password })
      .expect(200);

    accessToken = body.accessToken as string;

    // request to reset (to-change) email

    const newEmail = 'newemail@example.com';

    await request
      .post('/user/email/reset')
      // .set('Authorization', `Bearer ${accessToken}`)
      .send({ newEmail })
      .expect(401);

    await request
      .post('/user/email/reset')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newEmail })
      .expect(200);

    // get ticket on new email
    const [message] = await mailHogSearch(newEmail);
    expect(message).toBeTruthy();

    const ticket = message.Content.Headers['X-Ticket'][0];
    expect(ticket.startsWith('emailReset:')).toBeTruthy();

    const emailType = message.Content.Headers['X-Email-Template'][0];
    expect(emailType).toBe('email-reset');

    // change email
    await request
      .post('/user/email')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ticket: `emailReset:${uuidv4()}` })
      .expect(401);

    await request
      .post('/user/email')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ticket })
      .expect(200);

    // sign in with new email
    await request
      .post('/signin/email-password')
      .send({ email, password })
      .expect(401);

    await request
      .post('/signin/email-password')
      .send({ email: newEmail, password })
      .expect(200);
  });
});
