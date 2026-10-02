import { readFileSync } from 'node:fs';
import { StatusCodes } from 'http-status-codes';
import { Client } from 'pg';
import { request, resetEnvironment } from '../../server';
import { ENV } from '../../src/env';
import type { SignInResponse } from '../../src/types';
import { decodeAccessToken, readSMSCode, wrongSMSCode } from '../../utils';

const querySQL = readFileSync(`${__dirname}/../../../go/sql/query.sql`, 'utf8');
const releaseExpiredStagedSMSDeanonymizationsMatch = querySQL.match(
  /-- name: ReleaseExpiredStagedSMSDeanonymizations :exec\s+([\s\S]*?);/,
);

if (!releaseExpiredStagedSMSDeanonymizationsMatch) {
  throw new Error('ReleaseExpiredStagedSMSDeanonymizations query is missing');
}

const releaseExpiredStagedSMSDeanonymizations =
  releaseExpiredStagedSMSDeanonymizationsMatch[1];

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

    // After OTP verification the user is non-anonymous and the anonymous
    // session's live refresh token is revoked. Use the token from the mid-flow
    // refresh, since the original anonRefreshToken was already rotated away.
    await request
      .post('/token')
      .send({ refreshToken: refreshedSession.refreshToken })
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

  it('burns the SMS OTP after too many wrong verification attempts', async () => {
    const phoneNumber = '+15551110033';

    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_SMS_PASSWORDLESS_ENABLED: true,
    });

    await request
      .post('/signup/passwordless/sms')
      .send({ phoneNumber })
      .expect(StatusCodes.OK);

    const otp = readSMSCode(phoneNumber);
    const wrongOtp = wrongSMSCode(otp);

    // Four wrong guesses are rejected but keep the code alive: a single typo
    // must not burn a still-valid code.
    for (let attempt = 0; attempt < 4; attempt++) {
      const { body } = await request
        .post('/signin/passwordless/sms/otp')
        .send({ phoneNumber, otp: wrongOtp })
        .expect(StatusCodes.BAD_REQUEST);
      expect(body.error).toBe('invalid-otp');
    }

    // The fifth wrong guess exhausts the attempt budget and burns the code.
    const { body: burned } = await request
      .post('/signin/passwordless/sms/otp')
      .send({ phoneNumber, otp: wrongOtp })
      .expect(StatusCodes.BAD_REQUEST);
    expect(burned.error).toBe('otp-too-many-attempts');

    // Even the correct code no longer works once the code is burned.
    const { body: afterBurn } = await request
      .post('/signin/passwordless/sms/otp')
      .send({ phoneNumber, otp })
      .expect(StatusCodes.BAD_REQUEST);
    expect(afterBurn.error).toBe('otp-too-many-attempts');

    const { rows } = await client.query(
      `SELECT otp_attempts, otp_hash IS NULL AS burned
         FROM auth.users WHERE new_phone_number = $1`,
      [phoneNumber],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].otp_attempts).toBe(5);
    expect(rows[0].burned).toBe(true);
  });

  it('burns the OTP on the anonymous deanonymization path after too many wrong attempts', async () => {
    const phoneNumber = '+15551110029';

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

    await request
      .post('/user/deanonymize/sms')
      .set('Authorization', `Bearer ${anonBody.session.accessToken}`)
      .send({
        phoneNumber,
        options: { allowedRoles: ['user'], defaultRole: 'user' },
      })
      .expect(StatusCodes.OK);

    const otp = readSMSCode(phoneNumber);
    const wrongOtp = wrongSMSCode(otp);

    for (let attempt = 0; attempt < 4; attempt++) {
      const { body } = await request
        .post('/signin/passwordless/sms/otp')
        .send({ phoneNumber, otp: wrongOtp })
        .expect(StatusCodes.BAD_REQUEST);
      expect(body.error).toBe('invalid-otp');
    }

    const { body: burned } = await request
      .post('/signin/passwordless/sms/otp')
      .send({ phoneNumber, otp: wrongOtp })
      .expect(StatusCodes.BAD_REQUEST);
    expect(burned.error).toBe('otp-too-many-attempts');

    // Once burned, even the correct code must not promote the anonymous user.
    const { body: afterBurn } = await request
      .post('/signin/passwordless/sms/otp')
      .send({ phoneNumber, otp })
      .expect(StatusCodes.BAD_REQUEST);
    expect(afterBurn.error).toBe('otp-too-many-attempts');

    const { rows } = await client.query(
      `SELECT is_anonymous, otp_attempts, otp_hash IS NULL AS burned,
              phone_number, phone_number_verified
         FROM auth.users WHERE new_phone_number = $1`,
      [phoneNumber],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].is_anonymous).toBe(true);
    expect(rows[0].otp_attempts).toBe(5);
    expect(rows[0].burned).toBe(true);
    expect(rows[0].phone_number).toBeNull();
    expect(rows[0].phone_number_verified).toBe(false);
  });

  it('resets the attempt counter when a fresh deanonymization OTP is issued', async () => {
    const phoneNumber = '+15551110034';

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

    await request
      .post('/user/deanonymize/sms')
      .set('Authorization', `Bearer ${anonAccessToken}`)
      .send({
        phoneNumber,
        options: { allowedRoles: ['user'], defaultRole: 'user' },
      })
      .expect(StatusCodes.OK);

    const firstOtp = readSMSCode(phoneNumber);
    const wrongOtp = wrongSMSCode(firstOtp);

    // Three wrong guesses leave the counter nonzero but the code still alive.
    for (let attempt = 0; attempt < 3; attempt++) {
      await request
        .post('/signin/passwordless/sms/otp')
        .send({ phoneNumber, otp: wrongOtp })
        .expect(StatusCodes.BAD_REQUEST);
    }
    {
      const { rows } = await client.query(
        `SELECT otp_attempts FROM auth.users WHERE new_phone_number = $1`,
        [phoneNumber],
      );
      expect(rows[0].otp_attempts).toBe(3);
    }

    // Re-staging issues a fresh OTP and must reset the counter to zero.
    await request
      .post('/user/deanonymize/sms')
      .set('Authorization', `Bearer ${anonAccessToken}`)
      .send({
        phoneNumber,
        options: { allowedRoles: ['user'], defaultRole: 'user' },
      })
      .expect(StatusCodes.OK);
    {
      const { rows } = await client.query(
        `SELECT otp_attempts FROM auth.users WHERE new_phone_number = $1`,
        [phoneNumber],
      );
      expect(rows[0].otp_attempts).toBe(0);
    }

    // With the counter reset, the fresh OTP keeps its full budget and verifies.
    const secondOtp = readSMSCode(phoneNumber);
    const { body: verifyBody }: { body: SignInResponse } = await request
      .post('/signin/passwordless/sms/otp')
      .send({ phoneNumber, otp: secondOtp })
      .expect(StatusCodes.OK);
    expect(verifyBody.session).toBeTruthy();

    const { rows } = await client.query(
      `SELECT is_anonymous, phone_number, phone_number_verified, otp_attempts
         FROM auth.users WHERE phone_number = $1`,
      [phoneNumber],
    );
    expect(rows[0].is_anonymous).toBe(false);
    expect(rows[0].phone_number).toBe(phoneNumber);
    expect(rows[0].phone_number_verified).toBe(true);
    expect(rows[0].otp_attempts).toBe(0);
  });

  // Seed OTP hashes directly (not via readSMSCode): the dev provider keeps one
  // file per number, and an OTP collision can't be produced from random codes.
  const stageTwoAnonymous = async (
    phoneNumber: string,
    firstOtp: string,
    secondOtp: string,
  ): Promise<[string, string]> => {
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_ANONYMOUS_USERS_ENABLED: true,
      AUTH_SMS_PASSWORDLESS_ENABLED: true,
    });

    const ids: string[] = [];
    for (const otp of [firstOtp, secondOtp]) {
      const { body }: { body: SignInResponse } = await request
        .post('/signin/anonymous')
        .expect(StatusCodes.OK);
      if (!body.session?.user) {
        throw new Error('anonymous session user is not set');
      }
      await client.query(
        `UPDATE auth.users
            SET new_phone_number = $2,
                otp_method_last_used = 'sms',
                otp_attempts = 0,
                otp_hash = crypt($3, gen_salt('bf')),
                otp_hash_expires_at = now() + interval '5 minutes',
                pending_sms_deanonymize_options = jsonb_build_object(
                  'roles', jsonb_build_array('user'::text),
                  'default_role', 'user',
                  'display_name', 'Anonymous',
                  'locale', 'en',
                  'metadata', '{}'::jsonb
                )
          WHERE id = $1`,
        [body.session.user.id, phoneNumber, otp],
      );
      ids.push(body.session.user.id);
    }

    return [ids[0], ids[1]];
  };

  it('increments both staged counters on a single wrong guess when two rows share a phone', async () => {
    const phoneNumber = '+15551110031';
    const [id1, id2] = await stageTwoAnonymous(phoneNumber, '111111', '222222');

    // One wrong guess (correct for neither staged row) must consume one attempt
    // from every live row sharing the number, not just one.
    const { body } = await request
      .post('/signin/passwordless/sms/otp')
      .send({ phoneNumber, otp: '000000' })
      .expect(StatusCodes.BAD_REQUEST);
    expect(body.error).toBe('invalid-otp');

    const { rows } = await client.query(
      `SELECT id, is_anonymous, phone_number, otp_attempts,
              otp_hash IS NOT NULL AS has_otp
         FROM auth.users WHERE id = ANY($1::uuid[]) ORDER BY id`,
      [[id1, id2]],
    );
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.otp_attempts).toBe(1);
      expect(row.is_anonymous).toBe(true);
      expect(row.phone_number).toBeNull();
      expect(row.has_otp).toBe(true);
    }
  });

  it('rejects an ambiguous OTP shared by two staged rows without promoting or consuming either', async () => {
    const phoneNumber = '+15551110032';
    const [id1, id2] = await stageTwoAnonymous(phoneNumber, '123456', '123456');

    // The code matches both rows, so it identifies no single account: rejected,
    // with neither row promoted nor its challenge consumed.
    const { body } = await request
      .post('/signin/passwordless/sms/otp')
      .send({ phoneNumber, otp: '123456' })
      .expect(StatusCodes.BAD_REQUEST);
    expect(body.error).toBe('invalid-otp');

    const { rows } = await client.query(
      `SELECT id, is_anonymous, phone_number, phone_number_verified,
              new_phone_number, otp_attempts, otp_hash IS NOT NULL AS has_otp,
              pending_sms_deanonymize_options IS NOT NULL AS has_pending_options
         FROM auth.users WHERE id = ANY($1::uuid[]) ORDER BY id`,
      [[id1, id2]],
    );
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.is_anonymous).toBe(true);
      expect(row.phone_number).toBeNull();
      expect(row.phone_number_verified).toBe(false);
      expect(row.new_phone_number).toBe(phoneNumber);
      expect(row.otp_attempts).toBe(0);
      expect(row.has_otp).toBe(true);
      expect(row.has_pending_options).toBe(true);
    }
  });

  it('resets the attempt counter on a correct guess after earlier wrong ones', async () => {
    const phoneNumber = '+15551110035';

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

    await request
      .post('/user/deanonymize/sms')
      .set('Authorization', `Bearer ${anonBody.session.accessToken}`)
      .send({
        phoneNumber,
        options: { allowedRoles: ['user'], defaultRole: 'user' },
      })
      .expect(StatusCodes.OK);

    const otp = readSMSCode(phoneNumber);
    const wrongOtp = wrongSMSCode(otp);

    // Fewer than max wrong guesses: the counter climbs but the code stays live.
    for (let attempt = 0; attempt < 3; attempt++) {
      await request
        .post('/signin/passwordless/sms/otp')
        .send({ phoneNumber, otp: wrongOtp })
        .expect(StatusCodes.BAD_REQUEST);
    }
    {
      const { rows } = await client.query(
        `SELECT otp_attempts FROM auth.users WHERE new_phone_number = $1`,
        [phoneNumber],
      );
      expect(rows[0].otp_attempts).toBe(3);
    }

    // Correct code from a nonzero counter: proves the reset comes from the guess,
    // not from re-staging.
    const { body: verifyBody }: { body: SignInResponse } = await request
      .post('/signin/passwordless/sms/otp')
      .send({ phoneNumber, otp })
      .expect(StatusCodes.OK);
    expect(verifyBody.session).toBeTruthy();

    const { rows } = await client.query(
      `SELECT is_anonymous, phone_number, phone_number_verified, otp_attempts
         FROM auth.users WHERE phone_number = $1`,
      [phoneNumber],
    );
    expect(rows[0].is_anonymous).toBe(false);
    expect(rows[0].phone_number).toBe(phoneNumber);
    expect(rows[0].phone_number_verified).toBe(true);
    expect(rows[0].otp_attempts).toBe(0);
  });

  it('rejects a correct deanonymization OTP once it has expired', async () => {
    const phoneNumber = '+15551110037';

    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
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

    await request
      .post('/user/deanonymize/sms')
      .set('Authorization', `Bearer ${anonBody.session.accessToken}`)
      .send({
        phoneNumber,
        options: { allowedRoles: ['user'], defaultRole: 'user' },
      })
      .expect(StatusCodes.OK);

    const otp = readSMSCode(phoneNumber);

    await client.query(
      `UPDATE auth.users
          SET otp_hash_expires_at = now() - interval '1 minute'
        WHERE id = $1`,
      [user.id],
    );

    const { body } = await request
      .post('/signin/passwordless/sms/otp')
      .send({ phoneNumber, otp })
      .expect(StatusCodes.BAD_REQUEST);
    expect(body).toMatchObject({
      error: 'invalid-otp',
      status: StatusCodes.BAD_REQUEST,
    });

    await request.post('/token').send({ refreshToken }).expect(StatusCodes.OK);

    const { rows } = await client.query(
      `SELECT u.is_anonymous, u.default_role, u.phone_number,
              u.new_phone_number, u.phone_number_verified, u.otp_attempts,
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
    expect(rows[0].otp_attempts).toBe(0);
    expect(rows[0].has_otp).toBe(true);
    expect(rows[0].has_pending_options).toBe(true);
    expect(rows[0].roles).toEqual(['anonymous']);
  });

  it('reports invalid, not too-many-attempts, when a wrong guess burns one sibling but leaves another live', async () => {
    const phoneNumber = '+15551110036';
    const [burnedId, liveId] = await stageTwoAnonymous(
      phoneNumber,
      '111111',
      '222222',
    );
    // First row on the brink; the next wrong guess burns it but not the second.
    await client.query(`UPDATE auth.users SET otp_attempts = 4 WHERE id = $1`, [
      burnedId,
    ]);

    const { body } = await request
      .post('/signin/passwordless/sms/otp')
      .send({ phoneNumber, otp: '000000' })
      .expect(StatusCodes.BAD_REQUEST);
    // A live sibling remains, so the status is the least-terminal 'invalid-otp'.
    expect(body.error).toBe('invalid-otp');

    const { rows } = await client.query(
      `SELECT id, otp_attempts, otp_hash IS NULL AS burned
         FROM auth.users WHERE id = ANY($1::uuid[])`,
      [[burnedId, liveId]],
    );
    const burned = rows.find((row) => row.id === burnedId);
    const live = rows.find((row) => row.id === liveId);
    if (!burned || !live) {
      throw new Error('expected both staged rows to still exist');
    }
    expect(burned.otp_attempts).toBe(5);
    expect(burned.burned).toBe(true);
    expect(live.otp_attempts).toBe(1);
    expect(live.burned).toBe(false);
  });

  it('does not deanonymize a disabled anonymous user with staged options and a valid OTP', async () => {
    const phoneNumber = '+15551110099';

    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_ANONYMOUS_USERS_ENABLED: true,
      AUTH_SMS_PASSWORDLESS_ENABLED: true,
    });

    const { body: anonBody }: { body: SignInResponse } = await request
      .post('/signin/anonymous')
      .expect(StatusCodes.OK);
    if (!anonBody.session?.user) {
      throw new Error('anonymous session user is not set');
    }

    const { user } = anonBody.session;

    // Stage a deanonymization: sets pending_sms_deanonymize_options and sends an OTP.
    await request
      .post('/user/deanonymize/sms')
      .set('Authorization', `Bearer ${anonBody.session.accessToken}`)
      .send({
        phoneNumber,
        options: {
          allowedRoles: ['user'],
          defaultRole: 'user',
        },
      })
      .expect(StatusCodes.OK);

    const otp = readSMSCode(phoneNumber);

    // Disable the account AFTER staging but BEFORE OTP verification. The only
    // guard stopping the anonymous promotion branch is `disabled = false` in
    // the candidate CTE; a disabled account must never be resurrected.
    const { rowCount: disabledCount } = await client.query(
      `UPDATE auth.users SET disabled = true WHERE id = $1`,
      [user.id],
    );
    expect(disabledCount).toBe(1);

    const { body } = await request
      .post('/signin/passwordless/sms/otp')
      .send({ phoneNumber, otp })
      .expect(StatusCodes.BAD_REQUEST);
    expect(body).toMatchObject({
      error: 'invalid-otp',
      status: StatusCodes.BAD_REQUEST,
    });

    // The disabled anonymous user is untouched: not promoted, still anonymous,
    // staged options and OTP intact.
    const { rows } = await client.query(
      `SELECT u.disabled, u.is_anonymous, u.default_role, u.phone_number,
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
    expect(rows[0].disabled).toBe(true);
    expect(rows[0].is_anonymous).toBe(true);
    expect(rows[0].default_role).toBe('anonymous');
    expect(rows[0].phone_number).toBeNull();
    expect(rows[0].new_phone_number).toBe(phoneNumber);
    expect(rows[0].phone_number_verified).toBe(false);
    expect(rows[0].has_otp).toBe(true);
    expect(rows[0].has_pending_options).toBe(true);
    expect(rows[0].roles).toEqual(['anonymous']);
  });

  it('sweeps only expired staged deanonymizations and keeps the account', async () => {
    const phoneNumber = '+15551110030';

    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_ANONYMOUS_USERS_ENABLED: true,
      AUTH_SMS_PASSWORDLESS_ENABLED: true,
    });

    const { body: anonBody }: { body: SignInResponse } = await request
      .post('/signin/anonymous')
      .expect(StatusCodes.OK);
    if (!anonBody.session?.user) {
      throw new Error('anonymous session user is not set');
    }
    const { user } = anonBody.session;

    await request
      .post('/user/deanonymize/sms')
      .set('Authorization', `Bearer ${anonBody.session.accessToken}`)
      .send({
        phoneNumber,
        options: { allowedRoles: ['user'], defaultRole: 'user' },
      })
      .expect(StatusCodes.OK);

    const stagedStateSQL = `
      SELECT is_anonymous, default_role, phone_number, new_phone_number,
             phone_number_verified,
             otp_hash IS NOT NULL AS has_otp,
             otp_hash_expires_at > now() AS otp_is_live,
             otp_method_last_used,
             pending_sms_deanonymize_options IS NOT NULL AS has_pending_options
        FROM auth.users
       WHERE id = $1`;

    // OTP still live: the sweep must be a no-op.
    const { rows: staged } = await client.query(stagedStateSQL, [user.id]);
    expect(staged).toHaveLength(1);
    expect(staged[0].is_anonymous).toBe(true);
    expect(staged[0].new_phone_number).toBe(phoneNumber);
    expect(staged[0].has_otp).toBe(true);
    expect(staged[0].otp_is_live).toBe(true);
    expect(staged[0].otp_method_last_used).toBe('sms');
    expect(staged[0].has_pending_options).toBe(true);

    await client.query(releaseExpiredStagedSMSDeanonymizations);

    const { rows: afterLiveSweep } = await client.query(stagedStateSQL, [
      user.id,
    ]);
    expect(afterLiveSweep).toEqual(staged);

    // Expire the OTP, then the sweep clears the staged state while leaving the
    // still-anonymous account intact.
    await client.query(
      `UPDATE auth.users
          SET otp_hash_expires_at = now() - interval '1 day'
        WHERE id = $1`,
      [user.id],
    );
    await client.query(releaseExpiredStagedSMSDeanonymizations);

    const { rows: afterExpiredSweep } = await client.query(stagedStateSQL, [
      user.id,
    ]);
    expect(afterExpiredSweep).toHaveLength(1);
    expect(afterExpiredSweep[0].is_anonymous).toBe(true);
    expect(afterExpiredSweep[0].default_role).toBe('anonymous');
    expect(afterExpiredSweep[0].phone_number).toBeNull();
    expect(afterExpiredSweep[0].new_phone_number).toBeNull();
    expect(afterExpiredSweep[0].phone_number_verified).toBe(false);
    expect(afterExpiredSweep[0].has_otp).toBe(false);
    expect(afterExpiredSweep[0].otp_method_last_used).toBeNull();
    expect(afterExpiredSweep[0].has_pending_options).toBe(false);

    // The account survived the sweep and keeps its anonymous role.
    const { rows: roleRows } = await client.query(
      `SELECT array_agg(role ORDER BY role) AS roles
         FROM auth.user_roles WHERE user_id = $1`,
      [user.id],
    );
    expect(roleRows[0].roles).toEqual(['anonymous']);
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
