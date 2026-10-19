package controller_test

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"github.com/nhost/nhost/services/auth/go/sql"
	"github.com/nhost/nhost/services/auth/go/tokenpurpose"
	"go.uber.org/mock/gomock"
)

func TestOauth2Introspect(t *testing.T) {
	t.Parallel()

	clientID := "nhost_abc123def456"
	unknownClientID := "nhost_unknown"
	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")
	now := time.Now()
	hint := api.OAuth2IntrospectRequestTokenTypeHintRefreshToken

	publicClient := sql.AuthOauth2Client{
		ClientID: clientID,
	}

	rt := sql.AuthOauth2RefreshToken{
		ID:            uuid.MustParse("33333333-3333-3333-3333-333333333333"),
		TokenHash:     "somehash",
		AuthRequestID: pgtype.UUID{Valid: false},
		ClientID:      clientID,
		UserID:        userID,
		Scopes:        []string{"openid", "profile"},
		CreatedAt: pgtype.Timestamptz{
			Time:  now,
			Valid: true,
		},
		ExpiresAt: pgtype.Timestamptz{
			Time:  now.Add(24 * time.Hour),
			Valid: true,
		},
	}

	otherClientID := "nhost_other_client"

	rtCrossClient := sql.AuthOauth2RefreshToken{
		ID:            uuid.MustParse("33333333-3333-3333-3333-333333333333"),
		TokenHash:     "somehash",
		AuthRequestID: pgtype.UUID{Valid: false},
		ClientID:      otherClientID,
		UserID:        userID,
		Scopes:        []string{"openid", "profile"},
		CreatedAt: pgtype.Timestamptz{
			Time:  now,
			Valid: true,
		},
		ExpiresAt: pgtype.Timestamptz{
			Time:  now.Add(24 * time.Hour),
			Valid: true,
		},
	}

	scope := strings.Join(rt.Scopes, " ")
	sub := userID.String()
	exp := int(rt.ExpiresAt.Time.Unix())
	iat := int(rt.CreatedAt.Time.Unix())
	tokenType := "refresh_token"
	iss := "https://local.auth.nhost.run"
	sid := rt.ID.String()

	cases := []testRequest[api.Oauth2IntrospectRequestObject, api.Oauth2IntrospectResponseObject]{
		{
			name:   "disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.Oauth2IntrospectRequestObject{
				Body: &api.OAuth2IntrospectRequest{
					Token: "some-token",
				},
			},
			expectedResponse: controller.OAuth2ErrorResponse{
				StatusCode: http.StatusInternalServerError,
				Body: api.OAuth2ErrorResponse{
					Error:            "server_error",
					ErrorDescription: ptr("OAuth2 provider is disabled"),
				},
			},
		},
		{
			name:   "missing body",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.Oauth2IntrospectRequestObject{
				Body: nil,
			},
			expectedResponse: controller.OAuth2ErrorResponse{
				StatusCode: http.StatusBadRequest,
				Body: api.OAuth2ErrorResponse{
					Error:            "invalid_request",
					ErrorDescription: ptr("Missing request body"),
				},
			},
		},
		{
			name:   "missing client_id",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.Oauth2IntrospectRequestObject{
				Body: &api.OAuth2IntrospectRequest{
					Token: "some-token",
				},
			},
			expectedResponse: controller.OAuth2ErrorResponse{
				StatusCode: http.StatusUnauthorized,
				Body: api.OAuth2ErrorResponse{
					Error:            "invalid_client",
					ErrorDescription: ptr("Client ID is required"),
				},
			},
		},
		{
			name:   "unknown client",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), unknownClientID).
					Return(sql.AuthOauth2Client{}, pgx.ErrNoRows)

				return mock
			},
			request: api.Oauth2IntrospectRequestObject{
				Body: &api.OAuth2IntrospectRequest{
					Token:    "some-token",
					ClientId: &unknownClientID,
				},
			},
			expectedResponse: controller.OAuth2ErrorResponse{
				StatusCode: http.StatusUnauthorized,
				Body: api.OAuth2ErrorResponse{
					Error:            "invalid_client",
					ErrorDescription: ptr("Unknown client"),
				},
			},
		},
		{
			name:   "refresh token - active",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(publicClient, nil)
				mock.EXPECT().GetOAuth2RefreshTokenByHash(gomock.Any(), gomock.Any()).
					Return(rt, nil)

				return mock
			},
			request: api.Oauth2IntrospectRequestObject{
				Body: &api.OAuth2IntrospectRequest{
					Token:         "some-refresh-token",
					TokenTypeHint: &hint,
					ClientId:      &clientID,
				},
			},
			expectedResponse: api.Oauth2Introspect200JSONResponse{
				Active:    true,
				ClientId:  &clientID,
				Sub:       &sub,
				Scope:     &scope,
				Exp:       &exp,
				Iat:       &iat,
				Iss:       &iss,
				TokenType: &tokenType,
				Sid:       &sid,
			},
		},
		{
			name:   "refresh token - cross-client returns inactive",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(publicClient, nil)
				mock.EXPECT().GetOAuth2RefreshTokenByHash(gomock.Any(), gomock.Any()).
					Return(rtCrossClient, nil)

				return mock
			},
			request: api.Oauth2IntrospectRequestObject{
				Body: &api.OAuth2IntrospectRequest{
					Token:         "some-refresh-token",
					TokenTypeHint: &hint,
					ClientId:      &clientID,
				},
			},
			expectedResponse: api.Oauth2Introspect200JSONResponse{
				Active: false,
			},
		},
		{
			name:   "unknown refresh token - inactive",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(publicClient, nil)
				mock.EXPECT().GetOAuth2RefreshTokenByHash(gomock.Any(), gomock.Any()).
					Return(sql.AuthOauth2RefreshToken{}, pgx.ErrNoRows)

				return mock
			},
			request: api.Oauth2IntrospectRequestObject{
				Body: &api.OAuth2IntrospectRequest{
					Token:         "unknown-token",
					TokenTypeHint: &hint,
					ClientId:      &clientID,
				},
			},
			expectedResponse: api.Oauth2Introspect200JSONResponse{
				Active: false,
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, _ := getController(t, ctrl, tc.config, tc.db)

			assertRequest(
				context.Background(), t, c.Oauth2Introspect,
				tc.request, tc.expectedResponse,
			)
		})
	}

	t.Run("dual credentials", func(t *testing.T) {
		t.Parallel()

		bodyClientID := "body-client-id"

		assertOAuth2DualCredentials(
			t,
			"/oauth2/introspect",
			(*controller.Controller).Oauth2Introspect,
			api.Oauth2IntrospectRequestObject{
				Body: &api.OAuth2IntrospectRequest{
					Token:    "some-token",
					ClientId: &bodyClientID,
				},
			},
		)
	})
}

func TestOauth2IntrospectCompletionLog(t *testing.T) {
	t.Parallel()

	clientID := "nhost_log_client"
	sessionID := uuid.MustParse("33333333-3333-4333-8333-333333333333")
	jti := "44444444-4444-4444-8444-444444444444"
	userID := uuid.New()

	for _, tc := range []struct {
		name      string
		kind      string
		active    bool
		expectSid bool
		expectJti bool
	}{
		{"access", "access", true, true, true},
		{"refresh", "refresh", true, true, false},
		{"inactive", "inactive", false, false, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var logs bytes.Buffer

			logger := slog.New(slog.NewJSONHandler(&logs, nil))
			ctrl, getter := getController(t, gomock.NewController(t), getConfigOAuth2Enabled,
				func(mc *gomock.Controller) controller.DBClient {
					db := mock.NewMockDBClient(mc)
					db.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
						Return(sql.AuthOauth2Client{ClientID: clientID}, nil)

					if tc.kind == "refresh" {
						db.EXPECT().GetOAuth2RefreshTokenByHash(gomock.Any(), gomock.Any()).
							Return(sql.AuthOauth2RefreshToken{
								ID: sessionID, ClientID: clientID, UserID: userID,
								Scopes:    []string{"openid"},
								ExpiresAt: sql.TimestampTz(time.Now().Add(time.Hour)),
								CreatedAt: sql.TimestampTz(time.Now().Add(-time.Hour)),
							}, nil)
					}

					return db
				}, withAudience("https://project.example.com"))

			rawToken := "not-a-valid-token"

			hint := "access_token"
			switch tc.kind {
			case "access":
				rawToken = signTestToken(t, getter, userID, tokenpurpose.OAuth2AccessToken,
					map[string]any{
						"client_id": clientID, "sid": sessionID.String(), "jti": jti,
						"aud": "https://project.example.com",
					})
			case "refresh":
				rawToken = "sensitive-refresh-token"
				hint = "refresh_token"
			}

			router := newLoggedAuthRouter(t, getter, logger, ctrl)
			form := url.Values{
				"token":           {rawToken},
				"token_type_hint": {hint},
				"client_id":       {clientID},
			}
			req := httptest.NewRequest(
				http.MethodPost,
				"/oauth2/introspect",
				strings.NewReader(form.Encode()),
			)
			req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)

			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
			}

			assertIntrospectionHTTPLog(
				t,
				rec,
				logs.Bytes(),
				rawToken,
				clientID,
				sessionID,
				jti,
				tc.active,
				tc.expectSid,
				tc.expectJti,
			)
		})
	}
}

func assertIntrospectionHTTPLog(
	t *testing.T, rec *httptest.ResponseRecorder, logBytes []byte, rawToken, clientID string,
	sessionID uuid.UUID, jti string, active, expectSid, expectJti bool,
) {
	t.Helper()

	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}

	if body["active"] != active || !active && len(body) != 1 {
		t.Errorf("response = %v", body)
	}

	expectedAud := any(nil)
	if expectJti {
		expectedAud = []any{"https://project.example.com"}
	}

	if diff := cmp.Diff(expectedAud, body["aud"]); diff != "" {
		t.Errorf("response audience mismatch (-want +got):\n%s", diff)
	}

	assertIntrospectionIDs(t, body, sessionID, jti, expectSid, expectJti)

	var record map[string]any
	if err := json.Unmarshal(bytes.TrimSpace(logBytes), &record); err != nil {
		t.Fatal(err)
	}

	group, present := record["introspected_token"].(map[string]any)
	if present != active {
		t.Errorf("completion group = %v", group)
	}

	if active {
		if group["client_id"] != clientID {
			t.Errorf("completion client_id = %v", group)
		}

		assertIntrospectionIDs(t, group, sessionID, jti, expectSid, expectJti)
	}

	if strings.Contains(string(logBytes), rawToken) {
		t.Error("raw token logged")
	}
}

func assertIntrospectionIDs(
	t *testing.T,
	values map[string]any,
	sessionID uuid.UUID,
	jti string,
	expectSid, expectJti bool,
) {
	t.Helper()

	expectedSid := any(nil)
	if expectSid {
		expectedSid = sessionID.String()
	}

	expectedJti := any(nil)
	if expectJti {
		expectedJti = jti
	}

	if values["sid"] != expectedSid {
		t.Errorf("sid = %v, want %v", values["sid"], expectedSid)
	}

	if values["jti"] != expectedJti {
		t.Errorf("jti = %v, want %v", values["jti"], expectedJti)
	}
}
