import { Client } from 'pg';
import * as faker from 'faker';
import { StatusCodes } from 'http-status-codes';
import { ENV } from '../../../src/utils/env';
import { request } from '../../server';
import {
  mailHogSearch,
  deleteAllMailHogEmails,
  expectUrlParameters,
  getUrlParameters,
} from '../../utils';

const params = {
  a: 'valuea',
  b: 'valueb',
};
const strParams = Object.entries(params)
  .map(([key, value]) => `${key}=${value}`)
  .join('&');

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

  it('should ignore external query parameters', async () => {
    const email = faker.internet.email();

    await request
      .post('/signin/passwordless/email')
      .send({
        email,
        options: {
          redirectTo: `http://localhost:3000?${strParams}`,
        },
      })
      .expect(StatusCodes.OK);

    // get magic link email
    const [message] = await mailHogSearch(email);
    expect(message).toBeTruthy();

    const link = message.Content.Headers['X-Link'][0];
    const req = await request
      .get(
        link.replace('http://localhost:4000', '') +
          '&another_unrelated_param=here-anyway'
      )
      .expect(StatusCodes.MOVED_TEMPORARILY);

    expectUrlParameters(req).not.toIncludeAnyMembers([
      'error',
      'errorDescription',
    ]);
  });

  it('should include query parameters in optional redirectTo', async () => {
    const email = faker.internet.email();
    // ! Urls are case insensitive

    await request
      .post('/signin/passwordless/email')
      .send({
        email,
        options: {
          redirectTo: `http://localhost:3000?${strParams}`,
        },
      })
      .expect(StatusCodes.OK);

    // get magic link email
    const [message] = await mailHogSearch(email);
    expect(message).toBeTruthy();

    const link = message.Content.Headers['X-Link'][0];
    const res = await request
      .get(link.replace('http://localhost:4000', ''))
      .expect(StatusCodes.MOVED_TEMPORARILY);

    const resParams = getUrlParameters(res);
    expect(Array.from(resParams.keys())).toIncludeAllMembers(
      Object.keys(params)
    );
    expect(Array.from(resParams.values())).toIncludeAllMembers(
      Object.values(params)
    );
    expectUrlParameters(res).not.toIncludeAnyMembers([
      'error',
      'errorDescription',
    ]);
  });

  it('should not allow a locale of more than two characters', async () => {
    const email = faker.internet.email();

    const { body } = await request
      .post('/signin/passwordless/email')
      .send({
        email,
        options: {
          locale: 'en-us',
        },
      })
      .expect(StatusCodes.BAD_REQUEST);

    expect(body).toBeObject();
    expect(body.message).toEqual(
      '"options.locale" length must be 2 characters long'
    );
  });
});
