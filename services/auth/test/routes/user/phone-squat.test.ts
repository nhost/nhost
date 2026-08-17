import { readFileSync } from 'node:fs';
import * as faker from 'faker';
import { StatusCodes } from 'http-status-codes';
import { Client } from 'pg';
import { request, resetEnvironment } from '../../server';
import { ENV } from '../../src/env';
import type { SignInResponse } from '../../src/types';
import { readSMSCode } from '../../utils';

const querySQL = readFileSync(`${__dirname}/../../../go/sql/query.sql`, 'utf8');
const deleteExpiredStagedPhoneUsersMatch = querySQL.match(
  /-- name: DeleteExpiredStagedPhoneUsers :exec\s+([\s\S]*?);/,
);

if (!deleteExpiredStagedPhoneUsersMatch) {
  throw new Error('DeleteExpiredStagedPhoneUsers query is missing');
}

const deleteExpiredStagedPhoneUsers = deleteExpiredStagedPhoneUsersMatch[1];

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

  it('case 1: X signs up squat, Y signs up — Y wins, X row stays inert', async () => {
    const phoneNumber = '+15553330001';

    // X squats via signup-passwordless-sms (the SMS goes to +1 but X never gets it).
    await request
      .post('/signup/passwordless/sms')
      .send({ phoneNumber })
      .expect(StatusCodes.OK);

    const { rows: xRows } = await client.query(
      `SELECT id FROM auth.users WHERE new_phone_number = $1`,
      [phoneNumber],
    );
    expect(xRows).toHaveLength(1);
    const xId = xRows[0].id;

    // Verified-only existence check: X's row has phone_number=NULL,
    // new_phone_number=+1, verified=false — does NOT block Y's signup.
    await request
      .post('/signup/passwordless/sms')
      .send({ phoneNumber })
      .expect(StatusCodes.OK);

    const { rows: stagedRows } = await client.query(
      `SELECT id FROM auth.users WHERE new_phone_number = $1`,
      [phoneNumber],
    );
    expect(stagedRows).toHaveLength(2);
    const yRow = stagedRows.find((row) => row.id !== xId);
    if (!yRow) {
      throw new Error('Y staged phone row is missing');
    }
    const yId = yRow.id;

    // The latest OTP belongs to Y.
    const otp = readSMSCode(phoneNumber);

    // Y verifies — only Y's row has the matching OTP, so only Y is promoted.
    const { body: verifyBody }: { body: SignInResponse } = await request
      .post('/signin/passwordless/sms/otp')
      .send({ phoneNumber, otp })
      .expect(StatusCodes.OK);

    expect(verifyBody.session).toBeTruthy();

    // DB state: exactly one row with phone_number=+1 verified (Y); X's row
    // dangles with new_phone_number=+1 unverified and is harmless.
    const { rows } = await client.query(
      `SELECT id, phone_number, new_phone_number, phone_number_verified
         FROM auth.users
         ORDER BY phone_number_verified DESC NULLS LAST`,
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
  });

  it('sweeps expired signup retries while preserving the live OTP row', async () => {
    const phoneNumber = '+15553330007';
    const requestSMS = () =>
      request
        .post('/signup/passwordless/sms')
        .send({ phoneNumber })
        .expect(StatusCodes.OK);

    await requestSMS();
    await requestSMS();
    await requestSMS();

    await client.query(
      `UPDATE auth.users
          SET otp_hash_expires_at = now() - interval '1 minute'
        WHERE new_phone_number = $1`,
      [phoneNumber],
    );

    await requestSMS();

    const { rows: beforeSweep } = await client.query(
      `SELECT id FROM auth.users WHERE new_phone_number = $1`,
      [phoneNumber],
    );
    expect(beforeSweep).toHaveLength(4);

    await client.query(deleteExpiredStagedPhoneUsers);

    const { rows: afterSweep } = await client.query(
      `SELECT phone_number, new_phone_number, otp_hash_expires_at > now() AS otp_is_live
         FROM auth.users
        WHERE phone_number = $1 OR new_phone_number = $1`,
      [phoneNumber],
    );
    expect(afterSweep).toHaveLength(1);
    expect(afterSweep[0].phone_number).toBeNull();
    expect(afterSweep[0].new_phone_number).toBe(phoneNumber);
    expect(afterSweep[0].otp_is_live).toBe(true);
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

    // Y owns the verified phone; X's dangling row is unaffected.
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

    // Y has the verified phone. X still has new_phone_number=+1 staged but
    // can never promote it (UNIQUE constraint on phone_number would block).
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
    expect(rows[1].phone_number).toBeNull();
    expect(rows[1].new_phone_number).toBe(phoneNumber);
    expect(rows[1].email).toBeTruthy(); // X's row has an email
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
    expect(rows[1].phone_number).toBeNull();
    expect(rows[1].new_phone_number).toBe(phoneNumber);
    expect(rows[1].phone_number_verified).toBe(false);
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

  it('rejects X verifying a signup squat after Y wins without revealing ownership', async () => {
    const phoneNumber = '+15553330009';

    await request
      .post('/signup/passwordless/sms')
      .send({ phoneNumber })
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
      `SELECT id, phone_number, new_phone_number, phone_number_verified,
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
    expect(rows[1].otp_matches).toBe(true);
    expect(rows[1].otp_is_live).toBe(true);
    expect(rows[1].otp_method_last_used).toBe('sms');
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
