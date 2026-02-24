package oauth2_test

import (
	"context"
	"log/slog"
	"strings"
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

func newTestProvider(
	db oauth2.DBClient,
	signer oauth2.Signer,
	config oauth2.Config,
) *oauth2.Provider {
	return oauth2.NewProvider(
		db,
		signer,
		nil,
		func(_, _ string) bool { return true },
		config,
		nil,
	)
}

func TestCreateDeviceAuthorization(t *testing.T) {
	t.Parallel()

	logger := slog.Default()
	clientID := "test-client"

	testClient := sql.AuthOauth2Client{ //nolint:exhaustruct
		ClientID: clientID,
		Scopes:   []string{"openid", "profile", "email"},
	}

	cases := []struct {
		name        string
		config      oauth2.Config
		db          func(ctrl *gomock.Controller) *mock.MockDBClient
		request     api.OAuth2DeviceAuthorizationRequest
		expectedErr *oauth2.Error
	}{
		{
			name:   "success - default scopes from client",
			config: oauth2.Config{ClientURL: "https://app.example.com"}, //nolint:exhaustruct
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(testClient, nil)
				m.EXPECT().InsertOAuth2DeviceCode(gomock.Any(), gomock.Any()).
					Return(sql.AuthOauth2DeviceCode{}, nil) //nolint:exhaustruct

				return m
			},
			request: api.OAuth2DeviceAuthorizationRequest{
				ClientId: clientID,
				Scope:    nil,
			},
			expectedErr: nil,
		},
		{
			name:   "success - explicit scope",
			config: oauth2.Config{ClientURL: "https://app.example.com"}, //nolint:exhaustruct
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(testClient, nil)
				m.EXPECT().InsertOAuth2DeviceCode(gomock.Any(), gomock.Any()).
					Return(sql.AuthOauth2DeviceCode{}, nil) //nolint:exhaustruct

				return m
			},
			request: api.OAuth2DeviceAuthorizationRequest{
				ClientId: clientID,
				Scope:    new("openid"),
			},
			expectedErr: nil,
		},
		{
			name:   "unknown client",
			config: oauth2.Config{ClientURL: "https://app.example.com"}, //nolint:exhaustruct
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(sql.AuthOauth2Client{}, pgx.ErrNoRows) //nolint:exhaustruct

				return m
			},
			request: api.OAuth2DeviceAuthorizationRequest{
				ClientId: clientID,
				Scope:    nil,
			},
			expectedErr: &oauth2.Error{Err: "invalid_client", Description: "Unknown client"},
		},
		{
			name:   "invalid scope",
			config: oauth2.Config{ClientURL: "https://app.example.com"}, //nolint:exhaustruct
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(testClient, nil)

				return m
			},
			request: api.OAuth2DeviceAuthorizationRequest{
				ClientId: clientID,
				Scope:    new("invalid_scope"),
			},
			expectedErr: &oauth2.Error{
				Err:         "invalid_scope",
				Description: "invalid scope: invalid_scope",
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			db := tc.db(ctrl)
			signer := mock.NewMockSigner(ctrl)

			p := newTestProvider(db, signer, tc.config)

			resp, oauthErr := p.CreateDeviceAuthorization(ctx(), &tc.request, logger)
			if diff := cmp.Diff(tc.expectedErr, oauthErr); diff != "" {
				t.Fatalf("unexpected error (-want +got):\n%s", diff)
			}

			if oauthErr == nil {
				assertDeviceAuthorizationResponse(t, resp)
			}
		})
	}
}

func assertDeviceAuthorizationResponse(
	t *testing.T,
	resp *api.OAuth2DeviceAuthorizationResponse,
) {
	t.Helper()

	if resp.DeviceCode == "" {
		t.Error("expected non-empty device_code")
	}

	if resp.UserCode == "" {
		t.Error("expected non-empty user_code")
	}

	parts := strings.Split(resp.UserCode, "-")
	if len(parts) != 2 || len(parts[0]) != 4 || len(parts[1]) != 4 {
		t.Errorf("user_code format should be XXXX-XXXX, got %s", resp.UserCode)
	}

	if resp.ExpiresIn <= 0 {
		t.Error("expected positive expires_in")
	}

	if resp.Interval != oauth2.DeviceCodePollingSec {
		t.Errorf(
			"expected interval %d, got %d",
			oauth2.DeviceCodePollingSec,
			resp.Interval,
		)
	}

	if resp.VerificationUri == "" {
		t.Error("expected non-empty verification_uri")
	}

	if resp.VerificationUriComplete == nil {
		t.Error("expected non-nil verification_uri_complete")
	}
}

func TestGetDeviceVerification(t *testing.T) {
	t.Parallel()

	logger := slog.Default()
	clientID := "test-client"

	pendingDC := sql.AuthOauth2DeviceCode{ //nolint:exhaustruct
		ClientID: clientID,
		Scopes:   []string{"openid"},
		Status:   "pending",
	}

	cases := []struct {
		name        string
		db          func(ctrl *gomock.Controller) *mock.MockDBClient
		userCode    string
		expected    *api.OAuth2DeviceVerifyResponse
		expectedErr *oauth2.Error
	}{
		{
			name: "success",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2DeviceCodeByUserCode(gomock.Any(), "ABCDEFGH").
					Return(pendingDC, nil)

				return m
			},
			userCode: "ABCD-EFGH",
			expected: &api.OAuth2DeviceVerifyResponse{
				ClientId: clientID,
				Scopes:   []string{"openid"},
			},
			expectedErr: nil,
		},
		{
			name: "not found",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2DeviceCodeByUserCode(gomock.Any(), "ZZZZZZZZ").
					Return(sql.AuthOauth2DeviceCode{}, pgx.ErrNoRows) //nolint:exhaustruct

				return m
			},
			userCode: "ZZZZ-ZZZZ",
			expected: nil,
			expectedErr: &oauth2.Error{
				Err:         "invalid_request",
				Description: "Unknown or expired user code",
			},
		},
		{
			name: "already processed",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				approvedDC := pendingDC
				approvedDC.Status = "approved"
				m.EXPECT().GetOAuth2DeviceCodeByUserCode(gomock.Any(), "ABCDEFGH").
					Return(approvedDC, nil)

				return m
			},
			userCode: "ABCD-EFGH",
			expected: nil,
			expectedErr: &oauth2.Error{
				Err:         "invalid_request",
				Description: "Device authorization request already processed",
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			db := tc.db(ctrl)
			signer := mock.NewMockSigner(ctrl)
			config := oauth2.Config{} //nolint:exhaustruct

			p := newTestProvider(db, signer, config)

			resp, oauthErr := p.GetDeviceVerification(ctx(), tc.userCode, logger)
			if diff := cmp.Diff(tc.expectedErr, oauthErr); diff != "" {
				t.Fatalf("unexpected error (-want +got):\n%s", diff)
			}

			if diff := cmp.Diff(tc.expected, resp); diff != "" {
				t.Fatalf("unexpected response (-want +got):\n%s", diff)
			}
		})
	}
}

func TestCompleteDeviceVerification(t *testing.T) {
	t.Parallel()

	logger := slog.Default()
	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")
	clientID := "test-client"

	approvedDC := sql.AuthOauth2DeviceCode{ //nolint:exhaustruct
		ClientID: clientID,
		Scopes:   []string{"openid"},
		Status:   "approved",
		UserID:   pgtype.UUID{Bytes: userID, Valid: true},
	}

	cases := []struct {
		name        string
		db          func(ctrl *gomock.Controller) *mock.MockDBClient
		userCode    string
		action      api.OAuth2DeviceVerifyRequestAction
		expected    *api.OAuth2DeviceVerifyResponse
		expectedErr *oauth2.Error
	}{
		{
			name: "approve success",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().ApproveOAuth2DeviceCode(gomock.Any(), gomock.Any()).
					Return(approvedDC, nil)

				return m
			},
			userCode: "ABCD-EFGH",
			action:   api.Approve,
			expected: &api.OAuth2DeviceVerifyResponse{
				ClientId: clientID,
				Scopes:   []string{"openid"},
			},
			expectedErr: nil,
		},
		{
			name: "deny success",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().DenyOAuth2DeviceCode(gomock.Any(), "ABCDEFGH").
					Return(nil)

				return m
			},
			userCode: "ABCD-EFGH",
			action:   api.Deny,
			expected: &api.OAuth2DeviceVerifyResponse{
				ClientId: "",
				Scopes:   nil,
			},
			expectedErr: nil,
		},
		{
			name: "approve not found",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().ApproveOAuth2DeviceCode(gomock.Any(), gomock.Any()).
					Return(sql.AuthOauth2DeviceCode{}, pgx.ErrNoRows) //nolint:exhaustruct

				return m
			},
			userCode: "ABCD-EFGH",
			action:   api.Approve,
			expected: nil,
			expectedErr: &oauth2.Error{
				Err:         "invalid_request",
				Description: "Unknown, expired, or already processed user code",
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			db := tc.db(ctrl)
			signer := mock.NewMockSigner(ctrl)
			config := oauth2.Config{} //nolint:exhaustruct

			p := newTestProvider(db, signer, config)

			resp, oauthErr := p.CompleteDeviceVerification(
				ctx(), tc.userCode, userID, tc.action, logger,
			)
			if diff := cmp.Diff(tc.expectedErr, oauthErr); diff != "" {
				t.Fatalf("unexpected error (-want +got):\n%s", diff)
			}

			if diff := cmp.Diff(tc.expected, resp); diff != "" {
				t.Fatalf("unexpected response (-want +got):\n%s", diff)
			}
		})
	}
}

func TestValidateDeviceCodeGrant(t *testing.T) {
	t.Parallel()

	logger := slog.Default()
	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")
	clientID := "test-client"
	deviceCodeValue := "test-device-code"
	codeHash := oauth2.HashToken(deviceCodeValue)

	publicClient := sql.AuthOauth2Client{ //nolint:exhaustruct
		ClientID: clientID,
	}

	pendingDC := sql.AuthOauth2DeviceCode{ //nolint:exhaustruct
		ClientID:        clientID,
		Status:          "pending",
		PollingInterval: 5,
	}

	approvedDC := sql.AuthOauth2DeviceCode{ //nolint:exhaustruct
		ClientID:        clientID,
		Status:          "approved",
		UserID:          pgtype.UUID{Bytes: userID, Valid: true},
		PollingInterval: 5,
		Scopes:          []string{"openid"},
	}

	deniedDC := sql.AuthOauth2DeviceCode{ //nolint:exhaustruct
		ClientID:        clientID,
		Status:          "denied",
		PollingInterval: 5,
	}

	recentlyPolledDC := sql.AuthOauth2DeviceCode{ //nolint:exhaustruct
		ClientID:        clientID,
		Status:          "pending",
		PollingInterval: 5,
		LastPolledAt:    sql.TimestampTz(time.Now()),
	}

	cases := []struct {
		name           string
		db             func(ctrl *gomock.Controller) *mock.MockDBClient
		request        api.OAuth2TokenRequest
		expectedResult *oauth2.ValidatedDeviceCodeGrant
		expectedErr    *oauth2.Error
	}{
		{
			name: "missing device_code",
			db:   mock.NewMockDBClient,
			request: api.OAuth2TokenRequest{ //nolint:exhaustruct
				GrantType: api.UrnIetfParamsOauthGrantTypeDeviceCode,
			},
			expectedResult: nil,
			expectedErr: &oauth2.Error{
				Err:         "invalid_request",
				Description: "Missing device_code",
			},
		},
		{
			name: "expired token",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2DeviceCodeByHash(gomock.Any(), codeHash).
					Return(sql.AuthOauth2DeviceCode{}, pgx.ErrNoRows) //nolint:exhaustruct

				return m
			},
			request: api.OAuth2TokenRequest{ //nolint:exhaustruct
				GrantType:  api.UrnIetfParamsOauthGrantTypeDeviceCode,
				DeviceCode: &deviceCodeValue,
				ClientId:   &clientID,
			},
			expectedResult: nil,
			expectedErr: &oauth2.Error{
				Err:         "expired_token",
				Description: "Device code expired or not found",
			},
		},
		{
			name: "authorization_pending",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2DeviceCodeByHash(gomock.Any(), codeHash).
					Return(pendingDC, nil)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(publicClient, nil)
				m.EXPECT().UpdateOAuth2DeviceCodePolledAt(gomock.Any(), codeHash).
					Return(nil)

				return m
			},
			request: api.OAuth2TokenRequest{ //nolint:exhaustruct
				GrantType:  api.UrnIetfParamsOauthGrantTypeDeviceCode,
				DeviceCode: &deviceCodeValue,
				ClientId:   &clientID,
			},
			expectedResult: nil,
			expectedErr: &oauth2.Error{
				Err:         "authorization_pending",
				Description: "The authorization request is still pending",
			},
		},
		{
			name: "slow_down",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2DeviceCodeByHash(gomock.Any(), codeHash).
					Return(recentlyPolledDC, nil)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(publicClient, nil)

				return m
			},
			request: api.OAuth2TokenRequest{ //nolint:exhaustruct
				GrantType:  api.UrnIetfParamsOauthGrantTypeDeviceCode,
				DeviceCode: &deviceCodeValue,
				ClientId:   &clientID,
			},
			expectedResult: nil,
			expectedErr: &oauth2.Error{
				Err:         "slow_down",
				Description: "Polling too frequently",
			},
		},
		{
			name: "access_denied",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2DeviceCodeByHash(gomock.Any(), codeHash).
					Return(deniedDC, nil)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(publicClient, nil)
				m.EXPECT().UpdateOAuth2DeviceCodePolledAt(gomock.Any(), codeHash).
					Return(nil)

				return m
			},
			request: api.OAuth2TokenRequest{ //nolint:exhaustruct
				GrantType:  api.UrnIetfParamsOauthGrantTypeDeviceCode,
				DeviceCode: &deviceCodeValue,
				ClientId:   &clientID,
			},
			expectedResult: nil,
			expectedErr: &oauth2.Error{
				Err:         "access_denied",
				Description: "The user denied the request",
			},
		},
		{
			name: "success - approved",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2DeviceCodeByHash(gomock.Any(), codeHash).
					Return(approvedDC, nil)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(publicClient, nil)
				m.EXPECT().UpdateOAuth2DeviceCodePolledAt(gomock.Any(), codeHash).
					Return(nil)

				return m
			},
			request: api.OAuth2TokenRequest{ //nolint:exhaustruct
				GrantType:  api.UrnIetfParamsOauthGrantTypeDeviceCode,
				DeviceCode: &deviceCodeValue,
				ClientId:   &clientID,
			},
			expectedResult: &oauth2.ValidatedDeviceCodeGrant{
				DeviceCode: approvedDC,
				CodeHash:   codeHash,
				UserID:     userID,
			},
			expectedErr: nil,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			db := tc.db(ctrl)
			signer := mock.NewMockSigner(ctrl)
			config := oauth2.Config{} //nolint:exhaustruct

			p := newTestProvider(db, signer, config)

			result, oauthErr := p.ValidateDeviceCodeGrant(ctx(), &tc.request, logger)
			if diff := cmp.Diff(tc.expectedErr, oauthErr); diff != "" {
				t.Fatalf("unexpected error (-want +got):\n%s", diff)
			}

			if diff := cmp.Diff(
				tc.expectedResult,
				result,
			); diff != "" {
				t.Fatalf("unexpected result (-want +got):\n%s", diff)
			}
		})
	}
}

func TestIssueTokensFromDeviceCode(t *testing.T) {
	t.Parallel()

	logger := slog.Default()
	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")
	clientID := "test-client"
	codeHash := "test-hash"

	cases := []struct {
		name        string
		db          func(ctrl *gomock.Controller) *mock.MockDBClient
		signer      func(ctrl *gomock.Controller) *mock.MockSigner
		validated   *oauth2.ValidatedDeviceCodeGrant
		checkResp   bool
		expectedErr *oauth2.Error
	}{
		{
			name: "success without openid",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().ConsumeOAuth2DeviceCodeAndInsertRefreshToken(
					gomock.Any(), gomock.Any(),
				).Return(sql.AuthOauth2RefreshToken{}, nil) //nolint:exhaustruct

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				m.EXPECT().SignTokenWithClaims(gomock.Any(), gomock.Any()).
					Return("access-token", nil)

				return m
			},
			validated: &oauth2.ValidatedDeviceCodeGrant{
				DeviceCode: sql.AuthOauth2DeviceCode{ //nolint:exhaustruct
					ClientID: clientID,
					Scopes:   []string{"profile"},
				},
				CodeHash: codeHash,
				UserID:   userID,
			},
			checkResp:   true,
			expectedErr: nil,
		},
		{
			name: "success with openid",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().ConsumeOAuth2DeviceCodeAndInsertRefreshToken(
					gomock.Any(), gomock.Any(),
				).Return(sql.AuthOauth2RefreshToken{}, nil) //nolint:exhaustruct

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				// Access token
				m.EXPECT().SignTokenWithClaims(gomock.Any(), gomock.Any()).
					Return("access-token", nil)
				// ID token
				m.EXPECT().SignTokenWithClaims(gomock.Any(), gomock.Any()).
					Return("id-token", nil)

				return m
			},
			validated: &oauth2.ValidatedDeviceCodeGrant{
				DeviceCode: sql.AuthOauth2DeviceCode{ //nolint:exhaustruct
					ClientID: clientID,
					Scopes:   []string{"openid"},
				},
				CodeHash: codeHash,
				UserID:   userID,
			},
			checkResp:   true,
			expectedErr: nil,
		},
		{
			name: "already consumed",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().ConsumeOAuth2DeviceCodeAndInsertRefreshToken(
					gomock.Any(), gomock.Any(),
				).Return(sql.AuthOauth2RefreshToken{}, pgx.ErrNoRows) //nolint:exhaustruct

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				m.EXPECT().SignTokenWithClaims(gomock.Any(), gomock.Any()).
					Return("access-token", nil)

				return m
			},
			validated: &oauth2.ValidatedDeviceCodeGrant{
				DeviceCode: sql.AuthOauth2DeviceCode{ //nolint:exhaustruct
					ClientID: clientID,
					Scopes:   []string{"profile"},
				},
				CodeHash: codeHash,
				UserID:   userID,
			},
			checkResp: false,
			expectedErr: &oauth2.Error{
				Err:         "invalid_grant",
				Description: "Device code already consumed",
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			db := tc.db(ctrl)
			signer := tc.signer(ctrl)
			config := oauth2.Config{ //nolint:exhaustruct
				AccessTokenTTL:  900,
				RefreshTokenTTL: 2592000,
			}

			p := newTestProvider(db, signer, config)

			resp, oauthErr := p.IssueTokensFromDeviceCode(ctx(), tc.validated, logger)
			if diff := cmp.Diff(tc.expectedErr, oauthErr); diff != "" {
				t.Fatalf("unexpected error (-want +got):\n%s", diff)
			}

			if tc.checkResp && resp != nil {
				if resp.AccessToken == "" {
					t.Error("expected non-empty access_token")
				}

				if resp.RefreshToken == nil || *resp.RefreshToken == "" {
					t.Error("expected non-empty refresh_token")
				}

				if resp.TokenType != "Bearer" {
					t.Errorf("expected token_type Bearer, got %s", resp.TokenType)
				}
			}
		})
	}
}

func ctx() context.Context {
	return context.Background()
}

//go:fix inline
func ptr[T any](x T) *T { return new(x) }
