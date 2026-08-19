import { readFileSync } from 'node:fs';
import * as faker from 'faker';
import { StatusCodes } from 'http-status-codes';
import { Client } from 'pg';
import { request, resetEnvironment } from '../../server';
import { ENV } from '../../src/env';
import type { SignInResponse } from '../../src/types';
import { readSMSCode } from '../../utils';

const querySQL = readFileSync(`${__dirname}/../../../go/sql/query.sql`, 'utf8');
const releaseExpiredStagedPhoneNumbersMatch = querySQL.match(
  /-- name: ReleaseExpiredStagedPhoneNumbers :exec\s+([\s\S]*?);/,
);

if (!releaseExpiredStagedPhoneNumbersMatch) {
  throw new Error('ReleaseExpiredStagedPhoneNumbers query is missing');
}

const releaseExpiredStagedPhoneNumbers =
  releaseExpiredStagedPhoneNumbersMatch[1];

const releaseExpiredStagedPhoneNumberChangesMatch = querySQL.match(
  /-- name: ReleaseExpiredStagedPhoneNumberChanges :exec\s+([\s\S]*?);/,
);

if (!releaseExpiredStagedPhoneNumberChangesMatch) {
  throw new Error('ReleaseExpiredStagedPhoneNumberChanges query is missing');
}

const releaseExpiredStagedPhoneNumberChanges =
  releaseExpiredStagedPhoneNumberChangesMatch[1];

/**
 * These tests pin down the four squat-vs-claim scenarios for SMS phone-number
 * ownership. In each case, X (the squatter) does NOT control the phone +1, and
 * Y (the legitimate owner) does. Y must always end up with phone_number=+1
 * verified, regardless of what X tried first.
 *
 * 1. X squats via /signup/passwordless/sms, then Y signs up.
 * 2. X squats via /signup/passwordless/sms, then Y (existing email-password
 *    account) tries /user/phone-number/change.
 * 3. X squats via /user/phone-number/change (existing email-password account),
 *    then Y signs up.
 * 4. X squats via /user/phone-number/change, then Y (existing email-password
 *    account) tries /user/phone-number/change.
 */
describe('phone-number squat vs claim', () => {
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
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: false,
      AUTH_SMS_PASSWORDLESS_ENABLED: true,
      AUTH_ANONYMOUS_USERS_ENABLED: true,
    });
  });

  const signupEmailPassword = async (): Promise<string> => {
    const email = faker.internet.email();
    const password = faker.internet.password(12);

    await request
      .post('/signup/email-password')
      .send({ email, password })
      .expect(StatusCodes.OK);

    const response = await request
      .post('/signin/email-password')
      .send({ email, password })
      .expect(StatusCodes.OK);

    const body: SignInResponse = response.body;
    if (!body.session) {
      throw new Error('session is not set');
    }
    return body.session.accessToken;
  };

  const establishedAccountStateSQL = `
    SELECT users.id,
           users.updated_at,
           users.email,
           users.password_hash,
           users.phone_number,
           users.phone_number_verified,
           users.new_phone_number,
           users.otp_hash,
           users.otp_hash_expires_at,
           users.otp_hash_expires_at > now() AS otp_is_live,
           users.otp_hash_expires_at > now() - interval '1 minute'
             AS otp_expiry_is_recent,
           users.otp_method_last_used,
           ARRAY(
             SELECT refresh_tokens.id
               FROM auth.refresh_tokens
              WHERE refresh_tokens.user_id = users.id
              ORDER BY refresh_tokens.id
           ) AS refresh_token_ids
      FROM auth.users AS users
     WHERE users.id = $1`;

  const expectExpiredPhoneChangeReleased = async (
    userId: string,
    phoneNumber: string,
  ): Promise<void> => {
    const { rows: beforeSweep } = await client.query(
      establishedAccountStateSQL,
      [userId],
    );
    expect(beforeSweep).toHaveLength(1);
    const before = beforeSweep[0];
    expect(before.email).toBeTruthy();
    expect(before.password_hash).toBeTruthy();
    expect(before.new_phone_number).toBe(phoneNumber);
    expect(before.otp_hash).toBeTruthy();
    expect(before.otp_is_live).toBe(true);
    expect(before.otp_method_last_used).toBe('sms-change');
    expect(before.refresh_token_ids.length).toBeGreaterThan(0);

    await client.query(releaseExpiredStagedPhoneNumberChanges);

    const { rows: afterLiveSweep } = await client.query(
      establishedAccountStateSQL,
      [userId],
    );
    expect(afterLiveSweep).toEqual(beforeSweep);

    await client.query(
      `UPDATE auth.users
          SET otp_hash_expires_at = now() - interval '1 day'
        WHERE id = $1`,
      [userId],
    );
    await client.query(releaseExpiredStagedPhoneNumberChanges);

    const { rows: afterExpiredSweep } = await client.query(
      establishedAccountStateSQL,
      [userId],
    );
    expect(afterExpiredSweep).toHaveLength(1);
    const after = afterExpiredSweep[0];
    expect(after.id).toBe(before.id);
    expect(after.email).toBe(before.email);
    expect(after.password_hash).toBe(before.password_hash);
    expect(after.phone_number).toBe(before.phone_number);
    expect(after.phone_number_verified).toBe(before.phone_number_verified);
    expect(after.refresh_token_ids).toEqual(before.refresh_token_ids);
    expect(after.new_phone_number).toBeNull();
    expect(after.otp_hash).toBeNull();
    expect(after.otp_is_live).toBe(false);
    expect(after.otp_expiry_is_recent).toBe(true);
    expect(after.otp_method_last_used).toBeNull();
  };

  it('case 1: X signs up squat, Y retries signup — Y wins without an orphan', async () => {
    const phoneNumber = '+15553330001';

    await request
      .post('/signup/passwordless/sms')
      .send({
        phoneNumber,
        options: { displayName: 'X', metadata: { claimant: 'X' } },
      })
      .expect(StatusCodes.OK);

    const { rows: xRows } = await client.query(
      `SELECT id FROM auth.users WHERE new_phone_number = $1`,
      [phoneNumber],
    );
    expect(xRows).toHaveLength(1);
    const stagedUserId = xRows[0].id;

    await request
      .post('/signup/passwordless/sms')
      .send({
        phoneNumber,
        options: { displayName: 'Y', metadata: { claimant: 'Y' } },
      })
      .expect(StatusCodes.OK);

    const { rows: stagedRows } = await client.query(
      `SELECT id, display_name, metadata
         FROM auth.users
        WHERE new_phone_number = $1`,
      [phoneNumber],
    );
    expect(stagedRows).toHaveLength(1);
    expect(stagedRows[0].id).toBe(stagedUserId);
    expect(stagedRows[0].display_name).toBe('Y');
    expect(stagedRows[0].metadata).toEqual({ claimant: 'Y' });

    const otp = readSMSCode(phoneNumber);
    const { body: verifyBody }: { body: SignInResponse } = await request
      .post('/signin/passwordless/sms/otp')
      .send({ phoneNumber, otp })
      .expect(StatusCodes.OK);

    expect(verifyBody.session).toBeTruthy();

    const { rows } = await client.query(
      `SELECT id, phone_number, new_phone_number, phone_number_verified
         FROM auth.users`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(stagedUserId);
    expect(rows[0].phone_number).toBe(phoneNumber);
    expect(rows[0].phone_number_verified).toBe(true);
    expect(rows[0].new_phone_number).toBeNull();
  });

  it('reuses the staged row on a signin auto-signup retry', async () => {
    const phoneNumber = '+15553330010';
    const requestSMS = () =>
      request
        .post('/signin/passwordless/sms')
        .send({ phoneNumber })
        .expect(StatusCodes.OK);

    await requestSMS();
    const { rows: firstAttempt } = await client.query(
      `SELECT id FROM auth.users WHERE new_phone_number = $1`,
      [phoneNumber],
    );
    expect(firstAttempt).toHaveLength(1);

    await requestSMS();
    const { rows: afterRetry } = await client.query(
      `SELECT id FROM auth.users WHERE new_phone_number = $1`,
      [phoneNumber],
    );
    expect(afterRetry).toHaveLength(1);
    expect(afterRetry[0].id).toBe(firstAttempt[0].id);
  });

  it('deletes expired historical signup retries while preserving the live OTP row', async () => {
    const phoneNumber = '+15553330007';
    const historicalNumbers = ['+15553330701', '+15553330702', '+15553330703'];
    const requestSMS = (number: string) =>
      request
        .post('/signup/passwordless/sms')
        .send({ phoneNumber: number })
        .expect(StatusCodes.OK);

    await requestSMS(phoneNumber);
    const { rows: liveRows } = await client.query(
      `SELECT id FROM auth.users WHERE new_phone_number = $1`,
      [phoneNumber],
    );
    expect(liveRows).toHaveLength(1);
    const liveUserId = liveRows[0].id;

    for (const historicalNumber of historicalNumbers) {
      await requestSMS(historicalNumber);
    }

    await client.query(
      `UPDATE auth.users
          SET new_phone_number = $1,
              display_name = $1,
              otp_hash_expires_at = now() - interval '1 minute'
        WHERE new_phone_number = ANY($2::text[])`,
      [phoneNumber, historicalNumbers],
    );

    const { rows: beforeSweep } = await client.query(
      `SELECT id FROM auth.users WHERE new_phone_number = $1`,
      [phoneNumber],
    );
    expect(beforeSweep).toHaveLength(4);

    await client.query(releaseExpiredStagedPhoneNumbers);

    const { rows: afterSweep } = await client.query(
      `SELECT id, phone_number, new_phone_number,
              otp_hash_expires_at > now() AS otp_is_live
         FROM auth.users
        WHERE phone_number = $1 OR new_phone_number = $1`,
      [phoneNumber],
    );
    expect(afterSweep).toHaveLength(1);
    expect(afterSweep[0].id).toBe(liveUserId);
    expect(afterSweep[0].phone_number).toBeNull();
    expect(afterSweep[0].new_phone_number).toBe(phoneNumber);
    expect(afterSweep[0].otp_is_live).toBe(true);

    const { rows: survivors } = await client.query(
      `SELECT id FROM auth.users WHERE id = ANY($1::uuid[])`,
      [beforeSweep.map((row) => row.id)],
    );
    expect(survivors).toHaveLength(1);
    expect(survivors[0].id).toBe(liveUserId);
  });

  it('preserves expired staged rows that acquired an authentication method', async () => {
    const guardedNumbers = {
      password: '+15553330801',
      provider: '+15553330802',
      securityKey: '+15553330803',
      refreshToken: '+15553330804',
      mfa: '+15553330805',
    };
    const plainDebris = '+15553330806';
    const phoneNumbers = [...Object.values(guardedNumbers), plainDebris];

    const { rows: stagedRows } = await client.query(
      `INSERT INTO auth.users (
          display_name,
          locale,
          otp_method_last_used,
          otp_hash,
          otp_hash_expires_at,
          new_phone_number
       )
       SELECT phone_number,
              'en',
              'sms',
              crypt('otp', gen_salt('bf')),
              now() - interval '1 minute',
              phone_number
         FROM unnest($1::text[]) AS staged(phone_number)
       RETURNING id, new_phone_number`,
      [phoneNumbers],
    );
    const userIds = new Map(
      stagedRows.map((row) => [row.new_phone_number, row.id]),
    );
    const getUserId = (phoneNumber: string): string => {
      const userId = userIds.get(phoneNumber);
      if (!userId) {
        throw new Error(`staged test user is missing for ${phoneNumber}`);
      }
      return userId;
    };

    await client.query(
      `UPDATE auth.users
          SET password_hash = crypt('password', gen_salt('bf'))
        WHERE id = $1`,
      [getUserId(guardedNumbers.password)],
    );

    const { rows: providers } = await client.query(
      `SELECT id FROM auth.providers ORDER BY id LIMIT 1`,
    );
    if (!providers[0]) {
      throw new Error('an auth provider is required for this test');
    }
    await client.query(
      `INSERT INTO auth.user_providers (
          user_id, access_token, provider_id, provider_user_id
       ) VALUES ($1, 'unset', $2, $3)`,
      [
        getUserId(guardedNumbers.provider),
        providers[0].id,
        `phone-squat-${getUserId(guardedNumbers.provider)}`,
      ],
    );

    await client.query(
      `INSERT INTO auth.user_security_keys (user_id, credential_id)
       VALUES ($1, $2)`,
      [
        getUserId(guardedNumbers.securityKey),
        `phone-squat-${getUserId(guardedNumbers.securityKey)}`,
      ],
    );

    await client.query(
      `INSERT INTO auth.refresh_tokens (
          user_id, expires_at, refresh_token_hash
       ) VALUES ($1, now() + interval '1 hour', $2)`,
      [
        getUserId(guardedNumbers.refreshToken),
        `phone-squat-${getUserId(guardedNumbers.refreshToken)}`,
      ],
    );

    await client.query(
      `UPDATE auth.users
          SET totp_secret = 'secret', active_mfa_type = 'totp'
        WHERE id = $1`,
      [getUserId(guardedNumbers.mfa)],
    );

    await client.query(releaseExpiredStagedPhoneNumbers);

    const { rows: survivors } = await client.query(
      `SELECT new_phone_number
         FROM auth.users
        WHERE id = ANY($1::uuid[])
        ORDER BY new_phone_number`,
      [stagedRows.map((row) => row.id)],
    );
    expect(survivors.map((row) => row.new_phone_number)).toEqual(
      Object.values(guardedNumbers).sort(),
    );
  });

  it('heals a legacy unverified phone_number instead of stranding the number', async () => {
    const phoneNumber = '+15553330008';

    await request
      .post('/signup/passwordless/sms')
      .send({ phoneNumber })
      .expect(StatusCodes.OK);

    const { rows: seeded } = await client.query(
      `UPDATE auth.users
          SET phone_number = new_phone_number,
              new_phone_number = NULL,
              phone_number_verified = false
        WHERE new_phone_number = $1
        RETURNING id`,
      [phoneNumber],
    );
    expect(seeded).toHaveLength(1);
    const legacyId = seeded[0].id;

    await request
      .post('/signin/passwordless/sms')
      .send({ phoneNumber })
      .expect(StatusCodes.OK);

    const { rows: afterSignin } = await client.query(
      `SELECT id FROM auth.users WHERE phone_number = $1 OR new_phone_number = $1`,
      [phoneNumber],
    );
    expect(afterSignin).toHaveLength(1);
    expect(afterSignin[0].id).toBe(legacyId);

    const otp = readSMSCode(phoneNumber);

    const { body: verifyBody }: { body: SignInResponse } = await request
      .post('/signin/passwordless/sms/otp')
      .send({ phoneNumber, otp })
      .expect(StatusCodes.OK);

    expect(verifyBody.session).toBeTruthy();

    // The OTP healed the row in place: still one account, now verified.
    const { rows: healed } = await client.query(
      `SELECT id, phone_number, new_phone_number, phone_number_verified
         FROM auth.users
        WHERE phone_number = $1 OR new_phone_number = $1`,
      [phoneNumber],
    );
    expect(healed).toHaveLength(1);
    expect(healed[0].id).toBe(legacyId);
    expect(healed[0].phone_number).toBe(phoneNumber);
    expect(healed[0].phone_number_verified).toBe(true);
    expect(healed[0].new_phone_number).toBeNull();
  });

  it('case 2: X signs up squat, Y changes — Y wins', async () => {
    const phoneNumber = '+15553330002';

    // X squats via signup.
    await request
      .post('/signup/passwordless/sms')
      .send({ phoneNumber })
      .expect(StatusCodes.OK);

    // Y signs up (with email/password) and tries to claim +1 via change.
    const accessToken = await signupEmailPassword();

    // Verified-only existence check ignores X's unverified squat.
    await request
      .post('/user/phone-number/change')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPhoneNumber: phoneNumber })
      .expect(StatusCodes.OK);

    const otp = readSMSCode(phoneNumber);

    await request
      .post('/user/phone-number/change/verify')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPhoneNumber: phoneNumber, otp })
      .expect(StatusCodes.OK);

    // Y owns the verified phone; the unverified signup row remains staged until
    // its OTP expires and the debris sweep reclaims it.
    const { rows } = await client.query(
      `SELECT phone_number, new_phone_number, phone_number_verified, email
         FROM auth.users
         WHERE phone_number = $1 OR new_phone_number = $1
         ORDER BY phone_number_verified DESC NULLS LAST`,
      [phoneNumber],
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].phone_number).toBe(phoneNumber);
    expect(rows[0].phone_number_verified).toBe(true);
    expect(rows[0].email).toBeTruthy();
    expect(rows[1].phone_number).toBeNull();
    expect(rows[1].new_phone_number).toBe(phoneNumber);
    expect(rows[1].phone_number_verified).toBe(false);
  });

  it('case 3: X changes squat, Y signs up — Y wins', async () => {
    const phoneNumber = '+15553330003';

    // X (existing user) stages +1 via change-endpoint.
    const xToken = await signupEmailPassword();
    await request
      .post('/user/phone-number/change')
      .set('Authorization', `Bearer ${xToken}`)
      .send({ newPhoneNumber: phoneNumber })
      .expect(StatusCodes.OK);

    const { rows: xRows } = await client.query(
      `SELECT id FROM auth.users WHERE new_phone_number = $1`,
      [phoneNumber],
    );
    expect(xRows).toHaveLength(1);
    const xId = xRows[0].id;

    // Y signs up. X's new_phone_number squat is invisible to the
    // verified-only existence check.
    await request
      .post('/signup/passwordless/sms')
      .send({ phoneNumber })
      .expect(StatusCodes.OK);

    // The latest SMS body is Y's (the dev provider overwrites <phone>.txt).
    const otp = readSMSCode(phoneNumber);

    const { body: verifyBody }: { body: SignInResponse } = await request
      .post('/signin/passwordless/sms/otp')
      .send({ phoneNumber, otp })
      .expect(StatusCodes.OK);
    expect(verifyBody.session).toBeTruthy();

    // Y has the verified phone while X's change stage is still live.
    const { rows } = await client.query(
      `SELECT id, phone_number, new_phone_number, phone_number_verified, email
         FROM auth.users
         WHERE phone_number = $1 OR new_phone_number = $1
         ORDER BY phone_number_verified DESC NULLS LAST`,
      [phoneNumber],
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].phone_number).toBe(phoneNumber);
    expect(rows[0].phone_number_verified).toBe(true);
    expect(rows[0].email).toBeNull(); // Y's row has no email yet
    expect(rows[1].id).toBe(xId);
    expect(rows[1].phone_number).toBeNull();
    expect(rows[1].new_phone_number).toBe(phoneNumber);
    expect(rows[1].email).toBeTruthy(); // X's row has an email

    await expectExpiredPhoneChangeReleased(xId, phoneNumber);

    const { rows: afterSweep } = await client.query(
      `SELECT phone_number, new_phone_number, phone_number_verified
         FROM auth.users
        WHERE phone_number = $1 OR new_phone_number = $1`,
      [phoneNumber],
    );
    expect(afterSweep).toHaveLength(1);
    expect(afterSweep[0].phone_number).toBe(phoneNumber);
    expect(afterSweep[0].new_phone_number).toBeNull();
    expect(afterSweep[0].phone_number_verified).toBe(true);
  });

  it('case 4: X changes squat, Y changes — Y wins', async () => {
    const phoneNumber = '+15553330004';

    // X stages +1 via change.
    const xToken = await signupEmailPassword();
    await request
      .post('/user/phone-number/change')
      .set('Authorization', `Bearer ${xToken}`)
      .send({ newPhoneNumber: phoneNumber })
      .expect(StatusCodes.OK);

    const { rows: xRows } = await client.query(
      `SELECT id FROM auth.users WHERE new_phone_number = $1`,
      [phoneNumber],
    );
    expect(xRows).toHaveLength(1);
    const xId = xRows[0].id;

    // Y also wants to change to +1.
    const yToken = await signupEmailPassword();
    await request
      .post('/user/phone-number/change')
      .set('Authorization', `Bearer ${yToken}`)
      .send({ newPhoneNumber: phoneNumber })
      .expect(StatusCodes.OK);

    const otp = readSMSCode(phoneNumber);

    await request
      .post('/user/phone-number/change/verify')
      .set('Authorization', `Bearer ${yToken}`)
      .send({ newPhoneNumber: phoneNumber, otp })
      .expect(StatusCodes.OK);

    const { rows } = await client.query(
      `SELECT id, phone_number, new_phone_number, phone_number_verified
         FROM auth.users
         WHERE phone_number = $1 OR new_phone_number = $1
         ORDER BY phone_number_verified DESC NULLS LAST`,
      [phoneNumber],
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].phone_number).toBe(phoneNumber);
    expect(rows[0].phone_number_verified).toBe(true);
    expect(rows[1].id).toBe(xId);
    expect(rows[1].phone_number).toBeNull();
    expect(rows[1].new_phone_number).toBe(phoneNumber);
    expect(rows[1].phone_number_verified).toBe(false);

    await expectExpiredPhoneChangeReleased(xId, phoneNumber);

    const { rows: afterSweep } = await client.query(
      `SELECT phone_number, new_phone_number, phone_number_verified
         FROM auth.users
        WHERE phone_number = $1 OR new_phone_number = $1`,
      [phoneNumber],
    );
    expect(afterSweep).toHaveLength(1);
    expect(afterSweep[0].phone_number).toBe(phoneNumber);
    expect(afterSweep[0].new_phone_number).toBeNull();
    expect(afterSweep[0].phone_number_verified).toBe(true);
  });

  it('rejects X verifying a change-endpoint squat after Y wins', async () => {
    const phoneNumber = '+15553330008';

    const xToken = await signupEmailPassword();
    await request
      .post('/user/phone-number/change')
      .set('Authorization', `Bearer ${xToken}`)
      .send({ newPhoneNumber: phoneNumber })
      .expect(StatusCodes.OK);
    const otpX = readSMSCode(phoneNumber);

    const { rows: xRows } = await client.query(
      `SELECT id, otp_hash = crypt($2, otp_hash) AS otp_matches,
              otp_hash_expires_at > now() AS otp_is_live
         FROM auth.users
        WHERE new_phone_number = $1`,
      [phoneNumber, otpX],
    );
    expect(xRows).toHaveLength(1);
    expect(xRows[0].otp_matches).toBe(true);
    expect(xRows[0].otp_is_live).toBe(true);
    const xId = xRows[0].id;

    await request
      .post('/signup/passwordless/sms')
      .send({ phoneNumber })
      .expect(StatusCodes.OK);
    const otpY = readSMSCode(phoneNumber);

    const { rows: yRows } = await client.query(
      `SELECT id
         FROM auth.users
        WHERE new_phone_number = $1 AND id <> $2`,
      [phoneNumber, xId],
    );
    expect(yRows).toHaveLength(1);
    const yId = yRows[0].id;

    await request
      .post('/signin/passwordless/sms/otp')
      .send({ phoneNumber, otp: otpY })
      .expect(StatusCodes.OK);

    const conflictResponse = await request
      .post('/user/phone-number/change/verify')
      .set('Authorization', `Bearer ${xToken}`)
      .send({ newPhoneNumber: phoneNumber, otp: otpX })
      .expect(StatusCodes.CONFLICT);
    expect(conflictResponse.body).toEqual({
      status: StatusCodes.CONFLICT,
      message: 'User already exists',
      error: 'user-already-exists',
    });

    const { rows } = await client.query(
      `SELECT id, phone_number, new_phone_number, phone_number_verified, email,
              otp_hash = crypt($2, otp_hash) AS otp_matches,
              otp_hash_expires_at > now() AS otp_is_live,
              otp_method_last_used
         FROM auth.users
        WHERE phone_number = $1 OR new_phone_number = $1
        ORDER BY phone_number_verified DESC NULLS LAST`,
      [phoneNumber, otpX],
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe(yId);
    expect(rows[0].phone_number).toBe(phoneNumber);
    expect(rows[0].phone_number_verified).toBe(true);
    expect(rows[0].new_phone_number).toBeNull();
    expect(rows[1].id).toBe(xId);
    expect(rows[1].phone_number).toBeNull();
    expect(rows[1].new_phone_number).toBe(phoneNumber);
    expect(rows[1].phone_number_verified).toBe(false);
    expect(rows[1].email).toBeTruthy();
    expect(rows[1].otp_matches).toBe(true);
    expect(rows[1].otp_is_live).toBe(true);
    expect(rows[1].otp_method_last_used).toBe('sms-change');
  });

  it('rejects the superseded signup OTP after a retry without revealing ownership', async () => {
    const phoneNumber = '+15553330009';

    await request
      .post('/signup/passwordless/sms')
      .send({ phoneNumber })
      .expect(StatusCodes.OK);
    const otpX = readSMSCode(phoneNumber);

    const { rows: initialRows } = await client.query(
      `SELECT id, otp_hash = crypt($2, otp_hash) AS otp_matches,
              otp_hash_expires_at > now() AS otp_is_live
         FROM auth.users
        WHERE new_phone_number = $1`,
      [phoneNumber, otpX],
    );
    expect(initialRows).toHaveLength(1);
    expect(initialRows[0].otp_matches).toBe(true);
    expect(initialRows[0].otp_is_live).toBe(true);
    const stagedUserId = initialRows[0].id;

    await request
      .post('/signup/passwordless/sms')
      .send({ phoneNumber })
      .expect(StatusCodes.OK);
    const otpY = readSMSCode(phoneNumber);

    const { rows: retriedRows } = await client.query(
      `SELECT id,
              otp_hash = crypt($2, otp_hash) AS old_otp_matches,
              otp_hash = crypt($3, otp_hash) AS new_otp_matches
         FROM auth.users
        WHERE new_phone_number = $1`,
      [phoneNumber, otpX, otpY],
    );
    expect(retriedRows).toHaveLength(1);
    expect(retriedRows[0].id).toBe(stagedUserId);
    expect(retriedRows[0].old_otp_matches).toBe(false);
    expect(retriedRows[0].new_otp_matches).toBe(true);

    await request
      .post('/signin/passwordless/sms/otp')
      .send({ phoneNumber, otp: otpY })
      .expect(StatusCodes.OK);

    const invalidOTPResponse = await request
      .post('/signin/passwordless/sms/otp')
      .send({ phoneNumber, otp: otpX })
      .expect(StatusCodes.BAD_REQUEST);
    expect(invalidOTPResponse.body).toEqual({
      status: StatusCodes.BAD_REQUEST,
      message: 'Invalid or expired OTP',
      error: 'invalid-otp',
    });

    const { rows } = await client.query(
      `SELECT id, phone_number, new_phone_number, phone_number_verified
         FROM auth.users
        WHERE phone_number = $1 OR new_phone_number = $1`,
      [phoneNumber],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(stagedUserId);
    expect(rows[0].phone_number).toBe(phoneNumber);
    expect(rows[0].phone_number_verified).toBe(true);
    expect(rows[0].new_phone_number).toBeNull();
  });

  it('verified phone DOES block another change', async () => {
    const phoneNumber = '+15553330005';

    // Y owns and verifies +1.
    await request
      .post('/signup/passwordless/sms')
      .send({ phoneNumber })
      .expect(StatusCodes.OK);
    const otpY = readSMSCode(phoneNumber);
    await request
      .post('/signin/passwordless/sms/otp')
      .send({ phoneNumber, otp: otpY })
      .expect(StatusCodes.OK);

    // X tries to change to +1 — must be blocked.
    const xToken = await signupEmailPassword();
    await request
      .post('/user/phone-number/change')
      .set('Authorization', `Bearer ${xToken}`)
      .send({ newPhoneNumber: phoneNumber })
      .expect(StatusCodes.CONFLICT);
  });

  it('verified phone DOES block another signup (silent OK, no SMS)', async () => {
    const phoneNumber = '+15553330006';

    // Y owns and verifies +1.
    await request
      .post('/signup/passwordless/sms')
      .send({ phoneNumber })
      .expect(StatusCodes.OK);
    const otpY = readSMSCode(phoneNumber);
    await request
      .post('/signin/passwordless/sms/otp')
      .send({ phoneNumber, otp: otpY })
      .expect(StatusCodes.OK);

    // A second signup gets 200 OK (anti-enumeration) but does NOT create a
    // new dangling row.
    await request
      .post('/signup/passwordless/sms')
      .send({ phoneNumber })
      .expect(StatusCodes.OK);

    const { rows } = await client.query(
      `SELECT count(*)::int AS n FROM auth.users WHERE phone_number = $1 OR new_phone_number = $1`,
      [phoneNumber],
    );
    expect(rows[0].n).toBe(1);
  });
});
