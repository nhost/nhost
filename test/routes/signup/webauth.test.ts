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

  it('should failed if trying to sign up while webauth is not enabled', async () => {
    const email = faker.internet.email();

    // reset env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_WEBAUTHN_ENABLED: false,
    });

    await request
      .post('/signup/webauthn')
      .send({ email })
      .expect(StatusCodes.NOT_FOUND);
  });

  it('should create user and return null session waiting user to be verified', async () => {
    const email = faker.internet.email();

    const { body } = await request
      .post('/signup/webauthn')
      .send({ email })
      .expect(StatusCodes.OK);

    expect(body).toHaveProperty('session');
    expect(body.session).toBeNull();
  });

  it('should not re-create user when sign up multiple times with same email', async () => {
    const email = faker.internet.email();

    await request
      .post('/signup/webauthn')
      .send({ email })
      .expect(StatusCodes.OK);

    await request
      .post('/signup/webauthn')
      .send({ email })
      .expect(StatusCodes.OK);

    const res = await client.query(`SELECT COUNT(*) FROM auth.users;`);
    expect(res.rows).toBeArrayOfSize(1);
    expect(res.rows[0]).toHaveProperty('count');
    expect(res.rows[0].count).toEqual('1');
  });

  it('should return registration options when signup again but user was verified', async () => {
    const email = faker.internet.email();
    const password = faker.internet.password();

    const record = await insertDbUser(client, email, password, true);
    expect(record.rowCount).toEqual(1);

    const { body } = await request
      .post('/signup/webauthn')
      .send({ email })
      .expect(StatusCodes.OK);

    // checking its persist and remove it as cannot compare
    expect(body).toHaveProperty('challenge');
    delete body.challenge;

    expect(body).toEqual({
      rp: {
        name: rpName,
        id: rpId,
      },
      user: {
        id: record.rows[0].id,
        name: email,
        displayName: email,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' },
      ],
      timeout: 60000,
      attestation: 'indirect',
      excludeCredentials: [],
      authenticatorSelection: {
        requireResidentKey: true,
        residentKey: 'required',
        authenticatorAttachment: 'platform',
        userVerification: 'required',
      },
    });
  });

  it('should fail verify user is webauth is not enabled', async () => {
    const email = faker.internet.email();

    // reset env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_WEBAUTHN_ENABLED: false,
    });

    await request
      .post('/signup/webauthn/verify')
      .send({ email, credential: {} })
      .expect(StatusCodes.NOT_FOUND);
  });

  it('should fail verify user when no credential is passed', async () => {
    const email = faker.internet.email();
    const password = faker.internet.password();

    const record = await insertDbUser(client, email, password, true);
    expect(record.rowCount).toEqual(1);

    await request
      .post('/signup/webauthn/verify')
      .send({ email })
      .expect(StatusCodes.BAD_REQUEST);
  });

  it('should fail verify user when there is error while verify', async () => {
    const email = faker.internet.email();
    const password = faker.internet.password();

    const record = await insertDbUser(client, email, password, true);
    expect(record.rowCount).toEqual(1);

    const { body: credential } = await request
      .post('/signup/webauthn')
      .send({ email })
      .expect(StatusCodes.OK);

    await request
      .post('/signup/webauthn/verify')
      .send({ email, credential })
      .expect(StatusCodes.BAD_REQUEST);
  });
});
