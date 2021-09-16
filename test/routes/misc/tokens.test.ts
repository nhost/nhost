import { Client } from 'pg';

import { ENV } from '../../../src/utils/env';
import { request } from '../../server';
import { trackTable, setTableCustomization } from '../../../src/metadata';
import { decodeAccessToken, isValidAccessToken } from '../../utils';

describe('token', () => {
  let client: any;

  beforeAll(async () => {
    client = new Client({
      connectionString: ENV.HASURA_GRAPHQL_DATABASE_URL,
    });
    await client.connect();

    // create profile table
    await client.query(`DROP TABLE IF EXISTS public.profiles;`);
    await client.query(`
    CREATE TABLE public.profiles (
      user_id uuid PRIMARY KEY,
      company_id int NOT NULL,
      foreign key(user_id) references auth.users(id) on delete cascade
    );
    `);

    // track table
    await trackTable({ table: { schema: 'public', name: 'profiles' } });

    // set profile customization
    await setTableCustomization({
      table: {
        schema: 'public',
        name: 'profiles',
      },
      configuration: {
        identifier: 'profile',
        custom_root_fields: {
          select: 'profiles',
          select_by_pk: 'profile',
          select_aggregate: 'profilesAggregat',
          insert: 'insertProfiles',
          insert_one: 'insertProfile',
          update: 'updateProfiles',
          update_by_pk: 'updateProfile',
          delete: 'deleteProfiles',
          delete_by_pk: 'deleteProfile',
        },
        custom_column_names: {
          user_id: 'userId',
          company_id: 'companyId',
        },
      },
    });
  });

  afterAll(() => {
    client.end();
  });

  beforeEach(async () => {
    await client.query(`DELETE FROM auth.users;`);
  });

  it('should should sign in and get access token with standard claims', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_ANONYMOUS_USERS_ENABLED: true,
      AUTH_SIGNUP_PROFILE_FIELDS: '',
      AUTH_PROFILE_SESSION_VARIABLE_FIELDS: '',
      AUTH_USER_SESSION_VARIABLE_FIELDS: '',
    });

    const { body } = await request.post('/signin/anonymous').send().expect(200);

    const { accessToken, accessTokenExpiresIn, refreshToken } = body.session;
    const { mfa } = body;

    expect(isValidAccessToken(accessToken)).toBe(true);
    expect(typeof accessTokenExpiresIn).toBe('number');
    expect(typeof refreshToken).toBe('string');
    expect(mfa).toBe(null);
  });

  it('should should sign in and get access token with email user fields', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_SIGNIN_EMAIL_VERIFIED_REQUIRED: false,
      AUTH_SIGNUP_PROFILE_FIELDS: '',
      AUTH_PROFILE_SESSION_VARIABLE_FIELDS: '',
      AUTH_USER_SESSION_VARIABLE_FIELDS: 'email',
    });

    const email = 'joedoe@example.com';
    const password = '123123123123';

    await request
      .post('/signup/email-password')
      .send({
        email,
        password,
      })
      .expect(200);

    const { body } = await request
      .post('/signin/email-password')
      .send({
        email,
        password,
      })
      .expect(200);

    const token = decodeAccessToken(body.session.accessToken);

    if (!token) {
      throw new Error('Token not set');
    }

    expect(token['https://hasura.io/jwt/claims']['x-hasura-user-email']).toBe(
      email
    );
  });

  it('should should sign in and get access token with email user fields and companyId profile field', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_SIGNIN_EMAIL_VERIFIED_REQUIRED: false,
      AUTH_SIGNUP_PROFILE_FIELDS: 'companyId',
      AUTH_PROFILE_SESSION_VARIABLE_FIELDS: 'companyId',
      AUTH_USER_SESSION_VARIABLE_FIELDS: 'email',
    });

    const email = 'joedoe@example.com';
    const password = '123123123123';
    const companyId = 1337;

    await request
      .post('/signup/email-password')
      .send({
        email,
        password,
        profile: {
          companyId,
        },
      })
      .expect(200);

    const { body } = await request
      .post('/signin/email-password')
      .send({
        email,
        password,
      })
      .expect(200);

    const token = decodeAccessToken(body.session.accessToken);

    if (!token) {
      throw new Error('Token not set');
    }

    expect(token['https://hasura.io/jwt/claims']['x-hasura-user-email']).toBe(
      email
    );

    // must do a `.toString()` because claims must be of type string
    // https://hasura.io/docs/latest/graphql/core/auth/authentication/jwt.html#the-spec
    // > The claims in the JWT can have other x-hasura-* fields where their values can only be strings.
    expect(
      token['https://hasura.io/jwt/claims']['x-hasura-profile-companyId']
    ).toBe(companyId.toString());
  });
});
