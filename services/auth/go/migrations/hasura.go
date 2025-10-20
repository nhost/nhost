package migrations

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	timeout                 = 10
	hasuraDBName            = "default"
	errorCodeAlreadyTracked = "already-tracked"
	errorCodeAlreadyExists  = "already-exists"
)

type hasuraErrResponse struct {
	Path  string `json:"path"`
	Error string `json:"error"`
	Code  string `json:"code"`
}

type metadataError struct {
	code string
	msg  string
}

func (e *metadataError) Error() string {
	return e.msg
}

func (e *metadataError) Code() string {
	return e.code
}

func postMetadata(ctx context.Context, url, hasuraSecret string, data any) error {
	client := &http.Client{ //nolint: exhaustruct
		Timeout: time.Second * timeout,
	}

	b, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("problem marshalling data: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(b))
	if err != nil {
		return fmt.Errorf("problem creating request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json; charset=UTF-8")
	req.Header.Set("X-Hasura-Admin-Secret", hasuraSecret)

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("problem executing request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errResponse *hasuraErrResponse

		b, _ := io.ReadAll(resp.Body)
		if err := json.Unmarshal(b, &errResponse); err != nil {
			return fmt.Errorf( //nolint: err113
				"status_code: %d\nresponse: %s",
				resp.StatusCode,
				b,
			)
		}

		if errResponse.Code == errorCodeAlreadyTracked ||
			errResponse.Code == errorCodeAlreadyExists {
			return &metadataError{
				code: errResponse.Code,
				msg:  errResponse.Error,
			}
		}

		return fmt.Errorf("status_code: %d\nresponse: %s", resp.StatusCode, b) //nolint: err113
	}

	return nil
}

type TrackTable struct {
	Type   string           `json:"type"`
	Args   PgTrackTableArgs `json:"args"`
	IsEnum bool             `json:"is_enum,omitempty"` //nolint: tagliatelle
}

type Table struct {
	Schema string `json:"schema"`
	Name   string `json:"name"`
}

type CustomRootFields struct {
	Select          string `json:"select"`
	SelectByPk      string `json:"select_by_pk"`     //nolint: tagliatelle
	SelectAggregate string `json:"select_aggregate"` //nolint: tagliatelle
	Insert          string `json:"insert"`
	InsertOne       string `json:"insert_one"` //nolint: tagliatelle
	Update          string `json:"update"`
	UpdateByPk      string `json:"update_by_pk"` //nolint: tagliatelle
	Delete          string `json:"delete"`
	DeleteByPk      string `json:"delete_by_pk"` //nolint: tagliatelle
}

type Configuration struct {
	CustomName        string            `json:"custom_name"`         //nolint: tagliatelle
	CustomRootFields  CustomRootFields  `json:"custom_root_fields"`  //nolint: tagliatelle
	CustomColumnNames map[string]string `json:"custom_column_names"` //nolint: tagliatelle
}

type PgTrackTableArgs struct {
	Source              string                     `json:"source"`
	Table               Table                      `json:"table"`
	Configuration       Configuration              `json:"configuration"`
	ObjectRelationships []ObjectRelationshipConfig `json:"object_relationships,omitempty"` //nolint: tagliatelle
	ArrayRelationships  []ArrayRelationshipConfig  `json:"array_relationships,omitempty"`  //nolint: tagliatelle
}

type ObjectRelationshipConfig struct {
	Name  string                        `json:"name"`
	Using ObjectRelationshipConfigUsing `json:"using"`
}

type ObjectRelationshipConfigUsing struct {
	ForeignKeyConstraintOn any `json:"foreign_key_constraint_on"` //nolint: tagliatelle
}

type ArrayRelationshipConfig struct {
	Name  string                       `json:"name"`
	Using ArrayRelationshipConfigUsing `json:"using"`
}

type ArrayRelationshipConfigUsing struct {
	ForeignKeyConstraintOn ForeignKeyConstraintOn `json:"foreign_key_constraint_on"` //nolint: tagliatelle
}

type CreateObjectRelationship struct {
	Type string                       `json:"type"`
	Args CreateObjectRelationshipArgs `json:"args"`
}

type CreateObjectRelationshipUsing struct {
	ForeignKeyConstraintOn []string `json:"foreign_key_constraint_on"` //nolint: tagliatelle
}

type CreateObjectRelationshipArgs struct {
	Table  Table                         `json:"table"`
	Name   string                        `json:"name"`
	Source string                        `json:"source"`
	Using  CreateObjectRelationshipUsing `json:"using"`
}

type CreateArrayRelationship struct {
	Type string                      `json:"type"`
	Args CreateArrayRelationshipArgs `json:"args"`
}

type ForeignKeyConstraintOn struct {
	Table   Table    `json:"table"`
	Columns []string `json:"columns"`
}

type CreateArrayRelationshipUsing struct {
	ForeignKeyConstraintOn ForeignKeyConstraintOn `json:"foreign_key_constraint_on"` //nolint: tagliatelle
}

type CreateArrayRelationshipArgs struct {
	Table  Table                        `json:"table"`
	Name   string                       `json:"name"`
	Source string                       `json:"source"`
	Using  CreateArrayRelationshipUsing `json:"using"`
}

type DropRelationship struct {
	Type string               `json:"type"`
	Args DropRelationshipArgs `json:"args"`
}

type DropRelationshipArgs struct {
	Table        string `json:"table"`
	Source       string `json:"source"`
	Cascade      bool   `json:"cascade"`
	Relationship string `json:"relationship"`
}

type SetTableCustomization struct {
	Type string                    `json:"type"`
	Args SetTableCustomizationArgs `json:"args"`
}

type SetTableCustomizationArgs struct {
	Source        string        `json:"source"`
	Table         Table         `json:"table"`
	Configuration Configuration `json:"configuration"`
}

func applyTableCustomization(
	ctx context.Context,
	url, hasuraSecret string,
	table TrackTable,
) error {
	customization := SetTableCustomization{
		Type: "pg_set_table_customization",
		Args: SetTableCustomizationArgs{
			Source:        table.Args.Source,
			Table:         table.Args.Table,
			Configuration: table.Args.Configuration,
		},
	}

	return postMetadata(ctx, url, hasuraSecret, customization)
}

func applyObjectRelationships(
	ctx context.Context,
	url, hasuraSecret string,
	table TrackTable,
) error {
	for _, rel := range table.Args.ObjectRelationships {
		relationship := CreateObjectRelationship{
			Type: "pg_create_object_relationship",
			Args: CreateObjectRelationshipArgs{
				Source: table.Args.Source,
				Table:  table.Args.Table,
				Name:   rel.Name,
				Using: CreateObjectRelationshipUsing{
					ForeignKeyConstraintOn: func() []string {
						// Handle both string and array cases
						switch v := rel.Using.ForeignKeyConstraintOn.(type) {
						case string:
							return []string{v}
						case []string:
							return v
						default:
							return []string{}
						}
					}(),
				},
			},
		}

		if err := postMetadata(ctx, url, hasuraSecret, relationship); err != nil {
			var metaErr *metadataError
			if ok := errors.As(err, &metaErr); ok && metaErr.Code() == errorCodeAlreadyExists {
				continue // Skip if relationship already exists
			}

			return fmt.Errorf(
				"problem creating object relationship %s for table %s.%s: %w",
				rel.Name,
				table.Args.Table.Schema,
				table.Args.Table.Name,
				err,
			)
		}
	}

	return nil
}

func applyArrayRelationships(
	ctx context.Context,
	url, hasuraSecret string,
	table TrackTable,
) error {
	for _, rel := range table.Args.ArrayRelationships {
		relationship := CreateArrayRelationship{
			Type: "pg_create_array_relationship",
			Args: CreateArrayRelationshipArgs{
				Source: table.Args.Source,
				Table:  table.Args.Table,
				Name:   rel.Name,
				Using: CreateArrayRelationshipUsing{
					ForeignKeyConstraintOn: rel.Using.ForeignKeyConstraintOn,
				},
			},
		}

		if err := postMetadata(ctx, url, hasuraSecret, relationship); err != nil {
			var metaErr *metadataError
			if ok := errors.As(err, &metaErr); ok && metaErr.Code() == errorCodeAlreadyExists {
				continue // Skip if relationship already exists
			}

			return fmt.Errorf(
				"problem creating array relationship %s for table %s.%s: %w",
				rel.Name,
				table.Args.Table.Schema,
				table.Args.Table.Name,
				err,
			)
		}
	}

	return nil
}

func updateHasuraMetadata(
	ctx context.Context,
	url, hasuraSecret string,
	table TrackTable,
) error {
	// Table already tracked, update customization and relationships
	if err := applyTableCustomization(ctx, url, hasuraSecret, table); err != nil {
		return fmt.Errorf(
			"problem updating customization for table %s.%s: %w",
			table.Args.Table.Schema,
			table.Args.Table.Name,
			err,
		)
	}

	if err := applyObjectRelationships(ctx, url, hasuraSecret, table); err != nil {
		return err
	}

	if err := applyArrayRelationships(ctx, url, hasuraSecret, table); err != nil {
		return err
	}

	return nil
}

func ApplyHasuraMetadata( //nolint: funlen,maintidx
	ctx context.Context,
	url, hasuraSecret string,
) error {
	authTables := []TrackTable{
		{ //nolint:exhaustruct
			Type: "pg_track_table",
			Args: PgTrackTableArgs{ //nolint:exhaustruct
				Source: hasuraDBName,
				Table: Table{
					Schema: "auth",
					Name:   "provider_requests",
				},
				Configuration: Configuration{
					CustomName: "authProviderRequests",
					CustomRootFields: CustomRootFields{
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
			Args: PgTrackTableArgs{ //nolint:exhaustruct
				Source: hasuraDBName,
				Table: Table{
					Schema: "auth",
					Name:   "refresh_token_types",
				},
				Configuration: Configuration{
					CustomName: "authRefreshTokenTypes",
					CustomRootFields: CustomRootFields{
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
				ArrayRelationships: []ArrayRelationshipConfig{
					{
						Name: "refreshTokens",
						Using: ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: ForeignKeyConstraintOn{
								Table: Table{
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
			Args: PgTrackTableArgs{ //nolint:exhaustruct
				Source: hasuraDBName,
				Table: Table{
					Schema: "auth",
					Name:   "refresh_tokens",
				},
				Configuration: Configuration{
					CustomName: "authRefreshTokens",
					CustomRootFields: CustomRootFields{
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
				ObjectRelationships: []ObjectRelationshipConfig{
					{
						Name: "user",
						Using: ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: "user_id",
						},
					},
				},
			},
		},
		{ //nolint:exhaustruct
			Type: "pg_track_table",
			Args: PgTrackTableArgs{ //nolint:exhaustruct
				Source: hasuraDBName,
				Table: Table{
					Schema: "auth",
					Name:   "roles",
				},
				Configuration: Configuration{
					CustomName: "authRoles",
					CustomRootFields: CustomRootFields{
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
				ArrayRelationships: []ArrayRelationshipConfig{
					{
						Name: "userRoles",
						Using: ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: ForeignKeyConstraintOn{
								Table: Table{
									Schema: "auth",
									Name:   "user_roles",
								},
								Columns: []string{"role"},
							},
						},
					},
					{
						Name: "usersByDefaultRole",
						Using: ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: ForeignKeyConstraintOn{
								Table: Table{
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
			Args: PgTrackTableArgs{ //nolint:exhaustruct
				Source: hasuraDBName,
				Table: Table{
					Schema: "auth",
					Name:   "user_providers",
				},
				Configuration: Configuration{
					CustomName: "authUserProviders",
					CustomRootFields: CustomRootFields{
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
				ObjectRelationships: []ObjectRelationshipConfig{
					{
						Name: "user",
						Using: ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: "user_id",
						},
					},
					{
						Name: "provider",
						Using: ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: "provider_id",
						},
					},
				},
			},
		},
		{ //nolint:exhaustruct
			Type: "pg_track_table",
			Args: PgTrackTableArgs{ //nolint:exhaustruct
				Source: hasuraDBName,
				Table: Table{
					Schema: "auth",
					Name:   "user_roles",
				},
				Configuration: Configuration{
					CustomName: "authUserRoles",
					CustomRootFields: CustomRootFields{
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
				ObjectRelationships: []ObjectRelationshipConfig{
					{
						Name: "user",
						Using: ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: "user_id",
						},
					},
					{
						Name: "roleByRole",
						Using: ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: "role",
						},
					},
				},
			},
		},
		{ //nolint:exhaustruct
			Type: "pg_track_table",
			Args: PgTrackTableArgs{
				Source: hasuraDBName,
				Table: Table{
					Schema: "auth",
					Name:   "users",
				},
				Configuration: Configuration{
					CustomName: "users",
					CustomRootFields: CustomRootFields{
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
				ObjectRelationships: []ObjectRelationshipConfig{
					{
						Name: "defaultRoleByRole",
						Using: ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: "default_role",
						},
					},
				},
				ArrayRelationships: []ArrayRelationshipConfig{
					{
						Name: "userProviders",
						Using: ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: ForeignKeyConstraintOn{
								Table: Table{
									Schema: "auth",
									Name:   "user_providers",
								},
								Columns: []string{"user_id"},
							},
						},
					},
					{
						Name: "roles",
						Using: ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: ForeignKeyConstraintOn{
								Table: Table{
									Schema: "auth",
									Name:   "user_roles",
								},
								Columns: []string{"user_id"},
							},
						},
					},
					{
						Name: "refreshTokens",
						Using: ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: ForeignKeyConstraintOn{
								Table: Table{
									Schema: "auth",
									Name:   "refresh_tokens",
								},
								Columns: []string{"user_id"},
							},
						},
					},
					{
						Name: "securityKeys",
						Using: ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: ForeignKeyConstraintOn{
								Table: Table{
									Schema: "auth",
									Name:   "user_security_keys",
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
			Args: PgTrackTableArgs{ //nolint:exhaustruct
				Source: hasuraDBName,
				Table: Table{
					Schema: "auth",
					Name:   "providers",
				},
				Configuration: Configuration{
					CustomName: "authProviders",
					CustomRootFields: CustomRootFields{
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
				ArrayRelationships: []ArrayRelationshipConfig{
					{
						Name: "userProviders",
						Using: ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: ForeignKeyConstraintOn{
								Table: Table{
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
			Args: PgTrackTableArgs{ //nolint:exhaustruct
				Source: hasuraDBName,
				Table: Table{
					Schema: "auth",
					Name:   "user_security_keys",
				},
				Configuration: Configuration{
					CustomName: "authUserSecurityKeys",
					CustomRootFields: CustomRootFields{
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
				ObjectRelationships: []ObjectRelationshipConfig{
					{
						Name: "user",
						Using: ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: "user_id",
						},
					},
				},
			},
		},
	}

	// Track each table with retry logic for already-tracked tables
	for _, table := range authTables {
		err := postMetadata(ctx, url, hasuraSecret, table)
		if err != nil {
			var metaErr *metadataError
			if ok := errors.As(err, &metaErr); ok && metaErr.Code() == errorCodeAlreadyTracked {
				// Table already tracked, update customization and relationships
				if err := updateHasuraMetadata(ctx, url, hasuraSecret, table); err != nil {
					return err
				}

				continue
			}

			return fmt.Errorf(
				"problem adding metadata for table %s.%s: %w",
				table.Args.Table.Schema,
				table.Args.Table.Name,
				err,
			)
		}
	}

	return nil
}
