import { ENV } from '../../src/env';
import faker from 'faker';
import { StatusCodes } from 'http-status-codes';
import { Client } from 'pg';
import { request, resetEnvironment } from '../../server';
import { deleteAllMailHogEmails, insertDbUser } from '../../utils';

describe('webauthn', () => {
  let client: Client;

  const rpName = 'Nhost tests';
  const serverUrl = 'http://localhost:4000';

  beforeAll(async () => {
    client = new Client({
      connectionString: ENV.HASURA_GRAPHQL_DATABASE_URL,
    });
    await client.connect();
    await deleteAllMailHogEmails();

    await resetEnvironment();
  });

  afterAll(async () => {
    await client.end();
  });

  beforeEach(async () => {
    await client.query(`DELETE FROM auth.users;`);
    await client.query(`DELETE FROM auth.user_security_keys;`);

    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_SIGNUP: false,
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_WEBAUTHN_ENABLED: true,
      AUTH_SERVER_URL: serverUrl,
      AUTH_WEBAUTHN_RP_NAME: rpName,
      AUTH_WEBAUTHN_RP_ORIGINS: ['http://localhost:3000'],
    });
  });

  it('should failed if trying to sign in while webauth is not enabled', async () => {
    const email = faker.internet.email();

    // reset env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_WEBAUTHN_ENABLED: false,
    });

    await request
      .post('/signin/webauthn')
      .send({ email })
      .expect(StatusCodes.CONFLICT);
  });

  it('should failed if trying to sign in but user does not exist', async () => {
    const email = faker.internet.email();

    await request
      .post('/signin/webauthn')
      .send({ email })
      .expect(StatusCodes.UNAUTHORIZED);
  });

  it('should failed if trying to sign in but user is disabled', async () => {
    const email = faker.internet.email();
    const password = faker.internet.password();

    const record = await insertDbUser(client, email, password, false, true);
    expect(record.rowCount).toEqual(1);

    await request
      .post('/signin/webauthn')
      .send({ email })
      .expect(StatusCodes.UNAUTHORIZED);
  });

  it('should failed if trying to sign in but user is not verified', async () => {
    const email = faker.internet.email();
    const password = faker.internet.password();

    const record = await insertDbUser(client, email, password, false, false);
    expect(record.rowCount).toEqual(1);

    await request.post('/change-env').send({
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: true,
    });

    await request
      .post('/signin/webauthn')
      .send({ email })
      .expect(StatusCodes.UNAUTHORIZED);
  });

  it('should fail verify user is webauth is not enabled', async () => {
    const email = faker.internet.email();

    // reset env vars
    await request.post('/change-env').send({
      AUTH_WEBAUTHN_ENABLED: false,
    });

    await request
      .post('/signin/webauthn/verify')
      .send({ email, credential: {} })
      .expect(StatusCodes.CONFLICT);
  });

  it('should fail verify user when no credential is passed', async () => {
    const email = faker.internet.email();
    const password = faker.internet.password();

    const record = await insertDbUser(client, email, password, true);
    expect(record.rowCount).toEqual(1);

    await request
      .post('/signin/webauthn/verify')
      .send({ email })
      .expect(StatusCodes.BAD_REQUEST);
  });

  it('should fail if signup is disabled', async () => {
    const email = faker.internet.email();

    await request.post('/change-env').send({
      AUTH_DISABLE_SIGNUP: true,
    });

    await request
      .post('/signup/webauthn')
      .send({ email })
      .expect(StatusCodes.FORBIDDEN);
  });
});
