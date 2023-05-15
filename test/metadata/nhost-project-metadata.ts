import { HasuraMetadataV3 } from '@/utils';

export const NHOST_PROJECT_METADATA: HasuraMetadataV3 = {
  version: 3,
  sources: [
    {
      name: 'default',
      kind: 'postgres',
      tables: [
        {
          table: {
            name: 'provider_requests',
            schema: 'auth',
          },
          configuration: {
            column_config: {},
            custom_column_names: {},
            custom_name: 'authProviderRequests',
            custom_root_fields: {
              delete: 'deleteAuthProviderRequests',
              delete_by_pk: 'deleteAuthProviderRequest',
              insert: 'insertAuthProviderRequests',
              insert_one: 'insertAuthProviderRequest',
              select: 'authProviderRequests',
              select_aggregate: 'authProviderRequestsAggregate',
              select_by_pk: 'authProviderRequest',
              update: 'updateAuthProviderRequests',
              update_by_pk: 'updateAuthProviderRequest',
            },
          },
        },
        {
          table: {
            name: 'providers',
            schema: 'auth',
          },
          configuration: {
            column_config: {},
            custom_column_names: {},
            custom_name: 'authProviders',
            custom_root_fields: {
              delete: 'deleteAuthProviders',
              delete_by_pk: 'deleteAuthProvider',
              insert: 'insertAuthProviders',
              insert_one: 'insertAuthProvider',
              select: 'authProviders',
              select_aggregate: 'authProvidersAggregate',
              select_by_pk: 'authProvider',
              update: 'updateAuthProviders',
              update_by_pk: 'updateAuthProvider',
            },
          },
          array_relationships: [
            {
              name: 'userProviders',
              using: {
                foreign_key_constraint_on: {
                  column: 'provider_id',
                  table: {
                    name: 'user_providers',
                    schema: 'auth',
                  },
                },
              },
            },
          ],
        },
        {
          table: {
            name: 'refresh_tokens',
            schema: 'auth',
          },
          configuration: {
            column_config: {
              created_at: {
                custom_name: 'createdAt',
              },
              expires_at: {
                custom_name: 'expiresAt',
              },
              user_id: {
                custom_name: 'userId',
              },
            },
            custom_column_names: {
              created_at: 'createdAt',
              expires_at: 'expiresAt',
              user_id: 'userId',
            },
            custom_name: 'authRefreshTokens',
            custom_root_fields: {
              delete: 'deleteAuthRefreshTokens',
              delete_by_pk: 'deleteAuthRefreshToken',
              insert: 'insertAuthRefreshTokens',
              insert_one: 'insertAuthRefreshToken',
              select: 'authRefreshTokens',
              select_aggregate: 'authRefreshTokensAggregate',
              select_by_pk: 'authRefreshToken',
              update: 'updateAuthRefreshTokens',
              update_by_pk: 'updateAuthRefreshToken',
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
          table: {
            name: 'roles',
            schema: 'auth',
          },
          configuration: {
            column_config: {},
            custom_column_names: {},
            custom_name: 'authRoles',
            custom_root_fields: {
              delete: 'deleteAuthRoles',
              delete_by_pk: 'deleteAuthRole',
              insert: 'insertAuthRoles',
              insert_one: 'insertAuthRole',
              select: 'authRoles',
              select_aggregate: 'authRolesAggregate',
              select_by_pk: 'authRole',
              update: 'updateAuthRoles',
              update_by_pk: 'updateAuthRole',
            },
          },
          array_relationships: [
            {
              name: 'userRoles',
              using: {
                foreign_key_constraint_on: {
                  column: 'role',
                  table: {
                    name: 'user_roles',
                    schema: 'auth',
                  },
                },
              },
            },
            {
              name: 'usersByDefaultRole',
              using: {
                foreign_key_constraint_on: {
                  column: 'default_role',
                  table: {
                    name: 'users',
                    schema: 'auth',
                  },
                },
              },
            },
          ],
        },
        {
          table: {
            name: 'user_providers',
            schema: 'auth',
          },
          configuration: {
            column_config: {
              access_token: {
                custom_name: 'accessToken',
              },
              created_at: {
                custom_name: 'createdAt',
              },
              provider_id: {
                custom_name: 'providerId',
              },
              provider_user_id: {
                custom_name: 'providerUserId',
              },
              refresh_token: {
                custom_name: 'refreshToken',
              },
              updated_at: {
                custom_name: 'updatedAt',
              },
              user_id: {
                custom_name: 'userId',
              },
            },
            custom_column_names: {
              access_token: 'accessToken',
              created_at: 'createdAt',
              provider_id: 'providerId',
              provider_user_id: 'providerUserId',
              refresh_token: 'refreshToken',
              updated_at: 'updatedAt',
              user_id: 'userId',
            },
            custom_name: 'authUserProviders',
            custom_root_fields: {
              delete: 'deleteAuthUserProviders',
              delete_by_pk: 'deleteAuthUserProvider',
              insert: 'insertAuthUserProviders',
              insert_one: 'insertAuthUserProvider',
              select: 'authUserProviders',
              select_aggregate: 'authUserProvidersAggregate',
              select_by_pk: 'authUserProvider',
              update: 'updateAuthUserProviders',
              update_by_pk: 'updateAuthUserProvider',
            },
          },
          object_relationships: [
            {
              name: 'provider',
              using: {
                foreign_key_constraint_on: 'provider_id',
              },
            },
            {
              name: 'user',
              using: {
                foreign_key_constraint_on: 'user_id',
              },
            },
          ],
        },
        {
          table: {
            name: 'user_roles',
            schema: 'auth',
          },
          configuration: {
            column_config: {
              created_at: {
                custom_name: 'createdAt',
              },
              user_id: {
                custom_name: 'userId',
              },
            },
            custom_column_names: {
              created_at: 'createdAt',
              user_id: 'userId',
            },
            custom_name: 'authUserRoles',
            custom_root_fields: {
              delete: 'deleteAuthUserRoles',
              delete_by_pk: 'deleteAuthUserRole',
              insert: 'insertAuthUserRoles',
              insert_one: 'insertAuthUserRole',
              select: 'authUserRoles',
              select_aggregate: 'authUserRolesAggregate',
              select_by_pk: 'authUserRole',
              update: 'updateAuthUserRoles',
              update_by_pk: 'updateAuthUserRole',
            },
          },
          object_relationships: [
            {
              name: 'roleByRole',
              using: {
                foreign_key_constraint_on: 'role',
              },
            },
            {
              name: 'user',
              using: {
                foreign_key_constraint_on: 'user_id',
              },
            },
          ],
        },
        {
          table: {
            name: 'user_security_keys',
            schema: 'auth',
          },
          configuration: {
            column_config: {
              credential_id: {
                custom_name: 'credentialId',
              },
              credential_public_key: {
                custom_name: 'credentialPublicKey',
              },
              user_id: {
                custom_name: 'userId',
              },
            },
            custom_column_names: {
              credential_id: 'credentialId',
              credential_public_key: 'credentialPublicKey',
              user_id: 'userId',
            },
            custom_name: 'authUserSecurityKeys',
            custom_root_fields: {
              delete: 'deleteAuthUserSecurityKeys',
              delete_by_pk: 'deleteAuthUserSecurityKey',
              insert: 'insertAuthUserSecurityKeys',
              insert_one: 'insertAuthUserSecurityKey',
              select: 'authUserSecurityKeys',
              select_aggregate: 'authUserSecurityKeysAggregate',
              select_by_pk: 'authUserSecurityKey',
              update: 'updateAuthUserSecurityKeys',
              update_by_pk: 'updateAuthUserSecurityKey',
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
          table: {
            name: 'users',
            schema: 'auth',
          },
          configuration: {
            column_config: {
              active_mfa_type: {
                custom_name: 'activeMfaType',
              },
              avatar_url: {
                custom_name: 'avatarUrl',
              },
              created_at: {
                custom_name: 'createdAt',
              },
              default_role: {
                custom_name: 'defaultRole',
              },
              display_name: {
                custom_name: 'displayName',
              },
              email_verified: {
                custom_name: 'emailVerified',
              },
              is_anonymous: {
                custom_name: 'isAnonymous',
              },
              last_seen: {
                custom_name: 'lastSeen',
              },
              new_email: {
                custom_name: 'newEmail',
              },
              otp_hash: {
                custom_name: 'otpHash',
              },
              otp_hash_expires_at: {
                custom_name: 'otpHashExpiresAt',
              },
              otp_method_last_used: {
                custom_name: 'otpMethodLastUsed',
              },
              password_hash: {
                custom_name: 'passwordHash',
              },
              phone_number: {
                custom_name: 'phoneNumber',
              },
              phone_number_verified: {
                custom_name: 'phoneNumberVerified',
              },
              ticket_expires_at: {
                custom_name: 'ticketExpiresAt',
              },
              totp_secret: {
                custom_name: 'totpSecret',
              },
              updated_at: {
                custom_name: 'updatedAt',
              },
              webauthn_current_challenge: {
                custom_name: 'currentChallenge',
              },
            },
            custom_column_names: {
              active_mfa_type: 'activeMfaType',
              avatar_url: 'avatarUrl',
              created_at: 'createdAt',
              default_role: 'defaultRole',
              display_name: 'displayName',
              email_verified: 'emailVerified',
              is_anonymous: 'isAnonymous',
              last_seen: 'lastSeen',
              new_email: 'newEmail',
              otp_hash: 'otpHash',
              otp_hash_expires_at: 'otpHashExpiresAt',
              otp_method_last_used: 'otpMethodLastUsed',
              password_hash: 'passwordHash',
              phone_number: 'phoneNumber',
              phone_number_verified: 'phoneNumberVerified',
              ticket_expires_at: 'ticketExpiresAt',
              totp_secret: 'totpSecret',
              updated_at: 'updatedAt',
              webauthn_current_challenge: 'currentChallenge',
            },
            custom_name: 'users',
            custom_root_fields: {
              delete: 'deleteUsers',
              delete_by_pk: 'deleteUser',
              insert: 'insertUsers',
              insert_one: 'insertUser',
              select: 'users',
              select_aggregate: 'usersAggregate',
              select_by_pk: 'user',
              update: 'updateUsers',
              update_by_pk: 'updateUser',
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
              name: 'refreshTokens',
              using: {
                foreign_key_constraint_on: {
                  column: 'user_id',
                  table: {
                    name: 'refresh_tokens',
                    schema: 'auth',
                  },
                },
              },
            },
            {
              name: 'roles',
              using: {
                foreign_key_constraint_on: {
                  column: 'user_id',
                  table: {
                    name: 'user_roles',
                    schema: 'auth',
                  },
                },
              },
            },
            {
              name: 'securityKeys',
              using: {
                foreign_key_constraint_on: {
                  column: 'user_id',
                  table: {
                    name: 'user_security_keys',
                    schema: 'auth',
                  },
                },
              },
            },
            {
              name: 'userProviders',
              using: {
                foreign_key_constraint_on: {
                  column: 'user_id',
                  table: {
                    name: 'user_providers',
                    schema: 'auth',
                  },
                },
              },
            },
          ],
        },
        {
          table: {
            name: 'buckets',
            schema: 'storage',
          },
          configuration: {
            column_config: {
              cache_control: {
                custom_name: 'cacheControl',
              },
              created_at: {
                custom_name: 'createdAt',
              },
              download_expiration: {
                custom_name: 'downloadExpiration',
              },
              id: {
                custom_name: 'id',
              },
              max_upload_file_size: {
                custom_name: 'maxUploadFileSize',
              },
              min_upload_file_size: {
                custom_name: 'minUploadFileSize',
              },
              presigned_urls_enabled: {
                custom_name: 'presignedUrlsEnabled',
              },
              updated_at: {
                custom_name: 'updatedAt',
              },
            },
            custom_column_names: {
              cache_control: 'cacheControl',
              created_at: 'createdAt',
              download_expiration: 'downloadExpiration',
              id: 'id',
              max_upload_file_size: 'maxUploadFileSize',
              min_upload_file_size: 'minUploadFileSize',
              presigned_urls_enabled: 'presignedUrlsEnabled',
              updated_at: 'updatedAt',
            },
            custom_name: 'buckets',
            custom_root_fields: {
              delete: 'deleteBuckets',
              delete_by_pk: 'deleteBucket',
              insert: 'insertBuckets',
              insert_one: 'insertBucket',
              select: 'buckets',
              select_aggregate: 'bucketsAggregate',
              select_by_pk: 'bucket',
              update: 'updateBuckets',
              update_by_pk: 'updateBucket',
            },
          },
          array_relationships: [
            {
              name: 'files',
              using: {
                foreign_key_constraint_on: {
                  column: 'bucket_id',
                  table: {
                    name: 'files',
                    schema: 'storage',
                  },
                },
              },
            },
          ],
        },
        {
          table: {
            name: 'files',
            schema: 'storage',
          },
          configuration: {
            column_config: {
              bucket_id: {
                custom_name: 'bucketId',
              },
              created_at: {
                custom_name: 'createdAt',
              },
              etag: {
                custom_name: 'etag',
              },
              id: {
                custom_name: 'id',
              },
              is_uploaded: {
                custom_name: 'isUploaded',
              },
              mime_type: {
                custom_name: 'mimeType',
              },
              name: {
                custom_name: 'name',
              },
              size: {
                custom_name: 'size',
              },
              updated_at: {
                custom_name: 'updatedAt',
              },
              uploaded_by_user_id: {
                custom_name: 'uploadedByUserId',
              },
            },
            custom_column_names: {
              bucket_id: 'bucketId',
              created_at: 'createdAt',
              etag: 'etag',
              id: 'id',
              is_uploaded: 'isUploaded',
              mime_type: 'mimeType',
              name: 'name',
              size: 'size',
              updated_at: 'updatedAt',
              uploaded_by_user_id: 'uploadedByUserId',
            },
            custom_name: 'files',
            custom_root_fields: {
              delete: 'deleteFiles',
              delete_by_pk: 'deleteFile',
              insert: 'insertFiles',
              insert_one: 'insertFile',
              select: 'files',
              select_aggregate: 'filesAggregate',
              select_by_pk: 'file',
              update: 'updateFiles',
              update_by_pk: 'updateFile',
            },
          },
          object_relationships: [
            {
              name: 'bucket',
              using: {
                foreign_key_constraint_on: 'bucket_id',
              },
            },
          ],
        },
      ],
      configuration: {
        connection_info: {
          database_url: {
            from_env: 'HASURA_GRAPHQL_DATABASE_URL',
          },
          isolation_level: 'read-committed',
          pool_settings: {
            connection_lifetime: 600,
            idle_timeout: 60,
            max_connections: 10,
            retries: 1,
          },
          use_prepared_statements: true,
        },
      },
    },
  ],
};
