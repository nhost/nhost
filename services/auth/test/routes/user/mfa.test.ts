import { Client } from 'pg';
import { StatusCodes } from 'http-status-codes';

import { ENV } from '../../src/env';
import { request } from '../../server';
import { SignInResponse } from '../../src/types';
import { authenticator } from 'otplib';

describe('mfa totp', () => {
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
    await client.query(`DELETE FROM auth.users;`);

    await request.post('/change-env').send({
      AUTH_DISABLE_SIGNUP: false,
    });

  });

  it('should generate a secret, enable mfa and sign in with mfa', async () => {
    await request.post('/change-env').send({
      AUTH_MFA_ENABLED: true,
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: false,
    });

    const email = 'asdasd@asdasd.com';
    const password = '123123123';

    let accessToken = '';

    await request
      .post('/signup/email-password')
      .send({ email, password })
      .expect(StatusCodes.OK);

    const { body }: { body: SignInResponse } = await request
      .post('/signin/email-password')
      .send({ email, password })
      .expect(StatusCodes.OK);

    expect(body.session).toBeTruthy();

    if (!body.session) {
      throw new Error('session is not set');
    }

    accessToken = body.session.accessToken;

    // generate
    const {
      body: { totpSecret },
    } = await request
      .get('/mfa/totp/generate')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(StatusCodes.OK);

    // enable totp mfa
    await request
      .post('/user/mfa')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        code: authenticator.generate(totpSecret),
        activeMfaType: 'totp',
      })
      .expect(StatusCodes.OK);

    // TODO: log out

    const { body: signInBody }: { body: SignInResponse } = await request
      .post('/signin/email-password')
      .send({ email, password })
      .expect(StatusCodes.OK);

    const { body: mfaTotpBody }: { body: SignInResponse } = await request
      .post('/signin/mfa/totp')
      .send({
        ticket: signInBody.mfa?.ticket,
        otp: authenticator.generate(totpSecret),
      })
      .expect(StatusCodes.OK);

    expect(mfaTotpBody.session).toBeTruthy();

    if (!mfaTotpBody.session) {
      throw new Error('session is not set');
    }

    accessToken = mfaTotpBody.session.accessToken;

    // must be correct activeMfaType
    await request
      .post('/user/mfa')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        code: authenticator.generate(totpSecret),
        activeMfaType: 'incorrect',
      })
      .expect(StatusCodes.BAD_REQUEST);

    // Disable MFA for user
    await request
      .post('/user/mfa')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        code: authenticator.generate(totpSecret),
        activeMfaType: '',
      })
      .expect(StatusCodes.OK);

    // TODO: validate tokens

    const { body: signInBodyThird }: { body: SignInResponse } = await request
      .post('/signin/email-password')
      .send({ email, password })
      .expect(StatusCodes.OK);

    expect(signInBodyThird.mfa).toBe(undefined);
  });

  it('shoud not be possible to generate MFA code when anonymous', async () => {
    await request.post('/change-env').send({
      AUTH_MFA_ENABLED: true,
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_ANONYMOUS_USERS_ENABLED: true,
    });

    const { body }: { body: SignInResponse } = await request
      .post('/signin/anonymous')
      .expect(StatusCodes.OK);

    await request
      .get('/mfa/totp/generate')
      .set('Authorization', `Bearer ${body.session!.accessToken}`)
      .expect(StatusCodes.FORBIDDEN);
  });

  it('shoud not be possible to enable MFA when anonymous', async () => {
    await request.post('/change-env').send({
      AUTH_MFA_ENABLED: true,
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_ANONYMOUS_USERS_ENABLED: true,
    });

    const { body }: { body: SignInResponse } = await request
      .post('/signin/anonymous')
      .expect(StatusCodes.OK);

    await request
      .post('/user/mfa')
      .set('Authorization', `Bearer ${body.session!.accessToken}`)
      .send({
        code: authenticator.generate('anything'),
        activeMfaType: 'totp',
      })
      .expect(StatusCodes.FORBIDDEN);
  });
});
