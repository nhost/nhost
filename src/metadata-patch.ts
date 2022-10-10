import { runMetadataRequest } from './metadata';
const target = {
  resource_version: 49,
  metadata: {
    version: 3,
    sources: [
      {
        name: 'default',
        kind: 'postgres',
        tables: [
          {
            table: {
              name: 'migrations',
              schema: 'auth',
            },
          },
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
                refresh_token: {
                  custom_name: 'refreshToken',
                },
                user_id: {
                  custom_name: 'userId',
                },
              },
              custom_column_names: {
                created_at: 'createdAt',
                expires_at: 'expiresAt',
                refresh_token: 'refreshToken',
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
            event_triggers: [
              {
                name: 'refresh-tokens-insert-segment',
                definition: {
                  enable_manual: false,
                  insert: {
                    columns: '*',
                  },
                },
                retry_conf: {
                  interval_sec: 10,
                  num_retries: 0,
                  timeout_sec: 60,
                },
                webhook:
                  '{{NHOST_BACKEND_URL}}/v1/functions/events/refresh-tokens/insert/segment',
                headers: [
                  {
                    name: 'nhost-webhook-secret',
                    value_from_env: 'NHOST_WEBHOOK_SECRET',
                  },
                ],
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
              {
                name: 'role',
                using: {
                  foreign_key_constraint_on: 'default_role',
                },
              },
            ],
            array_relationships: [
              {
                name: 'apps',
                using: {
                  foreign_key_constraint_on: {
                    column: 'creator_user_id',
                    table: {
                      name: 'apps',
                      schema: 'public',
                    },
                  },
                },
              },
              {
                name: 'cliTokens',
                using: {
                  manual_configuration: {
                    column_mapping: {
                      id: 'user_id',
                    },
                    insertion_order: null,
                    remote_table: {
                      name: 'cli_tokens',
                      schema: 'public',
                    },
                  },
                },
              },
              {
                name: 'creatorOfWorkspaces',
                using: {
                  manual_configuration: {
                    column_mapping: {
                      id: 'creator_user_id',
                    },
                    insertion_order: null,
                    remote_table: {
                      name: 'workspaces',
                      schema: 'public',
                    },
                  },
                },
              },
              {
                name: 'feedbacks',
                using: {
                  foreign_key_constraint_on: {
                    column: 'sent_by',
                    table: {
                      name: 'feedback',
                      schema: 'public',
                    },
                  },
                },
              },
              {
                name: 'github_app_installations',
                using: {
                  foreign_key_constraint_on: {
                    column: 'user_id',
                    table: {
                      name: 'github_app_installations',
                      schema: 'public',
                    },
                  },
                },
              },
              {
                name: 'payment_methods',
                using: {
                  foreign_key_constraint_on: {
                    column: 'added_by_user_id',
                    table: {
                      name: 'payment_methods',
                      schema: 'public',
                    },
                  },
                },
              },
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
              {
                name: 'workspaceMemberInvitesByInvitedByUserId',
                using: {
                  foreign_key_constraint_on: {
                    column: 'invited_by_user_id',
                    table: {
                      name: 'workspace_member_invites',
                      schema: 'public',
                    },
                  },
                },
              },
              {
                name: 'workspaceMembers',
                using: {
                  manual_configuration: {
                    column_mapping: {
                      id: 'user_id',
                    },
                    insertion_order: null,
                    remote_table: {
                      name: 'workspace_members',
                      schema: 'public',
                    },
                  },
                },
              },
              {
                name: 'workspace_member_invites',
                using: {
                  foreign_key_constraint_on: {
                    column: 'email',
                    table: {
                      name: 'workspace_member_invites',
                      schema: 'public',
                    },
                  },
                },
              },
            ],
            select_permissions: [
              {
                role: 'user',
                permission: {
                  columns: ['avatar_url', 'display_name', 'email', 'id'],
                  filter: {
                    workspaceMembers: {
                      workspace: {
                        workspaceMembers: {
                          user_id: {
                            _eq: 'X-Hasura-User-Id',
                          },
                        },
                      },
                    },
                  },
                },
              },
            ],
            event_triggers: [
              {
                name: 'user-insert',
                definition: {
                  enable_manual: false,
                  insert: {
                    columns: '*',
                  },
                },
                retry_conf: {
                  interval_sec: 10,
                  num_retries: 0,
                  timeout_sec: 5,
                },
                webhook: '{{NHOST_BACKEND_URL}}/v1/functions/user-insert',
                headers: [
                  {
                    name: 'nhost-webhook-secret',
                    value_from_env: 'NHOST_WEBHOOK_SECRET',
                  },
                ],
              },
              {
                name: 'user-insert-segment',
                definition: {
                  enable_manual: false,
                  insert: {
                    columns: '*',
                  },
                },
                retry_conf: {
                  interval_sec: 10,
                  num_retries: 0,
                  timeout_sec: 60,
                },
                webhook:
                  '{{NHOST_BACKEND_URL}}/v1/functions/events/users/insert/segment',
                headers: [
                  {
                    name: 'nhost-webhook-secret',
                    value_from_env: 'NHOST_WEBHOOK_SECRET',
                  },
                ],
              },
            ],
          },
          {
            table: {
              name: 'app_state_history',
              schema: 'public',
            },
            configuration: {
              column_config: {
                app_id: {
                  custom_name: 'appId',
                },
                created_at: {
                  custom_name: 'createdAt',
                },
                id: {
                  custom_name: 'id',
                },
                message: {
                  custom_name: 'message',
                },
                state_id: {
                  custom_name: 'stateId',
                },
              },
              custom_column_names: {
                app_id: 'appId',
                created_at: 'createdAt',
                id: 'id',
                message: 'message',
                state_id: 'stateId',
              },
              custom_name: 'appStateHistory',
              custom_root_fields: {
                delete: 'deleteAppStateHistories',
                delete_by_pk: 'deleteAppStateHistory',
                insert: 'insertAppStateHistories',
                insert_one: 'insertAppStateHistory',
                select: 'appStateHistories',
                select_aggregate: 'appStateHistoryAggregate',
                select_by_pk: 'appStateHistory',
                update: 'updateAppStateHistories',
                update_by_pk: 'updateAppStateHistory',
              },
            },
            object_relationships: [
              {
                name: 'app',
                using: {
                  foreign_key_constraint_on: 'app_id',
                },
              },
              {
                name: 'appState',
                using: {
                  foreign_key_constraint_on: 'state_id',
                },
              },
            ],
            select_permissions: [
              {
                role: 'user',
                permission: {
                  columns: [
                    'id',
                    'app_id',
                    'state_id',
                    'message',
                    'created_at',
                  ],
                  filter: {
                    app: {
                      workspace: {
                        workspaceMembers: {
                          user_id: {
                            _eq: 'X-Hasura-User-Id',
                          },
                        },
                      },
                    },
                  },
                },
              },
            ],
          },
          {
            table: {
              name: 'app_states',
              schema: 'public',
            },
            configuration: {
              column_config: {},
              custom_column_names: {},
              custom_name: 'appStates',
              custom_root_fields: {
                delete: 'deleteAppStates',
                delete_by_pk: 'deleteAppState',
                insert: 'insertAppStates',
                insert_one: 'insertAppState',
                select: 'appStates',
                select_aggregate: 'appStatesAggregate',
                select_by_pk: 'appState',
                update: 'updateAppStates',
                update_by_pk: 'updateAppState',
              },
            },
            array_relationships: [
              {
                name: 'appStates',
                using: {
                  foreign_key_constraint_on: {
                    column: 'state_id',
                    table: {
                      name: 'app_state_history',
                      schema: 'public',
                    },
                  },
                },
              },
              {
                name: 'apps',
                using: {
                  foreign_key_constraint_on: {
                    column: 'desired_state',
                    table: {
                      name: 'apps',
                      schema: 'public',
                    },
                  },
                },
              },
            ],
            select_permissions: [
              {
                role: 'user',
                permission: {
                  columns: [],
                  filter: {},
                },
              },
            ],
          },
          {
            table: {
              name: 'apps',
              schema: 'public',
            },
            configuration: {
              column_config: {
                auth_access_control_allowedEmailDomains: {
                  custom_name: 'authAccessControlAllowedEmailDomains',
                },
                auth_access_control_allowed_emails: {
                  custom_name: 'authAccessControlAllowedEmails',
                },
                auth_access_control_allowed_redirect_urls: {
                  custom_name: 'authAccessControlAllowedRedirectUrls',
                },
                auth_access_control_blocked_email_domains: {
                  custom_name: 'authAccessControlBlockedEmailDomains',
                },
                auth_access_control_blocked_emails: {
                  custom_name: 'authAccessControlBlockedEmails',
                },
                auth_access_token_expires_in: {
                  custom_name: 'authAccessTokenExpiresIn',
                },
                auth_anonymous_users_enabled: {
                  custom_name: 'authAnonymousUsersEnabled',
                },
                auth_app_name: {
                  custom_name: 'authAppName',
                },
                auth_apple_client_id: {
                  custom_name: 'authAppleClientId',
                },
                auth_apple_enabled: {
                  custom_name: 'authAppleEnabled',
                },
                auth_apple_key_id: {
                  custom_name: 'authAppleKeyId',
                },
                auth_apple_private_key: {
                  custom_name: 'authApplePrivateKey',
                },
                auth_apple_scope: {
                  custom_name: 'authAppleScope',
                },
                auth_apple_team_id: {
                  custom_name: 'authAppleTeamId',
                },
                auth_client_url: {
                  custom_name: 'authClientUrl',
                },
                auth_disable_new_users: {
                  custom_name: 'authDisableNewUsers',
                },
                auth_discord_client_id: {
                  custom_name: 'authDiscordClientId',
                },
                auth_discord_client_secret: {
                  custom_name: 'authDiscordClientSecret',
                },
                auth_discord_enabled: {
                  custom_name: 'authDiscordEnabled',
                },
                auth_discord_scope: {
                  custom_name: 'authDiscordScope',
                },
                auth_email_passwordless_enabled: {
                  custom_name: 'authEmailPasswordlessEnabled',
                },
                auth_email_signin_email_verified_required: {
                  custom_name: 'authEmailSigninEmailVerifiedRequired',
                },
                auth_email_template_fetch_url: {
                  custom_name: 'authEmailTemplateFetchUrl',
                },
                auth_emails_enabled: {
                  custom_name: 'authEmailsEnabled',
                },
                auth_facebook_client_id: {
                  custom_name: 'authFacebookClientId',
                },
                auth_facebook_client_secret: {
                  custom_name: 'authFacebookClientSecret',
                },
                auth_facebook_enabled: {
                  custom_name: 'authFacebookEnabled',
                },
                auth_facebook_profile_fields: {
                  custom_name: 'authFacebookProfileFields',
                },
                auth_facebook_scope: {
                  custom_name: 'authFacebookScope',
                },
                auth_github_client_id: {
                  custom_name: 'authGithubClientId',
                },
                auth_github_client_secret: {
                  custom_name: 'authGithubClientSecret',
                },
                auth_github_enabled: {
                  custom_name: 'authGithubEnabled',
                },
                auth_github_scope: {
                  custom_name: 'authGithubScope',
                },
                auth_google_client_id: {
                  custom_name: 'authGoogleClientId',
                },
                auth_google_client_secret: {
                  custom_name: 'authGoogleClientSecret',
                },
                auth_google_enabled: {
                  custom_name: 'authGoogleEnabled',
                },
                auth_google_scope: {
                  custom_name: 'authGoogleScope',
                },
                auth_gravatar_default: {
                  custom_name: 'authGravatarDefault',
                },
                auth_gravatar_enabled: {
                  custom_name: 'authGravatarEnabled',
                },
                auth_gravatar_rating: {
                  custom_name: 'authGravatarRating',
                },
                auth_jwt_custom_claims: {
                  custom_name: 'authJwtCustomClaims',
                },
                auth_linkedin_client_id: {
                  custom_name: 'authLinkedinClientId',
                },
                auth_linkedin_client_secret: {
                  custom_name: 'authLinkedinClientSecret',
                },
                auth_linkedin_enabled: {
                  custom_name: 'authLinkedinEnabled',
                },
                auth_linkedin_scope: {
                  custom_name: 'authLinkedinScope',
                },
                auth_locale_allowed_locales: {
                  custom_name: 'authAllowedLocales',
                },
                auth_locale_default: {
                  custom_name: 'authLocaleDefault',
                },
                auth_log_level: {
                  custom_name: 'authLogLevel',
                },
                auth_mfa_enabled: {
                  custom_name: 'authMfaEnabled',
                },
                auth_mfa_totp_issuer: {
                  custom_name: 'authMfaTotpIssuer',
                },
                auth_password_hibp_enabled: {
                  custom_name: 'authPasswordHibpEnabled',
                },
                auth_password_min_length: {
                  custom_name: 'authPasswordMinLength',
                },
                auth_refresh_token_expires_in: {
                  custom_name: 'authRefreshTokenExpiresIn',
                },
                auth_sms_passwordless_enabled: {
                  custom_name: 'authSmsPasswordlessEnabled',
                },
                auth_sms_twilio_account_sid: {
                  custom_name: 'authSmsTwilioAccountSid',
                },
                auth_sms_twilio_auth_token: {
                  custom_name: 'authSmsTwilioAuthToken',
                },
                auth_sms_twilio_from: {
                  custom_name: 'authSmsTwilioFrom',
                },
                auth_sms_twilio_messaging_service_id: {
                  custom_name: 'authSmsTwilioMessagingServiceId',
                },
                auth_smtp_auth_method: {
                  custom_name: 'AuthSmtpAuthMethod',
                },
                auth_smtp_host: {
                  custom_name: 'authSmtpHost',
                },
                auth_smtp_pass: {
                  custom_name: 'authSmtpPass',
                },
                auth_smtp_port: {
                  custom_name: 'authSmtpPort',
                },
                auth_smtp_secure: {
                  custom_name: 'AuthSmtpSecure',
                },
                auth_smtp_sender: {
                  custom_name: 'authSmtpSender',
                },
                auth_smtp_user: {
                  custom_name: 'authSmtpUser',
                },
                auth_spotify_client_id: {
                  custom_name: 'authSpotifyClientId',
                },
                auth_spotify_client_secret: {
                  custom_name: 'authSpotifyClientSecret',
                },
                auth_spotify_enabled: {
                  custom_name: 'authSpotifyEnabled',
                },
                auth_spotify_scope: {
                  custom_name: 'authSpotifyScope',
                },
                auth_twitch_client_id: {
                  custom_name: 'authTwitchClientId',
                },
                auth_twitch_client_secret: {
                  custom_name: 'authTwitchClientSecret',
                },
                auth_twitch_enabled: {
                  custom_name: 'authTwitchEnabled',
                },
                auth_twitch_scope: {
                  custom_name: 'authTwitchScope',
                },
                auth_twitter_consumer_key: {
                  custom_name: 'authTwitterConsumerKey',
                },
                auth_twitter_consumer_secret: {
                  custom_name: 'authTwitterConsumerSecret',
                },
                auth_twitter_enabled: {
                  custom_name: 'authTwitterEnabled',
                },
                auth_user_default_allowed_roles: {
                  custom_name: 'authUserDefaultAllowedRoles',
                },
                auth_user_default_role: {
                  custom_name: 'authUserDefaultRole',
                },
                auth_user_session_variable_fields: {
                  custom_name: 'authUserSessionVariableFields',
                },
                auth_webauthn_enabled: {
                  custom_name: 'authWebAuthnEnabled',
                },
                auth_windows_live_client_id: {
                  custom_name: 'authWindowsLiveClientId',
                },
                auth_windows_live_client_secret: {
                  custom_name: 'authWindowsLiveClientSecret',
                },
                auth_windows_live_enabled: {
                  custom_name: 'authWindowsLiveEnabled',
                },
                auth_windows_live_scope: {
                  custom_name: 'authWindowsLiveScope',
                },
                auth_workos_client_id: {
                  custom_name: 'authWorkOsClientId',
                },
                auth_workos_client_secret: {
                  custom_name: 'authWorkOsClientSecret',
                },
                auth_workos_default_connection: {
                  custom_name: 'authWorkOsDefaultConnection',
                },
                auth_workos_default_domain: {
                  custom_name: 'authWorkOsDefaultDomain',
                },
                auth_workos_default_organization: {
                  custom_name: 'authWorkOsDefaultOrganization',
                },
                auth_workos_enabled: {
                  custom_name: 'authWorkOsEnabled',
                },
                auto_update: {
                  custom_name: 'autoUpdate',
                },
                created_at: {
                  custom_name: 'createdAt',
                },
                creator_user_id: {
                  custom_name: 'creatorUserId',
                },
                desired_state: {
                  custom_name: 'desiredState',
                },
                email_templates_s3_key: {
                  custom_name: 'emailTemplatesS3Key',
                },
                github_repository_id: {
                  custom_name: 'githubRepositoryId',
                },
                hasura_auth_version: {
                  custom_name: 'hasuraAuthVersion',
                },
                hasura_graphql_admin_secret: {
                  custom_name: 'hasuraGraphqlAdminSecret',
                },
                hasura_graphql_database_url: {
                  custom_name: 'hasuraGraphqlDatabaseUrl',
                },
                hasura_graphql_enable_console: {
                  custom_name: 'hasuraGraphqlEnableConsole',
                },
                hasura_graphql_enable_remote_schema_permissions: {
                  custom_name: 'hasuraGraphqlEnableRemoteSchemaPermissions',
                },
                hasura_graphql_enabled_apis: {
                  custom_name: 'hasuraGraphqlEnabledApis',
                },
                hasura_graphql_grapqhl_url: {
                  custom_name: 'hasuraGraphqlGraphqlUrl',
                },
                hasura_graphql_jwt_secret: {
                  custom_name: 'hasuraGraphqlJwtSecret',
                },
                hasura_storage_version: {
                  custom_name: 'hasuraStorageVersion',
                },
                hasura_version: {
                  custom_name: 'hasuraVersion',
                },
                id: {
                  custom_name: 'id',
                },
                is_provisioned: {
                  custom_name: 'isProvisioned',
                },
                metadata_functions: {
                  custom_name: 'metadataFunctions',
                },
                name: {
                  custom_name: 'name',
                },
                nhost_base_folder: {
                  custom_name: 'nhostBaseFolder',
                },
                paused: {
                  custom_name: 'paused',
                },
                plan_id: {
                  custom_name: 'planId',
                },
                postgres_database: {
                  custom_name: 'postgresDatabase',
                },
                postgres_host: {
                  custom_name: 'postgresHost',
                },
                postgres_password: {
                  custom_name: 'postgresPassword',
                },
                postgres_public_access: {
                  custom_name: 'postgresPublicAccess',
                },
                postgres_schema_migration_password: {
                  custom_name: 'postgresSchemaMigrationPassword',
                },
                postgres_schema_migration_user: {
                  custom_name: 'postgresSchemaMigrationUser',
                },
                postgres_user: {
                  custom_name: 'postgresUser',
                },
                region_id: {
                  custom_name: 'regionId',
                },
                repository_production_branch: {
                  custom_name: 'repositoryProductionBranch',
                },
                s3_access_key: {
                  custom_name: 'S3AccessKey',
                },
                s3_bucket: {
                  custom_name: 'S3Bucket',
                },
                s3_endpoint: {
                  custom_name: 'S3Endpoint',
                },
                s3_secret_key: {
                  custom_name: 'S3SecretKey',
                },
                s3_ssl_enabled: {
                  custom_name: 'S3SslEnabled',
                },
                slug: {
                  custom_name: 'slug',
                },
                storage_force_download_for_content_types: {
                  custom_name: 'StorageForceDownloadForContentTypes',
                },
                storage_log_level: {
                  custom_name: 'StorageLogLevel',
                },
                storage_swagger_enabled: {
                  custom_name: 'StorageSwaggerEnabled',
                },
                stripe_subscription_id: {
                  custom_name: 'stripeSubscriptionId',
                },
                subdomain: {
                  custom_name: 'subdomain',
                },
                updated_at: {
                  custom_name: 'updatedAt',
                },
                webhook_secret: {
                  custom_name: 'webhookSecret',
                },
                workspace_id: {
                  custom_name: 'workspaceId',
                },
              },
              custom_column_names: {
                auth_access_control_allowedEmailDomains:
                  'authAccessControlAllowedEmailDomains',
                auth_access_control_allowed_emails:
                  'authAccessControlAllowedEmails',
                auth_access_control_allowed_redirect_urls:
                  'authAccessControlAllowedRedirectUrls',
                auth_access_control_blocked_email_domains:
                  'authAccessControlBlockedEmailDomains',
                auth_access_control_blocked_emails:
                  'authAccessControlBlockedEmails',
                auth_access_token_expires_in: 'authAccessTokenExpiresIn',
                auth_anonymous_users_enabled: 'authAnonymousUsersEnabled',
                auth_app_name: 'authAppName',
                auth_apple_client_id: 'authAppleClientId',
                auth_apple_enabled: 'authAppleEnabled',
                auth_apple_key_id: 'authAppleKeyId',
                auth_apple_private_key: 'authApplePrivateKey',
                auth_apple_scope: 'authAppleScope',
                auth_apple_team_id: 'authAppleTeamId',
                auth_client_url: 'authClientUrl',
                auth_disable_new_users: 'authDisableNewUsers',
                auth_discord_client_id: 'authDiscordClientId',
                auth_discord_client_secret: 'authDiscordClientSecret',
                auth_discord_enabled: 'authDiscordEnabled',
                auth_discord_scope: 'authDiscordScope',
                auth_email_passwordless_enabled: 'authEmailPasswordlessEnabled',
                auth_email_signin_email_verified_required:
                  'authEmailSigninEmailVerifiedRequired',
                auth_email_template_fetch_url: 'authEmailTemplateFetchUrl',
                auth_emails_enabled: 'authEmailsEnabled',
                auth_facebook_client_id: 'authFacebookClientId',
                auth_facebook_client_secret: 'authFacebookClientSecret',
                auth_facebook_enabled: 'authFacebookEnabled',
                auth_facebook_profile_fields: 'authFacebookProfileFields',
                auth_facebook_scope: 'authFacebookScope',
                auth_github_client_id: 'authGithubClientId',
                auth_github_client_secret: 'authGithubClientSecret',
                auth_github_enabled: 'authGithubEnabled',
                auth_github_scope: 'authGithubScope',
                auth_google_client_id: 'authGoogleClientId',
                auth_google_client_secret: 'authGoogleClientSecret',
                auth_google_enabled: 'authGoogleEnabled',
                auth_google_scope: 'authGoogleScope',
                auth_gravatar_default: 'authGravatarDefault',
                auth_gravatar_enabled: 'authGravatarEnabled',
                auth_gravatar_rating: 'authGravatarRating',
                auth_jwt_custom_claims: 'authJwtCustomClaims',
                auth_linkedin_client_id: 'authLinkedinClientId',
                auth_linkedin_client_secret: 'authLinkedinClientSecret',
                auth_linkedin_enabled: 'authLinkedinEnabled',
                auth_linkedin_scope: 'authLinkedinScope',
                auth_locale_allowed_locales: 'authAllowedLocales',
                auth_locale_default: 'authLocaleDefault',
                auth_log_level: 'authLogLevel',
                auth_mfa_enabled: 'authMfaEnabled',
                auth_mfa_totp_issuer: 'authMfaTotpIssuer',
                auth_password_hibp_enabled: 'authPasswordHibpEnabled',
                auth_password_min_length: 'authPasswordMinLength',
                auth_refresh_token_expires_in: 'authRefreshTokenExpiresIn',
                auth_sms_passwordless_enabled: 'authSmsPasswordlessEnabled',
                auth_sms_twilio_account_sid: 'authSmsTwilioAccountSid',
                auth_sms_twilio_auth_token: 'authSmsTwilioAuthToken',
                auth_sms_twilio_from: 'authSmsTwilioFrom',
                auth_sms_twilio_messaging_service_id:
                  'authSmsTwilioMessagingServiceId',
                auth_smtp_auth_method: 'AuthSmtpAuthMethod',
                auth_smtp_host: 'authSmtpHost',
                auth_smtp_pass: 'authSmtpPass',
                auth_smtp_port: 'authSmtpPort',
                auth_smtp_secure: 'AuthSmtpSecure',
                auth_smtp_sender: 'authSmtpSender',
                auth_smtp_user: 'authSmtpUser',
                auth_spotify_client_id: 'authSpotifyClientId',
                auth_spotify_client_secret: 'authSpotifyClientSecret',
                auth_spotify_enabled: 'authSpotifyEnabled',
                auth_spotify_scope: 'authSpotifyScope',
                auth_twitch_client_id: 'authTwitchClientId',
                auth_twitch_client_secret: 'authTwitchClientSecret',
                auth_twitch_enabled: 'authTwitchEnabled',
                auth_twitch_scope: 'authTwitchScope',
                auth_twitter_consumer_key: 'authTwitterConsumerKey',
                auth_twitter_consumer_secret: 'authTwitterConsumerSecret',
                auth_twitter_enabled: 'authTwitterEnabled',
                auth_user_default_allowed_roles: 'authUserDefaultAllowedRoles',
                auth_user_default_role: 'authUserDefaultRole',
                auth_user_session_variable_fields:
                  'authUserSessionVariableFields',
                auth_webauthn_enabled: 'authWebAuthnEnabled',
                auth_windows_live_client_id: 'authWindowsLiveClientId',
                auth_windows_live_client_secret: 'authWindowsLiveClientSecret',
                auth_windows_live_enabled: 'authWindowsLiveEnabled',
                auth_windows_live_scope: 'authWindowsLiveScope',
                auth_workos_client_id: 'authWorkOsClientId',
                auth_workos_client_secret: 'authWorkOsClientSecret',
                auth_workos_default_connection: 'authWorkOsDefaultConnection',
                auth_workos_default_domain: 'authWorkOsDefaultDomain',
                auth_workos_default_organization:
                  'authWorkOsDefaultOrganization',
                auth_workos_enabled: 'authWorkOsEnabled',
                auto_update: 'autoUpdate',
                created_at: 'createdAt',
                creator_user_id: 'creatorUserId',
                desired_state: 'desiredState',
                email_templates_s3_key: 'emailTemplatesS3Key',
                github_repository_id: 'githubRepositoryId',
                hasura_auth_version: 'hasuraAuthVersion',
                hasura_graphql_admin_secret: 'hasuraGraphqlAdminSecret',
                hasura_graphql_database_url: 'hasuraGraphqlDatabaseUrl',
                hasura_graphql_enable_console: 'hasuraGraphqlEnableConsole',
                hasura_graphql_enable_remote_schema_permissions:
                  'hasuraGraphqlEnableRemoteSchemaPermissions',
                hasura_graphql_enabled_apis: 'hasuraGraphqlEnabledApis',
                hasura_graphql_grapqhl_url: 'hasuraGraphqlGraphqlUrl',
                hasura_graphql_jwt_secret: 'hasuraGraphqlJwtSecret',
                hasura_storage_version: 'hasuraStorageVersion',
                hasura_version: 'hasuraVersion',
                id: 'id',
                is_provisioned: 'isProvisioned',
                metadata_functions: 'metadataFunctions',
                name: 'name',
                nhost_base_folder: 'nhostBaseFolder',
                paused: 'paused',
                plan_id: 'planId',
                postgres_database: 'postgresDatabase',
                postgres_host: 'postgresHost',
                postgres_password: 'postgresPassword',
                postgres_public_access: 'postgresPublicAccess',
                postgres_schema_migration_password:
                  'postgresSchemaMigrationPassword',
                postgres_schema_migration_user: 'postgresSchemaMigrationUser',
                postgres_user: 'postgresUser',
                region_id: 'regionId',
                repository_production_branch: 'repositoryProductionBranch',
                s3_access_key: 'S3AccessKey',
                s3_bucket: 'S3Bucket',
                s3_endpoint: 'S3Endpoint',
                s3_secret_key: 'S3SecretKey',
                s3_ssl_enabled: 'S3SslEnabled',
                slug: 'slug',
                storage_force_download_for_content_types:
                  'StorageForceDownloadForContentTypes',
                storage_log_level: 'StorageLogLevel',
                storage_swagger_enabled: 'StorageSwaggerEnabled',
                stripe_subscription_id: 'stripeSubscriptionId',
                subdomain: 'subdomain',
                updated_at: 'updatedAt',
                webhook_secret: 'webhookSecret',
                workspace_id: 'workspaceId',
              },
              custom_root_fields: {
                delete: 'deleteApps',
                delete_by_pk: 'deleteApp',
                insert: 'insertApps',
                insert_one: 'insertApp',
                select_aggregate: 'appsAggregate',
                select_by_pk: 'app',
                update: 'updateApps',
                update_by_pk: 'updateApp',
              },
            },
            object_relationships: [
              {
                name: 'creator',
                using: {
                  foreign_key_constraint_on: 'creator_user_id',
                },
              },
              {
                name: 'desiredAppState',
                using: {
                  foreign_key_constraint_on: 'desired_state',
                },
              },
              {
                name: 'githubRepository',
                using: {
                  foreign_key_constraint_on: 'github_repository_id',
                },
              },
              {
                name: 'plan',
                using: {
                  foreign_key_constraint_on: 'plan_id',
                },
              },
              {
                name: 'region',
                using: {
                  foreign_key_constraint_on: 'region_id',
                },
              },
              {
                name: 'workspace',
                using: {
                  foreign_key_constraint_on: 'workspace_id',
                },
              },
            ],
            array_relationships: [
              {
                name: 'appStates',
                using: {
                  foreign_key_constraint_on: {
                    column: 'app_id',
                    table: {
                      name: 'app_state_history',
                      schema: 'public',
                    },
                  },
                },
              },
              {
                name: 'backups',
                using: {
                  foreign_key_constraint_on: {
                    column: 'app_id',
                    table: {
                      name: 'backups',
                      schema: 'public',
                    },
                  },
                },
              },
              {
                name: 'deployments',
                using: {
                  foreign_key_constraint_on: {
                    column: 'app_id',
                    table: {
                      name: 'deployments',
                      schema: 'public',
                    },
                  },
                },
              },
              {
                name: 'environmentVariables',
                using: {
                  foreign_key_constraint_on: {
                    column: 'app_id',
                    table: {
                      name: 'environment_variables',
                      schema: 'public',
                    },
                  },
                },
              },
              {
                name: 'featureFlags',
                using: {
                  foreign_key_constraint_on: {
                    column: 'app_id',
                    table: {
                      name: 'feature_flags',
                      schema: 'public',
                    },
                  },
                },
              },
            ],
            insert_permissions: [
              {
                role: 'user',
                permission: {
                  check: {
                    workspace: {
                      workspaceMembers: {
                        user_id: {
                          _eq: 'X-Hasura-User-Id',
                        },
                      },
                    },
                  },
                  set: {
                    creator_user_id: 'x-hasura-user-id',
                  },
                  columns: [
                    'name',
                    'plan_id',
                    'postgres_password',
                    'region_id',
                    'slug',
                    'workspace_id',
                  ],
                },
              },
            ],
            select_permissions: [
              {
                role: 'user',
                permission: {
                  columns: [
                    'auth_access_control_allowedEmailDomains',
                    'auth_access_control_allowed_emails',
                    'auth_access_control_allowed_redirect_urls',
                    'auth_access_control_blocked_email_domains',
                    'auth_access_control_blocked_emails',
                    'auth_anonymous_users_enabled',
                    'auth_app_name',
                    'auth_apple_client_id',
                    'auth_apple_enabled',
                    'auth_apple_key_id',
                    'auth_apple_private_key',
                    'auth_apple_scope',
                    'auth_apple_team_id',
                    'auth_client_url',
                    'auth_disable_new_users',
                    'auth_discord_client_id',
                    'auth_discord_client_secret',
                    'auth_discord_enabled',
                    'auth_discord_scope',
                    'auth_email_passwordless_enabled',
                    'auth_email_signin_email_verified_required',
                    'auth_email_template_fetch_url',
                    'auth_facebook_client_id',
                    'auth_facebook_client_secret',
                    'auth_facebook_enabled',
                    'auth_facebook_profile_fields',
                    'auth_github_client_id',
                    'auth_github_client_secret',
                    'auth_github_enabled',
                    'auth_google_client_id',
                    'auth_google_client_secret',
                    'auth_google_enabled',
                    'auth_google_scope',
                    'auth_gravatar_default',
                    'auth_gravatar_enabled',
                    'auth_gravatar_rating',
                    'auth_jwt_custom_claims',
                    'auth_linkedin_client_id',
                    'auth_linkedin_client_secret',
                    'auth_linkedin_enabled',
                    'auth_linkedin_scope',
                    'auth_mfa_enabled',
                    'auth_mfa_totp_issuer',
                    'auth_password_hibp_enabled',
                    'auth_password_min_length',
                    'auth_sms_passwordless_enabled',
                    'auth_sms_twilio_account_sid',
                    'auth_sms_twilio_auth_token',
                    'auth_sms_twilio_from',
                    'auth_sms_twilio_messaging_service_id',
                    'auth_smtp_auth_method',
                    'auth_smtp_auth_method',
                    'auth_smtp_host',
                    'auth_smtp_host',
                    'auth_smtp_pass',
                    'auth_smtp_port',
                    'auth_smtp_secure',
                    'auth_smtp_sender',
                    'auth_smtp_user',
                    'auth_spotify_client_id',
                    'auth_spotify_client_secret',
                    'auth_spotify_enabled',
                    'auth_twitch_client_id',
                    'auth_twitch_client_secret',
                    'auth_twitch_enabled',
                    'auth_twitch_scope',
                    'auth_twitter_consumer_key',
                    'auth_twitter_consumer_secret',
                    'auth_twitter_enabled',
                    'auth_user_default_allowed_roles',
                    'auth_user_default_role',
                    'auth_windows_live_client_id',
                    'auth_windows_live_client_secret',
                    'auth_windows_live_enabled',
                    'auth_windows_live_scope',
                    'auth_webauthn_enabled',
                    'auth_workos_enabled',
                    'auth_workos_client_id',
                    'auth_workos_client_secret',
                    'auth_workos_default_domain',
                    'auth_workos_default_organization',
                    'auth_workos_default_connection',
                    'created_at',
                    'creator_user_id',
                    'desired_state',
                    'github_repository_id',
                    'hasura_graphql_admin_secret',
                    'hasura_graphql_jwt_secret',
                    'id',
                    'is_provisioned',
                    'metadata_functions',
                    'name',
                    'nhost_base_folder',
                    'postgres_database',
                    'postgres_user',
                    'repository_production_branch',
                    'slug',
                    'subdomain',
                    'updated_at',
                    'webhook_secret',
                    'workspace_id',
                  ],
                  filter: {
                    workspace: {
                      workspaceMembers: {
                        user_id: {
                          _eq: 'X-Hasura-User-Id',
                        },
                      },
                    },
                  },
                },
              },
            ],
            update_permissions: [
              {
                role: 'user',
                permission: {
                  columns: [
                    'auth_access_control_allowedEmailDomains',
                    'auth_access_control_allowed_emails',
                    'auth_access_control_allowed_redirect_urls',
                    'auth_access_control_blocked_email_domains',
                    'auth_access_control_blocked_emails',
                    'auth_anonymous_users_enabled',
                    'auth_apple_client_id',
                    'auth_apple_enabled',
                    'auth_apple_key_id',
                    'auth_apple_private_key',
                    'auth_apple_team_id',
                    'auth_client_url',
                    'auth_disable_new_users',
                    'auth_discord_client_id',
                    'auth_discord_client_secret',
                    'auth_discord_enabled',
                    'auth_discord_scope',
                    'auth_email_passwordless_enabled',
                    'auth_email_signin_email_verified_required',
                    'auth_email_template_fetch_url',
                    'auth_facebook_client_id',
                    'auth_facebook_client_secret',
                    'auth_facebook_enabled',
                    'auth_github_client_id',
                    'auth_github_client_secret',
                    'auth_github_enabled',
                    'auth_google_client_id',
                    'auth_google_client_secret',
                    'auth_google_enabled',
                    'auth_google_scope',
                    'auth_gravatar_default',
                    'auth_gravatar_enabled',
                    'auth_gravatar_rating',
                    'auth_jwt_custom_claims',
                    'auth_linkedin_client_id',
                    'auth_linkedin_client_secret',
                    'auth_linkedin_enabled',
                    'auth_mfa_enabled',
                    'auth_mfa_totp_issuer',
                    'auth_password_hibp_enabled',
                    'auth_password_min_length',
                    'auth_sms_passwordless_enabled',
                    'auth_sms_twilio_account_sid',
                    'auth_sms_twilio_auth_token',
                    'auth_sms_twilio_from',
                    'auth_sms_twilio_messaging_service_id',
                    'auth_smtp_auth_method',
                    'auth_smtp_host',
                    'auth_smtp_pass',
                    'auth_smtp_port',
                    'auth_smtp_secure',
                    'auth_smtp_sender',
                    'auth_smtp_user',
                    'auth_spotify_client_id',
                    'auth_spotify_client_secret',
                    'auth_spotify_enabled',
                    'auth_twitch_client_id',
                    'auth_twitch_client_secret',
                    'auth_twitch_enabled',
                    'auth_twitch_scope',
                    'auth_twitter_consumer_key',
                    'auth_twitter_consumer_secret',
                    'auth_twitter_enabled',
                    'auth_user_default_allowed_roles',
                    'auth_user_default_role',
                    'auth_windows_live_client_id',
                    'auth_windows_live_client_secret',
                    'auth_windows_live_enabled',
                    'auth_webauthn_enabled',
                    'auth_workos_enabled',
                    'auth_workos_client_id',
                    'auth_workos_client_secret',
                    'auth_workos_default_domain',
                    'auth_workos_default_organization',
                    'auth_workos_default_connection',
                    'desired_state',
                    'github_repository_id',
                    'hasura_graphql_jwt_secret',
                    'name',
                    'nhost_base_folder',
                    'plan_id',
                    'postgres_password',
                    'repository_production_branch',
                    'slug',
                  ],
                  filter: {
                    workspace: {
                      workspaceMembers: {
                        user_id: {
                          _eq: 'X-Hasura-User-Id',
                        },
                      },
                    },
                  },
                  check: null,
                },
              },
            ],
            delete_permissions: [
              {
                role: 'user',
                permission: {
                  backend_only: false,
                  filter: {
                    workspace: {
                      workspaceMembers: {
                        _and: [
                          {
                            user_id: {
                              _eq: 'X-Hasura-User-Id',
                            },
                          },
                          {
                            type: {
                              _eq: 'owner',
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              },
            ],
            event_triggers: [
              {
                name: 'app-delete',
                definition: {
                  delete: {
                    columns: '*',
                  },
                  enable_manual: false,
                },
                retry_conf: {
                  interval_sec: 10,
                  num_retries: 0,
                  timeout_sec: 60,
                },
                webhook: '{{NHOST_BACKEND_URL}}/v1/functions/app-delete',
                headers: [
                  {
                    name: 'nhost-webhook-secret',
                    value_from_env: 'NHOST_WEBHOOK_SECRET',
                  },
                ],
              },
              {
                name: 'app-delete-tenant',
                definition: {
                  delete: {
                    columns: '*',
                  },
                  enable_manual: false,
                },
                retry_conf: {
                  interval_sec: 10,
                  num_retries: 0,
                  timeout_sec: 60,
                },
                webhook_from_env: 'NHOST_TENANT_EVENT_URL',
                headers: [
                  {
                    name: 'nhost-webhook-secret',
                    value_from_env: 'NHOST_WEBHOOK_SECRET',
                  },
                ],
              },
              {
                name: 'app-insert',
                definition: {
                  enable_manual: false,
                  insert: {
                    columns: '*',
                  },
                },
                retry_conf: {
                  interval_sec: 10,
                  num_retries: 0,
                  timeout_sec: 60,
                },
                webhook: '{{NHOST_BACKEND_URL}}/v1/functions/app-insert',
                headers: [
                  {
                    name: 'nhost-webhook-secret',
                    value_from_env: 'NHOST_WEBHOOK_SECRET',
                  },
                ],
              },
              {
                name: 'app-insert-segment',
                definition: {
                  enable_manual: false,
                  insert: {
                    columns: '*',
                  },
                },
                retry_conf: {
                  interval_sec: 10,
                  num_retries: 0,
                  timeout_sec: 60,
                },
                webhook:
                  '{{NHOST_BACKEND_URL}}/v1/functions/events/apps/insert/segment',
                headers: [
                  {
                    name: 'nhost-webhook-secret',
                    value_from_env: 'NHOST_WEBHOOK_SECRET',
                  },
                ],
              },
              {
                name: 'app-insert-tenant',
                definition: {
                  enable_manual: false,
                  insert: {
                    columns: '*',
                  },
                },
                retry_conf: {
                  interval_sec: 10,
                  num_retries: 0,
                  timeout_sec: 60,
                },
                webhook_from_env: 'NHOST_TENANT_EVENT_URL',
                headers: [
                  {
                    name: 'nhost-webhook-secret',
                    value_from_env: 'NHOST_WEBHOOK_SECRET',
                  },
                ],
              },
              {
                name: 'app-update-plan',
                definition: {
                  enable_manual: false,
                  update: {
                    columns: ['plan_id'],
                  },
                },
                retry_conf: {
                  interval_sec: 10,
                  num_retries: 0,
                  timeout_sec: 60,
                },
                webhook: '{{NHOST_BACKEND_URL}}/v1/functions/app-update-plan',
                headers: [
                  {
                    name: 'nhost-webhook-secret',
                    value_from_env: 'NHOST_WEBHOOK_SECRET',
                  },
                ],
              },
              {
                name: 'app-update-tenant',
                definition: {
                  enable_manual: false,
                  update: {
                    columns: [
                      'auth_anonymous_users_enabled',
                      'auth_apple_enabled',
                      'auth_disable_new_users',
                      'auth_discord_enabled',
                      'auth_email_passwordless_enabled',
                      'auth_emails_enabled',
                      'auth_email_signin_email_verified_required',
                      'auth_facebook_enabled',
                      'auth_github_enabled',
                      'auth_google_enabled',
                      'auth_gravatar_enabled',
                      'auth_linkedin_enabled',
                      'auth_mfa_enabled',
                      'auth_password_hibp_enabled',
                      'auth_sms_passwordless_enabled',
                      'auth_smtp_secure',
                      'auth_spotify_enabled',
                      'auth_twitch_enabled',
                      'auth_twitter_enabled',
                      'auth_windows_live_enabled',
                      'hasura_graphql_enable_console',
                      'hasura_graphql_enable_remote_schema_permissions',
                      'postgres_public_access',
                      's3_ssl_enabled',
                      'auth_access_token_expires_in',
                      'auth_password_min_length',
                      'auth_refresh_token_expires_in',
                      'auth_smtp_port',
                      'desired_state',
                      'auth_jwt_custom_claims',
                      'auth_access_control_allowedEmailDomains',
                      'auth_access_control_allowed_emails',
                      'auth_access_control_allowed_redirect_urls',
                      'auth_access_control_blocked_email_domains',
                      'auth_access_control_blocked_emails',
                      'auth_apple_client_id',
                      'auth_apple_key_id',
                      'auth_apple_private_key',
                      'auth_apple_scope',
                      'auth_apple_team_id',
                      'auth_app_name',
                      'auth_client_url',
                      'auth_discord_client_id',
                      'auth_discord_client_secret',
                      'auth_discord_scope',
                      'auth_email_template_fetch_url',
                      'auth_facebook_client_id',
                      'auth_facebook_client_secret',
                      'auth_facebook_profile_fields',
                      'auth_facebook_scope',
                      'auth_github_client_id',
                      'auth_github_client_secret',
                      'auth_github_scope',
                      'auth_google_client_id',
                      'auth_google_client_secret',
                      'auth_google_scope',
                      'auth_gravatar_default',
                      'auth_gravatar_rating',
                      'auth_linkedin_client_id',
                      'auth_linkedin_client_secret',
                      'auth_linkedin_scope',
                      'auth_locale_allowed_locales',
                      'auth_locale_default',
                      'auth_log_level',
                      'auth_mfa_totp_issuer',
                      'auth_sms_twilio_account_sid',
                      'auth_sms_twilio_auth_token',
                      'auth_sms_twilio_from',
                      'auth_sms_twilio_messaging_service_id',
                      'auth_smtp_auth_method',
                      'auth_smtp_host',
                      'auth_smtp_pass',
                      'auth_smtp_sender',
                      'auth_smtp_user',
                      'auth_spotify_client_id',
                      'auth_spotify_client_secret',
                      'auth_spotify_scope',
                      'auth_twitch_client_id',
                      'auth_twitch_client_secret',
                      'auth_twitch_scope',
                      'auth_twitter_consumer_key',
                      'auth_twitter_consumer_secret',
                      'auth_user_default_allowed_roles',
                      'auth_user_default_role',
                      'auth_user_session_variable_fields',
                      'auth_windows_live_client_id',
                      'auth_windows_live_client_secret',
                      'auth_windows_live_scope',
                      'auth_webauthn_enabled',
                      'auth_workos_enabled',
                      'auth_workos_client_id',
                      'auth_workos_client_secret',
                      'auth_workos_default_domain',
                      'auth_workos_default_organization',
                      'auth_workos_default_connection',
                      'email_templates_s3_key',
                      'hasura_auth_version',
                      'hasura_graphql_admin_secret',
                      'hasura_graphql_database_url',
                      'hasura_graphql_enabled_apis',
                      'hasura_graphql_grapqhl_url',
                      'hasura_graphql_jwt_secret',
                      'hasura_storage_version',
                      'hasura_version',
                      's3_access_key',
                      's3_bucket',
                      's3_endpoint',
                      's3_secret_key',
                      'storage_force_download_for_content_types',
                      'storage_log_level',
                      'webhook_secret',
                      'plan_id',
                      'paused',
                    ],
                  },
                },
                retry_conf: {
                  interval_sec: 10,
                  num_retries: 0,
                  timeout_sec: 60,
                },
                webhook_from_env: 'NHOST_TENANT_EVENT_URL',
                headers: [
                  {
                    name: 'nhost-webhook-secret',
                    value_from_env: 'NHOST_WEBHOOK_SECRET',
                  },
                ],
              },
              {
                name: 'app-updated-paused-email',
                definition: {
                  enable_manual: false,
                  update: {
                    columns: '*',
                  },
                },
                retry_conf: {
                  interval_sec: 10,
                  num_retries: 0,
                  timeout_sec: 60,
                },
                webhook:
                  '{{NHOST_BACKEND_URL}}/v1/functions/events/apps/update/paused-email',
                headers: [
                  {
                    name: 'nhost-webhook-secret',
                    value_from_env: 'NHOST_WEBHOOK_SECRET',
                  },
                ],
              },
              {
                name: 'apps-delete-segment',
                definition: {
                  delete: {
                    columns: '*',
                  },
                  enable_manual: false,
                },
                retry_conf: {
                  interval_sec: 10,
                  num_retries: 0,
                  timeout_sec: 60,
                },
                webhook:
                  '{{NHOST_BACKEND_URL}}/v1/functions/events/apps/delete/segment',
                headers: [
                  {
                    name: 'nhost-webhook-secret',
                    value_from_env: 'NHOST_WEBHOOK_SECRET',
                  },
                ],
              },
              {
                name: 'apps-update-segment-github-repository',
                definition: {
                  enable_manual: false,
                  update: {
                    columns: ['postgres_password', 'github_repository_id'],
                  },
                },
                retry_conf: {
                  interval_sec: 10,
                  num_retries: 0,
                  timeout_sec: 60,
                },
                webhook:
                  '{{NHOST_BACKEND_URL}}/v1/functions/events/apps/update/segment-github-repository',
                headers: [
                  {
                    name: 'nhost-webhook-secret',
                    value_from_env: 'NHOST_WEBHOOK_SECRET',
                  },
                ],
              },
              {
                name: 'apps-update-segment-plan-changed',
                definition: {
                  enable_manual: false,
                  update: {
                    columns: ['plan_id'],
                  },
                },
                retry_conf: {
                  interval_sec: 10,
                  num_retries: 0,
                  timeout_sec: 60,
                },
                webhook:
                  '{{NHOST_BACKEND_URL}}/v1/functions/events/apps/update/segment-plan-change',
                headers: [
                  {
                    name: 'nhost-webhook-secret',
                    value_from_env: 'NHOST_WEBHOOK_SECRET',
                  },
                ],
              },
            ],
          },
          {
            table: {
              name: 'backups',
              schema: 'public',
            },
            configuration: {
              column_config: {
                app_id: {
                  custom_name: 'appId',
                },
                completed_at: {
                  custom_name: 'completedAt',
                },
                created_at: {
                  custom_name: 'createdAt',
                },
                id: {
                  custom_name: 'id',
                },
                size: {
                  custom_name: 'size',
                },
              },
              custom_column_names: {
                app_id: 'appId',
                completed_at: 'completedAt',
                created_at: 'createdAt',
                id: 'id',
                size: 'size',
              },
              custom_name: 'backups',
              custom_root_fields: {
                delete: 'deleteBackups',
                delete_by_pk: 'deleteBackup',
                insert: 'insertBackups',
                insert_one: 'insertBackup',
                select: 'backups',
                select_aggregate: 'backupsAggregate',
                select_by_pk: 'backup',
                update: 'updateBackups',
                update_by_pk: 'updateBackup',
              },
            },
            object_relationships: [
              {
                name: 'app',
                using: {
                  foreign_key_constraint_on: 'app_id',
                },
              },
            ],
            select_permissions: [
              {
                role: 'user',
                permission: {
                  columns: [
                    'app_id',
                    'completed_at',
                    'created_at',
                    'id',
                    'size',
                  ],
                  filter: {
                    app: {
                      workspace: {
                        workspaceMembers: {
                          user_id: {
                            _eq: 'X-Hasura-User-Id',
                          },
                        },
                      },
                    },
                  },
                },
              },
            ],
          },
          {
            table: {
              name: 'cli_tokens',
              schema: 'public',
            },
            configuration: {
              column_config: {
                created_at: {
                  custom_name: 'createdAt',
                },
                id: {
                  custom_name: 'id',
                },
                token: {
                  custom_name: 'token',
                },
                updated_at: {
                  custom_name: 'updatedAt',
                },
                user_id: {
                  custom_name: 'userId',
                },
              },
              custom_column_names: {
                created_at: 'createdAt',
                id: 'id',
                token: 'token',
                updated_at: 'updatedAt',
                user_id: 'userId',
              },
              custom_name: 'cliTokens',
              custom_root_fields: {
                delete: 'deleteCliTokens',
                delete_by_pk: 'deleteCliToken',
                insert: 'insertCliTokens',
                insert_one: 'insertCliToken',
                select: 'cliTokens',
                select_aggregate: 'cliTokensAggregate',
                select_by_pk: 'cliToken',
                update: 'updateCliTokens',
                update_by_pk: 'updateCliToken',
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
            select_permissions: [
              {
                role: 'user',
                permission: {
                  columns: ['created_at', 'id', 'updated_at'],
                  filter: {
                    user_id: {
                      _eq: 'X-Hasura-User-Id',
                    },
                  },
                },
              },
            ],
            delete_permissions: [
              {
                role: 'user',
                permission: {
                  backend_only: false,
                  filter: {
                    user_id: {
                      _eq: 'X-Hasura-User-Id',
                    },
                  },
                },
              },
            ],
          },
          {
            table: {
              name: 'continents',
              schema: 'public',
            },
            array_relationships: [
              {
                name: 'countries',
                using: {
                  foreign_key_constraint_on: {
                    column: 'continent_code',
                    table: {
                      name: 'countries',
                      schema: 'public',
                    },
                  },
                },
              },
            ],
            select_permissions: [
              {
                role: 'user',
                permission: {
                  columns: ['code', 'name'],
                  filter: {},
                },
              },
            ],
          },
          {
            table: {
              name: 'countries',
              schema: 'public',
            },
            configuration: {
              column_config: {
                continent_code: {
                  custom_name: 'continentCode',
                },
                emoji_flag: {
                  custom_name: 'emojiFlag',
                },
                full_name: {
                  custom_name: 'fullName',
                },
                iso_number: {
                  custom_name: 'isoNumber',
                },
              },
              custom_column_names: {
                continent_code: 'continentCode',
                emoji_flag: 'emojiFlag',
                full_name: 'fullName',
                iso_number: 'isoNumber',
              },
              custom_root_fields: {},
            },
            object_relationships: [
              {
                name: 'continent',
                using: {
                  foreign_key_constraint_on: 'continent_code',
                },
              },
            ],
            array_relationships: [
              {
                name: 'locations',
                using: {
                  foreign_key_constraint_on: {
                    column: 'country_code',
                    table: {
                      name: 'regions',
                      schema: 'public',
                    },
                  },
                },
              },
              {
                name: 'workspaces',
                using: {
                  foreign_key_constraint_on: {
                    column: 'address_country_code',
                    table: {
                      name: 'workspaces',
                      schema: 'public',
                    },
                  },
                },
              },
            ],
            select_permissions: [
              {
                role: 'user',
                permission: {
                  columns: ['code', 'continent_code', 'emoji_flag', 'name'],
                  filter: {},
                },
              },
            ],
          },
          {
            table: {
              name: 'deployment_logs',
              schema: 'public',
            },
            configuration: {
              column_config: {
                created_at: {
                  custom_name: 'createdAt',
                },
                deployment_id: {
                  custom_name: 'deploymentId',
                },
              },
              custom_column_names: {
                created_at: 'createdAt',
                deployment_id: 'deploymentId',
              },
              custom_name: 'deploymentLogs',
              custom_root_fields: {
                delete: 'deleteDeploymentLogs',
                delete_by_pk: 'deleteDeploymentLog',
                insert: 'insertDeploymentLogs',
                insert_one: 'insertDeploymentLog',
                select: 'deploymentLogs',
                select_aggregate: 'deploymentLogsAggregate',
                select_by_pk: 'deploymentLog',
                update: 'updateDeploymentLogs',
                update_by_pk: 'updateDeploymentLog',
              },
            },
            object_relationships: [
              {
                name: 'deployment',
                using: {
                  foreign_key_constraint_on: 'deployment_id',
                },
              },
            ],
            select_permissions: [
              {
                role: 'user',
                permission: {
                  columns: ['id', 'deployment_id', 'message', 'created_at'],
                  filter: {
                    deployment: {
                      app: {
                        workspace: {
                          workspaceMembers: {
                            user_id: {
                              _eq: 'X-Hasura-User-Id',
                            },
                          },
                        },
                      },
                    },
                  },
                  limit: 500,
                },
              },
            ],
          },
          {
            table: {
              name: 'deployments',
              schema: 'public',
            },
            configuration: {
              column_config: {
                app_id: {
                  custom_name: 'appId',
                },
                commit_message: {
                  custom_name: 'commitMessage',
                },
                commit_sha: {
                  custom_name: 'commitSHA',
                },
                commit_user_avatar_url: {
                  custom_name: 'commitUserAvatarUrl',
                },
                commit_user_name: {
                  custom_name: 'commitUserName',
                },
                deployment_ended_at: {
                  custom_name: 'deploymentEndedAt',
                },
                deployment_started_at: {
                  custom_name: 'deploymentStartedAt',
                },
                deployment_status: {
                  custom_name: 'deploymentStatus',
                },
                functions_ended_at: {
                  custom_name: 'functionsEndedAt',
                },
                functions_started_at: {
                  custom_name: 'functionsStartedAt',
                },
                functions_status: {
                  custom_name: 'functionsStatus',
                },
                metadata_ended_at: {
                  custom_name: 'metadataEndedAt',
                },
                metadata_started_at: {
                  custom_name: 'metadataStartedAt',
                },
                metadata_status: {
                  custom_name: 'metadataStatus',
                },
                migrations_ended_at: {
                  custom_name: 'migrationsEndedAt',
                },
                migrations_started_at: {
                  custom_name: 'migrationsStartedAt',
                },
                migrations_status: {
                  custom_name: 'migrationsStatus',
                },
              },
              custom_column_names: {
                app_id: 'appId',
                commit_message: 'commitMessage',
                commit_sha: 'commitSHA',
                commit_user_avatar_url: 'commitUserAvatarUrl',
                commit_user_name: 'commitUserName',
                deployment_ended_at: 'deploymentEndedAt',
                deployment_started_at: 'deploymentStartedAt',
                deployment_status: 'deploymentStatus',
                functions_ended_at: 'functionsEndedAt',
                functions_started_at: 'functionsStartedAt',
                functions_status: 'functionsStatus',
                metadata_ended_at: 'metadataEndedAt',
                metadata_started_at: 'metadataStartedAt',
                metadata_status: 'metadataStatus',
                migrations_ended_at: 'migrationsEndedAt',
                migrations_started_at: 'migrationsStartedAt',
                migrations_status: 'migrationsStatus',
              },
              custom_name: 'deployments',
              custom_root_fields: {
                delete: 'deleteDeployments',
                delete_by_pk: 'deleteDeployment',
                insert: 'insertDeployments',
                insert_one: 'insertDeployment',
                select: 'deployments',
                select_aggregate: 'deploymentsAggregate',
                select_by_pk: 'deployment',
                update: 'updateDeployments',
                update_by_pk: 'updateDeployment',
              },
            },
            object_relationships: [
              {
                name: 'app',
                using: {
                  foreign_key_constraint_on: 'app_id',
                },
              },
            ],
            array_relationships: [
              {
                name: 'deploymentLogs',
                using: {
                  manual_configuration: {
                    column_mapping: {
                      id: 'deployment_id',
                    },
                    insertion_order: null,
                    remote_table: {
                      name: 'deployment_logs',
                      schema: 'public',
                    },
                  },
                },
              },
            ],
            select_permissions: [
              {
                role: 'user',
                permission: {
                  columns: [
                    'app_id',
                    'commit_message',
                    'commit_sha',
                    'commit_user_avatar_url',
                    'commit_user_name',
                    'deployment_ended_at',
                    'deployment_started_at',
                    'deployment_status',
                    'functions_ended_at',
                    'functions_started_at',
                    'functions_status',
                    'id',
                    'metadata_ended_at',
                    'metadata_started_at',
                    'metadata_status',
                    'migrations_ended_at',
                    'migrations_started_at',
                    'migrations_status',
                  ],
                  filter: {
                    app: {
                      workspace: {
                        workspaceMembers: {
                          user_id: {
                            _eq: 'X-Hasura-User-Id',
                          },
                        },
                      },
                    },
                  },
                  limit: 256,
                },
              },
            ],
            event_triggers: [
              {
                name: 'deployments-update-failed-email',
                definition: {
                  enable_manual: false,
                  update: {
                    columns: '*',
                  },
                },
                retry_conf: {
                  interval_sec: 10,
                  num_retries: 0,
                  timeout_sec: 60,
                },
                webhook:
                  '{{NHOST_BACKEND_URL}}/v1/functions/events/deployments/update/failed-email',
                headers: [
                  {
                    name: 'nhost-webhook-secret',
                    value_from_env: 'NHOST_WEBHOOK_SECRET',
                  },
                ],
              },
            ],
          },
          {
            table: {
              name: 'environment_variables',
              schema: 'public',
            },
            configuration: {
              column_config: {
                app_id: {
                  custom_name: 'appId',
                },
                created_at: {
                  custom_name: 'createdAt',
                },
                dev_value: {
                  custom_name: 'devValue',
                },
                prod_value: {
                  custom_name: 'prodValue',
                },
                updated_at: {
                  custom_name: 'updatedAt',
                },
              },
              custom_column_names: {
                app_id: 'appId',
                created_at: 'createdAt',
                dev_value: 'devValue',
                prod_value: 'prodValue',
                updated_at: 'updatedAt',
              },
              custom_name: 'environmentVariables',
              custom_root_fields: {
                delete: 'deleteEnvironmentVariables',
                delete_by_pk: 'deleteEnvironmentVariable',
                insert: 'insertEnvironmentVariables',
                insert_one: 'insertEnvironmentVariable',
                select: 'environmentVariables',
                select_aggregate: 'environmentVariablesAggregate',
                select_by_pk: 'environmentVariable',
                update: 'updateEnvironmentVariables',
                update_by_pk: 'updateEnvironmentVariable',
              },
            },
            object_relationships: [
              {
                name: 'app',
                using: {
                  foreign_key_constraint_on: 'app_id',
                },
              },
            ],
            insert_permissions: [
              {
                role: 'user',
                permission: {
                  check: {
                    app: {
                      workspace: {
                        workspaceMembers: {
                          user_id: {
                            _eq: 'X-Hasura-User-Id',
                          },
                        },
                      },
                    },
                  },
                  columns: ['app_id', 'dev_value', 'name', 'prod_value'],
                },
              },
            ],
            select_permissions: [
              {
                role: 'user',
                permission: {
                  columns: [
                    'app_id',
                    'created_at',
                    'dev_value',
                    'id',
                    'name',
                    'prod_value',
                    'updated_at',
                  ],
                  filter: {
                    app: {
                      workspace: {
                        workspaceMembers: {
                          user_id: {
                            _eq: 'X-Hasura-User-Id',
                          },
                        },
                      },
                    },
                  },
                },
              },
            ],
            update_permissions: [
              {
                role: 'user',
                permission: {
                  columns: ['dev_value', 'prod_value'],
                  filter: {
                    app: {
                      workspace: {
                        workspaceMembers: {
                          user_id: {
                            _eq: 'X-Hasura-User-Id',
                          },
                        },
                      },
                    },
                  },
                  check: null,
                },
              },
            ],
            delete_permissions: [
              {
                role: 'user',
                permission: {
                  backend_only: false,
                  filter: {
                    app: {
                      workspace: {
                        workspaceMembers: {
                          user_id: {
                            _eq: 'X-Hasura-User-Id',
                          },
                        },
                      },
                    },
                  },
                },
              },
            ],
            event_triggers: [
              {
                name: 'app-delete-environment',
                definition: {
                  delete: {
                    columns: '*',
                  },
                  enable_manual: false,
                },
                retry_conf: {
                  interval_sec: 10,
                  num_retries: 0,
                  timeout_sec: 60,
                },
                webhook_from_env: 'NHOST_TENANT_EVENT_URL',
                headers: [
                  {
                    name: 'nhost-webhook-secret',
                    value_from_env: 'NHOST_WEBHOOK_SECRET',
                  },
                ],
              },
              {
                name: 'app-insert-environment',
                definition: {
                  enable_manual: false,
                  insert: {
                    columns: '*',
                  },
                },
                retry_conf: {
                  interval_sec: 10,
                  num_retries: 0,
                  timeout_sec: 60,
                },
                webhook_from_env: 'NHOST_TENANT_EVENT_URL',
                headers: [
                  {
                    name: 'nhost-webhook-secret',
                    value_from_env: 'NHOST_WEBHOOK_SECRET',
                  },
                ],
              },
              {
                name: 'app-update-environment',
                definition: {
                  enable_manual: false,
                  update: {
                    columns: '*',
                  },
                },
                retry_conf: {
                  interval_sec: 10,
                  num_retries: 0,
                  timeout_sec: 60,
                },
                webhook_from_env: 'NHOST_TENANT_EVENT_URL',
                headers: [
                  {
                    name: 'nhost-webhook-secret',
                    value_from_env: 'NHOST_WEBHOOK_SECRET',
                  },
                ],
              },
            ],
          },
          {
            table: {
              name: 'feature_flags',
              schema: 'public',
            },
            configuration: {
              column_config: {
                app_id: {
                  custom_name: 'appId',
                },
              },
              custom_column_names: {
                app_id: 'appId',
              },
              custom_name: 'featureFlags',
              custom_root_fields: {
                delete: 'deleteFeatureFlags',
                delete_by_pk: 'deleteFeatureFlag',
                insert: 'insertFeatureFlags',
                insert_one: 'insertFeatureFlag',
                select: 'featureFlags',
                select_aggregate: 'featureFlagsAggregate',
                select_by_pk: 'featureFlag',
                update: 'updateFeatureFlags',
                update_by_pk: 'updateFeatureFlag',
              },
            },
            object_relationships: [
              {
                name: 'app',
                using: {
                  foreign_key_constraint_on: 'app_id',
                },
              },
            ],
            select_permissions: [
              {
                role: 'user',
                permission: {
                  columns: ['app_id', 'description', 'id', 'name', 'value'],
                  filter: {
                    app: {
                      workspace: {
                        workspaceMembers: {
                          user_id: {
                            _eq: 'X-Hasura-User-Id',
                          },
                        },
                      },
                    },
                  },
                },
              },
            ],
          },
          {
            table: {
              name: 'feedback',
              schema: 'public',
            },
            configuration: {
              column_config: {
                created_at: {
                  custom_name: 'createdAt',
                },
                sent_by: {
                  custom_name: 'sentBy',
                },
              },
              custom_column_names: {
                created_at: 'createdAt',
                sent_by: 'sentBy',
              },
              custom_root_fields: {
                delete: 'deleteFeedback',
                delete_by_pk: 'deleteFeedbackOne',
                insert: 'insertFeedback',
                insert_one: 'insertFeedbackOne',
                select: 'feedback',
                select_aggregate: 'feedbackAggreggate',
                select_by_pk: 'feedbackOne',
                update: 'updateFeedback',
                update_by_pk: 'updateFeedbackOne',
              },
            },
            object_relationships: [
              {
                name: 'user',
                using: {
                  foreign_key_constraint_on: 'sent_by',
                },
              },
            ],
            insert_permissions: [
              {
                role: 'user',
                permission: {
                  check: {},
                  set: {
                    sent_by: 'x-hasura-user-id',
                  },
                  columns: ['feedback'],
                },
              },
            ],
            select_permissions: [
              {
                role: 'user',
                permission: {
                  columns: ['id'],
                  filter: {
                    sent_by: {
                      _eq: 'X-Hasura-User-Id',
                    },
                  },
                },
              },
            ],
            event_triggers: [
              {
                name: 'feedback-insert',
                definition: {
                  enable_manual: false,
                  insert: {
                    columns: '*',
                  },
                },
                retry_conf: {
                  interval_sec: 10,
                  num_retries: 0,
                  timeout_sec: 60,
                },
                webhook: '{{NHOST_BACKEND_URL}}/v1/functions/feedback-insert',
                headers: [
                  {
                    name: 'nhost-webhook-secret',
                    value_from_env: 'NHOST_WEBHOOK_SECRET',
                  },
                ],
              },
            ],
          },
          {
            table: {
              name: 'github_app_installations',
              schema: 'public',
            },
            configuration: {
              column_config: {
                account_avatar_url: {
                  custom_name: 'accountAvatarUrl',
                },
                account_login: {
                  custom_name: 'accountLogin',
                },
                account_node_id: {
                  custom_name: 'accountNodeId',
                },
                account_type: {
                  custom_name: 'accountType',
                },
                created_at: {
                  custom_name: 'createdAt',
                },
                external_github_app_installation_id: {
                  custom_name: 'externalGithubAppInstallationId',
                },
                github_data: {
                  custom_name: 'githubData',
                },
                id: {
                  custom_name: 'id',
                },
                updated_at: {
                  custom_name: 'updatedAt',
                },
                user_id: {
                  custom_name: 'userId',
                },
              },
              custom_column_names: {
                account_avatar_url: 'accountAvatarUrl',
                account_login: 'accountLogin',
                account_node_id: 'accountNodeId',
                account_type: 'accountType',
                created_at: 'createdAt',
                external_github_app_installation_id:
                  'externalGithubAppInstallationId',
                github_data: 'githubData',
                id: 'id',
                updated_at: 'updatedAt',
                user_id: 'userId',
              },
              custom_name: 'githubAppInstallations',
              custom_root_fields: {
                delete: 'deleteGithubAppInstallations',
                delete_by_pk: 'deleteGithubAppInstallation',
                insert: 'insertGithubAppInstallations',
                insert_one: 'insertGithubAppInstallation',
                select: 'githubAppInstallations',
                select_aggregate: 'githubAppInstallationsAggregate',
                select_by_pk: 'githubAppInstallation',
                update: 'updateGithubAppInstallations',
                update_by_pk: 'updateGithubAppInstallation',
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
            array_relationships: [
              {
                name: 'githubRepositories',
                using: {
                  foreign_key_constraint_on: {
                    column: 'github_app_installation_id',
                    table: {
                      name: 'github_repositories',
                      schema: 'public',
                    },
                  },
                },
              },
            ],
            insert_permissions: [
              {
                role: 'user',
                permission: {
                  check: {
                    user_id: {
                      _eq: 'X-Hasura-User-Id',
                    },
                  },
                  columns: [
                    'account_avatar_url',
                    'account_login',
                    'account_node_id',
                    'account_type',
                    'external_github_app_installation_id',
                    'github_data',
                    'user_id',
                  ],
                },
              },
            ],
            select_permissions: [
              {
                role: 'user',
                permission: {
                  columns: [
                    'account_avatar_url',
                    'account_login',
                    'account_type',
                    'created_at',
                    'id',
                    'updated_at',
                  ],
                  filter: {
                    user_id: {
                      _eq: 'X-Hasura-User-Id',
                    },
                  },
                },
              },
            ],
            update_permissions: [
              {
                role: 'user',
                permission: {
                  columns: [],
                  filter: {
                    user_id: {
                      _eq: 'X-Hasura-User-Id',
                    },
                  },
                  check: null,
                  set: {
                    user_id: 'x-hasura-user-id',
                  },
                },
              },
            ],
          },
          {
            table: {
              name: 'github_repositories',
              schema: 'public',
            },
            configuration: {
              column_config: {
                created_at: {
                  custom_name: 'createdAt',
                },
                external_github_repository_node_id: {
                  custom_name: 'externalGithubAppRepositoryNodeId',
                },
                full_name: {
                  custom_name: 'fullName',
                },
                github_app_installation_id: {
                  custom_name: 'githubAppInstallationId',
                },
                id: {
                  custom_name: 'id',
                },
                name: {
                  custom_name: 'name',
                },
                private: {
                  custom_name: 'private',
                },
                updated_at: {
                  custom_name: 'updatedAt',
                },
              },
              custom_column_names: {
                created_at: 'createdAt',
                external_github_repository_node_id:
                  'externalGithubAppRepositoryNodeId',
                full_name: 'fullName',
                github_app_installation_id: 'githubAppInstallationId',
                id: 'id',
                name: 'name',
                private: 'private',
                updated_at: 'updatedAt',
              },
              custom_name: 'githubRepositories',
              custom_root_fields: {
                delete: 'deleteGithubRepositories',
                delete_by_pk: 'deleteGithubRepository',
                insert: 'insertGithubRepositories',
                insert_one: 'insertGithubRepository',
                select: 'githubRepositories',
                select_aggregate: 'githubRepositoriesAggregate',
                select_by_pk: 'githubRepository',
                update: 'updateGithubRepositories',
                update_by_pk: 'updateGithubRepository',
              },
            },
            object_relationships: [
              {
                name: 'githubAppInstallation',
                using: {
                  foreign_key_constraint_on: 'github_app_installation_id',
                },
              },
            ],
            array_relationships: [
              {
                name: 'apps',
                using: {
                  foreign_key_constraint_on: {
                    column: 'github_repository_id',
                    table: {
                      name: 'apps',
                      schema: 'public',
                    },
                  },
                },
              },
            ],
            select_permissions: [
              {
                role: 'user',
                permission: {
                  columns: [
                    'created_at',
                    'full_name',
                    'id',
                    'name',
                    'private',
                    'updated_at',
                  ],
                  filter: {
                    _or: [
                      {
                        githubAppInstallation: {
                          user_id: {
                            _eq: 'X-Hasura-User-Id',
                          },
                        },
                      },
                      {
                        apps: {
                          workspace: {
                            workspaceMembers: {
                              user_id: {
                                _eq: 'X-Hasura-User-Id',
                              },
                            },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            ],
          },
          {
            table: {
              name: 'payment_methods',
              schema: 'public',
            },
            configuration: {
              column_config: {
                added_by_user_id: {
                  custom_name: 'addedByUserId',
                },
                card_brand: {
                  custom_name: 'cardBrand',
                },
                card_exp_month: {
                  custom_name: 'cardExpMonth',
                },
                card_exp_year: {
                  custom_name: 'cardExpYear',
                },
                card_last4: {
                  custom_name: 'cardLast4',
                },
                created_at: {
                  custom_name: 'createdAt',
                },
                is_default: {
                  custom_name: 'isDefault',
                },
                stripe_payment_method_id: {
                  custom_name: 'stripePaymentMethodId',
                },
                workspace_id: {
                  custom_name: 'workspaceId',
                },
              },
              custom_column_names: {
                added_by_user_id: 'addedByUserId',
                card_brand: 'cardBrand',
                card_exp_month: 'cardExpMonth',
                card_exp_year: 'cardExpYear',
                card_last4: 'cardLast4',
                created_at: 'createdAt',
                is_default: 'isDefault',
                stripe_payment_method_id: 'stripePaymentMethodId',
                workspace_id: 'workspaceId',
              },
              custom_name: 'paymentMethods',
              custom_root_fields: {
                delete: 'deletePaymentMethods',
                delete_by_pk: 'deletePaymentMethod',
                insert: 'insertPaymentMethods',
                insert_one: 'insertPaymentMethod',
                select: 'paymentMethods',
                select_aggregate: 'paymentMethodsAggregate',
                select_by_pk: 'paymentMethod',
                update: 'updatePaymentMethods',
                update_by_pk: 'updatePaymentMethod',
              },
            },
            object_relationships: [
              {
                name: 'user',
                using: {
                  foreign_key_constraint_on: 'added_by_user_id',
                },
              },
              {
                name: 'workspace',
                using: {
                  foreign_key_constraint_on: 'workspace_id',
                },
              },
            ],
            insert_permissions: [
              {
                role: 'user',
                permission: {
                  check: {
                    workspace: {
                      workspaceMembers: {
                        _and: [
                          {
                            user_id: {
                              _eq: 'X-Hasura-User-Id',
                            },
                          },
                          {
                            type: {
                              _eq: 'owner',
                            },
                          },
                        ],
                      },
                    },
                  },
                  set: {
                    added_by_user_id: 'x-hasura-user-id',
                  },
                  columns: [
                    'card_brand',
                    'card_exp_month',
                    'card_exp_year',
                    'card_last4',
                    'is_default',
                    'stripe_payment_method_id',
                    'workspace_id',
                  ],
                },
              },
            ],
            select_permissions: [
              {
                role: 'user',
                permission: {
                  columns: [
                    'added_by_user_id',
                    'card_brand',
                    'card_exp_month',
                    'card_exp_year',
                    'card_last4',
                    'created_at',
                    'id',
                    'is_default',
                    'stripe_payment_method_id',
                    'workspace_id',
                  ],
                  filter: {
                    workspace: {
                      workspaceMembers: {
                        user_id: {
                          _eq: 'X-Hasura-User-Id',
                        },
                      },
                    },
                  },
                },
              },
            ],
            update_permissions: [
              {
                role: 'user',
                permission: {
                  columns: ['is_default'],
                  filter: {
                    workspace: {
                      workspaceMembers: {
                        _and: [
                          {
                            user_id: {
                              _eq: 'X-Hasura-User-Id',
                            },
                          },
                          {
                            type: {
                              _eq: 'owner',
                            },
                          },
                        ],
                      },
                    },
                  },
                  check: null,
                },
              },
            ],
            delete_permissions: [
              {
                role: 'user',
                permission: {
                  backend_only: false,
                  filter: {
                    workspace: {
                      workspaceMembers: {
                        _and: [
                          {
                            user_id: {
                              _eq: 'X-Hasura-User-Id',
                            },
                          },
                          {
                            type: {
                              _eq: 'owner',
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              },
            ],
            event_triggers: [
              {
                name: 'payment-method-delete',
                definition: {
                  delete: {
                    columns: '*',
                  },
                  enable_manual: false,
                },
                retry_conf: {
                  interval_sec: 10,
                  num_retries: 0,
                  timeout_sec: 60,
                },
                webhook:
                  '{{NHOST_BACKEND_URL}}/v1/functions/events/payment-methods/delete/stripe',
                headers: [
                  {
                    name: 'nhost-webhook-secret',
                    value_from_env: 'NHOST_WEBHOOK_SECRET',
                  },
                ],
              },
              {
                name: 'payment-method-delete-segment',
                definition: {
                  delete: {
                    columns: '*',
                  },
                  enable_manual: false,
                },
                retry_conf: {
                  interval_sec: 10,
                  num_retries: 0,
                  timeout_sec: 60,
                },
                webhook:
                  '{{NHOST_BACKEND_URL}}/v1/functions/events/payment-methods/delete/segment',
                headers: [
                  {
                    name: 'nhost-webhook-secret',
                    value_from_env: 'NHOST_WEBHOOK_SECRET',
                  },
                ],
              },
              {
                name: 'payment-method-insert',
                definition: {
                  enable_manual: false,
                  insert: {
                    columns: '*',
                  },
                },
                retry_conf: {
                  interval_sec: 10,
                  num_retries: 0,
                  timeout_sec: 60,
                },
                webhook:
                  '{{NHOST_BACKEND_URL}}/v1/functions/payment-method-insert',
                headers: [
                  {
                    name: 'nhost-webhook-secret',
                    value_from_env: 'NHOST_WEBHOOK_SECRET',
                  },
                ],
              },
              {
                name: 'payment-method-insert-segment',
                definition: {
                  enable_manual: false,
                  insert: {
                    columns: '*',
                  },
                },
                retry_conf: {
                  interval_sec: 10,
                  num_retries: 0,
                  timeout_sec: 60,
                },
                webhook:
                  '{{NHOST_BACKEND_URL}}/v1/functions/events/payment-methods/insert/segment',
                headers: [
                  {
                    name: 'nhost-webhook-secret',
                    value_from_env: 'NHOST_WEBHOOK_SECRET',
                  },
                ],
              },
              {
                name: 'payment-method-update',
                definition: {
                  enable_manual: false,
                  update: {
                    columns: ['is_default'],
                  },
                },
                retry_conf: {
                  interval_sec: 10,
                  num_retries: 0,
                  timeout_sec: 60,
                },
                webhook:
                  '{{NHOST_BACKEND_URL}}/v1/functions/events/payment-methods/update/stripe',
                headers: [
                  {
                    name: 'nhost-webhook-secret',
                    value_from_env: 'NHOST_WEBHOOK_SECRET',
                  },
                ],
              },
            ],
          },
          {
            table: {
              name: 'plans',
              schema: 'public',
            },
            configuration: {
              column_config: {
                created_at: {
                  custom_name: 'createdAt',
                },
                feature_backup_enabled: {
                  custom_name: 'featureBackupEnabled',
                },
                feature_custom_domain_enabled: {
                  custom_name: 'featureCustomDomainsEnabled',
                },
                feature_custom_email_templates_enabled: {
                  custom_name: 'featureCustomEmailTemplatesEnabled',
                },
                feature_deploy_email_templates: {
                  custom_name: 'featureDeployEmailTemplates',
                },
                feature_function_execution_timeout: {
                  custom_name: 'featureFunctionExecutionTimeout',
                },
                feature_max_db_size: {
                  custom_name: 'featureMaxDbSize',
                },
                feature_max_files_size: {
                  custom_name: 'featureMaxFilesSize',
                },
                feature_max_number_of_functions_per_deployment: {
                  custom_name: 'featureMaxNumberOfFunctionsPerDeployment',
                },
                is_default: {
                  custom_name: 'isDefault',
                },
                is_free: {
                  custom_name: 'isFree',
                },
                is_public: {
                  custom_name: 'isPublic',
                },
                stripe_price_id: {
                  custom_name: 'stripePriceId',
                },
                updated_at: {
                  custom_name: 'upatedAt',
                },
              },
              custom_column_names: {
                created_at: 'createdAt',
                feature_backup_enabled: 'featureBackupEnabled',
                feature_custom_domain_enabled: 'featureCustomDomainsEnabled',
                feature_custom_email_templates_enabled:
                  'featureCustomEmailTemplatesEnabled',
                feature_deploy_email_templates: 'featureDeployEmailTemplates',
                feature_function_execution_timeout:
                  'featureFunctionExecutionTimeout',
                feature_max_db_size: 'featureMaxDbSize',
                feature_max_files_size: 'featureMaxFilesSize',
                feature_max_number_of_functions_per_deployment:
                  'featureMaxNumberOfFunctionsPerDeployment',
                is_default: 'isDefault',
                is_free: 'isFree',
                is_public: 'isPublic',
                stripe_price_id: 'stripePriceId',
                updated_at: 'upatedAt',
              },
              custom_root_fields: {
                delete: 'deletePlans',
                delete_by_pk: 'deletePlan',
                insert: 'insertPlans',
                insert_one: 'insertPlan',
                select: 'plans',
                select_aggregate: 'plansAggregate',
                select_by_pk: 'plan',
                update: 'updatePlans',
                update_by_pk: 'updatePlan',
              },
            },
            array_relationships: [
              {
                name: 'apps',
                using: {
                  foreign_key_constraint_on: {
                    column: 'plan_id',
                    table: {
                      name: 'apps',
                      schema: 'public',
                    },
                  },
                },
              },
            ],
            select_permissions: [
              {
                role: 'user',
                permission: {
                  columns: [
                    'created_at',
                    'feature_backup_enabled',
                    'feature_custom_domain_enabled',
                    'feature_custom_email_templates_enabled',
                    'feature_max_db_size',
                    'id',
                    'is_default',
                    'is_free',
                    'name',
                    'price',
                    'sort',
                    'updated_at',
                  ],
                  filter: {
                    _or: [
                      {
                        is_public: {
                          _eq: true,
                        },
                      },
                      {
                        apps: {
                          workspace: {
                            workspaceMembers: {
                              user_id: {
                                _eq: 'X-Hasura-User-Id',
                              },
                            },
                          },
                        },
                      },
                    ],
                  },
                  limit: 100,
                },
              },
            ],
          },
          {
            table: {
              name: 'regions',
              schema: 'public',
            },
            configuration: {
              column_config: {
                aws_name: {
                  custom_name: 'awsName',
                },
                city: {
                  custom_name: 'city',
                },
                country_code: {
                  custom_name: 'countryCode',
                },
                created_at: {
                  custom_name: 'createdAt',
                },
                id: {
                  custom_name: 'id',
                },
                is_gdpr_compliant: {
                  custom_name: 'isGdprCompliant',
                },
                updated_at: {
                  custom_name: 'updatedAt',
                },
              },
              custom_column_names: {
                aws_name: 'awsName',
                city: 'city',
                country_code: 'countryCode',
                created_at: 'createdAt',
                id: 'id',
                is_gdpr_compliant: 'isGdprCompliant',
                updated_at: 'updatedAt',
              },
              custom_root_fields: {},
            },
            object_relationships: [
              {
                name: 'country',
                using: {
                  foreign_key_constraint_on: 'country_code',
                },
              },
            ],
            array_relationships: [
              {
                name: 'apps',
                using: {
                  foreign_key_constraint_on: {
                    column: 'region_id',
                    table: {
                      name: 'apps',
                      schema: 'public',
                    },
                  },
                },
              },
            ],
            select_permissions: [
              {
                role: 'user',
                permission: {
                  columns: [
                    'active',
                    'aws_name',
                    'city',
                    'country_code',
                    'id',
                    'is_gdpr_compliant',
                  ],
                  filter: {},
                },
              },
            ],
          },
          {
            table: {
              name: 'workspace_member_invites',
              schema: 'public',
            },
            configuration: {
              column_config: {
                created_at: {
                  custom_name: 'createdAt',
                },
                email: {
                  custom_name: 'email',
                },
                id: {
                  custom_name: 'id',
                },
                invited_by_user_id: {
                  custom_name: 'invitedByUserId',
                },
                member_type: {
                  custom_name: 'memberType',
                },
                updated_at: {
                  custom_name: 'updatedAt',
                },
                workspace_id: {
                  custom_name: 'workspaceId',
                },
              },
              custom_column_names: {
                created_at: 'createdAt',
                email: 'email',
                id: 'id',
                invited_by_user_id: 'invitedByUserId',
                member_type: 'memberType',
                updated_at: 'updatedAt',
                workspace_id: 'workspaceId',
              },
              custom_name: 'workspaceMemberInvites',
              custom_root_fields: {
                delete: 'deleteWorkspaceMemberInvites',
                delete_by_pk: 'deleteWorkspaceMemberInvite',
                insert: 'insertWorkspaceMemberInvites',
                insert_one: 'insertWorkspaceMemberInvite',
                select: 'workspaceMemberInvites',
                select_aggregate: 'workspaceMemberInvitesAggregate',
                select_by_pk: 'workspaceMemberInvite',
                update: 'updateWorkspaceMemberInvites',
                update_by_pk: 'updateWorkspaceMemberInvite',
              },
            },
            object_relationships: [
              {
                name: 'invitedByUser',
                using: {
                  foreign_key_constraint_on: 'invited_by_user_id',
                },
              },
              {
                name: 'userByEmail',
                using: {
                  manual_configuration: {
                    column_mapping: {
                      email: 'email',
                    },
                    insertion_order: null,
                    remote_table: {
                      name: 'users',
                      schema: 'auth',
                    },
                  },
                },
              },
              {
                name: 'workspace',
                using: {
                  foreign_key_constraint_on: 'workspace_id',
                },
              },
            ],
            insert_permissions: [
              {
                role: 'user',
                permission: {
                  check: {
                    workspace: {
                      workspaceMembers: {
                        _and: [
                          {
                            user_id: {
                              _eq: 'X-Hasura-User-Id',
                            },
                          },
                          {
                            type: {
                              _eq: 'owner',
                            },
                          },
                        ],
                      },
                    },
                  },
                  set: {
                    invited_by_user_id: 'x-hasura-user-id',
                  },
                  columns: ['email', 'member_type', 'workspace_id'],
                },
              },
            ],
            select_permissions: [
              {
                role: 'user',
                permission: {
                  columns: [
                    'id',
                    'created_at',
                    'updated_at',
                    'workspace_id',
                    'email',
                    'member_type',
                    'invited_by_user_id',
                  ],
                  filter: {
                    _and: [
                      {
                        isAccepted: {
                          _is_null: true,
                        },
                      },
                      {
                        _or: [
                          {
                            workspace: {
                              workspaceMembers: {
                                user_id: {
                                  _eq: 'X-Hasura-User-Id',
                                },
                              },
                            },
                          },
                          {
                            userByEmail: {
                              id: {
                                _eq: 'X-Hasura-User-Id',
                              },
                            },
                          },
                        ],
                      },
                    ],
                  },
                },
              },
            ],
            update_permissions: [
              {
                role: 'user',
                permission: {
                  columns: ['member_type'],
                  filter: {
                    workspace: {
                      workspaceMembers: {
                        _and: [
                          {
                            user_id: {
                              _eq: 'X-Hasura-User-Id',
                            },
                          },
                          {
                            type: {
                              _eq: 'owner',
                            },
                          },
                        ],
                      },
                    },
                  },
                  check: null,
                },
              },
            ],
            delete_permissions: [
              {
                role: 'user',
                permission: {
                  backend_only: false,
                  filter: {
                    _or: [
                      {
                        workspace: {
                          workspaceMembers: {
                            _and: [
                              {
                                user_id: {
                                  _eq: 'X-Hasura-User-Id',
                                },
                              },
                              {
                                type: {
                                  _eq: 'owner',
                                },
                              },
                            ],
                          },
                        },
                      },
                      {
                        userByEmail: {
                          id: {
                            _eq: 'X-Hasura-User-Id',
                          },
                        },
                      },
                    ],
                  },
                },
              },
            ],
            event_triggers: [
              {
                name: 'workspace-member-invites-insert-email',
                definition: {
                  enable_manual: false,
                  insert: {
                    columns: '*',
                  },
                },
                retry_conf: {
                  interval_sec: 10,
                  num_retries: 0,
                  timeout_sec: 20,
                },
                webhook:
                  '{{NHOST_BACKEND_URL}}/v1/functions/events/workspace-member-invites/insert/email',
                headers: [
                  {
                    name: 'nhost-webhook-secret',
                    value_from_env: 'NHOST_WEBHOOK_SECRET',
                  },
                ],
              },
              {
                name: 'workspace-member-invites-insert-segment',
                definition: {
                  enable_manual: false,
                  insert: {
                    columns: '*',
                  },
                },
                retry_conf: {
                  interval_sec: 10,
                  num_retries: 0,
                  timeout_sec: 60,
                },
                webhook:
                  '{{NHOST_BACKEND_URL}}/v1/functions/events/workspace-member-invites/insert/segment',
                headers: [
                  {
                    name: 'nhost-webhook-secret',
                    value_from_env: 'NHOST_WEBHOOK_SECRET',
                  },
                ],
              },
            ],
          },
          {
            table: {
              name: 'workspace_members',
              schema: 'public',
            },
            configuration: {
              column_config: {
                created_at: {
                  custom_name: 'createdAt',
                },
                updated_at: {
                  custom_name: 'updatedAt',
                },
                user_id: {
                  custom_name: 'userId',
                },
                workspace_id: {
                  custom_name: 'workspaceId',
                },
              },
              custom_column_names: {
                created_at: 'createdAt',
                updated_at: 'updatedAt',
                user_id: 'userId',
                workspace_id: 'workspaceId',
              },
              custom_name: 'workspaceMembers',
              custom_root_fields: {
                delete: 'deleteWorkspaceMembers',
                delete_by_pk: 'deleteWorkspaceMember',
                insert: 'insertWorkspaceMembers',
                insert_one: 'insertWorkspaceMember',
                select: 'workspaceMembers',
                select_aggregate: 'workspaceMembersAggregate',
                select_by_pk: 'workspaceMember',
                update: 'updateWorkspaceMembers',
                update_by_pk: 'updateWorkspaceMember',
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
                name: 'workspace',
                using: {
                  foreign_key_constraint_on: 'workspace_id',
                },
              },
            ],
            insert_permissions: [
              {
                role: 'user',
                permission: {
                  check: {
                    _and: [
                      {
                        workspace: {
                          creator_user_id: {
                            _eq: 'X-Hasura-User-Id',
                          },
                        },
                      },
                      {
                        user_id: {
                          _eq: 'X-Hasura-User-Id',
                        },
                      },
                    ],
                  },
                  columns: ['type', 'user_id'],
                },
              },
            ],
            select_permissions: [
              {
                role: 'user',
                permission: {
                  columns: [
                    'id',
                    'created_at',
                    'updated_at',
                    'user_id',
                    'workspace_id',
                    'type',
                  ],
                  filter: {
                    workspace: {
                      workspaceMembers: {
                        user_id: {
                          _eq: 'X-Hasura-User-Id',
                        },
                      },
                    },
                  },
                },
              },
            ],
            update_permissions: [
              {
                role: 'user',
                permission: {
                  columns: ['type'],
                  filter: {
                    workspace: {
                      workspaceMembers: {
                        _and: [
                          {
                            user_id: {
                              _eq: 'X-Hasura-User-Id',
                            },
                          },
                          {
                            type: {
                              _eq: 'owner',
                            },
                          },
                        ],
                      },
                    },
                  },
                  check: null,
                },
              },
            ],
            delete_permissions: [
              {
                role: 'user',
                permission: {
                  backend_only: false,
                  filter: {
                    workspace: {
                      workspaceMembers: {
                        _and: [
                          {
                            user_id: {
                              _eq: 'X-Hasura-User-Id',
                            },
                          },
                          {
                            type: {
                              _eq: 'owner',
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              },
            ],
            event_triggers: [
              {
                name: 'workspace-members-delete-segment',
                definition: {
                  delete: {
                    columns: '*',
                  },
                  enable_manual: false,
                },
                retry_conf: {
                  interval_sec: 10,
                  num_retries: 0,
                  timeout_sec: 60,
                },
                webhook:
                  '{{NHOST_BACKEND_URL}}/v1/functions/events/workspace-members/delete/segment',
                headers: [
                  {
                    name: 'nhost-webhook-secret',
                    value_from_env: 'NHOST_WEBHOOK_SECRET',
                  },
                ],
              },
              {
                name: 'workspace-members-insert-segment',
                definition: {
                  enable_manual: false,
                  insert: {
                    columns: '*',
                  },
                },
                retry_conf: {
                  interval_sec: 10,
                  num_retries: 0,
                  timeout_sec: 60,
                },
                webhook:
                  '{{NHOST_BACKEND_URL}}/v1/functions/events/workspace-members/insert/segment',
                headers: [
                  {
                    name: 'nhost-webhook-secret',
                    value_from_env: 'NHOST_WEBHOOK_SECRET',
                  },
                ],
              },
            ],
          },
          {
            table: {
              name: 'workspaces',
              schema: 'public',
            },
            configuration: {
              column_config: {
                address_city: {
                  custom_name: 'addressCity',
                },
                address_country_code: {
                  custom_name: 'addressCountryCode',
                },
                address_line1: {
                  custom_name: 'addressLine1',
                },
                address_line2: {
                  custom_name: 'addressLine2',
                },
                address_postal_code: {
                  custom_name: 'addressPostalCode',
                },
                address_state: {
                  custom_name: 'addressState',
                },
                company_name: {
                  custom_name: 'companyName',
                },
                created_at: {
                  custom_name: 'createdAt',
                },
                creator_user_id: {
                  custom_name: 'creatorUserId',
                },
                email: {
                  custom_name: 'email',
                },
                name: {
                  custom_name: 'name',
                },
                stripe_customer_id: {
                  custom_name: 'stripeCustomerId',
                },
                tax_id_type: {
                  custom_name: 'taxIdType',
                },
                tax_id_value: {
                  custom_name: 'taxIdValue',
                },
                updated_at: {
                  custom_name: 'updatedAt',
                },
              },
              custom_column_names: {
                address_city: 'addressCity',
                address_country_code: 'addressCountryCode',
                address_line1: 'addressLine1',
                address_line2: 'addressLine2',
                address_postal_code: 'addressPostalCode',
                address_state: 'addressState',
                company_name: 'companyName',
                created_at: 'createdAt',
                creator_user_id: 'creatorUserId',
                email: 'email',
                name: 'name',
                stripe_customer_id: 'stripeCustomerId',
                tax_id_type: 'taxIdType',
                tax_id_value: 'taxIdValue',
                updated_at: 'updatedAt',
              },
              custom_root_fields: {
                delete: 'deleteWorkspaces',
                delete_by_pk: 'deleteWorkspace',
                insert: 'insertWorkspaces',
                insert_one: 'insertWorkspace',
                select: 'workspaces',
                select_aggregate: 'workspacesAggregate',
                select_by_pk: 'workspace',
                update: 'updateWorkspaces',
                update_by_pk: 'updateWorkspace',
              },
            },
            object_relationships: [
              {
                name: 'addressCountry',
                using: {
                  foreign_key_constraint_on: 'address_country_code',
                },
              },
              {
                name: 'creatorUser',
                using: {
                  foreign_key_constraint_on: 'creator_user_id',
                },
              },
              {
                name: 'paymentMethod',
                using: {
                  foreign_key_constraint_on: {
                    column: 'workspace_id',
                    table: {
                      name: 'payment_methods',
                      schema: 'public',
                    },
                  },
                },
              },
            ],
            array_relationships: [
              {
                name: 'apps',
                using: {
                  foreign_key_constraint_on: {
                    column: 'workspace_id',
                    table: {
                      name: 'apps',
                      schema: 'public',
                    },
                  },
                },
              },
              {
                name: 'paymentMethods',
                using: {
                  foreign_key_constraint_on: {
                    column: 'workspace_id',
                    table: {
                      name: 'payment_methods',
                      schema: 'public',
                    },
                  },
                },
              },
              {
                name: 'workspaceMemberInvites',
                using: {
                  foreign_key_constraint_on: {
                    column: 'workspace_id',
                    table: {
                      name: 'workspace_member_invites',
                      schema: 'public',
                    },
                  },
                },
              },
              {
                name: 'workspaceMembers',
                using: {
                  foreign_key_constraint_on: {
                    column: 'workspace_id',
                    table: {
                      name: 'workspace_members',
                      schema: 'public',
                    },
                  },
                },
              },
            ],
            insert_permissions: [
              {
                role: 'user',
                permission: {
                  check: {},
                  set: {
                    creator_user_id: 'x-hasura-user-id',
                  },
                  columns: ['company_name', 'email', 'id', 'name', 'slug'],
                },
              },
            ],
            select_permissions: [
              {
                role: 'user',
                permission: {
                  columns: [
                    'address_city',
                    'address_country_code',
                    'address_line1',
                    'address_line2',
                    'address_postal_code',
                    'address_state',
                    'company_name',
                    'created_at',
                    'creator_user_id',
                    'email',
                    'id',
                    'name',
                    'slug',
                    'tax_id_type',
                    'tax_id_value',
                    'updated_at',
                  ],
                  filter: {
                    _or: [
                      {
                        workspaceMembers: {
                          user_id: {
                            _eq: 'X-Hasura-User-Id',
                          },
                        },
                      },
                      {
                        workspaceMemberInvites: {
                          userByEmail: {
                            id: {
                              _eq: 'X-Hasura-User-Id',
                            },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            ],
            update_permissions: [
              {
                role: 'user',
                permission: {
                  columns: [
                    'address_city',
                    'address_country_code',
                    'address_line1',
                    'address_line2',
                    'address_postal_code',
                    'address_state',
                    'company_name',
                    'email',
                    'name',
                    'slug',
                    'tax_id_type',
                    'tax_id_value',
                  ],
                  filter: {
                    workspaceMembers: {
                      _and: [
                        {
                          type: {
                            _eq: 'owner',
                          },
                        },
                        {
                          user_id: {
                            _eq: 'X-Hasura-User-Id',
                          },
                        },
                      ],
                    },
                  },
                  check: null,
                },
              },
            ],
            delete_permissions: [
              {
                role: 'user',
                permission: {
                  backend_only: false,
                  filter: {
                    workspaceMembers: {
                      _and: [
                        {
                          type: {
                            _eq: 'owner',
                          },
                        },
                        {
                          user_id: {
                            _eq: 'X-Hasura-User-Id',
                          },
                        },
                      ],
                    },
                  },
                },
              },
            ],
            event_triggers: [
              {
                name: 'workspace-delete',
                definition: {
                  delete: {
                    columns: '*',
                  },
                  enable_manual: false,
                },
                retry_conf: {
                  interval_sec: 10,
                  num_retries: 0,
                  timeout_sec: 60,
                },
                webhook: '{{NHOST_BACKEND_URL}}/v1/functions/workspace-delete',
                headers: [
                  {
                    name: 'nhost-webhook-secret',
                    value_from_env: 'NHOST_WEBHOOK_SECRET',
                  },
                ],
              },
              {
                name: 'workspace-delete-segment',
                definition: {
                  delete: {
                    columns: '*',
                  },
                  enable_manual: false,
                },
                retry_conf: {
                  interval_sec: 10,
                  num_retries: 0,
                  timeout_sec: 60,
                },
                webhook:
                  '{{NHOST_BACKEND_URL}}/v1/functions/events/workspaces/delete/segment',
                headers: [
                  {
                    name: 'nhost-webhook-secret',
                    value_from_env: 'NHOST_WEBHOOK_SECRET',
                  },
                ],
              },
              {
                name: 'workspace-insert',
                definition: {
                  enable_manual: false,
                  insert: {
                    columns: '*',
                  },
                },
                retry_conf: {
                  interval_sec: 10,
                  num_retries: 0,
                  timeout_sec: 5,
                },
                webhook: '{{NHOST_BACKEND_URL}}/v1/functions/workspace-insert',
                headers: [
                  {
                    name: 'nhost-webhook-secret',
                    value_from_env: 'NHOST_WEBHOOK_SECRET',
                  },
                ],
              },
              {
                name: 'workspace-insert-segment',
                definition: {
                  enable_manual: false,
                  insert: {
                    columns: '*',
                  },
                },
                retry_conf: {
                  interval_sec: 10,
                  num_retries: 0,
                  timeout_sec: 60,
                },
                webhook:
                  '{{NHOST_BACKEND_URL}}/v1/functions/events/workspaces/insert/segment',
                headers: [
                  {
                    name: 'nhost-webhook-secret',
                    value_from_env: 'NHOST_WEBHOOK_SECRET',
                  },
                ],
              },
              {
                name: 'workspace-update-stripe-customer',
                definition: {
                  enable_manual: false,
                  update: {
                    columns: [
                      'company_name',
                      'email',
                      'name',
                      'address_line1',
                      'address_line2',
                      'address_city',
                      'address_state',
                      'address_country_code',
                      'address_postal_code',
                    ],
                  },
                },
                retry_conf: {
                  interval_sec: 10,
                  num_retries: 0,
                  timeout_sec: 60,
                },
                webhook:
                  '{{NHOST_BACKEND_URL}}/v1/functions/workspace-update-stripe-customer',
                headers: [
                  {
                    name: 'nhost-webhook-secret',
                    value_from_env: 'NHOST_WEBHOOK_SECRET',
                  },
                ],
              },
              {
                name: 'workspace-update-stripe-tax-id',
                definition: {
                  enable_manual: false,
                  update: {
                    columns: ['email', 'tax_id_type', 'tax_id_value'],
                  },
                },
                retry_conf: {
                  interval_sec: 10,
                  num_retries: 0,
                  timeout_sec: 60,
                },
                webhook:
                  '{{NHOST_BACKEND_URL}}/v1/functions/workspace-update-stripe-tax-id',
                headers: [
                  {
                    name: 'nhost-webhook-secret',
                    value_from_env: 'NHOST_WEBHOOK_SECRET',
                  },
                ],
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
              idle_timeout: 180,
              max_connections: 50,
              retries: 1,
            },
            use_prepared_statements: true,
          },
        },
      },
    ],
    remote_schemas: [
      {
        name: 'auxsvc',
        definition: {
          url_from_env: 'AUXSVC_ENDPOINT',
          timeout_seconds: 60,
          headers: [
            {
              name: 'NHOST_WEBHOOK_SECRET',
              value_from_env: 'NHOST_WEBHOOK_SECRET',
            },
          ],
          forward_client_headers: true,
        },
        comment: '',
        permissions: [
          {
            role: 'user',
            definition: {
              schema:
                'scalar timestamptz\n\nscalar uuid\n\ntype FunctionLogEntry { createdAt: timestamptz!\n  functionPath: String!\n  message: String!\n}\n\ntype Mutation { scheduleRestoreDatabaseBackup(appId: uuid!, backupId: uuid!): String!\n}\n\ntype Query { getFunctionLogs(subdomain: String!, functionPaths: [String!], startTime: timestamptz, endTime: timestamptz): [FunctionLogEntry!]!\n}',
            },
          },
        ],
      },
      {
        name: 'bragi',
        definition: {
          url_from_env: 'BRAGI_ENDPOINT',
          timeout_seconds: 600,
          headers: [
            {
              name: 'X-Nhost-Webhook-Secret',
              value_from_env: 'NHOST_WEBHOOK_SECRET',
            },
          ],
          forward_client_headers: true,
        },
        comment: '',
        permissions: [
          {
            role: 'user',
            definition: {
              schema:
                'scalar Timestamp\n\nscalar bigint\n\nscalar uuid\n\ntype BackupResult { backupID: uuid!\n  size: bigint!\n}\n\ntype Log { log: String!\n  service: String!\n  timestamp: Timestamp!\n}\n\ntype Mutation { backupApplicationDatabase(appID: String!): BackupResult!\n  resetPostgresPassword(appID: String!, newPassword: String!): Boolean!\n  restoreApplicationDatabase(appID: String!, backupID: String!): Boolean!\n}\n\ntype Query { logs(appID: String!, service: String, from: Timestamp, to: Timestamp): [Log!]!\n}',
            },
          },
        ],
      },
    ],
    allowlist: [
      {
        collection: 'allowed-queries',
        scope: {
          global: true,
        },
      },
    ],
    cron_triggers: [
      {
        name: 'auxsvc - pause inactive tenants',
        webhook: '{{AUXSVC_ENDPOINT}}',
        schedule: '0 3 * * *',
        include_in_metadata: true,
        payload: {
          query: 'mutation { pauseInactiveApps }',
        },
        retry_conf: {
          num_retries: 0,
          retry_interval_seconds: 10,
          timeout_seconds: 300,
          tolerance_seconds: 21600,
        },
        headers: [
          {
            name: 'NHOST_WEBHOOK_SECRET',
            value_from_env: 'NHOST_WEBHOOK_SECRET',
          },
          {
            name: 'X-GRAPHQL-PAYLOAD-JQ',
            value: '.payload',
          },
          {
            name: 'X-GRAPHQL-RETURN-ERROR-STATUS',
            value: 'true',
          },
          {
            name: 'X-Hasura-Role',
            value: 'admin',
          },
        ],
      },
      {
        name: 'auxsvc - sync backups',
        webhook: '{{AUXSVC_ENDPOINT}}',
        schedule: '30 3 * * *',
        include_in_metadata: true,
        payload: {
          query: 'mutation { syncDatabaseBackups }',
        },
        retry_conf: {
          num_retries: 0,
          retry_interval_seconds: 10,
          timeout_seconds: 300,
          tolerance_seconds: 21600,
        },
        headers: [
          {
            name: 'NHOST_WEBHOOK_SECRET',
            value_from_env: 'NHOST_WEBHOOK_SECRET',
          },
          {
            name: 'X-GRAPHQL-PAYLOAD-JQ',
            value: '.payload',
          },
          {
            name: 'X-GRAPHQL-RETURN-ERROR-STATUS',
            value: 'true',
          },
          {
            name: 'X-Hasura-Role',
            value: 'admin',
          },
        ],
      },
    ],
  },
};

export const patchMetadata = async () => {
  // * Export metadata
  try {
    await runMetadataRequest({
      type: 'export_metadata',
      args: {},
    });
  } catch {
    console.log('Impossible to export metadata');
  }

  //   TODO patch

  // * Apply metadata
  try {
    await runMetadataRequest({
      type: 'replace_metadata',
      args: {
        allow_inconsistent_metadata: true,
        metadata: target.metadata,
      },
    });
  } catch (e) {
    console.log('Impossible to replace metadata', e);
  }
};
