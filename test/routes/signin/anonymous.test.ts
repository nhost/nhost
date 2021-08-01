// import { request } from "@/test/server";
// import { request } from '../../server';
import { APPLICATION } from '../../../src/config/application';
import { app } from '../../../src/server';
import { SuperTest, Test, agent } from 'supertest';
import { Server } from 'http';
import getPort from 'get-port';
import { Client } from 'pg';
import { isValidAccessToken } from '../../utils';
import { SignInTokens } from '../../../src/utils/tokens';
import { trackTable, setTableCustomization } from '../../../src/metadata';

let request: SuperTest<Test>;

let server: Server;

describe('anonymous', () => {
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
    console.log('before each generate new server');

    server = app.listen(await getPort(), APPLICATION.HOST);
    request = agent(server);
  });

  afterEach(async () => {
    console.log('after each, close server');

    server.close();
  });

  it('should sign in as anonymous', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTO_ACTIVATE_NEW_USERS: false,
      VERIFY_EMAILS: true,
      WHITELIST_ENABLED: false,
      PROFILE_SESSION_VARIABLE_FIELDS: '',
      REGISTRATION_CUSTOM_FIELDS: '',
      ANONYMOUS_USERS_ENABLED: true,
    });

    const { body }: { body: SignInTokens } = await request
      .post('/signin/anonymous')
      .expect(200);

    const { accessToken, accessTokenExpiresIn, refreshToken, mfa } = body;

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
      AUTO_ACTIVATE_NEW_USERS: false,
      VERIFY_EMAILS: true,
      WHITELIST_ENABLED: false,
      PROFILE_SESSION_VARIABLE_FIELDS: '',
      REGISTRATION_CUSTOM_FIELDS: '',
      ANONYMOUS_USERS_ENABLED: false,
    });

    await request.post('/signin/anonymous').expect(404);
  });
});

describe('anonymous with profile table', () => {
  let client: any;

  beforeAll(async () => {
    client = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    await client.connect();

    // create profile table
    console.log('drop table if exist');
    await client.query(`DROP TABLE IF EXISTS public.profiles;`);
    console.log('create profiles table');
    await client.query(`
    CREATE TABLE public.profiles (
      user_id uuid PRIMARY KEY,
      company_id int NOT NULL,
      foreign key(user_id) references auth.users(id) on delete cascade
    );
    `);

    console.log('track table');
    // track table
    await trackTable({ table: { schema: 'public', name: 'profiles' } });

    console.log('customize table');
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

    server = app.listen(await getPort(), APPLICATION.HOST);
    request = agent(server);
  });

  afterEach(async () => {
    server.close();
  });

  it('should sign up anonymous user with profile data', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTO_ACTIVATE_NEW_USERS: true,
      VERIFY_EMAILS: false,
      WHITELIST_ENABLED: false,
      ANONYMOUS_USERS_ENABLED: true,
      REGISTRATION_PROFILE_FIELDS: 'companyId',
    });

    await request
      .post('/signin/anonymous')
      .send({
        profile: { companyId: 1337 },
      })
      .expect(200);
  });
});
