package oauth2_test

import (
	"context"
	"errors"
	"log/slog"
	"net/url"
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

func TestGetLoginRequest(t *testing.T) {
	t.Parallel()

	logger := slog.Default()
	requestID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")
	clientID := "test-client"
	redirectURI := "https://example.com/callback"

	validAuthReq := sql.AuthOauth2AuthRequest{ //nolint:exhaustruct
		ID:          requestID,
		ClientID:    clientID,
		Scopes:      []string{"openid", "profile"},
		RedirectUri: redirectURI,
		ExpiresAt:   sql.TimestampTz(time.Now().Add(time.Hour)),
	}

	client := sql.AuthOauth2Client{ //nolint:exhaustruct
		ClientID: clientID,
	}

	cases := []struct {
		name             string
		db               func(ctrl *gomock.Controller) *mock.MockDBClient
		signer           func(ctrl *gomock.Controller) *mock.MockSigner
		expectedResponse *api.OAuth2LoginResponse
		expectedErr      *oauth2.Error
	}{
		{
			name: "success",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2AuthRequest(gomock.Any(), requestID).
					Return(validAuthReq, nil)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(client, nil)

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				return m
			},
			expectedResponse: &api.OAuth2LoginResponse{
				RequestId:   requestID,
				ClientId:    clientID,
				Scopes:      []string{"openid", "profile"},
				RedirectUri: redirectURI,
			},
			expectedErr: nil,
		},
		{
			name: "error - auth request not found",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2AuthRequest(gomock.Any(), requestID).
					Return(sql.AuthOauth2AuthRequest{}, pgx.ErrNoRows) //nolint:exhaustruct

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				return m
			},
			expectedResponse: nil,
			expectedErr: &oauth2.Error{
				Err:         "invalid_request",
				Description: "Unknown authorization request",
			},
		},
		{
			name: "error - database error getting auth request",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2AuthRequest(gomock.Any(), requestID).
					Return(
						sql.AuthOauth2AuthRequest{},      //nolint:exhaustruct
						errors.New("connection refused"), //nolint:err113
					)

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				return m
			},
			expectedResponse: nil,
			expectedErr: &oauth2.Error{
				Err:         "server_error",
				Description: "Internal server error",
			},
		},
		{
			name: "error - auth request expired",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)

				expiredAuthReq := validAuthReq
				expiredAuthReq.ExpiresAt = sql.TimestampTz(time.Now().Add(-time.Hour))

				m.EXPECT().GetOAuth2AuthRequest(gomock.Any(), requestID).
					Return(expiredAuthReq, nil)

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				return m
			},
			expectedResponse: nil,
			expectedErr: &oauth2.Error{
				Err:         "invalid_request",
				Description: "Authorization request expired",
			},
		},
		{
			name: "error - database error getting client",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2AuthRequest(gomock.Any(), requestID).
					Return(validAuthReq, nil)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(
						sql.AuthOauth2Client{},           //nolint:exhaustruct
						errors.New("connection refused"), //nolint:err113
					)

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				return m
			},
			expectedResponse: nil,
			expectedErr: &oauth2.Error{
				Err:         "server_error",
				Description: "Internal server error",
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
				oauth2.Config{}, //nolint:exhaustruct
				nil,
			)

			gotResp, gotErr := provider.GetLoginRequest(
				context.Background(), requestID, logger,
			)

			if diff := cmp.Diff(tc.expectedErr, gotErr); diff != "" {
				t.Errorf("error mismatch (-want +got):\n%s", diff)
			}

			if diff := cmp.Diff(tc.expectedResponse, gotResp); diff != "" {
				t.Errorf("response mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestCompleteLogin(t *testing.T) { //nolint:maintidx,gocognit,cyclop
	t.Parallel()

	logger := slog.Default()
	requestID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")
	userID := uuid.MustParse("a1b2c3d4-e5f6-7890-abcd-ef1234567890")
	clientID := "test-client"
	redirectURI := "https://example.com/callback"
	issuer := "https://auth.example.com"

	validAuthReq := sql.AuthOauth2AuthRequest{ //nolint:exhaustruct
		ID:          requestID,
		ClientID:    clientID,
		Scopes:      []string{"openid", "profile"},
		RedirectUri: redirectURI,
		ExpiresAt:   sql.TimestampTz(time.Now().Add(time.Hour)),
		Done:        false,
	}

	cases := []struct {
		name        string
		db          func(ctrl *gomock.Controller) *mock.MockDBClient
		signer      func(ctrl *gomock.Controller) *mock.MockSigner
		expectedErr *oauth2.Error
		verifyResp  func(t *testing.T, resp *api.OAuth2LoginCompleteResponse)
	}{
		{
			name: "success - without state",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2AuthRequest(gomock.Any(), requestID).
					Return(validAuthReq, nil)
				m.EXPECT().CompleteOAuth2LoginAndInsertCode(gomock.Any(), gomock.Any()).
					Return(sql.AuthOauth2AuthorizationCode{}, nil) //nolint:exhaustruct

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				m.EXPECT().Issuer().Return(issuer)

				return m
			},
			expectedErr: nil,
			verifyResp: func(t *testing.T, resp *api.OAuth2LoginCompleteResponse) {
				t.Helper()

				if resp == nil {
					t.Fatal("expected non-nil response")
				}

				parsed, err := url.Parse(resp.RedirectUri)
				if err != nil {
					t.Fatalf("failed to parse redirect URI: %v", err)
				}

				if parsed.Scheme+"://"+parsed.Host+parsed.Path != redirectURI {
					t.Errorf(
						"expected base URI %q, got %q",
						redirectURI,
						parsed.Scheme+"://"+parsed.Host+parsed.Path,
					)
				}

				q := parsed.Query()

				if q.Get("code") == "" {
					t.Error("expected code query parameter to be set")
				}

				if q.Get("iss") != issuer {
					t.Errorf("expected iss %q, got %q", issuer, q.Get("iss"))
				}

				if q.Has("state") {
					t.Error("expected state query parameter to be absent")
				}
			},
		},
		{
			name: "success - with state",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)

				authReqWithState := validAuthReq
				authReqWithState.State = pgtype.Text{String: "some-state", Valid: true}

				m.EXPECT().GetOAuth2AuthRequest(gomock.Any(), requestID).
					Return(authReqWithState, nil)
				m.EXPECT().CompleteOAuth2LoginAndInsertCode(gomock.Any(), gomock.Any()).
					Return(sql.AuthOauth2AuthorizationCode{}, nil) //nolint:exhaustruct

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				m.EXPECT().Issuer().Return(issuer)

				return m
			},
			expectedErr: nil,
			verifyResp: func(t *testing.T, resp *api.OAuth2LoginCompleteResponse) {
				t.Helper()

				if resp == nil {
					t.Fatal("expected non-nil response")
				}

				parsed, err := url.Parse(resp.RedirectUri)
				if err != nil {
					t.Fatalf("failed to parse redirect URI: %v", err)
				}

				q := parsed.Query()

				if q.Get("code") == "" {
					t.Error("expected code query parameter to be set")
				}

				if q.Get("iss") != issuer {
					t.Errorf("expected iss %q, got %q", issuer, q.Get("iss"))
				}

				if q.Get("state") != "some-state" {
					t.Errorf("expected state 'some-state', got %q", q.Get("state"))
				}
			},
		},
		{
			name: "success - with empty state (not included in redirect)",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)

				authReqEmptyState := validAuthReq
				authReqEmptyState.State = pgtype.Text{String: "", Valid: true}

				m.EXPECT().GetOAuth2AuthRequest(gomock.Any(), requestID).
					Return(authReqEmptyState, nil)
				m.EXPECT().CompleteOAuth2LoginAndInsertCode(gomock.Any(), gomock.Any()).
					Return(sql.AuthOauth2AuthorizationCode{}, nil) //nolint:exhaustruct

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				m.EXPECT().Issuer().Return(issuer)

				return m
			},
			expectedErr: nil,
			verifyResp: func(t *testing.T, resp *api.OAuth2LoginCompleteResponse) {
				t.Helper()

				if resp == nil {
					t.Fatal("expected non-nil response")
				}

				parsed, err := url.Parse(resp.RedirectUri)
				if err != nil {
					t.Fatalf("failed to parse redirect URI: %v", err)
				}

				if parsed.Query().Has("state") {
					t.Error("expected state query parameter to be absent for empty state")
				}
			},
		},
		{
			name: "success - with invalid state (Valid=false, not included in redirect)",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)

				authReqInvalidState := validAuthReq
				authReqInvalidState.State = pgtype.Text{} //nolint:exhaustruct

				m.EXPECT().GetOAuth2AuthRequest(gomock.Any(), requestID).
					Return(authReqInvalidState, nil)
				m.EXPECT().CompleteOAuth2LoginAndInsertCode(gomock.Any(), gomock.Any()).
					Return(sql.AuthOauth2AuthorizationCode{}, nil) //nolint:exhaustruct

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				m.EXPECT().Issuer().Return(issuer)

				return m
			},
			expectedErr: nil,
			verifyResp: func(t *testing.T, resp *api.OAuth2LoginCompleteResponse) {
				t.Helper()

				if resp == nil {
					t.Fatal("expected non-nil response")
				}

				parsed, err := url.Parse(resp.RedirectUri)
				if err != nil {
					t.Fatalf("failed to parse redirect URI: %v", err)
				}

				if parsed.Query().Has("state") {
					t.Error("expected state query parameter to be absent for invalid state")
				}
			},
		},
		{
			name: "success - redirect URI with existing query params",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)

				authReqWithParams := validAuthReq
				authReqWithParams.RedirectUri = "https://example.com/callback?foo=bar"

				m.EXPECT().GetOAuth2AuthRequest(gomock.Any(), requestID).
					Return(authReqWithParams, nil)
				m.EXPECT().CompleteOAuth2LoginAndInsertCode(gomock.Any(), gomock.Any()).
					Return(sql.AuthOauth2AuthorizationCode{}, nil) //nolint:exhaustruct

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				m.EXPECT().Issuer().Return(issuer)

				return m
			},
			expectedErr: nil,
			verifyResp: func(t *testing.T, resp *api.OAuth2LoginCompleteResponse) {
				t.Helper()

				if resp == nil {
					t.Fatal("expected non-nil response")
				}

				parsed, err := url.Parse(resp.RedirectUri)
				if err != nil {
					t.Fatalf("failed to parse redirect URI: %v", err)
				}

				q := parsed.Query()

				if q.Get("foo") != "bar" {
					t.Errorf("expected existing param foo=bar, got %q", q.Get("foo"))
				}

				if q.Get("code") == "" {
					t.Error("expected code query parameter to be set")
				}

				if q.Get("iss") != issuer {
					t.Errorf("expected iss %q, got %q", issuer, q.Get("iss"))
				}
			},
		},
		{
			name: "error - auth request not found",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2AuthRequest(gomock.Any(), requestID).
					Return(sql.AuthOauth2AuthRequest{}, pgx.ErrNoRows) //nolint:exhaustruct

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				return m
			},
			expectedErr: &oauth2.Error{
				Err:         "invalid_request",
				Description: "Unknown authorization request",
			},
			verifyResp: func(t *testing.T, resp *api.OAuth2LoginCompleteResponse) {
				t.Helper()

				if resp != nil {
					t.Errorf("expected nil response, got %v", resp)
				}
			},
		},
		{
			name: "error - database error getting auth request",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2AuthRequest(gomock.Any(), requestID).
					Return(
						sql.AuthOauth2AuthRequest{},      //nolint:exhaustruct
						errors.New("connection refused"), //nolint:err113
					)

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				return m
			},
			expectedErr: &oauth2.Error{
				Err:         "server_error",
				Description: "Internal server error",
			},
			verifyResp: func(t *testing.T, resp *api.OAuth2LoginCompleteResponse) {
				t.Helper()

				if resp != nil {
					t.Errorf("expected nil response, got %v", resp)
				}
			},
		},
		{
			name: "error - auth request expired",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)

				expiredAuthReq := validAuthReq
				expiredAuthReq.ExpiresAt = sql.TimestampTz(time.Now().Add(-time.Hour))

				m.EXPECT().GetOAuth2AuthRequest(gomock.Any(), requestID).
					Return(expiredAuthReq, nil)

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				return m
			},
			expectedErr: &oauth2.Error{
				Err:         "invalid_request",
				Description: "Authorization request expired",
			},
			verifyResp: func(t *testing.T, resp *api.OAuth2LoginCompleteResponse) {
				t.Helper()

				if resp != nil {
					t.Errorf("expected nil response, got %v", resp)
				}
			},
		},
		{
			name: "error - auth request already completed",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)

				doneAuthReq := validAuthReq
				doneAuthReq.Done = true

				m.EXPECT().GetOAuth2AuthRequest(gomock.Any(), requestID).
					Return(doneAuthReq, nil)

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				return m
			},
			expectedErr: &oauth2.Error{
				Err:         "invalid_request",
				Description: "Authorization request already completed",
			},
			verifyResp: func(t *testing.T, resp *api.OAuth2LoginCompleteResponse) {
				t.Helper()

				if resp != nil {
					t.Errorf("expected nil response, got %v", resp)
				}
			},
		},
		{
			name: "error - database error completing login",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2AuthRequest(gomock.Any(), requestID).
					Return(validAuthReq, nil)
				m.EXPECT().CompleteOAuth2LoginAndInsertCode(gomock.Any(), gomock.Any()).
					Return(
						sql.AuthOauth2AuthorizationCode{}, //nolint:exhaustruct
						errors.New("db error"),            //nolint:err113
					)

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				return m
			},
			expectedErr: &oauth2.Error{
				Err:         "server_error",
				Description: "Internal server error",
			},
			verifyResp: func(t *testing.T, resp *api.OAuth2LoginCompleteResponse) {
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
				oauth2.Config{}, //nolint:exhaustruct
				nil,
			)

			gotResp, gotErr := provider.CompleteLogin(
				context.Background(), requestID, userID, logger,
			)

			if diff := cmp.Diff(tc.expectedErr, gotErr); diff != "" {
				t.Errorf("error mismatch (-want +got):\n%s", diff)
			}

			tc.verifyResp(t, gotResp)
		})
	}
}
