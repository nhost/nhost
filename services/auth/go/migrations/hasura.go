package migrations

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/nhost/nhost/internal/lib/hasura/metadata"
)

const (
	hasuraDBName   = "default"
	defaultTimeout = 180 * time.Second
)

func authTables() []metadata.TrackTable { //nolint: funlen,maintidx
	return []metadata.TrackTable{
		{ //nolint:exhaustruct
			Type: "pg_track_table",
			Args: metadata.PgTrackTableArgs{ //nolint:exhaustruct
				Source: hasuraDBName,
				Table: metadata.Table{
					Schema: "auth",
					Name:   "provider_requests",
				},
				Configuration: metadata.Configuration{ //nolint:exhaustruct
					CustomName: "authProviderRequests",
					CustomRootFields: metadata.CustomRootFields{ //nolint:exhaustruct
						Select:          "authProviderRequests",
						SelectByPk:      "authProviderRequest",
						SelectAggregate: "authProviderRequestsAggregate",
						Insert:          "insertAuthProviderRequests",
						InsertOne:       "insertAuthProviderRequest",
						Update:          "updateAuthProviderRequests",
						UpdateByPk:      "updateAuthProviderRequest",
						Delete:          "deleteAuthProviderRequests",
						DeleteByPk:      "deleteAuthProviderRequest",
					},
					CustomColumnNames: map[string]string{
						"id":      "id",
						"options": "options",
					},
				},
			},
		},
		{
			Type:   "pg_track_table",
			IsEnum: true,
			Args: metadata.PgTrackTableArgs{ //nolint:exhaustruct
				Source: hasuraDBName,
				Table: metadata.Table{
					Schema: "auth",
					Name:   "refresh_token_types",
				},
				Configuration: metadata.Configuration{ //nolint:exhaustruct
					CustomName: "authRefreshTokenTypes",
					CustomRootFields: metadata.CustomRootFields{ //nolint:exhaustruct
						Select:          "authRefreshTokenTypes",
						SelectByPk:      "authRefreshTokenType",
						SelectAggregate: "authRefreshTokenTypesAggregate",
						Insert:          "insertAuthRefreshTokenTypes",
						InsertOne:       "insertAuthRefreshTokenType",
						Update:          "updateAuthRefreshTokenTypes",
						UpdateByPk:      "updateAuthRefreshTokenType",
						Delete:          "deleteAuthRefreshTokenTypes",
						DeleteByPk:      "deleteAuthRefreshTokenType",
					},
					CustomColumnNames: map[string]string{
						"value":   "value",
						"comment": "comment",
					},
				},
				ArrayRelationships: []metadata.ArrayRelationshipConfig{
					{
						Name: "refreshTokens",
						Using: metadata.ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: metadata.ForeignKeyConstraintOn{
								Table: metadata.Table{
									Schema: "auth",
									Name:   "refresh_tokens",
								},
								Columns: []string{"type"},
							},
						},
					},
				},
			},
		},
		{ //nolint:exhaustruct
			Type: "pg_track_table",
			Args: metadata.PgTrackTableArgs{ //nolint:exhaustruct
				Source: hasuraDBName,
				Table: metadata.Table{
					Schema: "auth",
					Name:   "refresh_tokens",
				},
				Configuration: metadata.Configuration{ //nolint:exhaustruct
					CustomName: "authRefreshTokens",
					CustomRootFields: metadata.CustomRootFields{ //nolint:exhaustruct
						Select:          "authRefreshTokens",
						SelectByPk:      "authRefreshToken",
						SelectAggregate: "authRefreshTokensAggregate",
						Insert:          "insertAuthRefreshTokens",
						InsertOne:       "insertAuthRefreshToken",
						Update:          "updateAuthRefreshTokens",
						UpdateByPk:      "updateAuthRefreshToken",
						Delete:          "deleteAuthRefreshTokens",
						DeleteByPk:      "deleteAuthRefreshToken",
					},
					CustomColumnNames: map[string]string{
						"refresh_token_hash": "refreshTokenHash",
						"created_at":         "createdAt",
						"expires_at":         "expiresAt",
						"user_id":            "userId",
					},
				},
				ObjectRelationships: []metadata.ObjectRelationshipConfig{
					{
						Name: "user",
						Using: metadata.ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: "user_id",
						},
					},
				},
			},
		},
		{ //nolint:exhaustruct
			Type: "pg_track_table",
			Args: metadata.PgTrackTableArgs{ //nolint:exhaustruct
				Source: hasuraDBName,
				Table: metadata.Table{
					Schema: "auth",
					Name:   "roles",
				},
				Configuration: metadata.Configuration{ //nolint:exhaustruct
					CustomName: "authRoles",
					CustomRootFields: metadata.CustomRootFields{ //nolint:exhaustruct
						Select:          "authRoles",
						SelectByPk:      "authRole",
						SelectAggregate: "authRolesAggregate",
						Insert:          "insertAuthRoles",
						InsertOne:       "insertAuthRole",
						Update:          "updateAuthRoles",
						UpdateByPk:      "updateAuthRole",
						Delete:          "deleteAuthRoles",
						DeleteByPk:      "deleteAuthRole",
					},
					CustomColumnNames: map[string]string{
						"role": "role",
					},
				},
				ArrayRelationships: []metadata.ArrayRelationshipConfig{
					{
						Name: "userRoles",
						Using: metadata.ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: metadata.ForeignKeyConstraintOn{
								Table: metadata.Table{
									Schema: "auth",
									Name:   "user_roles",
								},
								Columns: []string{"role"},
							},
						},
					},
					{
						Name: "usersByDefaultRole",
						Using: metadata.ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: metadata.ForeignKeyConstraintOn{
								Table: metadata.Table{
									Schema: "auth",
									Name:   "users",
								},
								Columns: []string{"default_role"},
							},
						},
					},
				},
			},
		},
		{ //nolint:exhaustruct
			Type: "pg_track_table",
			Args: metadata.PgTrackTableArgs{ //nolint:exhaustruct
				Source: hasuraDBName,
				Table: metadata.Table{
					Schema: "auth",
					Name:   "user_providers",
				},
				Configuration: metadata.Configuration{ //nolint:exhaustruct
					CustomName: "authUserProviders",
					CustomRootFields: metadata.CustomRootFields{ //nolint:exhaustruct
						Select:          "authUserProviders",
						SelectByPk:      "authUserProvider",
						SelectAggregate: "authUserProvidersAggregate",
						Insert:          "insertAuthUserProviders",
						InsertOne:       "insertAuthUserProvider",
						Update:          "updateAuthUserProviders",
						UpdateByPk:      "updateAuthUserProvider",
						Delete:          "deleteAuthUserProviders",
						DeleteByPk:      "deleteAuthUserProvider",
					},
					CustomColumnNames: map[string]string{
						"id":               "id",
						"created_at":       "createdAt",
						"updated_at":       "updatedAt",
						"user_id":          "userId",
						"access_token":     "accessToken",
						"refresh_token":    "refreshToken",
						"provider_id":      "providerId",
						"provider_user_id": "providerUserId",
					},
				},
				ObjectRelationships: []metadata.ObjectRelationshipConfig{
					{
						Name: "user",
						Using: metadata.ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: "user_id",
						},
					},
					{
						Name: "provider",
						Using: metadata.ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: "provider_id",
						},
					},
				},
			},
		},
		{ //nolint:exhaustruct
			Type: "pg_track_table",
			Args: metadata.PgTrackTableArgs{ //nolint:exhaustruct
				Source: hasuraDBName,
				Table: metadata.Table{
					Schema: "auth",
					Name:   "user_roles",
				},
				Configuration: metadata.Configuration{ //nolint:exhaustruct
					CustomName: "authUserRoles",
					CustomRootFields: metadata.CustomRootFields{ //nolint:exhaustruct
						Select:          "authUserRoles",
						SelectByPk:      "authUserRole",
						SelectAggregate: "authUserRolesAggregate",
						Insert:          "insertAuthUserRoles",
						InsertOne:       "insertAuthUserRole",
						Update:          "updateAuthUserRoles",
						UpdateByPk:      "updateAuthUserRole",
						Delete:          "deleteAuthUserRoles",
						DeleteByPk:      "deleteAuthUserRole",
					},
					CustomColumnNames: map[string]string{
						"id":         "id",
						"created_at": "createdAt",
						"user_id":    "userId",
						"role":       "role",
					},
				},
				ObjectRelationships: []metadata.ObjectRelationshipConfig{
					{
						Name: "user",
						Using: metadata.ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: "user_id",
						},
					},
					{
						Name: "roleByRole",
						Using: metadata.ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: "role",
						},
					},
				},
			},
		},
		{ //nolint:exhaustruct
			Type: "pg_track_table",
			Args: metadata.PgTrackTableArgs{
				Source: hasuraDBName,
				Table: metadata.Table{
					Schema: "auth",
					Name:   "users",
				},
				Configuration: metadata.Configuration{ //nolint:exhaustruct
					CustomName: "users",
					CustomRootFields: metadata.CustomRootFields{ //nolint:exhaustruct
						Select:          "users",
						SelectByPk:      "user",
						SelectAggregate: "usersAggregate",
						Insert:          "insertUsers",
						InsertOne:       "insertUser",
						Update:          "updateUsers",
						UpdateByPk:      "updateUser",
						Delete:          "deleteUsers",
						DeleteByPk:      "deleteUser",
					},
					CustomColumnNames: map[string]string{
						"id":                         "id",
						"created_at":                 "createdAt",
						"updated_at":                 "updatedAt",
						"last_seen":                  "lastSeen",
						"disabled":                   "disabled",
						"display_name":               "displayName",
						"avatar_url":                 "avatarUrl",
						"locale":                     "locale",
						"email":                      "email",
						"phone_number":               "phoneNumber",
						"password_hash":              "passwordHash",
						"email_verified":             "emailVerified",
						"phone_number_verified":      "phoneNumberVerified",
						"new_email":                  "newEmail",
						"otp_method_last_used":       "otpMethodLastUsed",
						"otp_hash":                   "otpHash",
						"otp_hash_expires_at":        "otpHashExpiresAt",
						"default_role":               "defaultRole",
						"is_anonymous":               "isAnonymous",
						"totp_secret":                "totpSecret",
						"active_mfa_type":            "activeMfaType",
						"ticket":                     "ticket",
						"ticket_expires_at":          "ticketExpiresAt",
						"webauthn_current_challenge": "currentChallenge",
					},
				},
				ObjectRelationships: []metadata.ObjectRelationshipConfig{
					{
						Name: "defaultRoleByRole",
						Using: metadata.ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: "default_role",
						},
					},
				},
				ArrayRelationships: []metadata.ArrayRelationshipConfig{
					{
						Name: "userProviders",
						Using: metadata.ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: metadata.ForeignKeyConstraintOn{
								Table: metadata.Table{
									Schema: "auth",
									Name:   "user_providers",
								},
								Columns: []string{"user_id"},
							},
						},
					},
					{
						Name: "roles",
						Using: metadata.ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: metadata.ForeignKeyConstraintOn{
								Table: metadata.Table{
									Schema: "auth",
									Name:   "user_roles",
								},
								Columns: []string{"user_id"},
							},
						},
					},
					{
						Name: "refreshTokens",
						Using: metadata.ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: metadata.ForeignKeyConstraintOn{
								Table: metadata.Table{
									Schema: "auth",
									Name:   "refresh_tokens",
								},
								Columns: []string{"user_id"},
							},
						},
					},
					{
						Name: "securityKeys",
						Using: metadata.ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: metadata.ForeignKeyConstraintOn{
								Table: metadata.Table{
									Schema: "auth",
									Name:   "user_security_keys",
								},
								Columns: []string{"user_id"},
							},
						},
					},
					{
						Name: "oauth2AuthRequests",
						Using: metadata.ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: metadata.ForeignKeyConstraintOn{
								Table: metadata.Table{
									Schema: "auth",
									Name:   "oauth2_auth_requests",
								},
								Columns: []string{"user_id"},
							},
						},
					},
					{
						Name: "oauth2RefreshTokens",
						Using: metadata.ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: metadata.ForeignKeyConstraintOn{
								Table: metadata.Table{
									Schema: "auth",
									Name:   "oauth2_refresh_tokens",
								},
								Columns: []string{"user_id"},
							},
						},
					},
				},
			},
		},
		{ //nolint:exhaustruct
			Type: "pg_track_table",
			Args: metadata.PgTrackTableArgs{ //nolint:exhaustruct
				Source: hasuraDBName,
				Table: metadata.Table{
					Schema: "auth",
					Name:   "providers",
				},
				Configuration: metadata.Configuration{ //nolint:exhaustruct
					CustomName: "authProviders",
					CustomRootFields: metadata.CustomRootFields{ //nolint:exhaustruct
						Select:          "authProviders",
						SelectByPk:      "authProvider",
						SelectAggregate: "authProvidersAggregate",
						Insert:          "insertAuthProviders",
						InsertOne:       "insertAuthProvider",
						Update:          "updateAuthProviders",
						UpdateByPk:      "updateAuthProvider",
						Delete:          "deleteAuthProviders",
						DeleteByPk:      "deleteAuthProvider",
					},
					CustomColumnNames: map[string]string{
						"id": "id",
					},
				},
				ArrayRelationships: []metadata.ArrayRelationshipConfig{
					{
						Name: "userProviders",
						Using: metadata.ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: metadata.ForeignKeyConstraintOn{
								Table: metadata.Table{
									Schema: "auth",
									Name:   "user_providers",
								},
								Columns: []string{"provider_id"},
							},
						},
					},
				},
			},
		},
		{ //nolint:exhaustruct
			Type: "pg_track_table",
			Args: metadata.PgTrackTableArgs{ //nolint:exhaustruct
				Source: hasuraDBName,
				Table: metadata.Table{
					Schema: "auth",
					Name:   "user_security_keys",
				},
				Configuration: metadata.Configuration{ //nolint:exhaustruct
					CustomName: "authUserSecurityKeys",
					CustomRootFields: metadata.CustomRootFields{ //nolint:exhaustruct
						Select:          "authUserSecurityKeys",
						SelectByPk:      "authUserSecurityKey",
						SelectAggregate: "authUserSecurityKeysAggregate",
						Insert:          "insertAuthUserSecurityKeys",
						InsertOne:       "insertAuthUserSecurityKey",
						Update:          "updateAuthUserSecurityKeys",
						UpdateByPk:      "updateAuthUserSecurityKey",
						Delete:          "deleteAuthUserSecurityKeys",
						DeleteByPk:      "deleteAuthUserSecurityKey",
					},
					CustomColumnNames: map[string]string{
						"id":                    "id",
						"user_id":               "userId",
						"credential_id":         "credentialId",
						"credential_public_key": "credentialPublicKey",
					},
				},
				ObjectRelationships: []metadata.ObjectRelationshipConfig{
					{
						Name: "user",
						Using: metadata.ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: "user_id",
						},
					},
				},
			},
		},
		{ //nolint:exhaustruct
			Type: "pg_track_table",
			Args: metadata.PgTrackTableArgs{
				Source: hasuraDBName,
				Table: metadata.Table{
					Schema: "auth",
					Name:   "oauth2_clients",
				},
				Configuration: metadata.Configuration{ //nolint:exhaustruct
					CustomName: "authOauth2Clients",
					CustomRootFields: metadata.CustomRootFields{ //nolint:exhaustruct
						Select:          "authOauth2Clients",
						SelectByPk:      "authOauth2Client",
						SelectAggregate: "authOauth2ClientsAggregate",
						Insert:          "insertAuthOauth2Clients",
						InsertOne:       "insertAuthOauth2Client",
						Update:          "updateAuthOauth2Clients",
						UpdateByPk:      "updateAuthOauth2Client",
						Delete:          "deleteAuthOauth2Clients",
						DeleteByPk:      "deleteAuthOauth2Client",
					},
					CustomColumnNames: map[string]string{
						"client_id":                    "clientId",
						"client_secret_hash":           "clientSecretHash",
						"redirect_uris":                "redirectUris",
						"scopes":                       "scopes",
						"type":                         "type",
						"metadata":                     "metadata",
						"metadata_document_fetched_at": "metadataDocumentFetchedAt",
						"created_by":                   "createdBy",
						"created_at":                   "createdAt",
						"updated_at":                   "updatedAt",
					},
				},
				ObjectRelationships: []metadata.ObjectRelationshipConfig{
					{
						Name: "createdByUser",
						Using: metadata.ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: "created_by",
						},
					},
				},
				ArrayRelationships: []metadata.ArrayRelationshipConfig{
					{
						Name: "authRequests",
						Using: metadata.ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: metadata.ForeignKeyConstraintOn{
								Table: metadata.Table{
									Schema: "auth",
									Name:   "oauth2_auth_requests",
								},
								Columns: []string{"client_id"},
							},
						},
					},
					{
						Name: "oauth2RefreshTokens",
						Using: metadata.ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: metadata.ForeignKeyConstraintOn{
								Table: metadata.Table{
									Schema: "auth",
									Name:   "oauth2_refresh_tokens",
								},
								Columns: []string{"client_id"},
							},
						},
					},
				},
			},
		},
		{ //nolint:exhaustruct
			Type: "pg_track_table",
			Args: metadata.PgTrackTableArgs{
				Source: hasuraDBName,
				Table: metadata.Table{
					Schema: "auth",
					Name:   "oauth2_auth_requests",
				},
				Configuration: metadata.Configuration{ //nolint:exhaustruct
					CustomName: "authOauth2AuthRequests",
					CustomRootFields: metadata.CustomRootFields{ //nolint:exhaustruct
						Select:          "authOauth2AuthRequests",
						SelectByPk:      "authOauth2AuthRequest",
						SelectAggregate: "authOauth2AuthRequestsAggregate",
						Insert:          "insertAuthOauth2AuthRequests",
						InsertOne:       "insertAuthOauth2AuthRequest",
						Update:          "updateAuthOauth2AuthRequests",
						UpdateByPk:      "updateAuthOauth2AuthRequest",
						Delete:          "deleteAuthOauth2AuthRequests",
						DeleteByPk:      "deleteAuthOauth2AuthRequest",
					},
					CustomColumnNames: map[string]string{
						"id":                    "id",
						"client_id":             "clientId",
						"scopes":                "scopes",
						"redirect_uri":          "redirectUri",
						"state":                 "state",
						"nonce":                 "nonce",
						"response_type":         "responseType",
						"code_challenge":        "codeChallenge",
						"code_challenge_method": "codeChallengeMethod",
						"resource":              "resource",
						"user_id":               "userId",
						"done":                  "done",
						"auth_time":             "authTime",
						"created_at":            "createdAt",
						"expires_at":            "expiresAt",
					},
				},
				ObjectRelationships: []metadata.ObjectRelationshipConfig{
					{
						Name: "client",
						Using: metadata.ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: "client_id",
						},
					},
					{
						Name: "user",
						Using: metadata.ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: "user_id",
						},
					},
				},
				ArrayRelationships: []metadata.ArrayRelationshipConfig{
					{
						Name: "authorizationCodes",
						Using: metadata.ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: metadata.ForeignKeyConstraintOn{
								Table: metadata.Table{
									Schema: "auth",
									Name:   "oauth2_authorization_codes",
								},
								Columns: []string{"auth_request_id"},
							},
						},
					},
					{
						Name: "refreshTokens",
						Using: metadata.ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: metadata.ForeignKeyConstraintOn{
								Table: metadata.Table{
									Schema: "auth",
									Name:   "oauth2_refresh_tokens",
								},
								Columns: []string{"auth_request_id"},
							},
						},
					},
				},
			},
		},
		{ //nolint:exhaustruct
			Type: "pg_track_table",
			Args: metadata.PgTrackTableArgs{ //nolint:exhaustruct
				Source: hasuraDBName,
				Table: metadata.Table{
					Schema: "auth",
					Name:   "oauth2_authorization_codes",
				},
				Configuration: metadata.Configuration{ //nolint:exhaustruct
					CustomName: "authOauth2AuthorizationCodes",
					CustomRootFields: metadata.CustomRootFields{ //nolint:exhaustruct
						Select:          "authOauth2AuthorizationCodes",
						SelectByPk:      "authOauth2AuthorizationCode",
						SelectAggregate: "authOauth2AuthorizationCodesAggregate",
						Insert:          "insertAuthOauth2AuthorizationCodes",
						InsertOne:       "insertAuthOauth2AuthorizationCode",
						Update:          "updateAuthOauth2AuthorizationCodes",
						UpdateByPk:      "updateAuthOauth2AuthorizationCode",
						Delete:          "deleteAuthOauth2AuthorizationCodes",
						DeleteByPk:      "deleteAuthOauth2AuthorizationCode",
					},
					CustomColumnNames: map[string]string{
						"id":              "id",
						"code_hash":       "codeHash",
						"auth_request_id": "authRequestId",
						"created_at":      "createdAt",
						"expires_at":      "expiresAt",
					},
				},
				ObjectRelationships: []metadata.ObjectRelationshipConfig{
					{
						Name: "authRequest",
						Using: metadata.ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: "auth_request_id",
						},
					},
				},
			},
		},
		{ //nolint:exhaustruct
			Type: "pg_track_table",
			Args: metadata.PgTrackTableArgs{ //nolint:exhaustruct
				Source: hasuraDBName,
				Table: metadata.Table{
					Schema: "auth",
					Name:   "oauth2_refresh_tokens",
				},
				Configuration: metadata.Configuration{ //nolint:exhaustruct
					CustomName: "authOauth2RefreshTokens",
					CustomRootFields: metadata.CustomRootFields{ //nolint:exhaustruct
						Select:          "authOauth2RefreshTokens",
						SelectByPk:      "authOauth2RefreshToken",
						SelectAggregate: "authOauth2RefreshTokensAggregate",
						Insert:          "insertAuthOauth2RefreshTokens",
						InsertOne:       "insertAuthOauth2RefreshToken",
						Update:          "updateAuthOauth2RefreshTokens",
						UpdateByPk:      "updateAuthOauth2RefreshToken",
						Delete:          "deleteAuthOauth2RefreshTokens",
						DeleteByPk:      "deleteAuthOauth2RefreshToken",
					},
					CustomColumnNames: map[string]string{
						"id":              "id",
						"token_hash":      "tokenHash",
						"auth_request_id": "authRequestId",
						"client_id":       "clientId",
						"user_id":         "userId",
						"scopes":          "scopes",
						"created_at":      "createdAt",
						"expires_at":      "expiresAt",
					},
				},
				ObjectRelationships: []metadata.ObjectRelationshipConfig{
					{
						Name: "authRequest",
						Using: metadata.ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: "auth_request_id",
						},
					},
					{
						Name: "client",
						Using: metadata.ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: "client_id",
						},
					},
					{
						Name: "user",
						Using: metadata.ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: "user_id",
						},
					},
				},
			},
		},
	}
}

func ApplyHasuraMetadata(
	ctx context.Context,
	url, hasuraSecret string,
	logger *slog.Logger,
) error {
	cfg := metadata.Config{
		URL:         url,
		AdminSecret: hasuraSecret,
		DBName:      hasuraDBName,
		Timeout:     defaultTimeout,
	}

	if err := metadata.ApplyMetadata(ctx, cfg, authTables(), logger); err != nil {
		return fmt.Errorf("applying Hasura metadata: %w", err)
	}

	return nil
}
