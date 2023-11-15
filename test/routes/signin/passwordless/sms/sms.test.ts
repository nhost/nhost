import { Client } from 'pg';
import * as faker from 'faker';
import { StatusCodes } from 'http-status-codes';

import { ENV } from '../../../../../src/utils/env';
import { request } from '../../../../server';

describe('passwordless sms', () => {
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
      .post('/signin/passwordless/sms')
      .send({
        phoneNumber: faker.phone.phoneNumber(),
      })
      .expect(StatusCodes.BAD_REQUEST);
  });

  it('should handle test phone numbers', async () => {
    await request
      .post('/signin/passwordless/sms')
      .send({
        phoneNumber: '+359837025545',
      })
      .expect(StatusCodes.OK);
  });

  it('should fail when no SMS provider if the phone number is not test phone number', async () => {
    await request
      .post('/signin/passwordless/sms')
      .send({
        phoneNumber: faker.phone.phoneNumber('+359 8## ### ###'),
      })
      .expect(StatusCodes.INTERNAL_SERVER_ERROR);
  });

  it('should fail when signup is disabled', async () => {
    const phoneNumber = `+3598${faker.phone.phoneNumber('########')}`;

    await request.post('/change-env').send({
      AUTH_DISABLE_SIGNUP: true,
      AUTH_SMS_TEST_PHONE_NUMBERS: phoneNumber,
    });

    await request
      .post('/signin/passwordless/sms')
      .send({
        phoneNumber,
      })
      .expect(StatusCodes.FORBIDDEN);
  });
});
