import * as faker from 'faker';
import { StatusCodes } from 'http-status-codes';
import { Client } from 'pg';
import { request, resetEnvironment } from '../../server';
import { ENV } from '../../src/env';
import type { SignInResponse } from '../../src/types';
import { readSMSCode } from '../../utils';

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

    // The existence check matches only phone_number, so X's new_phone_number
    // squat is ignored.
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

    // Y owns the verified phone; X's unverified signup row keeps its stale
    // new_phone_number — like new_email, staged values are not auto-cleaned.
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

    // Y signs up. X's new_phone_number squat is invisible to the existence
    // check, which matches only phone_number.
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

  it('legacy unverified phone_number DOES block another change', async () => {
    const phoneNumber = '+15553330007';

    // Y is an established email-password account holding +1 as a legacy
    // unverified phone_number — the shape the data migration deliberately
    // leaves in place for accounts with other credentials.
    await signupEmailPassword();
    const { rows: seeded } = await client.query(
      `UPDATE auth.users
          SET phone_number = $1,
              phone_number_verified = false
        WHERE email IS NOT NULL
        RETURNING id`,
      [phoneNumber],
    );
    expect(seeded).toHaveLength(1);

    // X tries to change to +1 — rejected early: any phone_number holder blocks
    // the confirm via users_phone_number_key, verified or not, so no SMS is
    // wasted on a doomed change.
    const xToken = await signupEmailPassword();
    const conflictResponse = await request
      .post('/user/phone-number/change')
      .set('Authorization', `Bearer ${xToken}`)
      .send({ newPhoneNumber: phoneNumber })
      .expect(StatusCodes.CONFLICT);
    expect(conflictResponse.body).toEqual({
      status: StatusCodes.CONFLICT,
      message: 'User already exists',
      error: 'user-already-exists',
    });

    // Nothing was staged for X.
    const { rows } = await client.query(
      `SELECT count(*)::int AS n FROM auth.users WHERE new_phone_number = $1`,
      [phoneNumber],
    );
    expect(rows[0].n).toBe(0);
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
