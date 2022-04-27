import { Client } from 'pg';
import * as faker from 'faker';
import rfc2047 from 'rfc2047';
import { StatusCodes } from 'http-status-codes';

import { ENV } from '../../../../src/utils/env';
import { request } from '../../../server';
import {
  mailHogSearch,
  deleteAllMailHogEmails,
  expectUrlParameters,
} from '../../../utils';

describe('passwordless email (magic link)', () => {
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

  it('should sign in', async () => {
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

    const emailTemplate = message.Content.Headers['X-Email-Template'][0];

    expect(emailTemplate).toBe('signin-passwordless');

    const link = message.Content.Headers['X-Link'][0];
    const res = await request
      .get(link.replace('http://localhost:4000', ''))
      .expect(StatusCodes.MOVED_TEMPORARILY);

    expectUrlParameters(res).not.toIncludeAnyMembers([
      'error',
      'errorDescription',
    ]);
  });

  it('should signin in using a different locale', async () => {
    const email = faker.internet.email();
    await request
      .post('/signin/passwordless/email')
      .send({
        email,
        options: { locale: 'fr' },
      })
      .expect(StatusCodes.OK);
    const [message] = await mailHogSearch(email);
    expect(message).toBeTruthy();
    expect(rfc2047.decode(message.Content.Headers.Subject[0])).toBe(
      'Lien de connexion sécurisé'
    );
  });

  it('should not be possible to sign it when new users are disabled', async () => {
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: true,
    });
    await request
      .post('/signin/passwordless/email')
      .send({
        email: faker.internet.email(),
      })
      .expect(StatusCodes.UNAUTHORIZED);
  });

  it('should fallback to the default locale when giving a wrong locale', async () => {
    const email = faker.internet.email();
    await request
      .post('/signin/passwordless/email')
      .send({
        email,
        options: { locale: 'XZ' },
      })
      .expect(StatusCodes.OK);
    const [message] = await mailHogSearch(email);
    expect(message).toBeTruthy();
    expect(rfc2047.decode(message.Content.Headers.Subject[0])).toBe(
      'Secure sign-in link'
    );
  });

  it('should use the custom user locale when logging in again', async () => {
    const email = faker.internet.email();
    await request
      .post('/signin/passwordless/email')
      .send({
        email,
        options: { locale: 'fr' },
      })
      .expect(StatusCodes.OK);
    await request
      .post('/signin/passwordless/email')
      .send({
        email,
      })
      .expect(StatusCodes.OK);
    const messages = await mailHogSearch(email);
    for (const message of messages) {
      expect(message).toBeTruthy();
      expect(rfc2047.decode(message.Content.Headers.Subject[0])).toBe(
        'Lien de connexion sécurisé'
      );
    }
  });

  it('should fail to sign in if passworless email is not enabled', async () => {
    await request.post('/change-env').send({
      AUTH_EMAIL_PASSWORDLESS_ENABLED: false,
    });
    await request
      .post('/signin/passwordless/email')
      .send({
        email: faker.internet.email(),
      })
      .expect(StatusCodes.NOT_FOUND);
  });

  it('should fail to sign if email is not valid', async () => {
    await request.post('/change-env').send({
      AUTH_ACCESS_CONTROL_ALLOWED_EMAILS: 'vip@example.com',
    });

    await request
      .post('/signin/passwordless/email')
      .send({
        email: faker.internet.email(),
      })
      .expect(StatusCodes.BAD_REQUEST);
  });

  it('should be able to sign in twice. First request will create the user', async () => {
    const email = faker.internet.email();
    await request
      .post('/signin/passwordless/email')
      .send({
        email,
      })
      .expect(StatusCodes.OK);

    await request
      .post('/signin/passwordless/email')
      .send({
        email,
      })
      .expect(StatusCodes.OK);
  });

  it('should succeed sign in with correct default role', async () => {
    await request
      .post('/signin/passwordless/email')
      .send({
        email: faker.internet.email(),
        options: {
          defaultRole: 'user',
        },
      })
      .expect(StatusCodes.OK);
  });

  it('should fail to sign in with incorrect allowed roles', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTH_USER_DEFAULT_ROLE: 'user',
      AUTH_USER_DEFAULT_ALLOWED_ROLES: 'user',
    });

    await request
      .post('/signin/passwordless/email')
      .send({
        email: faker.internet.email(),
        options: {
          allowedRoles: ['incorrect'],
        },
      })
      .expect(StatusCodes.BAD_REQUEST);
  });
});
