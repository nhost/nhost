package oauth2_test

import (
	"context"
	"log/slog"
	"maps"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/oauth2"
	"github.com/nhost/nhost/services/auth/go/oauth2/mock"
	"github.com/nhost/nhost/services/auth/go/sql"
	"github.com/nhost/nhost/services/auth/go/tokenpurpose"
	"go.uber.org/mock/gomock"
)

//nolint:cyclop // Covers both grant paths with and without a configured audience.
func TestAccessTokenClaimsAtBothGrants(
	t *testing.T,
) {
	t.Parallel()

	for _, tc := range []struct{ name, audience, grant string }{
		{"code configured", "https://project.example", "code"},
		{"code unset", "", "code"},
		{"refresh configured", "https://project.example", "refresh"},
		{"refresh unset", "", "refresh"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			db := mock.NewMockDBClient(gomock.NewController(t))
			signer := mock.NewMockSigner(gomock.NewController(t))
			sessionID := uuid.New()
			userID := uuid.New()
			clientID := "test-client"

			var signed jwt.MapClaims
			signer.EXPECT().
				SignTokenWithClaims(gomock.Any(), gomock.Any(), tokenpurpose.OAuth2AccessToken).
				DoAndReturn(func(claims jwt.MapClaims, _ time.Time, _ tokenpurpose.Purpose) (string, error) {
					signed = claims
					return "signed-access", nil
				})

			provider := oauth2.NewProvider(db, signer, nil, nil, oauth2.Config{
				Audience: tc.audience, AccessTokenTTL: 300, RefreshTokenTTL: 3600,
			}, nil)
			if tc.grant == "code" {
				db.EXPECT().ConsumeOAuth2CodeAndInsertRefreshToken(gomock.Any(), gomock.Any()).
					Return(sql.AuthOauth2RefreshToken{ID: sessionID}, nil)

				resp, oauthErr := provider.IssueTokensFromCode(
					context.Background(),
					&oauth2.ValidatedCodeExchange{
						UserID: userID, CodeHash: "hash", AuthReq: sql.AuthOauth2AuthRequest{
							ClientID: clientID, Scopes: []string{"profile"},
						},
					},
					slog.Default(),
				)
				if oauthErr != nil || resp == nil || resp.AccessToken != "signed-access" {
					t.Fatalf("code response = %v, error = %v", resp, oauthErr)
				}
			} else {
				db.EXPECT().UpdateOAuth2RefreshToken(gomock.Any(), gomock.Any()).
					Return(sql.AuthOauth2RefreshToken{ID: sessionID}, nil)

				resp, oauthErr := provider.IssueTokensFromRefresh(
					context.Background(),
					&oauth2.ValidatedRefreshGrant{
						UserID: userID, TokenHash: "hash", RefreshToken: sql.AuthOauth2RefreshToken{
							ID:       sessionID,
							ClientID: clientID,
							UserID:   userID,
							Scopes:   []string{"profile"},
						},
					},
					slog.Default(),
				)
				if oauthErr != nil || resp == nil || resp.AccessToken != "signed-access" {
					t.Fatalf("refresh response = %v, error = %v", resp, oauthErr)
				}
			}

			wantAud := tc.audience
			if wantAud == "" {
				wantAud = clientID
			}

			if signed["sub"] != userID.String() || signed["scope"] != "profile" ||
				signed["aud"] != wantAud || signed["client_id"] != clientID || signed["sid"] != sessionID.String() {
				t.Errorf("unexpected claims: %v", signed)
			}

			jti, ok := signed["jti"].(string)

			parsed, err := uuid.Parse(jti)
			if !ok || err != nil || parsed.Version() != 4 {
				t.Errorf("invalid jti: %v", signed["jti"])
			}
		})
	}
}

func TestIntrospectionClientBinding(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name   string
		claims jwt.MapClaims
		active bool
	}{
		{"new project audience", jwt.MapClaims{"aud": "project", "client_id": "client"}, true},
		{"pre-change", jwt.MapClaims{"aud": "client"}, true},
		{"other client", jwt.MapClaims{"aud": "project", "client_id": "other"}, false},
		{"mismatching claim never falls back", jwt.MapClaims{"aud": "client", "client_id": "other"}, false},
		{"missing binding", jwt.MapClaims{"aud": "project"}, false},
		{"malformed binding", jwt.MapClaims{"aud": "client", "client_id": 123}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			db := mock.NewMockDBClient(gomock.NewController(t))
			signer := mock.NewMockSigner(gomock.NewController(t))

			db.EXPECT().
				GetOAuth2ClientByClientID(gomock.Any(), "client").
				Return(sql.AuthOauth2Client{ClientID: "client"}, nil)
			signer.EXPECT().Validate("access", tokenpurpose.OAuth2AccessToken).DoAndReturn(
				func(_ string, _ tokenpurpose.Purpose) (*jwt.Token, error) {
					claims := jwt.MapClaims{
						"sub": uuid.NewString(),
						"iss": "issuer",
						"iat": float64(time.Now().Add(-time.Minute).Unix()),
						"exp": float64(time.Now().Add(time.Hour).Unix()),
					}
					maps.Copy(claims, tc.claims)

					return &jwt.Token{Valid: true, Claims: claims}, nil
				})
			provider := oauth2.NewProvider(db, signer, nil, nil, oauth2.Config{}, nil)
			hint := api.OAuth2IntrospectRequestTokenTypeHintAccessToken
			clientID := "client"

			result, oauthErr := provider.IntrospectToken(
				context.Background(),
				&api.OAuth2IntrospectRequest{
					Token: "access", ClientId: &clientID, TokenTypeHint: &hint,
				},
				slog.Default(),
			)
			if oauthErr != nil || result == nil {
				t.Fatalf("result = %v, error = %v", result, oauthErr)
			}

			if result.Active != tc.active {
				t.Errorf("active = %t, want %t", result.Active, tc.active)
			}

			if tc.active && (result.ClientId == nil || *result.ClientId != clientID) {
				t.Errorf("client_id = %v", result.ClientId)
			}
		})
	}
}
