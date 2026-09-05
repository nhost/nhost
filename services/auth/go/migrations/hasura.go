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
			Type: pgTrackTable,
			Args: metadata.PgTrackTableArgs{ //nolint:exhaustruct
				Source: hasuraDBName,
				Table: metadata.Table{
					Schema: schemaAuth,
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
			Type:   pgTrackTable,
			IsEnum: true,
			Args: metadata.PgTrackTableArgs{ //nolint:exhaustruct
				Source: hasuraDBName,
				Table: metadata.Table{
					Schema: schemaAuth,
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
						Name: fieldRefreshTokens,
						Using: metadata.ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: metadata.ForeignKeyConstraintOn{
								Table: metadata.Table{
									Schema: schemaAuth,
									Name:   tableRefreshTokens,
								},
								Columns: []string{typeKey},
							},
						},
					},
				},
			},
		},
		{ //nolint:exhaustruct
			Type: pgTrackTable,
			Args: metadata.PgTrackTableArgs{ //nolint:exhaustruct
				Source: hasuraDBName,
				Table: metadata.Table{
					Schema: schemaAuth,
					Name:   tableRefreshTokens,
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
						colCreatedAt:         fieldCreatedAt,
						colExpiresAt:         fieldExpiresAt,
						colUserID:            fieldUserID,
					},
				},
				ObjectRelationships: []metadata.ObjectRelationshipConfig{
					{
						Name: roleUser,
						Using: metadata.ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: colUserID,
						},
					},
				},
			},
		},
		{ //nolint:exhaustruct
			Type: pgTrackTable,
			Args: metadata.PgTrackTableArgs{ //nolint:exhaustruct
				Source: hasuraDBName,
				Table: metadata.Table{
					Schema: schemaAuth,
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
						colRole: colRole,
					},
				},
				ArrayRelationships: []metadata.ArrayRelationshipConfig{
					{
						Name: "userRoles",
						Using: metadata.ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: metadata.ForeignKeyConstraintOn{
								Table: metadata.Table{
									Schema: schemaAuth,
									Name:   tableUserRoles,
								},
								Columns: []string{colRole},
							},
						},
					},
					{
						Name: "usersByDefaultRole",
						Using: metadata.ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: metadata.ForeignKeyConstraintOn{
								Table: metadata.Table{
									Schema: schemaAuth,
									Name:   tableUsers,
								},
								Columns: []string{colDefaultRole},
							},
						},
					},
				},
			},
		},
		{ //nolint:exhaustruct
			Type: pgTrackTable,
			Args: metadata.PgTrackTableArgs{ //nolint:exhaustruct
				Source: hasuraDBName,
				Table: metadata.Table{
					Schema: schemaAuth,
					Name:   tableUserProviders,
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
						colCreatedAt:       fieldCreatedAt,
						colUpdatedAt:       fieldUpdatedAt,
						colUserID:          fieldUserID,
						"access_token":     "accessToken",
						"refresh_token":    "refreshToken",
						colProviderID:      "providerId",
						"provider_user_id": "providerUserId",
					},
				},
				ObjectRelationships: []metadata.ObjectRelationshipConfig{
					{
						Name: roleUser,
						Using: metadata.ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: colUserID,
						},
					},
					{
						Name: "provider",
						Using: metadata.ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: colProviderID,
						},
					},
				},
			},
		},
		{ //nolint:exhaustruct
			Type: pgTrackTable,
			Args: metadata.PgTrackTableArgs{ //nolint:exhaustruct
				Source: hasuraDBName,
				Table: metadata.Table{
					Schema: schemaAuth,
					Name:   tableUserRoles,
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
						colCreatedAt: fieldCreatedAt,
						colUserID:    fieldUserID,
						colRole:      colRole,
					},
				},
				ObjectRelationships: []metadata.ObjectRelationshipConfig{
					{
						Name: roleUser,
						Using: metadata.ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: colUserID,
						},
					},
					{
						Name: "roleByRole",
						Using: metadata.ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: colRole,
						},
					},
				},
			},
		},
		{ //nolint:exhaustruct
			Type: pgTrackTable,
			Args: metadata.PgTrackTableArgs{
				Source: hasuraDBName,
				Table: metadata.Table{
					Schema: schemaAuth,
					Name:   tableUsers,
				},
				Configuration: metadata.Configuration{ //nolint:exhaustruct
					CustomName: tableUsers,
					CustomRootFields: metadata.CustomRootFields{ //nolint:exhaustruct
						Select:          tableUsers,
						SelectByPk:      roleUser,
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
						colCreatedAt:                 fieldCreatedAt,
						colUpdatedAt:                 fieldUpdatedAt,
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
						colDefaultRole:               "defaultRole",
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
							ForeignKeyConstraintOn: colDefaultRole,
						},
					},
				},
				ArrayRelationships: []metadata.ArrayRelationshipConfig{
					{
						Name: "userProviders",
						Using: metadata.ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: metadata.ForeignKeyConstraintOn{
								Table: metadata.Table{
									Schema: schemaAuth,
									Name:   tableUserProviders,
								},
								Columns: []string{colUserID},
							},
						},
					},
					{
						Name: "roles",
						Using: metadata.ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: metadata.ForeignKeyConstraintOn{
								Table: metadata.Table{
									Schema: schemaAuth,
									Name:   tableUserRoles,
								},
								Columns: []string{colUserID},
							},
						},
					},
					{
						Name: fieldRefreshTokens,
						Using: metadata.ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: metadata.ForeignKeyConstraintOn{
								Table: metadata.Table{
									Schema: schemaAuth,
									Name:   tableRefreshTokens,
								},
								Columns: []string{colUserID},
							},
						},
					},
					{
						Name: "securityKeys",
						Using: metadata.ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: metadata.ForeignKeyConstraintOn{
								Table: metadata.Table{
									Schema: schemaAuth,
									Name:   "user_security_keys",
								},
								Columns: []string{colUserID},
							},
						},
					},
					{
						Name: "oauth2AuthRequests",
						Using: metadata.ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: metadata.ForeignKeyConstraintOn{
								Table: metadata.Table{
									Schema: schemaAuth,
									Name:   tableOAuth2AuthRequests,
								},
								Columns: []string{colUserID},
							},
						},
					},
					{
						Name: "oauth2RefreshTokens",
						Using: metadata.ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: metadata.ForeignKeyConstraintOn{
								Table: metadata.Table{
									Schema: schemaAuth,
									Name:   tableOAuth2RefreshTokens,
								},
								Columns: []string{colUserID},
							},
						},
					},
				},
			},
		},
		{ //nolint:exhaustruct
			Type: pgTrackTable,
			Args: metadata.PgTrackTableArgs{ //nolint:exhaustruct
				Source: hasuraDBName,
				Table: metadata.Table{
					Schema: schemaAuth,
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
									Schema: schemaAuth,
									Name:   tableUserProviders,
								},
								Columns: []string{colProviderID},
							},
						},
					},
				},
			},
		},
		{ //nolint:exhaustruct
			Type: pgTrackTable,
			Args: metadata.PgTrackTableArgs{ //nolint:exhaustruct
				Source: hasuraDBName,
				Table: metadata.Table{
					Schema: schemaAuth,
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
					CustomColumnNames: map[string]string{ //nolint:gosec // G101: column-name mapping, not credentials
						"id":                    "id",
						colUserID:               fieldUserID,
						"credential_id":         "credentialId",
						"credential_public_key": "credentialPublicKey",
					},
				},
				ObjectRelationships: []metadata.ObjectRelationshipConfig{
					{
						Name: roleUser,
						Using: metadata.ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: colUserID,
						},
					},
				},
			},
		},
		{ //nolint:exhaustruct
			Type: pgTrackTable,
			Args: metadata.PgTrackTableArgs{
				Source: hasuraDBName,
				Table: metadata.Table{
					Schema: schemaAuth,
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
						colClientID:                    fieldClientID,
						"client_secret_hash":           "clientSecretHash",
						"redirect_uris":                "redirectUris",
						colScopes:                      colScopes,
						typeKey:                        typeKey,
						"metadata":                     "metadata",
						"metadata_document_fetched_at": "metadataDocumentFetchedAt",
						"created_by":                   "createdBy",
						colCreatedAt:                   fieldCreatedAt,
						colUpdatedAt:                   fieldUpdatedAt,
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
									Schema: schemaAuth,
									Name:   tableOAuth2AuthRequests,
								},
								Columns: []string{colClientID},
							},
						},
					},
					{
						Name: "oauth2RefreshTokens",
						Using: metadata.ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: metadata.ForeignKeyConstraintOn{
								Table: metadata.Table{
									Schema: schemaAuth,
									Name:   tableOAuth2RefreshTokens,
								},
								Columns: []string{colClientID},
							},
						},
					},
				},
			},
		},
		{ //nolint:exhaustruct
			Type: pgTrackTable,
			Args: metadata.PgTrackTableArgs{
				Source: hasuraDBName,
				Table: metadata.Table{
					Schema: schemaAuth,
					Name:   tableOAuth2AuthRequests,
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
						colClientID:             fieldClientID,
						colScopes:               colScopes,
						"redirect_uri":          "redirectUri",
						"state":                 "state",
						"nonce":                 "nonce",
						"response_type":         "responseType",
						"code_challenge":        "codeChallenge",
						"code_challenge_method": "codeChallengeMethod",
						"resource":              "resource",
						colUserID:               fieldUserID,
						"done":                  "done",
						"auth_time":             "authTime",
						colCreatedAt:            fieldCreatedAt,
						colExpiresAt:            fieldExpiresAt,
					},
				},
				ObjectRelationships: []metadata.ObjectRelationshipConfig{
					{
						Name: "client",
						Using: metadata.ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: colClientID,
						},
					},
					{
						Name: roleUser,
						Using: metadata.ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: colUserID,
						},
					},
				},
				ArrayRelationships: []metadata.ArrayRelationshipConfig{
					{
						Name: "authorizationCodes",
						Using: metadata.ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: metadata.ForeignKeyConstraintOn{
								Table: metadata.Table{
									Schema: schemaAuth,
									Name:   "oauth2_authorization_codes",
								},
								Columns: []string{colAuthRequestID},
							},
						},
					},
					{
						Name: fieldRefreshTokens,
						Using: metadata.ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: metadata.ForeignKeyConstraintOn{
								Table: metadata.Table{
									Schema: schemaAuth,
									Name:   tableOAuth2RefreshTokens,
								},
								Columns: []string{colAuthRequestID},
							},
						},
					},
				},
			},
		},
		{ //nolint:exhaustruct
			Type: pgTrackTable,
			Args: metadata.PgTrackTableArgs{ //nolint:exhaustruct
				Source: hasuraDBName,
				Table: metadata.Table{
					Schema: schemaAuth,
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
						"id":             "id",
						"code_hash":      "codeHash",
						colAuthRequestID: "authRequestId",
						colCreatedAt:     fieldCreatedAt,
						colExpiresAt:     fieldExpiresAt,
					},
				},
				ObjectRelationships: []metadata.ObjectRelationshipConfig{
					{
						Name: "authRequest",
						Using: metadata.ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: colAuthRequestID,
						},
					},
				},
			},
		},
		{ //nolint:exhaustruct
			Type: pgTrackTable,
			Args: metadata.PgTrackTableArgs{ //nolint:exhaustruct
				Source: hasuraDBName,
				Table: metadata.Table{
					Schema: schemaAuth,
					Name:   tableOAuth2RefreshTokens,
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
						"id":             "id",
						"token_hash":     "tokenHash",
						colAuthRequestID: "authRequestId",
						colClientID:      fieldClientID,
						colUserID:        fieldUserID,
						colScopes:        colScopes,
						colCreatedAt:     fieldCreatedAt,
						colExpiresAt:     fieldExpiresAt,
					},
				},
				ObjectRelationships: []metadata.ObjectRelationshipConfig{
					{
						Name: "authRequest",
						Using: metadata.ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: colAuthRequestID,
						},
					},
					{
						Name: "client",
						Using: metadata.ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: colClientID,
						},
					},
					{
						Name: roleUser,
						Using: metadata.ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: colUserID,
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

// Hasura metadata identifiers: schema/table/column names and camelCase field names.
const (
	schemaAuth               = "auth"
	colAuthRequestID         = "auth_request_id"
	fieldClientID            = "clientId"
	colClientID              = "client_id"
	fieldCreatedAt           = "createdAt"
	colCreatedAt             = "created_at"
	colDefaultRole           = "default_role"
	fieldExpiresAt           = "expiresAt"
	colExpiresAt             = "expires_at"
	tableOAuth2AuthRequests  = "oauth2_auth_requests"
	tableOAuth2RefreshTokens = "oauth2_refresh_tokens" //nolint:gosec // G101: table name, not a credential
	pgTrackTable             = "pg_track_table"
	colProviderID            = "provider_id"
	fieldRefreshTokens       = "refreshTokens"
	tableRefreshTokens       = "refresh_tokens"
	colRole                  = "role"
	colScopes                = "scopes"
	typeKey                  = "type"
	fieldUpdatedAt           = "updatedAt"
	colUpdatedAt             = "updated_at"
	roleUser                 = "user"
	fieldUserID              = "userId"
	colUserID                = "user_id"
	tableUserProviders       = "user_providers"
	tableUserRoles           = "user_roles"
	tableUsers               = "users"
)
