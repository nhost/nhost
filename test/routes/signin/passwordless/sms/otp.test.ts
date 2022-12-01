import { Client } from 'pg';
import * as faker from 'faker';
import { StatusCodes } from 'http-status-codes';

import { ENV } from '../../../../../src/utils/env';
import { request } from '../../../../server';

describe('passwordless sms otp verification', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({
      connectionString: ENV.HASURA_GRAPHQL_DATABASE_URL,
    });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  beforeEach(async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_SMS_PASSWORDLESS_ENABLED: true,
      AUTH_SMS_TEST_PHONE_NUMBERS: '+359837025545',
    });
  });

  it('should reject invalid phone number', async () => {
    await request
      .post('/signin/passwordless/sms/otp')
      .send({
        phoneNumber: faker.phone.phoneNumber(),
        otp: '123456',
      })
      .expect(StatusCodes.BAD_REQUEST);
  });

  it('should handle test phone number verification and fail when invalid code', async () => {
    await request
      .post('/signin/passwordless/sms/otp')
      .send({
        phoneNumber: '+359837025545',
        otp: '234567',
      })
      .expect(StatusCodes.UNAUTHORIZED);
  });
});
