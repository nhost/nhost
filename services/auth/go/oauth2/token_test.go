package oauth2_test

import (
	"context"
	"errors"
	"log/slog"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/oauth2"
	"github.com/nhost/nhost/services/auth/go/oauth2/mock"
	"github.com/nhost/nhost/services/auth/go/sql"
	"go.uber.org/mock/gomock"
)

func TestValidateCodeExchange(t *testing.T) { //nolint:maintidx
	t.Parallel()

	logger := slog.Default()
	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")
	clientID := "test-client"
	codeValue := "test-code"
	codeHash := oauth2.HashToken(codeValue)
	redirectURI := "https://example.com/callback"
	secret := "my-secret"

	baseAuthReq := sql.AuthOauth2AuthRequest{ //nolint:exhaustruct
		ClientID:    clientID,
		RedirectUri: redirectURI,
		Scopes:      []string{"openid"},
		UserID:      pgtype.UUID{Bytes: userID, Valid: true},
	}

	confidentialClient := sql.AuthOauth2Client{ //nolint:exhaustruct
		ClientID:         clientID,
		ClientSecretHash: pgtype.Text{String: "hashed-secret", Valid: true},
	}

	publicClient := sql.AuthOauth2Client{ //nolint:exhaustruct
		ClientID: clientID,
	}

	cases := []struct {
		name           string
		db             func(ctrl *gomock.Controller) *mock.MockDBClient
		signer         func(ctrl *gomock.Controller) *mock.MockSigner
		verifyFn       oauth2.VerifySecretFunc
		request        api.OAuth2TokenRequest
		expectedResult *oauth2.ValidatedCodeExchange
		expectedErr    *oauth2.Error
	}{
		{
			name: "success - confidential client with matching redirect_uri",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2AuthorizationCodeAuthRequest(gomock.Any(), codeHash).
					Return(baseAuthReq, nil)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(confidentialClient, nil)

				return m
			},
			signer:   mock.NewMockSigner,
			verifyFn: func(_, _ string) bool { return true },
			request: api.OAuth2TokenRequest{ //nolint:exhaustruct
				Code:         &codeValue,
				GrantType:    "authorization_code",
				RedirectUri:  &redirectURI,
				ClientSecret: &secret,
			},
			expectedResult: &oauth2.ValidatedCodeExchange{
				UserID:   userID,
				CodeHash: codeHash,
				AuthReq:  baseAuthReq,
			},
			expectedErr: nil,
		},
		{
			name: "success - no redirect_uri in either request",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)

				authReqNoRedirect := baseAuthReq
				authReqNoRedirect.RedirectUri = ""

				m.EXPECT().GetOAuth2AuthorizationCodeAuthRequest(gomock.Any(), codeHash).
					Return(authReqNoRedirect, nil)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(confidentialClient, nil)

				return m
			},
			signer:   mock.NewMockSigner,
			verifyFn: func(_, _ string) bool { return true },
			request: api.OAuth2TokenRequest{ //nolint:exhaustruct
				Code:         &codeValue,
				GrantType:    "authorization_code",
				ClientSecret: &secret,
			},
			expectedResult: func() *oauth2.ValidatedCodeExchange {
				authReq := baseAuthReq
				authReq.RedirectUri = ""

				return &oauth2.ValidatedCodeExchange{
					UserID:   userID,
					CodeHash: codeHash,
					AuthReq:  authReq,
				}
			}(),
			expectedErr: nil,
		},
		{
			name: "success - public client with PKCE",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)

				authReqPKCE := baseAuthReq
				authReqPKCE.CodeChallenge = pgtype.Text{
					String: s256Challenge("verifier"),
					Valid:  true,
				}
				authReqPKCE.CodeChallengeMethod = pgtype.Text{String: "S256", Valid: true}

				m.EXPECT().GetOAuth2AuthorizationCodeAuthRequest(gomock.Any(), codeHash).
					Return(authReqPKCE, nil)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(publicClient, nil)

				return m
			},
			signer:   mock.NewMockSigner,
			verifyFn: nil,
			request: func() api.OAuth2TokenRequest {
				verifier := "verifier"

				return api.OAuth2TokenRequest{ //nolint:exhaustruct
					Code:         &codeValue,
					GrantType:    "authorization_code",
					RedirectUri:  &redirectURI,
					ClientId:     &clientID,
					CodeVerifier: &verifier,
				}
			}(),
			expectedResult: func() *oauth2.ValidatedCodeExchange {
				authReq := baseAuthReq
				authReq.CodeChallenge = pgtype.Text{String: s256Challenge("verifier"), Valid: true}
				authReq.CodeChallengeMethod = pgtype.Text{String: "S256", Valid: true}

				return &oauth2.ValidatedCodeExchange{
					UserID:   userID,
					CodeHash: codeHash,
					AuthReq:  authReq,
				}
			}(),
			expectedErr: nil,
		},
		{
			name:     "error - nil code",
			db:       mock.NewMockDBClient,
			signer:   mock.NewMockSigner,
			verifyFn: nil,
			request: api.OAuth2TokenRequest{ //nolint:exhaustruct
				GrantType: "authorization_code",
			},
			expectedResult: nil,
			expectedErr: &oauth2.Error{
				Err:         "invalid_request",
				Description: "Missing code",
			},
		},
		{
			name:     "error - empty code",
			db:       mock.NewMockDBClient,
			signer:   mock.NewMockSigner,
			verifyFn: nil,
			request: api.OAuth2TokenRequest{ //nolint:exhaustruct
				Code:      new(string),
				GrantType: "authorization_code",
			},
			expectedResult: nil,
			expectedErr: &oauth2.Error{
				Err:         "invalid_request",
				Description: "Missing code",
			},
		},
		{
			name: "error - authorization code not found",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2AuthorizationCodeAuthRequest(gomock.Any(), codeHash).
					Return(sql.AuthOauth2AuthRequest{}, pgx.ErrNoRows) //nolint:exhaustruct

				return m
			},
			signer:   mock.NewMockSigner,
			verifyFn: nil,
			request: api.OAuth2TokenRequest{ //nolint:exhaustruct
				Code:      &codeValue,
				GrantType: "authorization_code",
			},
			expectedResult: nil,
			expectedErr: &oauth2.Error{
				Err:         "invalid_grant",
				Description: "Invalid authorization code",
			},
		},
		{
			name: "error - database error getting authorization code",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2AuthorizationCodeAuthRequest(gomock.Any(), codeHash).
					Return(
						sql.AuthOauth2AuthRequest{},      //nolint:exhaustruct
						errors.New("connection refused"), //nolint:err113
					)

				return m
			},
			signer:   mock.NewMockSigner,
			verifyFn: nil,
			request: api.OAuth2TokenRequest{ //nolint:exhaustruct
				Code:      &codeValue,
				GrantType: "authorization_code",
			},
			expectedResult: nil,
			expectedErr: &oauth2.Error{
				Err:         "server_error",
				Description: "Internal server error",
			},
		},
		{
			name: "error - authorization not completed (user_id not valid)",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)

				authReqNoUser := baseAuthReq
				authReqNoUser.UserID = pgtype.UUID{} //nolint:exhaustruct

				m.EXPECT().GetOAuth2AuthorizationCodeAuthRequest(gomock.Any(), codeHash).
					Return(authReqNoUser, nil)

				return m
			},
			signer:   mock.NewMockSigner,
			verifyFn: nil,
			request: api.OAuth2TokenRequest{ //nolint:exhaustruct
				Code:      &codeValue,
				GrantType: "authorization_code",
			},
			expectedResult: nil,
			expectedErr: &oauth2.Error{
				Err:         "invalid_grant",
				Description: "Authorization not completed",
			},
		},
		{
			name: "error - redirect_uri in auth request but missing in token request",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2AuthorizationCodeAuthRequest(gomock.Any(), codeHash).
					Return(baseAuthReq, nil)

				return m
			},
			signer:   mock.NewMockSigner,
			verifyFn: nil,
			request: api.OAuth2TokenRequest{ //nolint:exhaustruct
				Code:      &codeValue,
				GrantType: "authorization_code",
			},
			expectedResult: nil,
			expectedErr: &oauth2.Error{
				Err:         "invalid_grant",
				Description: "redirect_uri mismatch",
			},
		},
		{
			name: "error - redirect_uri mismatch",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2AuthorizationCodeAuthRequest(gomock.Any(), codeHash).
					Return(baseAuthReq, nil)

				return m
			},
			signer:   mock.NewMockSigner,
			verifyFn: nil,
			request: func() api.OAuth2TokenRequest {
				wrongURI := "https://evil.com/callback"

				return api.OAuth2TokenRequest{ //nolint:exhaustruct
					Code:        &codeValue,
					GrantType:   "authorization_code",
					RedirectUri: &wrongURI,
				}
			}(),
			expectedResult: nil,
			expectedErr: &oauth2.Error{
				Err:         "invalid_grant",
				Description: "redirect_uri mismatch",
			},
		},
		{
			name: "error - redirect_uri not expected",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)

				authReqNoRedirect := baseAuthReq
				authReqNoRedirect.RedirectUri = ""

				m.EXPECT().GetOAuth2AuthorizationCodeAuthRequest(gomock.Any(), codeHash).
					Return(authReqNoRedirect, nil)

				return m
			},
			signer:   mock.NewMockSigner,
			verifyFn: nil,
			request: api.OAuth2TokenRequest{ //nolint:exhaustruct
				Code:        &codeValue,
				GrantType:   "authorization_code",
				RedirectUri: &redirectURI,
			},
			expectedResult: nil,
			expectedErr: &oauth2.Error{
				Err:         "invalid_request",
				Description: "redirect_uri not expected",
			},
		},
		{
			name: "error - client not found",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2AuthorizationCodeAuthRequest(gomock.Any(), codeHash).
					Return(baseAuthReq, nil)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(sql.AuthOauth2Client{}, pgx.ErrNoRows) //nolint:exhaustruct

				return m
			},
			signer:   mock.NewMockSigner,
			verifyFn: nil,
			request: api.OAuth2TokenRequest{ //nolint:exhaustruct
				Code:        &codeValue,
				GrantType:   "authorization_code",
				RedirectUri: &redirectURI,
			},
			expectedResult: nil,
			expectedErr: &oauth2.Error{
				Err:         "invalid_client",
				Description: "Unknown client",
			},
		},
		{
			name: "error - PKCE required for public client",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2AuthorizationCodeAuthRequest(gomock.Any(), codeHash).
					Return(baseAuthReq, nil)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(publicClient, nil)

				return m
			},
			signer:   mock.NewMockSigner,
			verifyFn: nil,
			request: api.OAuth2TokenRequest{ //nolint:exhaustruct
				Code:        &codeValue,
				GrantType:   "authorization_code",
				RedirectUri: &redirectURI,
				ClientId:    &clientID,
			},
			expectedResult: nil,
			expectedErr: &oauth2.Error{
				Err:         "invalid_request",
				Description: "PKCE code_challenge is required for public clients",
			},
		},
		{
			name: "error - confidential client missing secret",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2AuthorizationCodeAuthRequest(gomock.Any(), codeHash).
					Return(baseAuthReq, nil)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(confidentialClient, nil)

				return m
			},
			signer:   mock.NewMockSigner,
			verifyFn: nil,
			request: api.OAuth2TokenRequest{ //nolint:exhaustruct
				Code:        &codeValue,
				GrantType:   "authorization_code",
				RedirectUri: &redirectURI,
			},
			expectedResult: nil,
			expectedErr: &oauth2.Error{
				Err:         "invalid_client",
				Description: "Client secret required",
			},
		},
		{
			name: "error - confidential client wrong secret",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2AuthorizationCodeAuthRequest(gomock.Any(), codeHash).
					Return(baseAuthReq, nil)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(confidentialClient, nil)

				return m
			},
			signer:   mock.NewMockSigner,
			verifyFn: func(_, _ string) bool { return false },
			request: api.OAuth2TokenRequest{ //nolint:exhaustruct
				Code:         &codeValue,
				GrantType:    "authorization_code",
				RedirectUri:  &redirectURI,
				ClientSecret: &secret,
			},
			expectedResult: nil,
			expectedErr: &oauth2.Error{
				Err:         "invalid_client",
				Description: "Invalid client credentials",
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			mockDB := tc.db(ctrl)
			mockSigner := tc.signer(ctrl)

			provider := oauth2.NewProvider(
				mockDB, mockSigner, nil, tc.verifyFn,
				oauth2.Config{}, //nolint:exhaustruct
				nil,
			)

			gotResult, gotErr := provider.ValidateCodeExchange(
				context.Background(), &tc.request, logger,
			)

			if diff := cmp.Diff(tc.expectedErr, gotErr); diff != "" {
				t.Errorf("error mismatch (-want +got):\n%s", diff)
			}

			if diff := cmp.Diff(tc.expectedResult, gotResult); diff != "" {
				t.Errorf("result mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestIssueTokensFromCode(t *testing.T) { //nolint:maintidx,gocognit,cyclop
	t.Parallel()

	logger := slog.Default()
	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")
	clientID := "test-client"
	codeHash := "test-code-hash"

	config := oauth2.Config{ //nolint:exhaustruct
		AccessTokenTTL:  300,
		RefreshTokenTTL: 3600,
	}

	cases := []struct {
		name        string
		db          func(ctrl *gomock.Controller) *mock.MockDBClient
		signer      func(ctrl *gomock.Controller) *mock.MockSigner
		validated   oauth2.ValidatedCodeExchange
		expectedErr *oauth2.Error
		verifyResp  func(t *testing.T, resp *api.OAuth2TokenResponse)
	}{
		{
			name: "success - without openid scope",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().ConsumeOAuth2CodeAndInsertRefreshToken(gomock.Any(), gomock.Any()).
					Return(sql.AuthOauth2RefreshToken{}, nil) //nolint:exhaustruct

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				m.EXPECT().SignTokenWithClaims(gomock.Any(), gomock.Any()).
					Return("access-token", nil)

				return m
			},
			validated: oauth2.ValidatedCodeExchange{
				UserID:   userID,
				CodeHash: codeHash,
				AuthReq: sql.AuthOauth2AuthRequest{ //nolint:exhaustruct
					ClientID: clientID,
					Scopes:   []string{"profile"},
				},
			},
			expectedErr: nil,
			verifyResp: func(t *testing.T, resp *api.OAuth2TokenResponse) {
				t.Helper()

				if resp == nil {
					t.Fatal("expected non-nil response")
				}

				if resp.AccessToken != "access-token" {
					t.Errorf("expected access token 'access-token', got %q", resp.AccessToken)
				}

				if resp.TokenType != "Bearer" {
					t.Errorf("expected token type 'Bearer', got %q", resp.TokenType)
				}

				if resp.ExpiresIn != 300 {
					t.Errorf("expected expires_in 300, got %d", resp.ExpiresIn)
				}

				if resp.RefreshToken == nil {
					t.Fatal("expected refresh token to be set")
				}

				if resp.IdToken != nil {
					t.Error("expected no id_token without openid scope")
				}

				expectedScope := "profile"
				if resp.Scope == nil || *resp.Scope != expectedScope {
					t.Errorf("expected scope %q, got %v", expectedScope, resp.Scope)
				}
			},
		},
		{
			name: "success - with openid scope includes id_token",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().ConsumeOAuth2CodeAndInsertRefreshToken(gomock.Any(), gomock.Any()).
					Return(sql.AuthOauth2RefreshToken{}, nil) //nolint:exhaustruct

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				m.EXPECT().SignTokenWithClaims(gomock.Any(), gomock.Any()).
					Return("fake-token", nil).
					Times(2)

				return m
			},
			validated: oauth2.ValidatedCodeExchange{
				UserID:   userID,
				CodeHash: codeHash,
				AuthReq: sql.AuthOauth2AuthRequest{ //nolint:exhaustruct
					ClientID: clientID,
					Scopes:   []string{"openid"},
				},
			},
			expectedErr: nil,
			verifyResp: func(t *testing.T, resp *api.OAuth2TokenResponse) {
				t.Helper()

				if resp == nil {
					t.Fatal("expected non-nil response")
				}

				if resp.IdToken == nil {
					t.Fatal("expected id_token with openid scope")
				}

				if *resp.IdToken != "fake-token" {
					t.Errorf("expected id_token 'fake-token', got %q", *resp.IdToken)
				}
			},
		},
		{
			name: "success - openid with id_token sign failure still returns access token",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().ConsumeOAuth2CodeAndInsertRefreshToken(gomock.Any(), gomock.Any()).
					Return(sql.AuthOauth2RefreshToken{}, nil) //nolint:exhaustruct

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				gomock.InOrder(
					m.EXPECT().SignTokenWithClaims(gomock.Any(), gomock.Any()).
						Return("access-token", nil),
					m.EXPECT().SignTokenWithClaims(gomock.Any(), gomock.Any()).
						Return("", errors.New("sign error")), //nolint:err113
				)

				return m
			},
			validated: oauth2.ValidatedCodeExchange{
				UserID:   userID,
				CodeHash: codeHash,
				AuthReq: sql.AuthOauth2AuthRequest{ //nolint:exhaustruct
					ClientID: clientID,
					Scopes:   []string{"openid"},
				},
			},
			expectedErr: nil,
			verifyResp: func(t *testing.T, resp *api.OAuth2TokenResponse) {
				t.Helper()

				if resp == nil {
					t.Fatal("expected non-nil response")
				}

				if resp.AccessToken != "access-token" {
					t.Errorf("expected access token 'access-token', got %q", resp.AccessToken)
				}

				if resp.IdToken != nil {
					t.Error("expected no id_token when signing fails")
				}
			},
		},
		{
			name: "error - access token sign failure",
			db:   mock.NewMockDBClient,
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				m.EXPECT().SignTokenWithClaims(gomock.Any(), gomock.Any()).
					Return("", errors.New("sign error")) //nolint:err113

				return m
			},
			validated: oauth2.ValidatedCodeExchange{
				UserID:   userID,
				CodeHash: codeHash,
				AuthReq: sql.AuthOauth2AuthRequest{ //nolint:exhaustruct
					ClientID: clientID,
					Scopes:   []string{"profile"},
				},
			},
			expectedErr: &oauth2.Error{
				Err:         "server_error",
				Description: "Internal server error",
			},
			verifyResp: func(t *testing.T, resp *api.OAuth2TokenResponse) {
				t.Helper()

				if resp != nil {
					t.Errorf("expected nil response, got %v", resp)
				}
			},
		},
		{
			name: "error - graphql scope GetUser failure",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetUser(gomock.Any(), userID).
					Return(sql.AuthUser{}, errors.New("db error")) //nolint:exhaustruct,err113

				return m
			},
			signer: mock.NewMockSigner,
			validated: oauth2.ValidatedCodeExchange{
				UserID:   userID,
				CodeHash: codeHash,
				AuthReq: sql.AuthOauth2AuthRequest{ //nolint:exhaustruct
					ClientID: clientID,
					Scopes:   []string{"graphql"},
				},
			},
			expectedErr: &oauth2.Error{
				Err:         "server_error",
				Description: "Internal server error",
			},
			verifyResp: func(t *testing.T, resp *api.OAuth2TokenResponse) {
				t.Helper()

				if resp != nil {
					t.Errorf("expected nil response, got %v", resp)
				}
			},
		},
		{
			name: "error - code already consumed",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().ConsumeOAuth2CodeAndInsertRefreshToken(gomock.Any(), gomock.Any()).
					Return(sql.AuthOauth2RefreshToken{}, pgx.ErrNoRows) //nolint:exhaustruct

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				m.EXPECT().SignTokenWithClaims(gomock.Any(), gomock.Any()).
					Return("access-token", nil)

				return m
			},
			validated: oauth2.ValidatedCodeExchange{
				UserID:   userID,
				CodeHash: codeHash,
				AuthReq: sql.AuthOauth2AuthRequest{ //nolint:exhaustruct
					ClientID: clientID,
					Scopes:   []string{"profile"},
				},
			},
			expectedErr: &oauth2.Error{
				Err:         "invalid_grant",
				Description: "Invalid authorization code",
			},
			verifyResp: func(t *testing.T, resp *api.OAuth2TokenResponse) {
				t.Helper()

				if resp != nil {
					t.Errorf("expected nil response, got %v", resp)
				}
			},
		},
		{
			name: "error - consume code database error",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().ConsumeOAuth2CodeAndInsertRefreshToken(gomock.Any(), gomock.Any()).
					Return(
						sql.AuthOauth2RefreshToken{}, //nolint:exhaustruct
						errors.New("db error"),       //nolint:err113
					)

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				m.EXPECT().SignTokenWithClaims(gomock.Any(), gomock.Any()).
					Return("access-token", nil)

				return m
			},
			validated: oauth2.ValidatedCodeExchange{
				UserID:   userID,
				CodeHash: codeHash,
				AuthReq: sql.AuthOauth2AuthRequest{ //nolint:exhaustruct
					ClientID: clientID,
					Scopes:   []string{"profile"},
				},
			},
			expectedErr: &oauth2.Error{
				Err:         "server_error",
				Description: "Internal server error",
			},
			verifyResp: func(t *testing.T, resp *api.OAuth2TokenResponse) {
				t.Helper()

				if resp != nil {
					t.Errorf("expected nil response, got %v", resp)
				}
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			mockDB := tc.db(ctrl)
			mockSigner := tc.signer(ctrl)

			provider := oauth2.NewProvider(
				mockDB, mockSigner, nil, nil,
				config, nil,
			)

			gotResp, gotErr := provider.IssueTokensFromCode(
				context.Background(), &tc.validated, logger,
			)

			if diff := cmp.Diff(tc.expectedErr, gotErr); diff != "" {
				t.Errorf("error mismatch (-want +got):\n%s", diff)
			}

			tc.verifyResp(t, gotResp)
		})
	}
}

func TestValidateRefreshGrant(t *testing.T) { //nolint:maintidx
	t.Parallel()

	logger := slog.Default()
	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")
	clientID := "test-client"
	refreshTokenValue := "test-refresh-token"
	tokenHash := oauth2.HashToken(refreshTokenValue)

	validRT := sql.AuthOauth2RefreshToken{ //nolint:exhaustruct
		TokenHash: tokenHash,
		ClientID:  clientID,
		UserID:    userID,
		Scopes:    []string{"openid", "profile"},
		ExpiresAt: sql.TimestampTz(time.Now().Add(time.Hour)),
	}

	confidentialClient := sql.AuthOauth2Client{ //nolint:exhaustruct
		ClientID:         clientID,
		ClientSecretHash: pgtype.Text{String: "hashed-secret", Valid: true},
	}

	publicClient := sql.AuthOauth2Client{ //nolint:exhaustruct
		ClientID: clientID,
	}

	secret := "my-secret"

	cases := []struct {
		name           string
		db             func(ctrl *gomock.Controller) *mock.MockDBClient
		signer         func(ctrl *gomock.Controller) *mock.MockSigner
		verifyFn       oauth2.VerifySecretFunc
		request        api.OAuth2TokenRequest
		expectedResult *oauth2.ValidatedRefreshGrant
		expectedErr    *oauth2.Error
	}{
		{
			name: "success - confidential client",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2RefreshTokenByHash(gomock.Any(), tokenHash).
					Return(validRT, nil)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(confidentialClient, nil)

				return m
			},
			signer:   mock.NewMockSigner,
			verifyFn: func(_, _ string) bool { return true },
			request: api.OAuth2TokenRequest{ //nolint:exhaustruct
				RefreshToken: &refreshTokenValue,
				GrantType:    "refresh_token",
				ClientSecret: &secret,
			},
			expectedResult: &oauth2.ValidatedRefreshGrant{
				UserID:       userID,
				TokenHash:    tokenHash,
				RefreshToken: validRT,
			},
			expectedErr: nil,
		},
		{
			name: "success - public client",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2RefreshTokenByHash(gomock.Any(), tokenHash).
					Return(validRT, nil)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(publicClient, nil)

				return m
			},
			signer:   mock.NewMockSigner,
			verifyFn: nil,
			request: api.OAuth2TokenRequest{ //nolint:exhaustruct
				RefreshToken: &refreshTokenValue,
				GrantType:    "refresh_token",
				ClientId:     &clientID,
			},
			expectedResult: &oauth2.ValidatedRefreshGrant{
				UserID:       userID,
				TokenHash:    tokenHash,
				RefreshToken: validRT,
			},
			expectedErr: nil,
		},
		{
			name:     "error - nil refresh_token",
			db:       mock.NewMockDBClient,
			signer:   mock.NewMockSigner,
			verifyFn: nil,
			request: api.OAuth2TokenRequest{ //nolint:exhaustruct
				GrantType: "refresh_token",
			},
			expectedResult: nil,
			expectedErr: &oauth2.Error{
				Err:         "invalid_request",
				Description: "Missing refresh_token",
			},
		},
		{
			name:     "error - empty refresh_token",
			db:       mock.NewMockDBClient,
			signer:   mock.NewMockSigner,
			verifyFn: nil,
			request: api.OAuth2TokenRequest{ //nolint:exhaustruct
				RefreshToken: new(string),
				GrantType:    "refresh_token",
			},
			expectedResult: nil,
			expectedErr: &oauth2.Error{
				Err:         "invalid_request",
				Description: "Missing refresh_token",
			},
		},
		{
			name: "error - refresh token not found",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2RefreshTokenByHash(gomock.Any(), tokenHash).
					Return(sql.AuthOauth2RefreshToken{}, pgx.ErrNoRows) //nolint:exhaustruct

				return m
			},
			signer:   mock.NewMockSigner,
			verifyFn: nil,
			request: api.OAuth2TokenRequest{ //nolint:exhaustruct
				RefreshToken: &refreshTokenValue,
				GrantType:    "refresh_token",
			},
			expectedResult: nil,
			expectedErr: &oauth2.Error{
				Err:         "invalid_grant",
				Description: "Invalid refresh token",
			},
		},
		{
			name: "error - database error getting refresh token",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2RefreshTokenByHash(gomock.Any(), tokenHash).
					Return(
						sql.AuthOauth2RefreshToken{},     //nolint:exhaustruct
						errors.New("connection refused"), //nolint:err113
					)

				return m
			},
			signer:   mock.NewMockSigner,
			verifyFn: nil,
			request: api.OAuth2TokenRequest{ //nolint:exhaustruct
				RefreshToken: &refreshTokenValue,
				GrantType:    "refresh_token",
			},
			expectedResult: nil,
			expectedErr: &oauth2.Error{
				Err:         "server_error",
				Description: "Internal server error",
			},
		},
		{
			name: "error - refresh token expired",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)

				expiredRT := validRT
				expiredRT.ExpiresAt = sql.TimestampTz(time.Now().Add(-time.Hour))

				m.EXPECT().GetOAuth2RefreshTokenByHash(gomock.Any(), tokenHash).
					Return(expiredRT, nil)

				return m
			},
			signer:   mock.NewMockSigner,
			verifyFn: nil,
			request: api.OAuth2TokenRequest{ //nolint:exhaustruct
				RefreshToken: &refreshTokenValue,
				GrantType:    "refresh_token",
			},
			expectedResult: nil,
			expectedErr: &oauth2.Error{
				Err:         "invalid_grant",
				Description: "Refresh token expired",
			},
		},
		{
			name: "error - client not found",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2RefreshTokenByHash(gomock.Any(), tokenHash).
					Return(validRT, nil)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(sql.AuthOauth2Client{}, pgx.ErrNoRows) //nolint:exhaustruct

				return m
			},
			signer:   mock.NewMockSigner,
			verifyFn: nil,
			request: api.OAuth2TokenRequest{ //nolint:exhaustruct
				RefreshToken: &refreshTokenValue,
				GrantType:    "refresh_token",
			},
			expectedResult: nil,
			expectedErr: &oauth2.Error{
				Err:         "invalid_client",
				Description: "Unknown client",
			},
		},
		{
			name: "error - public client without client_id",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2RefreshTokenByHash(gomock.Any(), tokenHash).
					Return(validRT, nil)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(publicClient, nil)

				return m
			},
			signer:   mock.NewMockSigner,
			verifyFn: nil,
			request: api.OAuth2TokenRequest{ //nolint:exhaustruct
				RefreshToken: &refreshTokenValue,
				GrantType:    "refresh_token",
			},
			expectedResult: nil,
			expectedErr: &oauth2.Error{
				Err:         "invalid_client",
				Description: "Client ID is required",
			},
		},
		{
			name: "error - confidential client missing secret",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2RefreshTokenByHash(gomock.Any(), tokenHash).
					Return(validRT, nil)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(confidentialClient, nil)

				return m
			},
			signer:   mock.NewMockSigner,
			verifyFn: nil,
			request: api.OAuth2TokenRequest{ //nolint:exhaustruct
				RefreshToken: &refreshTokenValue,
				GrantType:    "refresh_token",
			},
			expectedResult: nil,
			expectedErr: &oauth2.Error{
				Err:         "invalid_client",
				Description: "Client secret required",
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			mockDB := tc.db(ctrl)
			mockSigner := tc.signer(ctrl)

			provider := oauth2.NewProvider(
				mockDB, mockSigner, nil, tc.verifyFn,
				oauth2.Config{ //nolint:exhaustruct
					AccessTokenTTL:  300,
					RefreshTokenTTL: 3600,
				},
				nil,
			)

			gotResult, gotErr := provider.ValidateRefreshGrant(
				context.Background(), &tc.request, logger,
			)

			if diff := cmp.Diff(tc.expectedErr, gotErr); diff != "" {
				t.Errorf("error mismatch (-want +got):\n%s", diff)
			}

			if diff := cmp.Diff(tc.expectedResult, gotResult); diff != "" {
				t.Errorf("result mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestIssueTokensFromRefresh(t *testing.T) { //nolint:maintidx,gocognit,gocyclo,cyclop
	t.Parallel()

	logger := slog.Default()
	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")
	clientID := "test-client"
	tokenHash := "test-token-hash"

	config := oauth2.Config{ //nolint:exhaustruct
		AccessTokenTTL:  300,
		RefreshTokenTTL: 3600,
	}

	user := sql.AuthUser{ //nolint:exhaustruct
		ID:          userID,
		DefaultRole: "user",
	}

	userRoles := []sql.AuthUserRole{
		{Role: "user"},   //nolint:exhaustruct
		{Role: "editor"}, //nolint:exhaustruct
	}

	cases := []struct {
		name        string
		db          func(ctrl *gomock.Controller) *mock.MockDBClient
		signer      func(ctrl *gomock.Controller) *mock.MockSigner
		validated   oauth2.ValidatedRefreshGrant
		expectedErr *oauth2.Error
		verifyResp  func(t *testing.T, resp *api.OAuth2TokenResponse)
	}{
		{
			name: "success - without openid scope",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().UpdateOAuth2RefreshToken(gomock.Any(), gomock.Any()).
					Return(sql.AuthOauth2RefreshToken{}, nil) //nolint:exhaustruct

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				m.EXPECT().SignTokenWithClaims(gomock.Any(), gomock.Any()).
					Return("access-token", nil)

				return m
			},
			validated: oauth2.ValidatedRefreshGrant{
				UserID:    userID,
				TokenHash: tokenHash,
				RefreshToken: sql.AuthOauth2RefreshToken{ //nolint:exhaustruct
					ClientID: clientID,
					UserID:   userID,
					Scopes:   []string{"profile"},
				},
			},
			expectedErr: nil,
			verifyResp: func(t *testing.T, resp *api.OAuth2TokenResponse) {
				t.Helper()

				if resp == nil {
					t.Fatal("expected non-nil response")
				}

				if resp.AccessToken != "access-token" {
					t.Errorf("expected access token 'access-token', got %q", resp.AccessToken)
				}

				if resp.TokenType != "Bearer" {
					t.Errorf("expected token type 'Bearer', got %q", resp.TokenType)
				}

				if resp.ExpiresIn != 300 {
					t.Errorf("expected expires_in 300, got %d", resp.ExpiresIn)
				}

				if resp.RefreshToken == nil || *resp.RefreshToken == "" {
					t.Error("expected new refresh token to be set")
				}

				if resp.IdToken != nil {
					t.Error("expected no id_token without openid scope")
				}

				expectedScope := "profile"
				if resp.Scope == nil || *resp.Scope != expectedScope {
					t.Errorf("expected scope %q, got %v", expectedScope, resp.Scope)
				}
			},
		},
		{
			name: "success - with openid scope includes id_token",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().UpdateOAuth2RefreshToken(gomock.Any(), gomock.Any()).
					Return(sql.AuthOauth2RefreshToken{}, nil) //nolint:exhaustruct

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				m.EXPECT().SignTokenWithClaims(gomock.Any(), gomock.Any()).
					Return("fake-token", nil).
					Times(2)

				return m
			},
			validated: oauth2.ValidatedRefreshGrant{
				UserID:    userID,
				TokenHash: tokenHash,
				RefreshToken: sql.AuthOauth2RefreshToken{ //nolint:exhaustruct
					ClientID: clientID,
					UserID:   userID,
					Scopes:   []string{"openid"},
				},
			},
			expectedErr: nil,
			verifyResp: func(t *testing.T, resp *api.OAuth2TokenResponse) {
				t.Helper()

				if resp == nil {
					t.Fatal("expected non-nil response")
				}

				if resp.IdToken == nil {
					t.Fatal("expected id_token with openid scope")
				}

				if *resp.IdToken != "fake-token" {
					t.Errorf("expected id_token 'fake-token', got %q", *resp.IdToken)
				}
			},
		},
		{
			name: "success - openid with id_token sign failure still returns access token",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().UpdateOAuth2RefreshToken(gomock.Any(), gomock.Any()).
					Return(sql.AuthOauth2RefreshToken{}, nil) //nolint:exhaustruct

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				gomock.InOrder(
					m.EXPECT().SignTokenWithClaims(gomock.Any(), gomock.Any()).
						Return("access-token", nil),
					m.EXPECT().SignTokenWithClaims(gomock.Any(), gomock.Any()).
						Return("", errors.New("sign error")), //nolint:err113
				)

				return m
			},
			validated: oauth2.ValidatedRefreshGrant{
				UserID:    userID,
				TokenHash: tokenHash,
				RefreshToken: sql.AuthOauth2RefreshToken{ //nolint:exhaustruct
					ClientID: clientID,
					UserID:   userID,
					Scopes:   []string{"openid"},
				},
			},
			expectedErr: nil,
			verifyResp: func(t *testing.T, resp *api.OAuth2TokenResponse) {
				t.Helper()

				if resp == nil {
					t.Fatal("expected non-nil response")
				}

				if resp.AccessToken != "access-token" {
					t.Errorf("expected access token 'access-token', got %q", resp.AccessToken)
				}

				if resp.IdToken != nil {
					t.Error("expected no id_token when signing fails")
				}
			},
		},
		{
			name: "success - graphql scope includes hasura claims",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetUser(gomock.Any(), userID).Return(user, nil)
				m.EXPECT().GetUserRoles(gomock.Any(), userID).Return(userRoles, nil)
				m.EXPECT().UpdateOAuth2RefreshToken(gomock.Any(), gomock.Any()).
					Return(sql.AuthOauth2RefreshToken{}, nil) //nolint:exhaustruct

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				m.EXPECT().GraphQLClaims(
					gomock.Any(), userID, false, gomock.Any(), "user", nil, gomock.Any(),
				).Return("https://hasura.io/jwt/claims", map[string]any{
					"x-hasura-user-id":       userID.String(),
					"x-hasura-default-role":  "user",
					"x-hasura-allowed-roles": []string{"user", "editor"},
				}, nil)

				var capturedClaims map[string]any
				m.EXPECT().SignTokenWithClaims(gomock.Any(), gomock.Any()).
					DoAndReturn(func(claims map[string]any, _ time.Time) (string, error) {
						capturedClaims = claims

						return "fake-token", nil
					})

				t.Cleanup(func() {
					if capturedClaims == nil {
						t.Error("expected SignTokenWithClaims to be called")

						return
					}

					hasuraClaims, ok := capturedClaims["https://hasura.io/jwt/claims"]
					if !ok {
						t.Error("expected hasura claims in access token")
					}

					hc, ok := hasuraClaims.(map[string]any)
					if !ok {
						t.Error("expected hasura claims to be a map")

						return
					}

					if hc["x-hasura-user-id"] != userID.String() {
						t.Errorf("expected x-hasura-user-id %q, got %q",
							userID.String(), hc["x-hasura-user-id"])
					}
				})

				return m
			},
			validated: oauth2.ValidatedRefreshGrant{
				UserID:    userID,
				TokenHash: tokenHash,
				RefreshToken: sql.AuthOauth2RefreshToken{ //nolint:exhaustruct
					ClientID: clientID,
					UserID:   userID,
					Scopes:   []string{"graphql"},
				},
			},
			expectedErr: nil,
			verifyResp: func(t *testing.T, resp *api.OAuth2TokenResponse) {
				t.Helper()

				if resp == nil {
					t.Fatal("expected non-nil response")
				}

				if resp.AccessToken != "fake-token" {
					t.Errorf("expected access token 'fake-token', got %q", resp.AccessToken)
				}
			},
		},
		{
			name: "success - without graphql scope omits hasura claims",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().UpdateOAuth2RefreshToken(gomock.Any(), gomock.Any()).
					Return(sql.AuthOauth2RefreshToken{}, nil) //nolint:exhaustruct

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)

				var capturedClaims map[string]any
				m.EXPECT().SignTokenWithClaims(gomock.Any(), gomock.Any()).
					DoAndReturn(func(claims map[string]any, _ time.Time) (string, error) {
						capturedClaims = claims

						return "fake-token", nil
					})

				t.Cleanup(func() {
					if capturedClaims == nil {
						return
					}

					if _, ok := capturedClaims["https://hasura.io/jwt/claims"]; ok {
						t.Error("expected hasura claims to NOT be present without graphql scope")
					}
				})

				return m
			},
			validated: oauth2.ValidatedRefreshGrant{
				UserID:    userID,
				TokenHash: tokenHash,
				RefreshToken: sql.AuthOauth2RefreshToken{ //nolint:exhaustruct
					ClientID: clientID,
					UserID:   userID,
					Scopes:   []string{"profile"},
				},
			},
			expectedErr: nil,
			verifyResp: func(t *testing.T, resp *api.OAuth2TokenResponse) {
				t.Helper()

				if resp == nil {
					t.Fatal("expected non-nil response")
				}

				if resp.AccessToken != "fake-token" {
					t.Errorf("expected access token 'fake-token', got %q", resp.AccessToken)
				}
			},
		},
		{
			name: "error - access token sign failure",
			db:   mock.NewMockDBClient,
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				m.EXPECT().SignTokenWithClaims(gomock.Any(), gomock.Any()).
					Return("", errors.New("sign error")) //nolint:err113

				return m
			},
			validated: oauth2.ValidatedRefreshGrant{
				UserID:    userID,
				TokenHash: tokenHash,
				RefreshToken: sql.AuthOauth2RefreshToken{ //nolint:exhaustruct
					ClientID: clientID,
					UserID:   userID,
					Scopes:   []string{"profile"},
				},
			},
			expectedErr: &oauth2.Error{
				Err:         "server_error",
				Description: "Internal server error",
			},
			verifyResp: func(t *testing.T, resp *api.OAuth2TokenResponse) {
				t.Helper()

				if resp != nil {
					t.Errorf("expected nil response, got %v", resp)
				}
			},
		},
		{
			name: "error - graphql scope GetUser failure",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetUser(gomock.Any(), userID).
					Return(sql.AuthUser{}, errors.New("db error")) //nolint:exhaustruct,err113

				return m
			},
			signer: mock.NewMockSigner,
			validated: oauth2.ValidatedRefreshGrant{
				UserID:    userID,
				TokenHash: tokenHash,
				RefreshToken: sql.AuthOauth2RefreshToken{ //nolint:exhaustruct
					ClientID: clientID,
					UserID:   userID,
					Scopes:   []string{"graphql"},
				},
			},
			expectedErr: &oauth2.Error{
				Err:         "server_error",
				Description: "Internal server error",
			},
			verifyResp: func(t *testing.T, resp *api.OAuth2TokenResponse) {
				t.Helper()

				if resp != nil {
					t.Errorf("expected nil response, got %v", resp)
				}
			},
		},
		{
			name: "error - graphql scope GetUserRoles failure",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetUser(gomock.Any(), userID).Return(user, nil)
				m.EXPECT().GetUserRoles(gomock.Any(), userID).
					Return(nil, errors.New("db error")) //nolint:err113

				return m
			},
			signer: mock.NewMockSigner,
			validated: oauth2.ValidatedRefreshGrant{
				UserID:    userID,
				TokenHash: tokenHash,
				RefreshToken: sql.AuthOauth2RefreshToken{ //nolint:exhaustruct
					ClientID: clientID,
					UserID:   userID,
					Scopes:   []string{"graphql"},
				},
			},
			expectedErr: &oauth2.Error{
				Err:         "server_error",
				Description: "Internal server error",
			},
			verifyResp: func(t *testing.T, resp *api.OAuth2TokenResponse) {
				t.Helper()

				if resp != nil {
					t.Errorf("expected nil response, got %v", resp)
				}
			},
		},
		{
			name: "error - refresh token already consumed",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().UpdateOAuth2RefreshToken(gomock.Any(), gomock.Any()).
					Return(sql.AuthOauth2RefreshToken{}, pgx.ErrNoRows) //nolint:exhaustruct

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				m.EXPECT().SignTokenWithClaims(gomock.Any(), gomock.Any()).
					Return("access-token", nil)

				return m
			},
			validated: oauth2.ValidatedRefreshGrant{
				UserID:    userID,
				TokenHash: tokenHash,
				RefreshToken: sql.AuthOauth2RefreshToken{ //nolint:exhaustruct
					ClientID: clientID,
					UserID:   userID,
					Scopes:   []string{"profile"},
				},
			},
			expectedErr: &oauth2.Error{
				Err:         "invalid_grant",
				Description: "Invalid refresh token",
			},
			verifyResp: func(t *testing.T, resp *api.OAuth2TokenResponse) {
				t.Helper()

				if resp != nil {
					t.Errorf("expected nil response, got %v", resp)
				}
			},
		},
		{
			name: "error - update refresh token database error",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().UpdateOAuth2RefreshToken(gomock.Any(), gomock.Any()).
					Return(
						sql.AuthOauth2RefreshToken{}, //nolint:exhaustruct
						errors.New("db error"),       //nolint:err113
					)

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				m.EXPECT().SignTokenWithClaims(gomock.Any(), gomock.Any()).
					Return("access-token", nil)

				return m
			},
			validated: oauth2.ValidatedRefreshGrant{
				UserID:    userID,
				TokenHash: tokenHash,
				RefreshToken: sql.AuthOauth2RefreshToken{ //nolint:exhaustruct
					ClientID: clientID,
					UserID:   userID,
					Scopes:   []string{"profile"},
				},
			},
			expectedErr: &oauth2.Error{
				Err:         "server_error",
				Description: "Internal server error",
			},
			verifyResp: func(t *testing.T, resp *api.OAuth2TokenResponse) {
				t.Helper()

				if resp != nil {
					t.Errorf("expected nil response, got %v", resp)
				}
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			mockDB := tc.db(ctrl)
			mockSigner := tc.signer(ctrl)

			provider := oauth2.NewProvider(
				mockDB, mockSigner, nil, nil,
				config, nil,
			)

			gotResp, gotErr := provider.IssueTokensFromRefresh(
				context.Background(), &tc.validated, logger,
			)

			if diff := cmp.Diff(tc.expectedErr, gotErr); diff != "" {
				t.Errorf("error mismatch (-want +got):\n%s", diff)
			}

			tc.verifyResp(t, gotResp)
		})
	}
}
