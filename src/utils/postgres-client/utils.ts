import { User } from '@/types';
import { PoolClient } from 'pg';
import { SqlUser } from './types';

export const cameliseUser = (user?: SqlUser | null): User | null => {
  if (!user) {
    return null;
  }
  const {
    avatar_url,
    created_at,
    default_role,
    display_name,
    email_verified,
    id,
    is_anonymous,
    locale,
    phone_number_verified,
    roles,
    active_mfa_type,
    email,
    metadata,
    phone_number,
    new_email,
    totp_secret,
    disabled,
    ticket,
    password_hash,
    otp_hash,
    webauthn_current_challenge,
    ticket_expires_at,
    otp_method_last_used,
    otp_hash_expires_at,
    last_seen,
  } = user;
  return {
    avatarUrl: avatar_url,
    createdAt: created_at,
    disabled,
    defaultRole: default_role,
    displayName: display_name,
    email,
    emailVerified: email_verified,
    id,
    isAnonymous: is_anonymous,
    locale,
    metadata,
    phoneNumber: phone_number,
    phoneNumberVerified: phone_number_verified,
    roles,
    activeMfaType: active_mfa_type,
    newEmail: new_email,
    totpSecret: totp_secret,
    ticket,
    passwordHash: password_hash,
    otpHash: otp_hash,
    otpMethodLastUsed: otp_method_last_used,
    webauthnCurrentChallenge: webauthn_current_challenge,
    ticketExpiresAt: ticket_expires_at,
    otpHashExpiresAt: otp_hash_expires_at,
    lastSeen: last_seen,
  };
};

export const snakeiseUser = (
  user: Partial<User> | null
): Partial<SqlUser> | null => {
  if (!user) {
    return null;
  }
  const {
    avatarUrl,
    createdAt,
    defaultRole,
    displayName,
    emailVerified,
    id,
    isAnonymous,
    locale,
    phoneNumberVerified,
    roles,
    activeMfaType,
    email,
    metadata,
    phoneNumber,
    newEmail,
    totpSecret,
    disabled,
    ticket,
    passwordHash,
    otpHash,
    webauthnCurrentChallenge,
    ticketExpiresAt,
    otpMethodLastUsed,
    otpHashExpiresAt,
    lastSeen,
  } = user;
  const result: Partial<SqlUser> = {
    avatar_url: avatarUrl,
    created_at: createdAt,
    disabled,
    default_role: defaultRole,
    display_name: displayName,
    email,
    email_verified: emailVerified,
    id,
    is_anonymous: isAnonymous,
    locale,
    metadata,
    phone_number: phoneNumber,
    phone_number_verified: phoneNumberVerified,
    roles,
    active_mfa_type: activeMfaType,
    new_email: newEmail,
    totp_secret: totpSecret,
    ticket,
    password_hash: passwordHash,
    otp_hash: otpHash,
    otp_method_last_used: otpMethodLastUsed,
    webauthn_current_challenge: webauthnCurrentChallenge,
    ticket_expires_at: ticketExpiresAt,
    otp_hash_expires_at: otpHashExpiresAt,
    last_seen: lastSeen,
  };
  Object.keys(result).forEach((k) => {
    const key = k as keyof typeof result;
    if (result[key] === undefined) {
      delete result[key];
    }
  });
  return result;
};

export const createUserQueryWhere = (where: string) =>
  `SELECT u.*, r.roles FROM "auth"."users" u 
    LEFT JOIN lateral (
            SELECT user_id, coalesce(json_agg(role), '[]') AS roles
            FROM "auth"."user_roles" r
            WHERE r.user_id = u.id
            GROUP BY user_id
        ) r ON r.user_id = id WHERE ${where};`;

export const createUserQueryByColumn = (column: string) =>
  createUserQueryWhere(`u.${column} = $1`);

export const getUserById = async (client: PoolClient, userId: string) => {
  const { rows } = await client.query<SqlUser>(createUserQueryByColumn('id'), [
    userId,
  ]);
  return rows[0];
};

export const insertUserRoles = async (
  client: PoolClient,
  userId: string,
  roles: string[]
) => {
  await client.query(
    `INSERT INTO "auth"."user_roles" (user_id, role) VALUES ${roles
      .map((_, i) => `($1, $${i + 2})`)
      .join(', ')} ON CONFLICT DO NOTHING;`,
    [userId, ...roles]
  );
};
