import { Client } from 'pg';
import * as faker from 'faker';

import {
  createArrayRelationship,
  createObjectRelationship,
  dropRelationship,
  reloadMetadata,
  trackTable,
  untrackTable,
} from '@/metadata';
import { escapeValueToPg, ENV } from '@/utils';

import { request } from '../../server';
import { decodeAccessToken } from '../../utils';

describe('custom JWT claims', () => {
  let client: Client;
  const organisationId = faker.datatype.uuid();
  const projects = [...Array(3).keys()].map(faker.datatype.uuid);

  beforeAll(async () => {
    client = new Client({
      connectionString: ENV.HASURA_GRAPHQL_DATABASE_URL,
    });
    await client.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.profiles (
        id uuid PRIMARY KEY
            CONSTRAINT fk_user REFERENCES auth.users(id) 
            ON UPDATE CASCADE ON DELETE CASCADE,
        organisation_id uuid);
      CREATE TABLE public.organisations (id uuid primary key default gen_random_uuid());
      ALTER TABLE public.profiles ADD FOREIGN KEY (organisation_id) REFERENCES public.organisations;
      INSERT INTO public.organisations(id) VALUES ('${organisationId}');
      CREATE TABLE public.projects (id uuid primary key);
      CREATE TABLE public.project_members (id uuid primary key default gen_random_uuid(), user_id uuid, project_id uuid);
      ALTER TABLE public.project_members ADD FOREIGN KEY (project_id) REFERENCES public.projects;
      ALTER TABLE public.project_members ADD FOREIGN KEY (user_id) REFERENCES public.profiles;
      INSERT INTO public.projects VALUES ${projects
        .map((id) => "('" + id + "')")
        .join(',')};
      `);
    await trackTable({ table: { schema: 'public', name: 'projects' } });
    await trackTable({
      table: { schema: 'public', name: 'project_members' },
    });
    await trackTable({ table: { schema: 'public', name: 'organisations' } });
    await trackTable({ table: { schema: 'public', name: 'profiles' } });
    await createObjectRelationship({
      source: 'default',
      table: {
        schema: 'auth',
        name: 'users',
      },
      name: 'profile',
      using: {
        foreign_key_constraint_on: {
          table: {
            schema: 'public',
            name: 'profiles',
          },
          columns: ['id'],
        },
      },
    });
    await createObjectRelationship({
      source: 'default',
      table: {
        schema: 'public',
        name: 'profiles',
      },
      name: 'organisation',
      using: {
        foreign_key_constraint_on: ['organisation_id'],
      },
    });
    await createArrayRelationship({
      source: 'default',
      table: {
        schema: 'public',
        name: 'profiles',
      },
      name: 'contributesTo',
      using: {
        foreign_key_constraint_on: {
          table: {
            schema: 'public',
            name: 'project_members',
          },
          columns: ['user_id'],
        },
      },
    });
    await createObjectRelationship({
      source: 'default',
      table: {
        schema: 'public',
        name: 'project_members',
      },
      name: 'project',
      using: {
        foreign_key_constraint_on: ['project_id'],
      },
    });

    await reloadMetadata();
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: false,
    });
  });

  afterAll(async () => {
    await dropRelationship({
      table: { schema: 'public', name: 'profiles' },
      relationship: 'contributesTo',
    });
    await dropRelationship({
      table: { schema: 'auth', name: 'users' },
      relationship: 'profile',
    });
    await dropRelationship({
      table: { schema: 'public', name: 'project_members' },
      relationship: 'project',
    });
    await untrackTable({
      table: { schema: 'public', name: 'project_members' },
      cascade: true,
    });
    await untrackTable({
      table: { schema: 'public', name: 'organisations' },
      cascade: true,
    });
    await untrackTable({
      table: { schema: 'public', name: 'profiles' },
      cascade: true,
    });
    await untrackTable({
      table: { schema: 'public', name: 'projects' },
      cascade: true,
    });
    await client.query(
      `DROP TABLE public.project_members;
        DROP TABLE public.profiles;
        DROP TABLE public.organisations;
        DROP TABLE public.projects;
        `
    );
    await client.end();
    await reloadMetadata();
  });

  beforeEach(async () => {
    // await client.query(`DELETE FROM auth.users;`);
  });

  it('should add a custom claim from a nested object relationship', async () => {
    await request.post('/change-env').send({
      AUTH_JWT_CUSTOM_CLAIMS: '{"organisation-id":"profile.organisation.id"}',
    });
    const email = faker.internet.email();
    const password = faker.internet.password();

    const {
      body: {
        session: { user },
      },
    } = await request.post('/signup/email-password').send({
      email,
      password,
    });

    await client.query(
      `INSERT INTO public.profiles(id, organisation_id) VALUES('${user.id}', '${organisationId}');`
    );
    const { body } = await request.post('/signin/email-password').send({
      email,
      password,
    });

    const jwt = decodeAccessToken(body.session.accessToken);
    expect(jwt).toBeObject();
    if (jwt) {
      expect(jwt['https://hasura.io/jwt/claims']).toBeObject();
      expect(
        jwt['https://hasura.io/jwt/claims']['x-hasura-organisation-id']
      ).toEqual(organisationId);
    }
  });

  it('should add a custom claim from a nested array relationship', async () => {
    await request.post('/change-env').send({
      AUTH_JWT_CUSTOM_CLAIMS:
        '{"project-ids":"profile.contributesTo.project.id"}',
    });
    const userProjects = projects.slice(1);
    const email = faker.internet.email();
    const password = faker.internet.password();

    const {
      body: {
        session: { user },
      },
    } = await request.post('/signup/email-password').send({
      email,
      password,
    });

    await client.query(
      `INSERT INTO public.profiles(id) VALUES('${user.id}');
      INSERT INTO public.project_members(user_id, project_id) VALUES ${userProjects
        .map((p) => "('" + user.id + "', '" + p + "')")
        .join(',')};`
    );
    const { body } = await request.post('/signin/email-password').send({
      email,
      password,
    });

    expect(body).toBeDefined();
    const jwt = decodeAccessToken(body.session.accessToken);

    expect(jwt).not.toBeNull();
    if (jwt) {
      expect(jwt['https://hasura.io/jwt/claims']).toBeObject();
      expect(
        jwt['https://hasura.io/jwt/claims']['x-hasura-project-ids']
      ).toEqual(escapeValueToPg(userProjects));
    }
  });

  it('should handle an invalid configuration (unparsable)', async () => {
    await request.post('/change-env').send({
      AUTH_JWT_CUSTOM_CLAIMS: '{"invalid JSON": unquoted value }',
    });
    const email = faker.internet.email();
    const password = faker.internet.password();
    const {
      body: {
        session: { user },
      },
    } = await request.post('/signup/email-password').send({
      email,
      password,
    });
    expect(user?.id).toBeString();
  });

  it('should handle an invalid configuration (parsable, but not an object)', async () => {
    await request.post('/change-env').send({
      AUTH_JWT_CUSTOM_CLAIMS: 'string value',
    });
    const email = faker.internet.email();
    const password = faker.internet.password();
    const {
      body: {
        session: { user },
      },
    } = await request.post('/signup/email-password').send({
      email,
      password,
    });
    expect(user?.id).toBeString();
  });

  it('should handle an valid configuration with invalid GraphQL path', async () => {
    await request.post('/change-env').send({
      AUTH_JWT_CUSTOM_CLAIMS: '{"key": "path.does.not-exist" }',
    });
    const email = faker.internet.email();
    const password = faker.internet.password();
    const {
      body: { session },
    } = await request.post('/signup/email-password').send({
      email,
      password,
    });
    expect(session?.user?.id).toBeString();
    const jwt = decodeAccessToken(session.accessToken);
    if (jwt) {
      expect(jwt['https://hasura.io/jwt/claims']).toBeObject();
      expect(
        jwt['https://hasura.io/jwt/claims']['x-hasura-key']
      ).toBeUndefined();
    }
  });

  it('should handle an valid configuration with invalid JSONata path', async () => {
    await request.post('/change-env').send({
      AUTH_JWT_CUSTOM_CLAIMS: '{"key": "invalid jsonata path!?!" }',
    });
    const email = faker.internet.email();
    const password = faker.internet.password();
    const {
      body: { session },
    } = await request.post('/signup/email-password').send({
      email,
      password,
    });
    expect(session?.user?.id).toBeString();
    const jwt = decodeAccessToken(session.accessToken);
    if (jwt) {
      expect(jwt['https://hasura.io/jwt/claims']).toBeObject();
      expect(
        jwt['https://hasura.io/jwt/claims']['x-hasura-key']
      ).toBeUndefined();
    }
  });
});
