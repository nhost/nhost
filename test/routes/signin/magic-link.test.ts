// import { request } from "@/test/server";
import { request } from '../../server';
import { Client } from 'pg';

describe('magic link', () => {
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

  it('should sign in', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTO_ACTIVATE_NEW_USERS: false,
      VERIFY_EMAILS: true,
      WHITELIST_ENABLED: false,
      MAGIC_LINK_ENABLED: true,
      REGISTRATION_PROFILE_FIELDS: '',
    });

    await request
      .post('/signin/magic-link')
      .send({
        email: 'joedoe@example.com',
      })
      .expect(200);
  });

  it('should fail to sign in if magic link is not enabled', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTO_ACTIVATE_NEW_USERS: false,
      VERIFY_EMAILS: true,
      WHITELIST_ENABLED: false,
      MAGIC_LINK_ENABLED: false,
      REGISTRATION_PROFILE_FIELDS: '',
    });

    await request
      .post('/signin/magic-link')
      .send({
        email: 'joedoe@example.com',
      })
      .expect(404);
  });

  it('should fail to sign if email is not whitelisted', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTO_ACTIVATE_NEW_USERS: false,
      VERIFY_EMAILS: true,
      WHITELIST_ENABLED: true,
      MAGIC_LINK_ENABLED: true,
      REGISTRATION_PROFILE_FIELDS: '',
    });

    await request
      .post('/signin/magic-link')
      .send({
        email: 'joedoe@example.com',
      })
      .expect(401);
  });

  it('should be able to sign in twice. First request will create the user', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTO_ACTIVATE_NEW_USERS: false,
      VERIFY_EMAILS: true,
      WHITELIST_ENABLED: false,
      MAGIC_LINK_ENABLED: true,
      REGISTRATION_PROFILE_FIELDS: '',
    });

    await request
      .post('/signin/magic-link')
      .send({
        email: 'joedoe@example.com',
      })
      .expect(200);

    await request
      .post('/signin/magic-link')
      .send({
        email: 'joedoe@example.com',
      })
      .expect(200);
  });

  it('should fail to sign in with default role that is not in allowed roles', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTO_ACTIVATE_NEW_USERS: false,
      VERIFY_EMAILS: true,
      WHITELIST_ENABLED: false,
      MAGIC_LINK_ENABLED: true,
      REGISTRATION_PROFILE_FIELDS: '',
      DEFAULT_USER_ROLE: 'user',
      DEFAULT_ALLOWED_USER_ROLES: 'user',
    });

    await request
      .post('/signin/magic-link')
      .send({
        email: 'joedoe@example.com',
        defaultRole: 'other',
      })
      .expect(400);
  });

  it('should succeed sign in with correct default role', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTO_ACTIVATE_NEW_USERS: false,
      VERIFY_EMAILS: true,
      WHITELIST_ENABLED: false,
      MAGIC_LINK_ENABLED: true,
      REGISTRATION_PROFILE_FIELDS: '',
      DEFAULT_USER_ROLE: 'user',
      DEFAULT_ALLOWED_USER_ROLES: 'user',
    });

    await request
      .post('/signin/magic-link')
      .send({
        email: 'joedoe@example.com',
        defaultRole: 'user',
      })
      .expect(200);
  });

  it('should fail to sign in with incorrect allowed roles', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTO_ACTIVATE_NEW_USERS: false,
      VERIFY_EMAILS: true,
      WHITELIST_ENABLED: false,
      MAGIC_LINK_ENABLED: true,
      REGISTRATION_PROFILE_FIELDS: '',
      DEFAULT_USER_ROLE: 'user',
      DEFAULT_ALLOWED_USER_ROLES: 'user',
    });

    await request
      .post('/signin/magic-link')
      .send({
        email: 'joedoe@example.com',
        allowedRoles: ['me'],
      })
      .expect(400);
  });

  it('should fail if sending emails is not enabled', async () => {
    // set env vars
    await request.post('/change-env').send({
      AUTO_ACTIVATE_NEW_USERS: false,
      VERIFY_EMAILS: true,
      WHITELIST_ENABLED: false,
      MAGIC_LINK_ENABLED: true,
      REGISTRATION_PROFILE_FIELDS: '',
      DEFAULT_USER_ROLE: 'user',
      DEFAULT_ALLOWED_USER_ROLES: 'user',
      EMAILS_ENABLED: false,
    });

    await request
      .post('/signin/magic-link')
      .send({
        email: 'joedoe@example.com',
      })
      .expect(500);
  });
});
