import * as faker from 'faker';
import { StatusCodes } from 'http-status-codes';
import { Client } from 'pg';
import { request, resetEnvironment } from '../../server';
import { ENV } from '../../src/env';
import type { SignInResponse } from '../../src/types';
import { readSMSCode, wrongSMSCode } from '../../utils';

describe('user/phone-number/change', () => {
  let client: Client;
  let accessToken: string | undefined;
  const email = faker.internet.email();
  const password = faker.internet.password(12);

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
    });

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
    accessToken = body.session.accessToken;
  });

  it('changes phone number end-to-end via SMS OTP', async () => {
    const newPhoneNumber = '+15552220001';

    // requires auth
    await request
      .post('/user/phone-number/change')
      .send({ newPhoneNumber })
      .expect(StatusCodes.UNAUTHORIZED);

    await request
      .post('/user/phone-number/change')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPhoneNumber })
      .expect(StatusCodes.OK);

    // staged: phone is still NULL/blank, new_phone_number is set, otp method is sms-change
    {
      const { rows } = await client.query(
        `SELECT phone_number, phone_number_verified, new_phone_number, otp_method_last_used
           FROM auth.users WHERE email = $1`,
        [email],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].phone_number).toBeNull();
      expect(rows[0].phone_number_verified).toBe(false);
      expect(rows[0].new_phone_number).toBe(newPhoneNumber);
      expect(rows[0].otp_method_last_used).toBe('sms-change');
    }

    const otp = readSMSCode(newPhoneNumber);

    // wrong OTP should fail
    await request
      .post('/user/phone-number/change/verify')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPhoneNumber, otp: wrongSMSCode(otp) })
      .expect(StatusCodes.BAD_REQUEST);

    // correct OTP swaps the staged phone in
    await request
      .post('/user/phone-number/change/verify')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPhoneNumber, otp })
      .expect(StatusCodes.OK);

    {
      const { rows } = await client.query(
        `SELECT phone_number, phone_number_verified, new_phone_number, otp_method_last_used
           FROM auth.users WHERE email = $1`,
        [email],
      );
      expect(rows[0].phone_number).toBe(newPhoneNumber);
      expect(rows[0].phone_number_verified).toBe(true);
      expect(rows[0].new_phone_number).toBeNull();
      expect(rows[0].otp_method_last_used).toBeNull();
    }
  });

  it('allows an SMS-only user to change phone number when email verification is required', async () => {
    const currentPhoneNumber = '+15552220011';
    const newPhoneNumber = '+15552220012';

    await request.post('/change-env').send({
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: true,
    });

    await request
      .post('/signup/passwordless/sms')
      .send({ phoneNumber: currentPhoneNumber })
      .expect(StatusCodes.OK);

    const { body: signInBody }: { body: SignInResponse } = await request
      .post('/signin/passwordless/sms/otp')
      .send({
        phoneNumber: currentPhoneNumber,
        otp: readSMSCode(currentPhoneNumber),
      })
      .expect(StatusCodes.OK);

    if (!signInBody.session) {
      throw new Error('SMS-only session is not set');
    }

    await request
      .post('/user/phone-number/change')
      .set('Authorization', `Bearer ${signInBody.session.accessToken}`)
      .send({ newPhoneNumber })
      .expect(StatusCodes.OK);

    await request
      .post('/user/phone-number/change/verify')
      .set('Authorization', `Bearer ${signInBody.session.accessToken}`)
      .send({ newPhoneNumber, otp: readSMSCode(newPhoneNumber) })
      .expect(StatusCodes.OK);

    const { rows } = await client.query(
      `SELECT email, phone_number, phone_number_verified, new_phone_number
         FROM auth.users WHERE phone_number = $1`,
      [newPhoneNumber],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBeNull();
    expect(rows[0].phone_number).toBe(newPhoneNumber);
    expect(rows[0].phone_number_verified).toBe(true);
    expect(rows[0].new_phone_number).toBeNull();
  });

  it('keeps a staged phone change during sign-in with the current number', async () => {
    const currentPhoneNumber = '+15552220007';
    const stagedPhoneNumber = '+15552220008';

    await request
      .post('/user/phone-number/change')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPhoneNumber: currentPhoneNumber })
      .expect(StatusCodes.OK);

    await request
      .post('/user/phone-number/change/verify')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        newPhoneNumber: currentPhoneNumber,
        otp: readSMSCode(currentPhoneNumber),
      })
      .expect(StatusCodes.OK);

    await request
      .post('/user/phone-number/change')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPhoneNumber: stagedPhoneNumber })
      .expect(StatusCodes.OK);

    await request
      .post('/signin/passwordless/sms')
      .send({ phoneNumber: currentPhoneNumber })
      .expect(StatusCodes.OK);

    await request
      .post('/signin/passwordless/sms/otp')
      .send({
        phoneNumber: currentPhoneNumber,
        otp: readSMSCode(currentPhoneNumber),
      })
      .expect(StatusCodes.OK);

    const { rows } = await client.query(
      `SELECT phone_number, phone_number_verified, new_phone_number
         FROM auth.users WHERE email = $1`,
      [email],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].phone_number).toBe(currentPhoneNumber);
    expect(rows[0].phone_number_verified).toBe(true);
    expect(rows[0].new_phone_number).toBe(stagedPhoneNumber);
  });

  it('rejects promoting a staged phone with the current phone OTP', async () => {
    const currentPhoneNumber = '+15552220009';
    const stagedPhoneNumber = '+15552220010';

    await request
      .post('/user/phone-number/change')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPhoneNumber: currentPhoneNumber })
      .expect(StatusCodes.OK);

    await request
      .post('/user/phone-number/change/verify')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        newPhoneNumber: currentPhoneNumber,
        otp: readSMSCode(currentPhoneNumber),
      })
      .expect(StatusCodes.OK);

    await request
      .post('/user/phone-number/change')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPhoneNumber: stagedPhoneNumber })
      .expect(StatusCodes.OK);

    await request
      .post('/signin/passwordless/sms')
      .send({ phoneNumber: currentPhoneNumber })
      .expect(StatusCodes.OK);

    await request
      .post('/signin/passwordless/sms/otp')
      .send({
        phoneNumber: stagedPhoneNumber,
        otp: readSMSCode(currentPhoneNumber),
      })
      .expect(StatusCodes.BAD_REQUEST);

    const { rows } = await client.query(
      `SELECT phone_number, phone_number_verified, new_phone_number
         FROM auth.users WHERE email = $1`,
      [email],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].phone_number).toBe(currentPhoneNumber);
    expect(rows[0].phone_number_verified).toBe(true);
    expect(rows[0].new_phone_number).toBe(stagedPhoneNumber);
  });

  it('rejects when SMS passwordless is disabled', async () => {
    await request.post('/change-env').send({
      AUTH_SMS_PASSWORDLESS_ENABLED: false,
    });

    await request
      .post('/user/phone-number/change')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPhoneNumber: '+15552220002' })
      .expect(StatusCodes.CONFLICT);
  });

  it('rejects when new phone is already verified by another user', async () => {
    const newPhoneNumber = '+15552220003';

    // Another user signs up with that phone via signup-passwordless-sms AND
    // verifies it — only verified phone numbers block subsequent claims.
    await request
      .post('/signup/passwordless/sms')
      .send({ phoneNumber: newPhoneNumber })
      .expect(StatusCodes.OK);

    const otp = readSMSCode(newPhoneNumber);

    await request
      .post('/signin/passwordless/sms/otp')
      .send({ phoneNumber: newPhoneNumber, otp })
      .expect(StatusCodes.OK);

    await request
      .post('/user/phone-number/change')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPhoneNumber })
      .expect(StatusCodes.CONFLICT);
  });

  it('does NOT reject when new phone is only staged (unverified) by another user', async () => {
    const newPhoneNumber = '+15552220006';

    // Another user signs up with the phone but never verifies — leaves
    // new_phone_number=+1 on a stranger's row.
    await request
      .post('/signup/passwordless/sms')
      .send({ phoneNumber: newPhoneNumber })
      .expect(StatusCodes.OK);

    // Y proceeds with change — the verified-only existence check ignores X's
    // unverified squat.
    await request
      .post('/user/phone-number/change')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPhoneNumber })
      .expect(StatusCodes.OK);
  });

  it('allows retrying with the same number when previous OTP was not verified', async () => {
    const newPhoneNumber = '+15552220005';

    // First attempt: SMS sent, new_phone_number staged but never verified.
    await request
      .post('/user/phone-number/change')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPhoneNumber })
      .expect(StatusCodes.OK);

    // Second attempt with the same number must succeed; the staged
    // new_phone_number on the caller's row must not block them.
    await request
      .post('/user/phone-number/change')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPhoneNumber })
      .expect(StatusCodes.OK);

    // The latest OTP must verify successfully.
    const otp = readSMSCode(newPhoneNumber);

    await request
      .post('/user/phone-number/change/verify')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPhoneNumber, otp })
      .expect(StatusCodes.OK);

    const { rows } = await client.query(
      `SELECT phone_number, phone_number_verified, new_phone_number
         FROM auth.users WHERE email = $1`,
      [email],
    );
    expect(rows[0].phone_number).toBe(newPhoneNumber);
    expect(rows[0].phone_number_verified).toBe(true);
    expect(rows[0].new_phone_number).toBeNull();
  });

  it('burns the OTP after too many wrong verification attempts', async () => {
    const newPhoneNumber = '+15552220020';

    await request
      .post('/user/phone-number/change')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPhoneNumber })
      .expect(StatusCodes.OK);

    const otp = readSMSCode(newPhoneNumber);
    const wrongOtp = wrongSMSCode(otp);

    // Four wrong guesses are rejected but keep the code alive: a single typo
    // must not burn a still-valid code.
    for (let attempt = 0; attempt < 4; attempt++) {
      const { body } = await request
        .post('/user/phone-number/change/verify')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ newPhoneNumber, otp: wrongOtp })
        .expect(StatusCodes.BAD_REQUEST);
      expect(body.error).toBe('invalid-otp');
    }

    // The fifth wrong guess exhausts the attempt budget and burns the code.
    const { body: burned } = await request
      .post('/user/phone-number/change/verify')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPhoneNumber, otp: wrongOtp })
      .expect(StatusCodes.BAD_REQUEST);
    expect(burned.error).toBe('otp-too-many-attempts');

    // Even the correct code no longer works once the code is burned.
    const { body: afterBurn } = await request
      .post('/user/phone-number/change/verify')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPhoneNumber, otp })
      .expect(StatusCodes.BAD_REQUEST);
    expect(afterBurn.error).toBe('otp-too-many-attempts');

    const { rows } = await client.query(
      `SELECT otp_attempts, otp_hash IS NULL AS burned, phone_number_verified
         FROM auth.users WHERE email = $1`,
      [email],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].otp_attempts).toBe(5);
    expect(rows[0].burned).toBe(true);
    expect(rows[0].phone_number_verified).toBe(false);
  });

  it('resets the attempt counter when a fresh phone-change OTP is issued', async () => {
    const newPhoneNumber = '+15552220021';

    await request
      .post('/user/phone-number/change')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPhoneNumber })
      .expect(StatusCodes.OK);

    const firstOtp = readSMSCode(newPhoneNumber);
    const wrongOtp = wrongSMSCode(firstOtp);

    // Three wrong guesses leave the counter nonzero but the code still alive.
    for (let attempt = 0; attempt < 3; attempt++) {
      await request
        .post('/user/phone-number/change/verify')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ newPhoneNumber, otp: wrongOtp })
        .expect(StatusCodes.BAD_REQUEST);
    }
    {
      const { rows } = await client.query(
        `SELECT otp_attempts FROM auth.users WHERE email = $1`,
        [email],
      );
      expect(rows[0].otp_attempts).toBe(3);
    }

    // Re-requesting the change issues a fresh OTP and must reset the counter.
    await request
      .post('/user/phone-number/change')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPhoneNumber })
      .expect(StatusCodes.OK);
    {
      const { rows } = await client.query(
        `SELECT otp_attempts FROM auth.users WHERE email = $1`,
        [email],
      );
      expect(rows[0].otp_attempts).toBe(0);
    }

    // With the counter reset, the fresh OTP keeps its full budget and verifies.
    const secondOtp = readSMSCode(newPhoneNumber);
    await request
      .post('/user/phone-number/change/verify')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPhoneNumber, otp: secondOtp })
      .expect(StatusCodes.OK);

    const { rows } = await client.query(
      `SELECT phone_number, phone_number_verified, new_phone_number, otp_attempts
         FROM auth.users WHERE email = $1`,
      [email],
    );
    expect(rows[0].phone_number).toBe(newPhoneNumber);
    expect(rows[0].phone_number_verified).toBe(true);
    expect(rows[0].new_phone_number).toBeNull();
    expect(rows[0].otp_attempts).toBe(0);
  });

  it('resets the attempt counter on a correct guess after earlier wrong ones', async () => {
    const newPhoneNumber = '+15552220022';

    await request
      .post('/user/phone-number/change')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPhoneNumber })
      .expect(StatusCodes.OK);

    const otp = readSMSCode(newPhoneNumber);
    const wrongOtp = wrongSMSCode(otp);

    // Fewer than max wrong guesses: the counter climbs but the code stays live.
    for (let attempt = 0; attempt < 3; attempt++) {
      await request
        .post('/user/phone-number/change/verify')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ newPhoneNumber, otp: wrongOtp })
        .expect(StatusCodes.BAD_REQUEST);
    }
    {
      const { rows } = await client.query(
        `SELECT otp_attempts FROM auth.users WHERE email = $1`,
        [email],
      );
      expect(rows[0].otp_attempts).toBe(3);
    }

    // Correct code from a nonzero counter: proves the reset comes from the guess,
    // not from re-requesting.
    await request
      .post('/user/phone-number/change/verify')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPhoneNumber, otp })
      .expect(StatusCodes.OK);

    const { rows } = await client.query(
      `SELECT phone_number, phone_number_verified, new_phone_number, otp_attempts
         FROM auth.users WHERE email = $1`,
      [email],
    );
    expect(rows[0].phone_number).toBe(newPhoneNumber);
    expect(rows[0].phone_number_verified).toBe(true);
    expect(rows[0].new_phone_number).toBeNull();
    expect(rows[0].otp_attempts).toBe(0);
  });

  it('rejects verify with mismatched newPhoneNumber', async () => {
    const newPhoneNumber = '+15552220004';

    await request
      .post('/user/phone-number/change')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPhoneNumber })
      .expect(StatusCodes.OK);

    const otp = readSMSCode(newPhoneNumber);

    // verify with a different phone number than was staged
    await request
      .post('/user/phone-number/change/verify')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPhoneNumber: '+15559999999', otp })
      .expect(StatusCodes.BAD_REQUEST);
  });
});
