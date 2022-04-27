import { Client } from 'pg';
import * as faker from 'faker';
import { StatusCodes } from 'http-status-codes';

import { request } from '../../server';
import { ENV } from '../../../src/utils/env';
import { mailHogSearch } from '../../utils';

describe('user password', () => {
  let client: Client;
  let accessToken: string | undefined;
  const email = faker.internet.email();
  const password = faker.internet.password();

  beforeAll(async () => {
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: false,
    });
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
    const response = await request
      .post('/signup/email-password')
      .send({ email, password })
      .expect(StatusCodes.OK);
    accessToken = response.body.session.accessToken;
  });

  it('should authenticate with password', async () => {
    await request
      .post('/signin/email-password')
      .send({ email, password })
      .expect(StatusCodes.OK);
  });

  it('should change password with old password', async () => {
    const oldPassword = password;
    const newPassword = faker.internet.password();

    await request
      .post('/user/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPassword })
      .expect(StatusCodes.OK);

    await request
      .post('/signin/email-password')
      .send({ email, password: oldPassword })
      .expect(StatusCodes.UNAUTHORIZED);

    await request
      .post('/signin/email-password')
      .send({ email, password: newPassword })
      .expect(StatusCodes.OK);
  });

  it('should change password with ticket', async () => {
    await request
      .post('/user/password/reset')
      .send({ email })
      .expect(StatusCodes.OK);

    // get ticket from email
    const [message] = await mailHogSearch(email);
    expect(message).toBeTruthy();

    const link = message.Content.Headers['X-Link'][0];

    // use password reset link
    await request
      .get(link.replace('http://localhost:4000', ''))
      .expect(StatusCodes.MOVED_TEMPORARILY);

    // TODO
    // get refershToken from previous request

    // request new access token

    // use access token to update password

    // const oldPassword = password;
    // const newPassword = '543543543';

    // await request
    //   .post('/user/password')
    //   .set('Authorization', `Bearer ${accessToken}`)
    //   .send({ ticket: 'incorrect', newPassword })
    //   .expect(StatusCodes.BAD_REQUEST);

    // await request
    //   .post('/user/password')
    //   .set('Authorization', `Bearer ${accessToken}`)
    //   .send({ ticket: `passwordReset:${uuidv4()}`, newPassword })
    //   .expect(StatusCodes.UNAUTHORIZED);

    // await request
    //   .post('/user/password')
    //   .set('Authorization', `Bearer ${accessToken}`)
    //   .send({ ticket, newPassword })
    //   .expect(StatusCodes.OK);

    // await request
    //   .post('/signin/email-password')
    //   .send({ email, password: oldPassword })
    //   .expect(StatusCodes.UNAUTHORIZED);

    // await request
    //   .post('/signin/email-password')
    //   .send({ email, password: newPassword })
    //   .expect(StatusCodes.OK);
  });

  it('should be able to pass "redirectTo" when changing password with ticket when ', async () => {
    const options = {
      redirectTo: 'http://localhost:3000/change-password-redirect',
    };

    await request
      .post('/user/password/reset')
      .send({ email, options })
      .expect(StatusCodes.OK);

    // get ticket from email
    const [message] = await mailHogSearch(email);
    expect(message).toBeTruthy();

    const redirectTo = message.Content.Headers['X-Redirect-To'][0];
    const link = message.Content.Headers['X-Link'][0];

    // use password reset link
    await request
      .get(link.replace('http://localhost:4000', ''))
      .expect(StatusCodes.MOVED_TEMPORARILY);

    expect(redirectTo).toStrictEqual(options.redirectTo);
  });
});
