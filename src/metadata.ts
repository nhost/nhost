import { logger } from './logger';
import { MetadataPatch, patchMetadata } from './utils';

const schema = 'auth';
/**
 * Hasura-auth metadata patch
 * The object is exported for testing purposes
 */
export const hasuraAuthMetadataPatch: MetadataPatch = {
  additions: {
    tables: [
      {
        table: { name: 'provider_requests', schema },
        configuration: {
          custom_name: 'authProviderRequests',
          custom_root_fields: {
            select: 'authProviderRequests',
            select_by_pk: 'authProviderRequest',
            select_aggregate: 'authProviderRequestsAggregate',
            insert: 'insertAuthProviderRequests',
            insert_one: 'insertAuthProviderRequest',
            update: 'updateAuthProviderRequests',
            update_by_pk: 'updateAuthProviderRequest',
            delete: 'deleteAuthProviderRequests',
            delete_by_pk: 'deleteAuthProviderRequest',
          },
          custom_column_names: {
            id: 'id',
            options: 'options',
          },
        },
      },
      {
        table: { name: 'refresh_tokens', schema },
        configuration: {
          custom_name: 'authRefreshTokens',
          custom_root_fields: {
            select: 'authRefreshTokens',
            select_by_pk: 'authRefreshToken',
            select_aggregate: 'authRefreshTokensAggregate',
            insert: 'insertAuthRefreshTokens',
            insert_one: 'insertAuthRefreshToken',
            update: 'updateAuthRefreshTokens',
            update_by_pk: 'updateAuthRefreshToken',
            delete: 'deleteAuthRefreshTokens',
            delete_by_pk: 'deleteAuthRefreshToken',
          },
          custom_column_names: {
            refresh_token: 'refreshToken',
            refresh_token_hash: 'refreshTokenHash',
            created_at: 'createdAt',
            expires_at: 'expiresAt',
            user_id: 'userId',
          },
        },
        object_relationships: [
          {
            name: 'user',
            using: {
              foreign_key_constraint_on: 'user_id',
            },
          },
        ],
      },
      {
        table: { name: 'roles', schema },
        configuration: {
          custom_name: 'authRoles',
          custom_root_fields: {
            select: 'authRoles',
            select_by_pk: 'authRole',
            select_aggregate: 'authRolesAggregate',
            insert: 'insertAuthRoles',
            insert_one: 'insertAuthRole',
            update: 'updateAuthRoles',
            update_by_pk: 'updateAuthRole',
            delete: 'deleteAuthRoles',
            delete_by_pk: 'deleteAuthRole',
          },
          custom_column_names: {
            role: 'role',
          },
        },
        array_relationships: [
          {
            name: 'userRoles',
            using: {
              foreign_key_constraint_on: {
                table: {
                  schema: 'auth',
                  name: 'user_roles',
                },
                column: 'role',
              },
            },
          },
          {
            name: 'usersByDefaultRole',
            using: {
              foreign_key_constraint_on: {
                table: {
                  schema: 'auth',
                  name: 'users',
                },
                column: 'default_role',
              },
            },
          },
        ],
      },
      {
        table: { name: 'user_providers', schema },
        configuration: {
          custom_name: 'authUserProviders',
          custom_root_fields: {
            select: 'authUserProviders',
            select_by_pk: 'authUserProvider',
            select_aggregate: 'authUserProvidersAggregate',
            insert: 'insertAuthUserProviders',
            insert_one: 'insertAuthUserProvider',
            update: 'updateAuthUserProviders',
            update_by_pk: 'updateAuthUserProvider',
            delete: 'deleteAuthUserProviders',
            delete_by_pk: 'deleteAuthUserProvider',
          },
          custom_column_names: {
            id: 'id',
            created_at: 'createdAt',
            updated_at: 'updatedAt',
            user_id: 'userId',
            access_token: 'accessToken',
            refresh_token: 'refreshToken',
            provider_id: 'providerId',
            provider_user_id: 'providerUserId',
          },
        },
        object_relationships: [
          {
            name: 'user',
            using: {
              foreign_key_constraint_on: 'user_id',
            },
          },
          {
            name: 'provider',
            using: {
              foreign_key_constraint_on: 'provider_id',
            },
          },
        ],
      },
      {
        table: { name: 'user_roles', schema },
        configuration: {
          custom_name: 'authUserRoles',
          custom_root_fields: {
            select: 'authUserRoles',
            select_by_pk: 'authUserRole',
            select_aggregate: 'authUserRolesAggregate',
            insert: 'insertAuthUserRoles',
            insert_one: 'insertAuthUserRole',
            update: 'updateAuthUserRoles',
            update_by_pk: 'updateAuthUserRole',
            delete: 'deleteAuthUserRoles',
            delete_by_pk: 'deleteAuthUserRole',
          },
          custom_column_names: {
            id: 'id',
            created_at: 'createdAt',
            user_id: 'userId',
            role: 'role',
          },
        },
        object_relationships: [
          {
            name: 'user',
            using: {
              foreign_key_constraint_on: 'user_id',
            },
          },
          {
            name: 'roleByRole',
            using: {
              foreign_key_constraint_on: 'role',
            },
          },
        ],
      },
      {
        table: { name: 'users', schema },
        configuration: {
          custom_name: 'users',
          custom_root_fields: {
            select: 'users',
            select_by_pk: 'user',
            select_aggregate: 'usersAggregate',
            insert: 'insertUsers',
            insert_one: 'insertUser',
            update: 'updateUsers',
            update_by_pk: 'updateUser',
            delete: 'deleteUsers',
            delete_by_pk: 'deleteUser',
          },
          custom_column_names: {
            id: 'id',
            created_at: 'createdAt',
            updated_at: 'updatedAt',
            last_seen: 'lastSeen',
            disabled: 'disabled',
            display_name: 'displayName',
            avatar_url: 'avatarUrl',
            locale: 'locale',
            email: 'email',
            phone_number: 'phoneNumber',
            password_hash: 'passwordHash',
            email_verified: 'emailVerified',
            phone_number_verified: 'phoneNumberVerified',
            new_email: 'newEmail',
            otp_method_last_used: 'otpMethodLastUsed',
            otp_hash: 'otpHash',
            otp_hash_expires_at: 'otpHashExpiresAt',
            default_role: 'defaultRole',
            is_anonymous: 'isAnonymous',
            totp_secret: 'totpSecret',
            active_mfa_type: 'activeMfaType',
            ticket: 'ticket',
            ticket_expires_at: 'ticketExpiresAt',
            webauthn_current_challenge: 'currentChallenge',
          },
        },
        object_relationships: [
          {
            name: 'defaultRoleByRole',
            using: {
              foreign_key_constraint_on: 'default_role',
            },
          },
        ],
        array_relationships: [
          {
            name: 'userProviders',
            using: {
              foreign_key_constraint_on: {
                table: {
                  schema: 'auth',
                  name: 'user_providers',
                },
                column: 'user_id',
              },
            },
          },
          {
            name: 'roles',
            using: {
              foreign_key_constraint_on: {
                table: {
                  schema: 'auth',
                  name: 'user_roles',
                },
                column: 'user_id',
              },
            },
          },
          {
            name: 'refreshTokens',
            using: {
              foreign_key_constraint_on: {
                table: {
                  schema: 'auth',
                  name: 'refresh_tokens',
                },
                column: 'user_id',
              },
            },
          },
          {
            name: 'securityKeys',
            using: {
              foreign_key_constraint_on: {
                table: {
                  schema: 'auth',
                  name: 'user_security_keys',
                },
                column: 'user_id',
              },
            },
          },
        ],
      },
      {
        table: { name: 'providers', schema },
        configuration: {
          custom_name: 'authProviders',
          custom_root_fields: {
            select: 'authProviders',
            select_by_pk: 'authProvider',
            select_aggregate: 'authProvidersAggregate',
            insert: 'insertAuthProviders',
            insert_one: 'insertAuthProvider',
            update: 'updateAuthProviders',
            update_by_pk: 'updateAuthProvider',
            delete: 'deleteAuthProviders',
            delete_by_pk: 'deleteAuthProvider',
          },
          custom_column_names: {
            id: 'id',
          },
        },
        array_relationships: [
          {
            name: 'userProviders',
            using: {
              foreign_key_constraint_on: {
                table: {
                  schema: 'auth',
                  name: 'user_providers',
                },
                column: 'provider_id',
              },
            },
          },
        ],
      },
      {
        table: { name: 'user_security_keys', schema },
        configuration: {
          custom_name: 'authUserSecurityKeys',
          custom_root_fields: {
            select: 'authUserSecurityKeys',
            select_by_pk: 'authUserSecurityKey',
            select_aggregate: 'authUserSecurityKeysAggregate',
            insert: 'insertAuthUserSecurityKeys',
            insert_one: 'insertAuthUserSecurityKey',
            update: 'updateAuthUserSecurityKeys',
            update_by_pk: 'updateAuthUserSecurityKey',
            delete: 'deleteAuthUserSecurityKeys',
            delete_by_pk: 'deleteAuthUserSecurityKey',
          },
          custom_column_names: {
            id: 'id',
            user_id: 'userId',
            credential_id: 'credentialId',
            credential_public_key: 'credentialPublicKey',
          },
        },
        object_relationships: [
          {
            name: 'user',
            using: {
              foreign_key_constraint_on: 'user_id',
            },
          },
        ],
      },
    ],
  },
  deletions: {
    tables: [{ name: 'user_authenticators', schema }],
    relationships: [
      { table: { name: 'users', schema }, relationship: 'authenticators' },
    ],
  },
};
export const applyMetadata = async (): Promise<void> => {
  logger.info('Applying metadata...');
  try {
    await patchMetadata(hasuraAuthMetadataPatch);
    logger.info('Metadata applied');
  } catch (e) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const error = e as any;
    const message = error.response?.data || error.message;
    logger.warn('Impossible to apply metadata', message);
  }
};
