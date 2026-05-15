import { Client } from 'pg';
import { StatusCodes } from 'http-status-codes';

import { ENV } from '../../src/env';
import { request, resetEnvironment } from '../../server';
import { SignInResponse } from '../../src/types';
import { decodeAccessToken, readSMSCode } from '../../utils';

describe('user/deanonymize/sms', () => {
  let client: Client;

  beforeAll(async () => {
    await resetEnvironment();

    client = new Client({
      connectionString: ENV.HASURA_GRAPHQL_DATABASE_URL,
    });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  beforeEach(async () => {
    await client.query(`DELETE FROM auth.users;`);
  });

  it('deanonymizes anonymous user via SMS OTP and returns a non-anonymous session', async () => {
    const phoneNumber = '+15551110001';

    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_ANONYMOUS_USERS_ENABLED: true,
      AUTH_SMS_PASSWORDLESS_ENABLED: true,
    });

    const { body: anonBody }: { body: SignInResponse } = await request
      .post('/signin/anonymous')
      .expect(StatusCodes.OK);

    expect(anonBody.session).toBeTruthy();
    if (!anonBody.session) {
      throw new Error('anonymous session is not set');
    }

    const { accessToken: anonAccessToken, refreshToken: anonRefreshToken } =
      anonBody.session;

    await request
      .post('/user/deanonymize/sms')
      .set('Authorization', `Bearer ${anonAccessToken}`)
      .send({ phoneNumber })
      .expect(StatusCodes.OK);

    // Until the OTP is verified, the user stays anonymous and the anonymous
    // refresh token remains valid — otherwise a user who never receives the
    // SMS would be permanently locked out.
    await request
      .post('/token')
      .send({ refreshToken: anonRefreshToken })
      .expect(StatusCodes.OK);

    {
      const { rows } = await client.query(
        `SELECT is_anonymous, phone_number, new_phone_number, phone_number_verified
           FROM auth.users WHERE new_phone_number = $1`,
        [phoneNumber]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].is_anonymous).toBe(true);
      expect(rows[0].phone_number).toBeNull();
      expect(rows[0].new_phone_number).toBe(phoneNumber);
      expect(rows[0].phone_number_verified).toBe(false);
    }

    const otp = readSMSCode(phoneNumber);

    const { body: verifyBody }: { body: SignInResponse } = await request
      .post('/signin/passwordless/sms/otp')
      .send({ phoneNumber, otp })
      .expect(StatusCodes.OK);

    expect(verifyBody.session).toBeTruthy();
    if (!verifyBody.session) {
      throw new Error('verified session is not set');
    }

    const claims = await decodeAccessToken(verifyBody.session.accessToken);
    expect(claims).toBeTruthy();
    expect(
      claims?.['https://hasura.io/jwt/claims']['x-hasura-user-is-anonymous']
    ).toBe('false');

    // After OTP verification the user is non-anonymous and the OLD anonymous
    // refresh token is revoked.
    await request
      .post('/token')
      .send({ refreshToken: anonRefreshToken })
      .expect(StatusCodes.UNAUTHORIZED);

    const { rows } = await client.query(
      `SELECT is_anonymous, phone_number_verified FROM auth.users WHERE phone_number = $1`,
      [phoneNumber]
    );
    expect(rows[0].is_anonymous).toBe(false);
    expect(rows[0].phone_number_verified).toBe(true);
  });

  it('allows retrying with the same number when previous OTP was not verified', async () => {
    const phoneNumber = '+15551110005';

    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_ANONYMOUS_USERS_ENABLED: true,
      AUTH_SMS_PASSWORDLESS_ENABLED: true,
    });

    const { body: anonBody }: { body: SignInResponse } = await request
      .post('/signin/anonymous')
      .expect(StatusCodes.OK);
    if (!anonBody.session) {
      throw new Error('anonymous session is not set');
    }
    const anonAccessToken = anonBody.session.accessToken;

    // First attempt — SMS sent, OTP staged, but user never verifies.
    await request
      .post('/user/deanonymize/sms')
      .set('Authorization', `Bearer ${anonAccessToken}`)
      .send({ phoneNumber })
      .expect(StatusCodes.OK);

    // Second attempt with the same number must succeed: the anonymous session
    // is still alive and the existing staged row gets a fresh OTP.
    await request
      .post('/user/deanonymize/sms')
      .set('Authorization', `Bearer ${anonAccessToken}`)
      .send({ phoneNumber })
      .expect(StatusCodes.OK);

    // The latest OTP must verify successfully.
    const otp = readSMSCode(phoneNumber);

    const { body: verifyBody }: { body: SignInResponse } = await request
      .post('/signin/passwordless/sms/otp')
      .send({ phoneNumber, otp })
      .expect(StatusCodes.OK);
    expect(verifyBody.session).toBeTruthy();

    const { rows } = await client.query(
      `SELECT is_anonymous, phone_number, phone_number_verified, new_phone_number
         FROM auth.users WHERE phone_number = $1`,
      [phoneNumber]
    );
    expect(rows[0].is_anonymous).toBe(false);
    expect(rows[0].phone_number).toBe(phoneNumber);
    expect(rows[0].phone_number_verified).toBe(true);
    expect(rows[0].new_phone_number).toBeNull();
  });

  it('rejects when SMS passwordless is disabled', async () => {
    const phoneNumber = '+15551110002';

    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_ANONYMOUS_USERS_ENABLED: true,
      AUTH_SMS_PASSWORDLESS_ENABLED: false,
    });

    const { body: anonBody }: { body: SignInResponse } = await request
      .post('/signin/anonymous')
      .expect(StatusCodes.OK);

    if (!anonBody.session) {
      throw new Error('anonymous session is not set');
    }

    await request
      .post('/user/deanonymize/sms')
      .set('Authorization', `Bearer ${anonBody.session.accessToken}`)
      .send({ phoneNumber })
      .expect(StatusCodes.CONFLICT);
  });

  it('rejects when phone number is already verified by another user', async () => {
    const phoneNumber = '+15551110003';

    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_ANONYMOUS_USERS_ENABLED: true,
      AUTH_SMS_PASSWORDLESS_ENABLED: true,
    });

    // First user takes the phone via signup AND verifies it.
    await request
      .post('/signup/passwordless/sms')
      .send({ phoneNumber })
      .expect(StatusCodes.OK);
    const otp = readSMSCode(phoneNumber);
    await request
      .post('/signin/passwordless/sms/otp')
      .send({ phoneNumber, otp })
      .expect(StatusCodes.OK);

    const { body: anonBody }: { body: SignInResponse } = await request
      .post('/signin/anonymous')
      .expect(StatusCodes.OK);

    if (!anonBody.session) {
      throw new Error('anonymous session is not set');
    }

    await request
      .post('/user/deanonymize/sms')
      .set('Authorization', `Bearer ${anonBody.session.accessToken}`)
      .send({ phoneNumber })
      .expect(StatusCodes.CONFLICT);
  });

  it('rejects when caller is not anonymous', async () => {
    const phoneNumber = '+15551110004';

    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_ANONYMOUS_USERS_ENABLED: true,
      AUTH_SMS_PASSWORDLESS_ENABLED: true,
    });

    const email = 'not-anon@example.com';
    const password = 'password-1234';

    await request
      .post('/signup/email-password')
      .send({ email, password })
      .expect(StatusCodes.OK);

    const { body: signinBody }: { body: SignInResponse } = await request
      .post('/signin/email-password')
      .send({ email, password })
      .expect(StatusCodes.OK);

    if (!signinBody.session) {
      throw new Error('session is not set');
    }

    await request
      .post('/user/deanonymize/sms')
      .set('Authorization', `Bearer ${signinBody.session.accessToken}`)
      .send({ phoneNumber })
      .expect(StatusCodes.BAD_REQUEST);
  });
});
