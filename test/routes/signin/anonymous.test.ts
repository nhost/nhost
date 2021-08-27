import { SuperTest, Test, agent } from 'supertest';
import { Server } from 'http';
import getPort from 'get-port';
import { Client } from 'pg';

import { ENV } from '../../../src/utils/env';
import { app } from '../../../src/server';
import { isValidAccessToken } from '../../utils';
import { SignInResponse } from '../../../src/types';
import { trackTable, setTableCustomization } from '../../../src/metadata';

let request: SuperTest<Test>;

let server: Server;

describe('anonymous', () => {
  let client: any;

  beforeAll(async () => {
    client = new Client({
      connectionString: ENV.HASURA_GRAPHQL_DATABASE_URL,
    });
    await client.connect();
  });

  afterAll(() => {
    client.end();
  });

  beforeEach(async () => {
    await client.query(`DELETE FROM auth.users;`);

    server = app.listen(await getPort(), ENV.AUTH_HOST);
    request = agent(server);
  });

  afterEach(async () => {
    server.close();
  });

  it('should sign in as anonymous', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_ANONYMOUS_USERS_ENABLED: true,
      AUTH_SIGNUP_PROFILE_FIELDS: '',
      AUTH_PROFILE_SESSION_VARIABLE_FIELDS: '',
      AUTH_USER_SESSION_VARIABLE_FIELDS: '',
    });

    const { body }: { body: SignInResponse } = await request
      .post('/signin/anonymous')
      .expect(200);

    expect(body.session).toBeTruthy();

    if (!body.session) {
      throw new Error('session is not set');
    }

    const { accessToken, accessTokenExpiresIn, refreshToken } = body.session;
    const { mfa } = body;

    expect(isValidAccessToken(accessToken)).toBe(true);
    expect(typeof accessTokenExpiresIn).toBe('number');
    expect(typeof refreshToken).toBe('string');
    expect(mfa).toBe(null);
  });

  it('should fail to sign in anonymously with email', async () => {
    await request
      .post('/signin/anonymous')
      .send({
        email: 'test@hello.com',
      })
      .expect(400);
  });

  it('should fail to sign in anonymously if not enabled', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_ANONYMOUS_USERS_ENABLED: false,
      AUTH_SIGNUP_PROFILE_FIELDS: '',
      AUTH_PROFILE_SESSION_VARIABLE_FIELDS: '',
      AUTH_USER_SESSION_VARIABLE_FIELDS: '',
    });

    await request.post('/signin/anonymous').expect(404);
  });
});

describe('anonymous with profile table', () => {
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
    // clear database
    await client.query(`DELETE FROM auth.users;`);
    await client.query(`DELETE FROM public.profiles;`);

    server = app.listen(await getPort(), ENV.AUTH_HOST);
    request = agent(server);
  });

  afterEach(async () => {
    server.close();
  });

  it('should sign up anonymous user with profile data', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_ANONYMOUS_USERS_ENABLED: true,
      AUTH_SIGNUP_PROFILE_FIELDS: 'companyId',
      AUTH_PROFILE_SESSION_VARIABLE_FIELDS: '',
      AUTH_USER_SESSION_VARIABLE_FIELDS: '',
    });

    await request
      .post('/signin/anonymous')
      .send({
        profile: { companyId: 1337 },
      })
      .expect(200);
  });
});
