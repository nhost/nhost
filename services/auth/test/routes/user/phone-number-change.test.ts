import { Client } from 'pg';
import { StatusCodes } from 'http-status-codes';
import * as faker from 'faker';

import { ENV } from '../../src/env';
import { request, resetEnvironment } from '../../server';
import { SignInResponse } from '../../src/types';
import { readSMSCode } from '../../utils';

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
        [email]
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
      .send({ newPhoneNumber, otp: '000000' })
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
        [email]
      );
      expect(rows[0].phone_number).toBe(newPhoneNumber);
      expect(rows[0].phone_number_verified).toBe(true);
      expect(rows[0].new_phone_number).toBeNull();
      expect(rows[0].otp_method_last_used).toBeNull();
    }
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

  it('rejects when new phone is already in use by another user', async () => {
    const newPhoneNumber = '+15552220003';

    // another user signs up with that phone via signup-passwordless-sms
    await request
      .post('/signup/passwordless/sms')
      .send({ phoneNumber: newPhoneNumber })
      .expect(StatusCodes.OK);

    await request
      .post('/user/phone-number/change')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPhoneNumber })
      .expect(StatusCodes.CONFLICT);
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
