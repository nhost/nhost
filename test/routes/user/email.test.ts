import { Client } from 'pg';
import { v4 as uuidv4 } from 'uuid';

import { ENV } from '../../../src/utils/env';
import { request } from '../../server';
import { SignInResponse } from '../../../src/types';
import { mailHogSearch } from '../../utils';

describe('user email', () => {
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

  it('change email', async () => {
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: false,
    });

    let accessToken = '';

    const email = 'asdasd@asdasd.com';
    const password = '123123123';

    await request
      .post('/signup/email-password')
      .send({ email, password })
      .expect(200);

    const { body }: { body: SignInResponse } = await request
      .post('/signin/email-password')
      .send({ email, password })
      .expect(200);

    expect(body.session).toBeTruthy();

    if (!body.session) {
      throw new Error('session is not set');
    }

    accessToken = body.session.accessToken;

    // request to reset (to-change) email

    const newEmail = 'newemail@example.com';

    console.log('1');
    await request
      .post('/user/email/change')
      // .set('Authorization', `Bearer ${accessToken}`)
      .send({ newEmail })
      .expect(401);

    await request
      .post('/user/email/change')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newEmail })
      .expect(200);

    // get ticket on new email
    const [message] = await mailHogSearch(newEmail);
    expect(message).toBeTruthy();

    const ticket = message.Content.Headers['X-Ticket'][0];
    const redirectTo = message.Content.Headers['X-Redirect-To'][0];
    // expect(ticket.startsWith('emailReset:')).toBeTruthy();

    const emailType = message.Content.Headers['X-Email-Template'][0];
    expect(emailType).toBe('email-confirm-change');

    console.log('2');
    // wrong ticket should fail
    await request
      .get(
        `/verify?ticket=${uuidv4()}&type=emailConfirmChange&redirectTo=${redirectTo}`
      )
      .expect(401);

    // confirm change email
    await request
      .get(
        `/verify?ticket=${ticket}&type=emailConfirmChange&redirectTo=${redirectTo}`
      )
      .expect(302);

    console.log('3');
    // fail to signin with old email
    await request
      .post('/signin/email-password')
      .send({ email, password })
      .expect(401);

    // sign in with new email
    await request
      .post('/signin/email-password')
      .send({ email: newEmail, password })
      .expect(200);
  });
});
