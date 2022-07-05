import { ENV } from '@/utils';
import faker from 'faker';
import { StatusCodes } from 'http-status-codes';
import { Client } from 'pg';
import { request } from '../../server';
import { deleteAllMailHogEmails, insertDbUser } from '../../utils';

describe('webauthn', () => {
  let client: Client;

  const rpName = 'Nhost tests';
  const rpId = 'localhost';

  beforeAll(async () => {
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
    await client.query(`DELETE FROM auth.user_authenticators;`);

    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_WEBAUTHN_ENABLED: true,
      AUTH_WEBAUTHN_RP_ID: rpId,
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
      .expect(StatusCodes.NOT_FOUND);
  });

  it('should failed if trying to sign in but user does not exist', async () => {
    const email = faker.internet.email();

    await request
      .post('/signin/webauthn')
      .send({ email })
      .expect(StatusCodes.BAD_REQUEST);
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

  it('should return authentication options when signin', async () => {
    const email = faker.internet.email();
    const password = faker.internet.password();

    const record = await insertDbUser(client, email, password, true, false);
    expect(record.rowCount).toEqual(1);

    const userRecord = await client.query(`SELECT id FROM auth.users LIMIT 1;`);
    expect(userRecord.rows).toBeArrayOfSize(1);
    expect(userRecord.rows[0]).toHaveProperty('id');

    const { body } = await request
      .post('/signin/webauthn')
      .send({ email })
      .expect(StatusCodes.OK);

    // checking its persist and remove it as cannot compare
    expect(body).toHaveProperty('challenge');
    delete body.challenge;

    expect(body).toEqual({
      allowCredentials: [],
      rpId: rpId,
      timeout: 60000,
      userVerification: 'preferred',
    });
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
      .expect(StatusCodes.NOT_FOUND);
  });

  it('should failed verify when user is disabled', async () => {
    const email = faker.internet.email();
    const password = faker.internet.password();

    const record = await insertDbUser(client, email, password, false, true);
    expect(record.rowCount).toEqual(1);

    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: true,
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: true,
    });

    await request
      .post('/signin/webauthn/verify')
      .send({ email, credential: {} })
      .expect(StatusCodes.UNAUTHORIZED);
  });

  it('should failed verify when user is not verified', async () => {
    const email = faker.internet.email();
    const password = faker.internet.password();

    const record = await insertDbUser(client, email, password, false, false);
    expect(record.rowCount).toEqual(1);

    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: true,
    });

    await request
      .post('/signin/webauthn/verify')
      .send({ email, credential: {} })
      .expect(StatusCodes.UNAUTHORIZED);
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

  it('should fail verify user when there is error while verify', async () => {
    const email = faker.internet.email();
    const password = faker.internet.password();

    const record = await insertDbUser(client, email, password, true);
    expect(record.rowCount).toEqual(1);

    const { body: credential } = await request
      .post('/signin/webauthn')
      .send({ email })
      .expect(StatusCodes.OK);

    await request
      .post('/signin/webauthn/verify')
      .send({ email, credential })
      .expect(StatusCodes.BAD_REQUEST);
  });
});
