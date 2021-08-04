// import { request } from "@/test/server";
import { request } from '../../server';
import { Client } from 'pg';
import { mailHogSearch, deleteAllMailHogEmails } from '../../utils';
import { trackTable, setTableCustomization } from '../../../src/metadata';

describe('email-password', () => {
  let client: any;

  beforeAll(async () => {
    client = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    await client.connect();
    await deleteAllMailHogEmails();
  });

  afterAll(() => {
    client.end();
  });

  beforeEach(async () => {
    await client.query(`DELETE FROM auth.users;`);
  });

  it('should sign up user', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTO_ACTIVATE_NEW_USERS: true,
      REGISTRATION_PROFILE_FIELDS: '',
      VERIFY_EMAILS: false,
      WHITELIST_ENABLED: false,
    });

    await request
      .post('/signup/email-password')
      .send({ email: 'joedoe@example.com', password: '123456' })
      .expect(200);
  });

  it('should fail to sign up with same email', async () => {
    // set env vars
    await await request.post('/change-env').send({
      AUTO_ACTIVATE_NEW_USERS: true,
      VERIFY_EMAILS: false,
      HIBP_ENABLED: false,
      WHITELIST_ENABLED: false,
    });

    await request
      .post('/signup/email-password')
      .send({ email: 'joedoe@example.com', password: '123456' })
      .expect(200);

    await request
      .post('/signup/email-password')
      .send({ email: 'joedoe@example.com', password: '123456' })
      .expect(409);
  });

  it('should fail sign up if whitelist is enabled and the email is not whitelisted', async () => {
    // set env vars
    await await request.post('/change-env').send({
      AUTO_ACTIVATE_NEW_USERS: true,
      HIBP_ENABLED: true,
      WHITELIST_ENABLED: true,
    });

    await request
      .post('/signup/email-password')
      .send({ email: 'joedoe@example.com', password: '123456' })
      .expect(401);
  });

  it('should fail with weak password', async () => {
    // set env vars
    await await request.post('/change-env').send({
      AUTO_ACTIVATE_NEW_USERS: true,
      HIBP_ENABLED: true,
      WHITELIST_ENABLED: false,
    });

    await request
      .post('/signup/email-password')
      .send({ email: 'joedoe@example.com', password: '123456' })
      .expect(400);
  });

  it('should succeed to sign up with different emails', async () => {
    // set env vars
    await await request.post('/change-env').send({
      AUTO_ACTIVATE_NEW_USERS: true,
      VERIFY_EMAILS: false,
      HIBP_ENABLED: false,
      WHITELIST_ENABLED: false,
    });

    await request
      .post('/signup/email-password')
      .send({ email: 'joedoe@example.com', password: '123456' })
      .expect(200);

    await request
      .post('/signup/email-password')
      .send({ email: 'joedoes@example.com', password: '123456' })
      .expect(200);
  });

  it('should fail sending email', async () => {
    // set env vars
    await await request.post('/change-env').send({
      AUTO_ACTIVATE_NEW_USERS: false,
      VERIFY_EMAILS: true,
      EMAILS_ENABLED: false,
      HIBP_ENABLED: false,
      WHITELIST_ENABLED: false,
    });

    await request
      .post('/signup/email-password')
      .send({ email: 'joedoe@example.com', password: '123456' })
      .expect(500);
  });

  it('should success with SMTP settings', async () => {
    // set env vars
    await await request.post('/change-env').send({
      AUTO_ACTIVATE_NEW_USERS: false,
      VERIFY_EMAILS: true,
      EMAILS_ENABLED: 'true',
      HIBP_ENABLED: false,
      WHITELIST_ENABLED: false,
    });

    const email = 'joedoe@example.com';

    await request
      .post('/signup/email-password')
      .send({ email, password: '123456' })
      .expect(200);

    // fetch email from mailhog and check ticket
    const [message] = await mailHogSearch(email);
    expect(message).toBeTruthy();
    const ticket = message.Content.Headers['X-Ticket'][0];
    expect(ticket.startsWith('verifyEmail:')).toBeTruthy();
  });

  it('default role must be part of allowed roles', async () => {
    // set env vars
    await await request.post('/change-env').send({
      AUTO_ACTIVATE_NEW_USERS: true,
      HIBP_ENABLED: false,
      WHITELIST_ENABLED: false,
    });

    const email = 'joedoe@example.com';

    await request
      .post('/signup/email-password')
      .send({
        email,
        password: '123456',
        defaultRole: 'user',
        allowedRoles: ['editor'],
      })
      .expect(400);
  });

  it('allowed roles must be subset of env var ALLOWED_USER_ROLES', async () => {
    // set env vars
    await await request.post('/change-env').send({
      AUTO_ACTIVATE_NEW_USERS: true,
      ALLOWED_USER_ROLES: 'user,editor',
      HIBP_ENABLED: false,
      WHITELIST_ENABLED: false,
    });

    const email = 'joedoe@example.com';

    await request
      .post('/signup/email-password')
      .send({
        email,
        password: '123456',
        defaultRole: 'user',
        allowedRoles: ['user', 'some-other-role'],
      })
      .expect(400);
  });

  it('user must verify email before being able to sign in', async () => {
    // set env vars
    await request.post('/change-env').send({
      DISABLE_NEW_USERS: false,
      SIGNIN_EMAIL_VERIFIED_REQUIRED: true,
      REGISTRATION_PROFILE_FIELDS: '',
      VERIFY_EMAILS: false,
      WHITELIST_ENABLED: false,
    });

    const email = 'joedoe@example.com';
    const password = '123123';

    await request
      .post('/signup/email-password')
      .send({ email, password })
      .expect(200);

    await request
      .post('/signin/email-password')
      .send({ email, password })
      .expect(401);

    // get ticket from email
    const [message] = await mailHogSearch(email);
    expect(message).toBeTruthy();
    const ticket = message.Content.Headers['X-Ticket'][0];
    expect(ticket.startsWith('verifyEmail:')).toBeTruthy();

    // use ticket to verify email
    await request
      .post('/user/email/verify')
      .send({ email, ticket })
      .expect(200);

    // sign in should now work

    await request
      .post('/signin/email-password')
      .send({ email, password })
      .expect(200);
  });
});

describe('email-password with profile table', () => {
  let client: any;

  beforeAll(async () => {
    client = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    await client.connect();
    await deleteAllMailHogEmails();

    // create profile table
    console.log('drop profiles table:');
    await client.query(`DROP TABLE IF EXISTS public.profiles;`);

    console.log('create profiles table');
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
  });

  it('should sign up user with profile data', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTO_ACTIVATE_NEW_USERS: true,
      VERIFY_EMAILS: false,
      WHITELIST_ENABLED: false,
      REGISTRATION_PROFILE_FIELDS: 'companyId',
    });

    await request
      .post('/signup/email-password')
      .send({
        email: 'joedoe@example.com',
        password: '123456',
        profile: { companyId: 1337 },
      })
      .expect(200);
  });

  it('should fail to sign up user with extra profile data', async () => {
    await request.post('/change-env').send({
      AUTO_ACTIVATE_NEW_USERS: true,
      VERIFY_EMAILS: false,
      WHITELIST_ENABLED: false,
      REGISTRATION_PROFILE_FIELDS: 'companyId',
    });

    await request
      .post('/signup/email-password')
      .send({
        email: 'joedoe@example.com',
        password: '123456',
        profile: { extra: true, companyId: 1337 },
      })
      .expect(400);
  });

  it('should fail to sign up because registration custom fields does not exist in database', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTO_ACTIVATE_NEW_USERS: true,
      VERIFY_EMAILS: false,
      WHITELIST_ENABLED: false,
      REGISTRATION_PROFILE_FIELDS: 'incorrect',
    });

    await request
      .post('/signup/email-password')
      .send({
        email: 'joedoe@example.com',
        password: '123456',
        profile: { incorrect: 1337 },
      })
      .expect(500);
  });

  it('should fail to sign up user with no profile data', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTO_ACTIVATE_NEW_USERS: true,
      VERIFY_EMAILS: false,
      WHITELIST_ENABLED: false,
      REGISTRATION_PROFILE_FIELDS: 'companyId',
    });

    await request
      .post('/signup/email-password')
      .send({
        email: 'joedoe@example.com',
        password: '123456',
      })
      .expect(400, {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Profile required',
      });
  });

  it('should fail to insert profile', async () => {
    await client.query(`ALTER TABLE public.profiles DROP COLUMN company_id`);

    // set env vars
    await request.post('/change-env').send({
      AUTO_ACTIVATE_NEW_USERS: true,
      VERIFY_EMAILS: false,
      WHITELIST_ENABLED: false,
      REGISTRATION_PROFILE_FIELDS: 'companyId',
    });

    await request
      .post('/signup/email-password')
      .send({
        email: 'joedoe@example.com',
        password: '123456',
        profile: {
          companyId: 1336,
        },
      })
      .expect(500);
  });
});
