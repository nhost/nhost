import { Client } from 'pg';
import * as faker from 'faker';

import { ENV } from '@/utils/env';
import {
  createObjectRelationship,
  dropRelationship,
  reloadMetadata,
  trackTable,
  untrackTable,
} from '@/metadata';

import { request } from '../../server';
import { decodeAccessToken } from '../../utils';

describe('custom JWT claims', () => {
  let client: Client;
  const organisationId = faker.datatype.uuid();
  beforeAll(async () => {
    client = new Client({
      connectionString: ENV.HASURA_GRAPHQL_DATABASE_URL,
    });
    await client.connect();
    try {
      await client.query(`
      CREATE TABLE IF NOT EXISTS public.profiles (
        id uuid PRIMARY KEY
            CONSTRAINT fk_user REFERENCES auth.users(id) 
            ON UPDATE CASCADE ON DELETE CASCADE,
        organisation_id uuid);
      CREATE TABLE public.organisations (id uuid primary key default gen_random_uuid());
      ALTER TABLE public.profiles ADD FOREIGN KEY (organisation_id) REFERENCES public.organisations;
      INSERT INTO public.organisations(id) VALUES ('${organisationId}');`);
    } catch {
      console.log('Error in setting temporary migrations');
    }
    try {
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
    } catch {
      console.log('Error in setting temporary metadata');
    }

    await reloadMetadata();
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: false,
      AUTH_JWT_CUSTOM_CLAIMS: '{"organisation-id":"profile.organisation.id"}',
    });
  });

  afterAll(async () => {
    try {
      await dropRelationship({
        table: { schema: 'auth', name: 'users' },
        relationship: 'profile',
      });
      await untrackTable({
        table: { schema: 'public', name: 'organisations' },
        cascade: true,
      });
      await untrackTable({
        table: { schema: 'public', name: 'profiles' },
        cascade: true,
      });
    } catch {
      console.log('Error in rolling back temporary metadata');
    }
    try {
      await client.query(
        `DROP TABLE public.profiles;
    DROP TABLE public.organisations;`
      );
    } catch {
      console.log('Error in rolling back temporary migrations');
    }
    await client.end();
    await reloadMetadata();
  });

  beforeEach(async () => {
    // await client.query(`DELETE FROM auth.users;`);
  });

  it('should add custom token', async () => {
    const email = faker.internet.email();
    const password = faker.internet.password();

    const {
      body: {
        session: { user },
      },
    } = await request
      .post('/signup/email-password')
      .send({
        email,
        password,
      })
      .expect(200);

    expect(user.id).toBeString();

    await client.query(
      `INSERT INTO public.profiles(id, organisation_id) VALUES('${user.id}', '${organisationId}');`
    );
    const { body } = await request.post('/signin/email-password').send({
      email,
      password,
    });

    expect(body).toBeDefined();
    const jwt = decodeAccessToken(body.session.accessToken);
    if (jwt) {
      expect(jwt['https://hasura.io/jwt/claims']).toBeObject();
      expect(
        jwt['https://hasura.io/jwt/claims']['x-hasura-organisation-id']
      ).toEqual(organisationId);
    }
  });
});
