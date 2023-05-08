import { Session, SignInResponse } from '@/types';
import { ENV } from '@/utils';
import faker from 'faker';
import { StatusCodes } from 'http-status-codes';
import { Client } from 'pg';
import { request } from '../../server';
import { deleteAllMailHogEmails } from '../../utils';

describe('webauthn', () => {
  let client: Client;
  let userSession: Session | null;

  const email = faker.internet.email();
  const displayName = `${faker.name.firstName()} ${faker.name.lastName()}`;

  const rpName = 'Nhost tests';
  const serverUrl = 'http://localhost:4000';

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
    await client.query(`DELETE FROM auth.user_security_keys;`);

    // set env vars
    await request.post('/change-env').send({
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: false,
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_WEBAUTHN_ENABLED: true,
      AUTH_SERVER_URL: serverUrl,
      AUTH_WEBAUTHN_RP_NAME: rpName,
      AUTH_WEBAUTHN_RP_ORIGINS: ['http://localhost:3000'],
    });

    const password = faker.internet.password();

    await request
      .post('/signup/email-password')
      .send({
        email,
        password,
        options: {
          displayName,
        },
      })
      .expect(StatusCodes.OK);

    const {
      body: { session },
    }: { body: SignInResponse } = await request
      .post('/signin/email-password')
      .send({
        email,
        password,
      })
      .expect(StatusCodes.OK);

    userSession = session;
  });

  it('should failed if trying to add new security key while webauth is not enabled', async () => {
    // reset env vars
    await request.post('/change-env').send({
      AUTH_WEBAUTHN_ENABLED: false,
    });

    await request
      .post('/user/webauthn/add')
      .set('Authorization', `Bearer ${userSession?.accessToken}`)
      .send({ email })
      .expect(StatusCodes.CONFLICT);
  });

  it('should return registration options when sign in using webauthn', async () => {
    // disable email verification
    await request.post('/change-env').send({
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: false,
    });

    const { body } = await request
      .post('/user/webauthn/add')
      .set('Authorization', `Bearer ${userSession?.accessToken}`)
      .send({ email })
      .expect(StatusCodes.OK);

    // checking its persist and remove it as cannot compare
    expect(body).toHaveProperty('challenge');
    delete body.challenge;

    expect(body.user).toHaveProperty('id');
    delete body.user.id;

    expect(body).toEqual({
      rp: {
        name: rpName,
        id: new URL(serverUrl).hostname,
      },
      user: {
        name: displayName,
        displayName,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -8, type: 'public-key' },
        { alg: -36, type: 'public-key' },
        { alg: -37, type: 'public-key' },
        { alg: -38, type: 'public-key' },
        { alg: -39, type: 'public-key' },
        { alg: -257, type: 'public-key' },
        { alg: -258, type: 'public-key' },
        { alg: -259, type: 'public-key' },
      ],
      timeout: 60000,
      attestation: 'indirect',
      excludeCredentials: [],
      authenticatorSelection: {
        requireResidentKey: false,
        // residentKey: 'required',
        userVerification: 'preferred',
      },
    });
  });

  it('should fail verify user is webauth is not enabled', async () => {
    // reset env vars
    await request.post('/change-env').send({
      AUTH_WEBAUTHN_ENABLED: false,
    });

    await request
      .post('/user/webauthn/verify')
      .set('Authorization', `Bearer ${userSession?.accessToken}`)
      .send({ credential: {} })
      .expect(StatusCodes.CONFLICT);
  });

  it('should fail verify user when no credential is passed', async () => {
    await request
      .post('/user/webauthn/verify')
      .set('Authorization', `Bearer ${userSession?.accessToken}`)
      .expect(StatusCodes.BAD_REQUEST);
  });

  it('should fail verify user when there is error while verify', async () => {
    const { body: credential } = await request
      .post('/user/webauthn/add')
      .set('Authorization', `Bearer ${userSession?.accessToken}`)
      .expect(StatusCodes.OK);

    await request
      .post('/user/webauthn/verify')
      .set('Authorization', `Bearer ${userSession?.accessToken}`)
      .send({ credential })
      .expect(StatusCodes.UNAUTHORIZED);
  });
});
