import * as faker from 'faker';
import { StatusCodes } from 'http-status-codes';
import { Client } from 'pg';
import { ENV } from '../../src/env';
import { request, resetEnvironment } from '../../server';
import {
  deleteAllMailHogEmails,
  generatePKCE,
  getDbUserByEmail,
  mailHogSearch,
  verfiyUserTicket,
  verifyEmailAndExchangePKCE,
} from '../../utils';

describe('signup passwordless email', () => {
  let client: Client;

  beforeAll(async () => {
    await resetEnvironment();

    client = new Client({
      connectionString: ENV.HASURA_GRAPHQL_DATABASE_URL,
    });
    await client.connect();
    await deleteAllMailHogEmails();
  });

  afterAll(async () => {
    await request.post('/change-env').send({
      AUTH_DISABLE_AUTO_SIGNUP: false,
    });
    await client.end();
  });

  beforeEach(async () => {
    await client.query(`DELETE FROM auth.users;`);
    await deleteAllMailHogEmails();
    await request.post('/change-env').send({
      AUTH_DISABLE_AUTO_SIGNUP: false,
      AUTH_DISABLE_SIGNUP: false,
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_EMAIL_PASSWORDLESS_ENABLED: true,
    });
  });

  it('creates the user and sends a magic link', async () => {
    const email = faker.internet.email();

    await request
      .post('/signup/passwordless/email')
      .send({ email })
      .expect(StatusCodes.OK);

    const result = await getDbUserByEmail(client, email);
    expect(result.rowCount).toBe(1);

    await verfiyUserTicket(email);
  });

  it('silently succeeds for already-registered emails (no enumeration)', async () => {
    const email = faker.internet.email();

    await request
      .post('/signup/passwordless/email')
      .send({ email })
      .expect(StatusCodes.OK);

    // The first signup sent one email. Clear the mailbox before the second
    // call so we can assert no additional email is sent.
    await deleteAllMailHogEmails();

    // Same endpoint, same email — must still return 200 OK and must not send
    // a second magic link. This matches the signin side of the house, so
    // attackers cannot distinguish "registered" from "not registered".
    await request
      .post('/signup/passwordless/email')
      .send({ email })
      .expect(StatusCodes.OK);

    const messages = await mailHogSearch(email);
    expect(messages.length).toBe(0);

    // Sanity check: only one user row for this email after two signup calls.
    const result = await getDbUserByEmail(client, email);
    expect(result.rowCount).toBe(1);
  });

  it('completes a PKCE round-trip end-to-end', async () => {
    const email = faker.internet.email();
    const pkce = generatePKCE();

    await request
      .post('/signup/passwordless/email')
      .send({ email, codeChallenge: pkce.challenge })
      .expect(StatusCodes.OK);

    await verifyEmailAndExchangePKCE(email, pkce);
  });

  it('returns disabled-endpoint when passwordless email is disabled', async () => {
    await request.post('/change-env').send({
      AUTH_EMAIL_PASSWORDLESS_ENABLED: false,
    });

    await request
      .post('/signup/passwordless/email')
      .send({ email: faker.internet.email() })
      .expect(StatusCodes.CONFLICT, {
        status: StatusCodes.CONFLICT,
        message: 'This endpoint is disabled',
        error: 'disabled-endpoint',
      });
  });

  it('returns signup-disabled when AUTH_DISABLE_SIGNUP is set', async () => {
    await request.post('/change-env').send({
      AUTH_DISABLE_SIGNUP: true,
    });

    await request
      .post('/signup/passwordless/email')
      .send({ email: faker.internet.email() })
      .expect(StatusCodes.FORBIDDEN, {
        status: StatusCodes.FORBIDDEN,
        message: 'Sign up is disabled.',
        error: 'signup-disabled',
      });
  });

  it('still works when AUTH_DISABLE_AUTO_SIGNUP is set (this is its purpose)', async () => {
    await request.post('/change-env').send({
      AUTH_DISABLE_AUTO_SIGNUP: true,
    });

    const email = faker.internet.email();

    await request
      .post('/signup/passwordless/email')
      .send({ email })
      .expect(StatusCodes.OK);

    const result = await getDbUserByEmail(client, email);
    expect(result.rowCount).toBe(1);

    const messages = await mailHogSearch(email);
    expect(messages.length).toBe(1);
  });
});
