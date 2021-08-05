import { Client } from 'pg';

import { request } from '../../server';
import { SignInTokens } from '../../../src/utils/tokens';
import { authenticator } from 'otplib';

describe('mfa totp', () => {
  let client: any;

  beforeAll(async () => {
    client = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    await client.connect();
  });

  afterAll(() => {
    client.end();
  });

  beforeEach(async () => {
    await client.query(`DELETE FROM auth.users;`);
  });

  it('should generate a secret, enable mfa and sign in with mfa', async () => {
    await request.post('/change-env').send({
      MFA_ENABLED: true,
      DISABLE_NEW_USERS: false,
      SIGNIN_EMAIL_VERIFIED_REQUIRED: false,
      WHITELIST_ENABLED: false,
    });

    let accessToken = '';

    const email = 'asdasd@asdasd.com';
    const password = '123123123';

    await request
      .post('/signup/email-password')
      .send({ email, password })
      .expect(200);

    const { body }: { body: SignInTokens } = await request
      .post('/signin/email-password')
      .send({ email, password })
      .expect(200);

    accessToken = body.accessToken as string;

    // generate
    const {
      body: { totpSecret },
    } = await request
      .get('/mfa/totp/generate')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    // enable totp mfa
    await request
      .post('/user/mfa')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        code: authenticator.generate(totpSecret),
        activeMfaType: 'totp',
      })
      .expect(200);

    // TODO: log out

    const { body: signInBody }: { body: SignInTokens } = await request
      .post('/signin/email-password')
      .send({ email, password })
      .expect(200);

    const { body: mfaTotpBody }: { body: SignInTokens } = await request
      .post('/signin/mfa/totp')
      .send({
        ticket: signInBody.mfa!.ticket,
        otp: authenticator.generate(totpSecret),
      })
      .expect(200);

    accessToken = mfaTotpBody.accessToken as string;

    // must be correct activeMfaType
    await request
      .post('/user/mfa')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        code: authenticator.generate(totpSecret),
        activeMfaType: 'incorrect',
      })
      .expect(400);

    // Disable MFA for user
    await request
      .post('/user/mfa')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        code: authenticator.generate(totpSecret),
        activeMfaType: '',
      })
      .expect(200);

    // TODO: validat tokens

    const { body: signInBodyThird }: { body: SignInTokens } = await request
      .post('/signin/email-password')
      .send({ email, password })
      .expect(200);

    expect(signInBodyThird.mfa).toBe(null);
  });
});
