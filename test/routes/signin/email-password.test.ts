import { Client } from 'pg';
import * as faker from 'faker';
import { StatusCodes } from 'http-status-codes';

import { ENV } from '../../../src/utils/env';
import { request } from '../../server';
import { deleteAllMailHogEmails, isValidAccessToken } from '../../utils';

describe('email-password', () => {
  let client: Client;

  beforeAll(async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: false,
      AUTH_ANONYMOUS_USERS_ENABLED: false,
    });
    client = new Client({
      connectionString: ENV.HASURA_GRAPHQL_DATABASE_URL,
    });
    await client.connect();
    await deleteAllMailHogEmails();
  });

  afterAll(async () => {
    await client.end();
  });

  beforeEach(async () => {
    await client.query(`DELETE FROM auth.users;`);
  });

  it('should sign in user and return valid tokens', async () => {
    const email = faker.internet.email();
    const password = faker.internet.password();
    await request
      .post('/signup/email-password')
      .send({ email, password })
      .expect(StatusCodes.OK);

    const { body } = await request
      .post('/signin/email-password')
      .send({ email, password })
      .expect(StatusCodes.OK);

    const { accessToken, accessTokenExpiresIn, refreshToken } = body.session;
    const { mfa } = body;

    expect(isValidAccessToken(accessToken)).toBe(true);
    expect(typeof accessTokenExpiresIn).toBe('number');
    expect(typeof refreshToken).toBe('string');
    expect(mfa).toBe(null);
  });

  it('should sign in user with metadata', async () => {
    const email = faker.internet.email();
    const password = faker.internet.password();
    const metadataInput = JSON.parse(faker.datatype.json());

    await request
      .post('/signup/email-password')
      .send({ email, password, options: { metadata: metadataInput } })
      .expect(StatusCodes.OK);

    const { body } = await request
      .post('/signin/email-password')
      .send({ email, password })
      .expect(StatusCodes.OK);

    const {
      accessToken,
      accessTokenExpiresIn,
      refreshToken,
      user: { metadata },
    } = body.session;
    const { mfa } = body;
    expect(metadata).toStrictEqual(metadataInput);
    expect(isValidAccessToken(accessToken)).toBe(true);
    expect(typeof accessTokenExpiresIn).toBe('number');
    expect(typeof refreshToken).toBe('string');
    expect(mfa).toBe(null);
  });

  it('should only sign in users with allowed emails', async () => {
    const a = {
      email: faker.internet.email(),
      password: faker.internet.password(),
    };
    const b = {
      email: faker.internet.email(),
      password: faker.internet.password(),
    };

    await request.post('/change-env').send({
      AUTH_ACCESS_CONTROL_ALLOWED_EMAILS: '',
      AUTH_ACCESS_CONTROL_ALLOWED_EMAIL_DOMAINS: '',
      AUTH_ACCESS_CONTROL_BLOCKED_EMAILS: '',
      AUTH_ACCESS_CONTROL_BLOCKED_EMAIL_DOMAINS: '',
    });

    await request.post('/signup/email-password').send(a).expect(StatusCodes.OK);
    await request.post('/signup/email-password').send(b).expect(StatusCodes.OK);

    // sign in
    await request.post('/change-env').send({
      AUTH_ACCESS_CONTROL_ALLOWED_EMAILS: a.email,
    });

    await request.post('/signin/email-password').send(a).expect(StatusCodes.OK);
    await request
      .post('/signin/email-password')
      .send(b)
      .expect(StatusCodes.BAD_REQUEST);
  });
});
