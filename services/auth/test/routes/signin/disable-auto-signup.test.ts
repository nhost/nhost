import * as faker from 'faker';
import { StatusCodes } from 'http-status-codes';
import { Client } from 'pg';
import { ENV } from '../../src/env';
import { request, resetEnvironment } from '../../server';
import {
  deleteAllMailHogEmails,
  getDbUserByEmail,
  mailHogSearch,
} from '../../utils';

describe('AUTH_DISABLE_AUTO_SIGNUP', () => {
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
      AUTH_DISABLE_AUTO_SIGNUP: true,
      AUTH_DISABLE_SIGNUP: false,
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_EMAIL_PASSWORDLESS_ENABLED: true,
      AUTH_OTP_EMAIL_ENABLED: true,
    });
  });

  it('signin/passwordless/email returns OK without sending email or creating user', async () => {
    const email = faker.internet.email();

    await request
      .post('/signin/passwordless/email')
      .send({ email })
      .expect(StatusCodes.OK);

    const messages = await mailHogSearch(email);
    expect(messages.length).toBe(0);

    const result = await getDbUserByEmail(client, email);
    expect(result.rowCount).toBe(0);
  });

  it('signin/otp/email returns OK without sending email or creating user', async () => {
    const email = faker.internet.email();

    await request
      .post('/signin/otp/email')
      .send({ email })
      .expect(StatusCodes.OK);

    const messages = await mailHogSearch(email);
    expect(messages.length).toBe(0);

    const result = await getDbUserByEmail(client, email);
    expect(result.rowCount).toBe(0);
  });

  it('existing verified user can still sign in via passwordless email', async () => {
    // Disable AUTH_DISABLE_AUTO_SIGNUP first to create a user, then re-enable.
    await request.post('/change-env').send({
      AUTH_DISABLE_AUTO_SIGNUP: false,
    });

    const email = faker.internet.email();
    await request
      .post('/signin/passwordless/email')
      .send({ email })
      .expect(StatusCodes.OK);

    // The first signin created the user with a magic-link ticket. Mark them
    // verified so the next signin treats them as an existing user.
    await client.query(
      `UPDATE auth.users SET email_verified = true WHERE email = $1;`,
      [email],
    );

    await deleteAllMailHogEmails();

    await request.post('/change-env').send({
      AUTH_DISABLE_AUTO_SIGNUP: true,
    });

    await request
      .post('/signin/passwordless/email')
      .send({ email })
      .expect(StatusCodes.OK);

    const messages = await mailHogSearch(email);
    expect(messages.length).toBeGreaterThan(0);
  });

  it('baseline: with flag off, signin/passwordless/email auto-creates the user', async () => {
    await request.post('/change-env').send({
      AUTH_DISABLE_AUTO_SIGNUP: false,
    });

    const email = faker.internet.email();
    await request
      .post('/signin/passwordless/email')
      .send({ email })
      .expect(StatusCodes.OK);

    const result = await getDbUserByEmail(client, email);
    expect(result.rowCount).toBe(1);

    const messages = await mailHogSearch(email);
    expect(messages.length).toBe(1);
  });
});
