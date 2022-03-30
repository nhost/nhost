import { Client } from 'pg';
import * as faker from 'faker';
import { StatusCodes } from 'http-status-codes';
import { ENV } from '@/utils';

import { request } from './server';
import { mailHogSearch } from './utils';

describe('custom external email templates', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({
      connectionString: ENV.HASURA_GRAPHQL_DATABASE_URL,
    });
    await client.connect();
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: true,
      AUTH_EMAIL_TEMPLATE_FETCH_URL:
        'https://raw.githubusercontent.com/nhost/hasura-auth/main/email-templates',
    });
  });

  afterAll(async () => {
    await client.end();
    await request.post('/change-env').send({
      AUTH_EMAIL_TEMPLATE_FETCH_URL: '',
    });
  });

  beforeEach(async () => {
    await client.query(`DELETE FROM auth.users;`);
  });

  it('shoud find a template through HTTP', async () => {
    const email = faker.internet.email();
    const password = faker.internet.password();

    await request
      .post('/signup/email-password')
      .send({ email, password })
      .expect(StatusCodes.OK);

    // fetch email from mailhog and check ticket
    const [message] = await mailHogSearch(email);
    expect(message).toBeTruthy();
    const ticket = message.Content.Headers['X-Ticket'][0];
    // expect(rfc2047.decode(message.Content.Headers.Subject[0])).not.toBe(
    //   'Verify your email'
    // );
    expect(ticket.startsWith('verifyEmail:')).toBeTruthy();
  });
});
