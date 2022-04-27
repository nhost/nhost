import { Client } from 'pg';
import * as faker from 'faker';
import { StatusCodes } from 'http-status-codes';
import { ENV } from '../../../src/utils/env';
import { request } from '../../server';
import {
  mailHogSearch,
  deleteAllMailHogEmails,
  expectUrlParameters,
} from '../../utils';

describe('Redirections', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({
      connectionString: ENV.HASURA_GRAPHQL_DATABASE_URL,
    });
    await client.connect();
    deleteAllMailHogEmails();
  });

  afterAll(async () => {
    await client.end();
  });

  beforeEach(async () => {
    await client.query(`DELETE FROM auth.users;`);
    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_EMAIL_PASSWORDLESS_ENABLED: true,
      AUTH_ACCESS_CONTROL_ALLOWED_EMAILS: '',
      AUTH_ACCESS_CONTROL_ALLOWED_EMAIL_DOMAINS: '',
      AUTH_ACCESS_CONTROL_BLOCKED_EMAILS: '',
      AUTH_ACCESS_CONTROL_BLOCKED_EMAIL_DOMAINS: '',
    });
  });

  it('should ignore additional query parameters', async () => {
    const email = faker.internet.email();

    await request
      .post('/signin/passwordless/email')
      .send({
        email,
      })
      .expect(StatusCodes.OK);

    // get magic link email
    const [message] = await mailHogSearch(email);
    expect(message).toBeTruthy();

    const ticket = message.Content.Headers['X-Ticket'][0];
    const redirectTo = message.Content.Headers['X-Redirect-To'][0];
    const req = await request
      .get(
        `/verify?ticket=${ticket}&type=signinPasswordless&redirectTo=${redirectTo}&utm_source=Email&another_unrelated_param=here-anyway`
      )
      .expect(StatusCodes.MOVED_TEMPORARILY);

    expectUrlParameters(req).not.toIncludeAnyMembers([
      'error',
      'errorDescription',
    ]);
  });
});
