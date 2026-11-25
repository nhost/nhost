package autoai_test

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"strings"
	"testing"

	"github.com/gqlgo/gqlgenc/clientv2"
	"github.com/nhost/nhost/services/ai/autoai"
	"github.com/nhost/nhost/services/ai/autoai/embedder"
	"github.com/nhost/nhost/services/ai/autoai/mock"
	"github.com/nhost/nhost/services/ai/hasura"
	"go.uber.org/mock/gomock"
)

var errCatalogUnavailable = errors.New("private database detail")

func deploymentConfig() *hasura.AiAutoEmbeddingsConfigurationFragment {
	return &hasura.AiAutoEmbeddingsConfigurationFragment{
		ID:         "11111111-1111-1111-1111-111111111111",
		Name:       "documents",
		SchemaName: "public",
		TableName:  "documents",
		ColumnName: "embedding",
		Provider:   "local",
		Dimensions: 2,
		Model:      "local",
	}
}

func expectValidTarget(catalog *mock.MockCatalog) {
	catalog.EXPECT().
		PrimaryKey(gomock.Any(), "public", "documents").
		Return([]hasura.PKInformation{{ColumnName: "id", DataType: "integer"}}, nil)
	catalog.EXPECT().
		VectorColumn(gomock.Any(), "public", "documents", "embedding").
		Return("vector", 2, nil)
}

func newAI(client autoai.HasuraClient, catalog autoai.Catalog) *autoai.AutoAI {
	return autoai.NewAutoAI(
		client,
		catalog,
		embedder.Registry{"local": nil},
		"http://ai",
		// Contains the default body delimiter, so rendering must pick another.
		"webhook-secret$function$",
	)
}

func TestValidateConfiguration(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name, provider, configName, typ, message string
		keys, dimensions                         int
		keyErr, columnErr                        error
		inspection                               bool
	}{
		{name: "valid", provider: "local", keys: 1, typ: "vector", dimensions: 2},
		{name: "unsized vector", provider: "local", keys: 1, typ: "vector", dimensions: -1},
		{
			name:       "name too long",
			configName: strings.Repeat("a", 53),
			message:    "name must be at most 52 bytes",
		},
		{name: "undeclared provider", provider: "absent", message: "provider is not declared"},
		{
			name:     "composite primary key",
			provider: "local",
			keys:     2,
			message:  "exactly one primary key",
		},
		{
			name:      "missing column",
			provider:  "local",
			keys:      1,
			columnErr: sql.ErrNoRows,
			message:   "column does not exist",
		},
		{
			name:       "not vector",
			provider:   "local",
			keys:       1,
			typ:        "text",
			dimensions: 2,
			message:    "must have type vector",
		},
		{
			name:       "dimension mismatch",
			provider:   "local",
			keys:       1,
			typ:        "vector",
			dimensions: 3,
			message:    "dimensions do not match",
		},
		{
			name:       "catalog read failure",
			provider:   "local",
			keyErr:     errCatalogUnavailable,
			message:    "could not inspect primary key",
			inspection: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			catalog := mock.NewMockCatalog(gomock.NewController(t))
			config := deploymentConfig()
			config.Provider = tt.provider

			if tt.configName != "" {
				config.Name = tt.configName
			}

			if tt.provider == "local" {
				catalog.EXPECT().
					PrimaryKey(gomock.Any(), "public", "documents").
					Return(make([]hasura.PKInformation, tt.keys), tt.keyErr)

				if tt.keys == 1 {
					catalog.EXPECT().
						VectorColumn(gomock.Any(), "public", "documents", "embedding").
						Return(tt.typ, tt.dimensions, tt.columnErr)
				}
			}

			err := newAI(nil, catalog).ValidateConfiguration(t.Context(), config)
			if tt.message == "" {
				if err != nil {
					t.Fatal(err)
				}

				return
			}

			var marker interface{ InspectionFailure() }
			if errors.As(err, &marker) != tt.inspection ||
				errors.Is(err, autoai.ErrInvalidConfiguration) == tt.inspection ||
				!strings.HasPrefix(err.Error(), "deploy: ") ||
				!strings.Contains(err.Error(), tt.message) ||
				strings.Contains(err.Error(), "private") {
				t.Fatalf("unexpected validation result: %v", err)
			}
		})
	}
}

func TestDeploy(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name                 string
		sqlFails, trackFails bool
		wantError            string
	}{
		{name: "success"},
		{name: "SQL failure", sqlFails: true, wantError: "postgres-error"},
		{name: "untracked table", trackFails: true, wantError: "target table must be tracked"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			catalog := mock.NewMockCatalog(ctrl)
			client := mock.NewMockHasuraClient(ctrl)
			config := deploymentConfig()

			expectValidTarget(catalog)
			client.EXPECT().
				RunSQL(gomock.Any(), gomock.Any(), false).
				DoAndReturn(func(_ context.Context, code string, _ bool) (*hasura.RunSQLResponse, error) {
					// Both functions and their ownership tags go in one transaction,
					// and search sends only the configuration id and the query.
					if strings.Count(code, "CREATE FUNCTION") != 2 ||
						strings.Count(code, "nhost-ai:auto_embeddings:"+config.ID) != 2 ||
						!strings.Contains(code, "'configuration_id'") ||
						strings.Contains(code, "'model'") {
						t.Error("deployment is not a single owned pair with the search contract")
					}

					if tt.sqlFails {
						return nil, &hasura.RequestError{
							StatusCode: 400,
							Body: []byte(
								`{"code":"postgres-error","internal":"private webhook-secret"}`,
							),
						}
					}

					return &hasura.RunSQLResponse{ResultType: "CommandOk", Result: nil}, nil
				})

			if tt.trackFails {
				client.EXPECT().
					TrackFunction(gomock.Any(), "public", "ai_similar_documents").
					Return(&hasura.MetadataRequestError{
						StatusCode: 400,
						Body: &hasura.MetadataRequestErrorBody{
							Code: "invalid-configuration",
							Err:  "table private is not tracked",
						},
					})
			}

			if !tt.sqlFails && !tt.trackFails {
				client.EXPECT().
					TrackFunction(gomock.Any(), "public", "ai_similar_documents").
					Return(nil)
				client.EXPECT().
					TrackFunction(gomock.Any(), "public", "ai_search_documents").
					Return(&hasura.MetadataRequestError{
						StatusCode: 400,
						Body: &hasura.MetadataRequestErrorBody{
							Code: hasura.ErrorCodeAlreadyTracked,
						},
					})
				// A function left behind by a rename carries the tag and is removed.
				catalog.EXPECT().
					TaggedFunctions(gomock.Any(), config.ID).
					Return([]autoai.Function{{Schema: "old", Name: "ai_search_old"}}, nil)
				client.EXPECT().UntrackFunction(gomock.Any(), "old", "ai_search_old").Return(nil)
				client.EXPECT().RunSQL(gomock.Any(), gomock.Any(), false).Return(nil, nil)
			}

			client.EXPECT().
				SetAiAutoEmbeddingsConfigurationLastError(gomock.Any(), config.ID, gomock.Any()).
				DoAndReturn(func(_ context.Context, _ string, message *string, _ ...clientv2.RequestInterceptor) (*hasura.SetAiAutoEmbeddingsConfigurationLastError, error) {
					if (tt.wantError == "") != (message == nil) ||
						(message != nil && !strings.HasPrefix(*message, "deploy: ")) {
						t.Errorf("unexpected status %v", message)
					}

					return &hasura.SetAiAutoEmbeddingsConfigurationLastError{}, nil
				})

			var logs bytes.Buffer

			err := newAI(client, catalog).SynchAutoEmbeddingsConfiguration(
				t.Context(),
				config,
				false,
				slog.New(slog.NewTextHandler(&logs, nil)),
			)
			if tt.wantError == "" {
				if err != nil {
					t.Fatal(err)
				}

				return
			}

			if err == nil || !strings.Contains(err.Error(), tt.wantError) {
				t.Fatalf("error = %v, want %q", err, tt.wantError)
			}

			for _, secret := range []string{"private", "webhook-secret", "CREATE FUNCTION"} {
				if strings.Contains(err.Error()+logs.String(), secret) {
					t.Errorf("leaked %s", secret)
				}
			}
		})
	}
}

func TestDeleteNeverDeployed(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	catalog := mock.NewMockCatalog(ctrl)
	client := mock.NewMockHasuraClient(ctrl)
	config := deploymentConfig()

	catalog.EXPECT().TaggedFunctions(gomock.Any(), config.ID).Return(nil, nil)

	for _, name := range []string{"ai_similar_documents", "ai_search_documents"} {
		client.EXPECT().
			UntrackFunction(gomock.Any(), "public", name).
			Return(&hasura.MetadataRequestError{
				StatusCode: 400,
				Body:       &hasura.MetadataRequestErrorBody{Code: hasura.ErrorCodeNotExists},
			})
		client.EXPECT().RunSQL(gomock.Any(), gomock.Any(), false).Return(nil, nil)
	}

	if err := newAI(client, catalog).SynchAutoEmbeddingsConfiguration(
		t.Context(),
		config,
		true,
		slog.New(slog.DiscardHandler),
	); err != nil {
		t.Fatal(err)
	}
}

func TestStart(t *testing.T) {
	t.Parallel()

	t.Run("one failing configuration does not stop startup", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		catalog := mock.NewMockCatalog(ctrl)
		client := mock.NewMockHasuraClient(ctrl)
		bad := deploymentConfig()
		bad.Provider = "missing"
		good := deploymentConfig()
		good.ID = "22222222-2222-2222-2222-222222222222"

		client.EXPECT().
			GetAiAutoEmbeddingsConfigurations(gomock.Any(), nil).
			Return(&hasura.GetAiAutoEmbeddingsConfigurations{
				AiAutoEmbeddingsConfigurations: []*hasura.AiAutoEmbeddingsConfigurationFragment{
					bad,
					good,
				},
			}, nil)
		client.EXPECT().
			SetAiAutoEmbeddingsConfigurationLastError(gomock.Any(), bad.ID, gomock.Any()).
			Return(nil, nil)
		expectValidTarget(catalog)
		client.EXPECT().RunSQL(gomock.Any(), gomock.Any(), false).Return(nil, nil)
		client.EXPECT().TrackFunction(gomock.Any(), "public", gomock.Any()).Return(nil).Times(2)
		catalog.EXPECT().TaggedFunctions(gomock.Any(), good.ID).Return(nil, nil)
		client.EXPECT().
			SetAiAutoEmbeddingsConfigurationLastError(gomock.Any(), good.ID, nil).
			Return(nil, nil)

		var logs bytes.Buffer
		if err := newAI(client, catalog).Start(
			t.Context(),
			slog.New(slog.NewTextHandler(&logs, nil)),
		); err != nil {
			t.Fatal(err)
		}

		if !strings.Contains(logs.String(), "startup summary") ||
			!strings.Contains(logs.String(), bad.ID) {
			t.Error("missing startup summary")
		}
	})

	t.Run("listing failure is reported safely", func(t *testing.T) {
		t.Parallel()

		client := mock.NewMockHasuraClient(gomock.NewController(t))
		client.EXPECT().
			GetAiAutoEmbeddingsConfigurations(gomock.Any(), nil).
			Return(nil, &hasura.RequestError{StatusCode: 503, Body: []byte("private")})

		var logs bytes.Buffer

		err := newAI(client, nil).Start(t.Context(), slog.New(slog.NewTextHandler(&logs, nil)))
		if err == nil || !strings.Contains(logs.String(), "http_status=503") ||
			strings.Contains(err.Error()+logs.String(), "private") {
			t.Fatal("listing failure was not safely reported")
		}
	})
}
