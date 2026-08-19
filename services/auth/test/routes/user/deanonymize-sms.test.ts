import { StatusCodes } from 'http-status-codes';
import { Client } from 'pg';
import { request, resetEnvironment } from '../../server';
import { ENV } from '../../src/env';
import type { SignInResponse } from '../../src/types';
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

  it('deanonymizes with an overlapping role set and removes stale roles', async () => {
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
      .send({
        phoneNumber,
        options: {
          allowedRoles: ['user'],
          defaultRole: 'user',
        },
      })
      .expect(StatusCodes.OK);

    // Until the OTP is verified, the user stays anonymous and the anonymous
    // refresh token retains only the anonymous role. Abandoning this flow must
    // neither elevate privileges nor remove anonymous-scoped access.
    const { body: refreshedSession }: { body: SignInResponse['session'] } =
      await request
        .post('/token')
        .send({ refreshToken: anonRefreshToken })
        .expect(StatusCodes.OK);
    expect(refreshedSession).toBeTruthy();
    if (!refreshedSession) {
      throw new Error('refreshed anonymous session is not set');
    }

    const midFlowClaims = await decodeAccessToken(refreshedSession.accessToken);
    const midFlowHasuraClaims = midFlowClaims?.['https://hasura.io/jwt/claims'];
    expect(midFlowHasuraClaims?.['x-hasura-user-is-anonymous']).toBe('true');
    expect(midFlowHasuraClaims?.['x-hasura-default-role']).toBe('anonymous');
    expect(midFlowHasuraClaims?.['x-hasura-allowed-roles']).toEqual([
      'anonymous',
    ]);

    {
      const { rows } = await client.query(
        `SELECT u.is_anonymous, u.default_role, u.phone_number,
                u.new_phone_number, u.phone_number_verified,
                array_agg(ur.role ORDER BY ur.role) AS roles
           FROM auth.users AS u
           JOIN auth.user_roles AS ur ON ur.user_id = u.id
          WHERE u.new_phone_number = $1
          GROUP BY u.id`,
        [phoneNumber],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].is_anonymous).toBe(true);
      expect(rows[0].default_role).toBe('anonymous');
      expect(rows[0].roles).toEqual(['anonymous']);
      expect(rows[0].phone_number).toBeNull();
      expect(rows[0].new_phone_number).toBe(phoneNumber);
      expect(rows[0].phone_number_verified).toBe(false);
    }

    await client.query(
      `INSERT INTO auth.user_roles (user_id, role)
       SELECT id, role
         FROM auth.users
         CROSS JOIN unnest(ARRAY['me', 'user']) AS roles(role)
        WHERE new_phone_number = $1`,
      [phoneNumber],
    );

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
      claims?.['https://hasura.io/jwt/claims']['x-hasura-user-is-anonymous'],
    ).toBe('false');

    // After OTP verification the user is non-anonymous and the OLD anonymous
    // refresh token is revoked.
    await request
      .post('/token')
      .send({ refreshToken: anonRefreshToken })
      .expect(StatusCodes.UNAUTHORIZED);

    const { rows } = await client.query(
      `SELECT u.is_anonymous, u.phone_number_verified,
              array_agg(ur.role ORDER BY ur.role) AS roles
         FROM auth.users AS u
         JOIN auth.user_roles AS ur ON ur.user_id = u.id
        WHERE u.phone_number = $1
        GROUP BY u.id`,
      [phoneNumber],
    );
    expect(rows[0].is_anonymous).toBe(false);
    expect(rows[0].phone_number_verified).toBe(true);
    expect(rows[0].roles).toEqual(['user']);
  });

  it('does not promote an anonymous passwordless OTP without staged options', async () => {
    const phoneNumber = '+15551110025';
    const otp = '123456';

    await request.post('/change-env').send({
      AUTH_ANONYMOUS_USERS_ENABLED: true,
      AUTH_SMS_PASSWORDLESS_ENABLED: true,
    });

    const { body: anonBody }: { body: SignInResponse } = await request
      .post('/signin/anonymous')
      .expect(StatusCodes.OK);
    if (!anonBody.session?.user) {
      throw new Error('anonymous session user is not set');
    }

    const { refreshToken, user } = anonBody.session;
    await client.query(
      `UPDATE auth.users
          SET new_phone_number = $2,
              otp_method_last_used = 'sms',
              otp_hash = crypt($3, gen_salt('bf')),
              otp_hash_expires_at = now() + interval '5 minutes'
        WHERE id = $1`,
      [user.id, phoneNumber, otp],
    );

    await request
      .post('/signin/passwordless/sms/otp')
      .send({ phoneNumber, otp })
      .expect(StatusCodes.BAD_REQUEST);

    await request.post('/token').send({ refreshToken }).expect(StatusCodes.OK);

    const { rows } = await client.query(
      `SELECT u.is_anonymous, u.default_role, u.phone_number,
              u.new_phone_number, u.phone_number_verified,
              u.otp_hash IS NOT NULL AS has_otp,
              array_agg(ur.role ORDER BY ur.role) AS roles
         FROM auth.users AS u
         JOIN auth.user_roles AS ur ON ur.user_id = u.id
        WHERE u.id = $1
        GROUP BY u.id`,
      [user.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].is_anonymous).toBe(true);
    expect(rows[0].default_role).toBe('anonymous');
    expect(rows[0].phone_number).toBeNull();
    expect(rows[0].new_phone_number).toBe(phoneNumber);
    expect(rows[0].phone_number_verified).toBe(false);
    expect(rows[0].has_otp).toBe(true);
    expect(rows[0].roles).toEqual(['anonymous']);
  });

  it('does not verify a disabled non-anonymous user with a valid OTP', async () => {
    const phoneNumber = '+15551110027';

    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_SMS_PASSWORDLESS_ENABLED: true,
    });

    await request
      .post('/signup/passwordless/sms')
      .send({ phoneNumber })
      .expect(StatusCodes.OK);

    const otp = readSMSCode(phoneNumber);
    const { rows: disabledUsers } = await client.query(
      `UPDATE auth.users
          SET disabled = true
        WHERE new_phone_number = $1
        RETURNING id`,
      [phoneNumber],
    );
    expect(disabledUsers).toHaveLength(1);

    const { body } = await request
      .post('/signin/passwordless/sms/otp')
      .send({ phoneNumber, otp })
      .expect(StatusCodes.BAD_REQUEST);
    expect(body).toMatchObject({
      error: 'invalid-otp',
      status: StatusCodes.BAD_REQUEST,
    });

    const { rows } = await client.query(
      `SELECT disabled, phone_number, new_phone_number,
              phone_number_verified, otp_hash IS NOT NULL AS has_otp
         FROM auth.users
        WHERE id = $1`,
      [disabledUsers[0].id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].disabled).toBe(true);
    expect(rows[0].phone_number).toBeNull();
    expect(rows[0].new_phone_number).toBe(phoneNumber);
    expect(rows[0].phone_number_verified).toBe(false);
    expect(rows[0].has_otp).toBe(true);
  });

  it('preserves refresh tokens when a non-anonymous user re-verifies', async () => {
    const phoneNumber = '+15551110028';

    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_SMS_PASSWORDLESS_ENABLED: true,
    });

    const verifySMSOTP = async (): Promise<
      NonNullable<SignInResponse['session']>
    > => {
      const { body }: { body: SignInResponse } = await request
        .post('/signin/passwordless/sms/otp')
        .send({ phoneNumber, otp: readSMSCode(phoneNumber) })
        .expect(StatusCodes.OK);
      if (!body.session) {
        throw new Error('verified session is not set');
      }

      return body.session;
    };

    await request
      .post('/signup/passwordless/sms')
      .send({ phoneNumber })
      .expect(StatusCodes.OK);
    const firstSession = await verifySMSOTP();

    await request
      .post('/signin/passwordless/sms')
      .send({ phoneNumber })
      .expect(StatusCodes.OK);
    const secondSession = await verifySMSOTP();

    const existingRefreshTokenIDs = [
      firstSession.refreshTokenId,
      secondSession.refreshTokenId,
    ].sort();
    expect(new Set(existingRefreshTokenIDs).size).toBe(2);

    await request
      .post('/signin/passwordless/sms')
      .send({ phoneNumber })
      .expect(StatusCodes.OK);
    await verifySMSOTP();

    const { rows } = await client.query(
      `SELECT id
         FROM auth.refresh_tokens
        WHERE id = ANY($1::uuid[])
        ORDER BY id`,
      [existingRefreshTokenIDs],
    );
    expect(rows.map((row) => row.id)).toEqual(existingRefreshTokenIDs);
  });

  it('rolls back phone promotion when atomic deanonymization fails', async () => {
    const phoneNumber = '+15551110026';
    const otp = '123456';
    const invalidRole = 'missing-atomic-deanonymization-role';

    await request.post('/change-env').send({
      AUTH_ANONYMOUS_USERS_ENABLED: true,
      AUTH_SMS_PASSWORDLESS_ENABLED: true,
    });

    const { body: anonBody }: { body: SignInResponse } = await request
      .post('/signin/anonymous')
      .expect(StatusCodes.OK);
    if (!anonBody.session?.user) {
      throw new Error('anonymous session user is not set');
    }

    const { refreshToken, user } = anonBody.session;
    await client.query(
      `UPDATE auth.users
          SET new_phone_number = $2,
              otp_method_last_used = 'sms',
              otp_hash = crypt($3, gen_salt('bf')),
              otp_hash_expires_at = now() + interval '5 minutes',
              pending_sms_deanonymize_options = jsonb_build_object(
                'roles', jsonb_build_array($4::text),
                'default_role', 'user',
                'display_name', 'Anonymous',
                'locale', 'en',
                'metadata', '{}'::jsonb
              )
        WHERE id = $1`,
      [user.id, phoneNumber, otp, invalidRole],
    );

    await request
      .post('/signin/passwordless/sms/otp')
      .send({ phoneNumber, otp })
      .expect(StatusCodes.BAD_REQUEST);

    await request.post('/token').send({ refreshToken }).expect(StatusCodes.OK);

    const { rows } = await client.query(
      `SELECT u.is_anonymous, u.default_role, u.phone_number,
              u.new_phone_number, u.phone_number_verified,
              u.otp_hash IS NOT NULL AS has_otp,
              u.pending_sms_deanonymize_options IS NOT NULL AS has_pending_options,
              array_agg(ur.role ORDER BY ur.role) AS roles
         FROM auth.users AS u
         JOIN auth.user_roles AS ur ON ur.user_id = u.id
        WHERE u.id = $1
        GROUP BY u.id`,
      [user.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].is_anonymous).toBe(true);
    expect(rows[0].default_role).toBe('anonymous');
    expect(rows[0].phone_number).toBeNull();
    expect(rows[0].new_phone_number).toBe(phoneNumber);
    expect(rows[0].phone_number_verified).toBe(false);
    expect(rows[0].has_otp).toBe(true);
    expect(rows[0].has_pending_options).toBe(true);
    expect(rows[0].roles).toEqual(['anonymous']);
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
      [phoneNumber],
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
