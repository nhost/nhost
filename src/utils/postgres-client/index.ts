import { SessionData } from 'express-session';
import { Pool } from 'pg';
export * from './types';

import { ENV } from '../env';
import { UserSecurityKey } from './types';

const pool = new Pool({
  max: 20,
  connectionString: ENV.HASURA_GRAPHQL_DATABASE_URL,
  idleTimeoutMillis: 30000,
});

export const pgClient = {
  insertProviderRequest: async (id: string, options: SessionData) => {
    const client = await pool.connect();
    await client.query(
      `INSERT INTO "auth"."provider_requests" (id, options) VALUES($1, $2) 
        ON CONFLICT(id) DO UPDATE SET options = EXCLUDED.options;`,
      [id, options]
    );
    client.release();
  },

  deleteProviderRequest: async (id: string) => {
    const client = await pool.connect();
    await client.query(
      `DELETE FROM "auth"."provider_requests" WHERE id = $1;`,
      [id]
    );
    client.release();
  },

  providerRequest: async (id: string) => {
    const client = await pool.connect();
    const { rows } = await client.query<{ options: SessionData }>(
      `SELECT options FROM "auth"."provider_requests" WHERE id = $1;`,
      [id]
    );
    client.release();
    return rows[0];
  },

  insertRefreshToken: async (
    userId: string,
    refreshToken: string,
    expiresAt: Date
  ) => {
    const client = await pool.connect();
    await client.query(
      `INSERT INTO "auth"."refresh_tokens" (user_id, refresh_token, expires_at) VALUES($1, $2, $3);`,
      [userId, refreshToken, expiresAt]
    );
    client.release();
  },

  deleteRefreshToken: async (refreshToken: string) => {
    const client = await pool.connect();
    await client.query(
      `DELETE FROM "auth"."refresh_tokens" WHERE refresh_token = $1;`,
      [refreshToken]
    );
    client.release();
  },

  deleteUserRefreshTokens: async (userId: string) => {
    const client = await pool.connect();
    await client.query(
      `DELETE FROM "auth"."refresh_tokens" WHERE user_id = $1;`,
      [userId]
    );
    client.release();
  },

  deleteExpiredRefreshTokens: async () => {
    const client = await pool.connect();
    await client.query(
      `DELETE FROM "auth"."refresh_tokens" WHERE expires_at < NOW();`
    );
    client.release();
  },

  upsertRoles: async (roles: string[]) => {
    const client = await pool.connect();
    const { rows } = await client.query<{ role: string }>(
      `INSERT INTO "auth"."roles" (role) VALUES ${roles
        .map((role) => `('${role}')`)
        .join(', ')} ON CONFLICT DO NOTHING
        RETURNING role;`
    );
    client.release();
    return rows.map((row) => row.role);
  },

  getUserSecurityKeys: async (userId: string) => {
    const client = await pool.connect();
    const { rows } = await client.query<UserSecurityKey>(
      `SELECT id, counter, credential_id, credential_public_key, transports FROM "auth"."security_keys" WHERE user_id = $1;`,
      [userId]
    );
    client.release();
    return rows;
  },

  getUserChallenge: async (userId: string) => {
    const client = await pool.connect();
    const { rows } = await client.query<{ current_challenge: string }>(
      `SELECT current_challenge FROM "auth"."users" WHERE id = $1;`,
      [userId]
    );
    client.release();
    return rows[0];
  },

  updateUserChallenge: async (userId: string, challenge: string) => {
    const client = await pool.connect();
    await client.query(
      `UPDATE "auth"."users" SET current_challenge = $1 WHERE id = $2;`,
      [challenge, userId]
    );
    client.release();
  },

  addUserSecurityKey: async ({
    user_id,
    counter,
    credential_id,
    credential_public_key,
    nickname,
  }: Pick<
    UserSecurityKey,
    | 'user_id'
    | 'counter'
    | 'credential_id'
    | 'credential_public_key'
    | 'nickname'
  >) => {
    const client = await pool.connect();
    const {
      rows: [{ id }],
    } = await client.query<{ id: string }>(
      `INSERT INTO "auth"."security_keys" (user_id, counter, credential_id, credential_public_key, nickname) VALUES($1, $2, $3, $4, $5) RETURNING id;`,
      [user_id, counter, credential_id, credential_public_key, nickname]
    );
    client.release();
    return id;
  },

  updateUserSecurityKey: async (securityKeyId: string, counter: number) => {
    const client = await pool.connect();
    await client.query(
      `UPDATE "auth"."security_keys" SET counter = $1 WHERE id = $2;`,
      [counter, securityKeyId]
    );
    client.release();
  },

  insertUserRoles: async (userId: string, roles: string[]) => {
    const client = await pool.connect();
    await client.query(
      `INSERT INTO "auth"."user_roles" (user_id, role) VALUES ${roles
        .map((role) => `('${userId}', '${role}')`)
        .join(', ')};`
    );
    client.release();
  },

  deleteUserRolesByUserId: async (userId: string) => {
    const client = await pool.connect();
    await client.query(`DELETE FROM "auth"."user_roles" WHERE user_id = $1;`, [
      userId,
    ]);
    client.release();
  },

  deleteUser: async (userId: string) => {
    const client = await pool.connect();
    await client.query(`DELETE FROM "auth"."users" WHERE id = $1;`, [userId]);
    client.release();
  },

  insertUserProviderToUser: async ({
    userId,
    providerId,
    providerUserId,
    refreshToken,
    accessToken,
  }: {
    userId: string;
    providerId: string;
    providerUserId: string;
    refreshToken?: string;
    accessToken?: string;
  }) => {
    const client = await pool.connect();
    const { rows } = await client.query(
      `INSERT INTO "auth"."user_providers" (user_id, provider_id, provider_user_id, refresh_token, access_token) VALUES($1, $2, $3, $4, $5, $6);`,
      [userId, providerId, providerUserId, refreshToken, accessToken]
    );
    client.release();
    return rows[0];
  },
};
