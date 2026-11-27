package controller_test

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"log/slog"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/nhost/nhost/services/auth/go/oauth2"
	oauthmock "github.com/nhost/nhost/services/auth/go/oauth2/mock"
	"github.com/nhost/nhost/services/auth/go/sql"
	"github.com/nhost/nhost/services/auth/go/tokenpurpose"
	"go.uber.org/mock/gomock"
)

//nolint:gocognit,cyclop // Checks both grants and ID-token invariants in the same issuance flow.
func TestSignedOAuth2Grants(
	t *testing.T,
) {
	t.Parallel()

	for _, audience := range []string{"project", ""} {
		t.Run("audience="+audience, func(t *testing.T) {
			t.Parallel()
			getter := newAudienceGetter(t, audience)
			db := oauthmock.NewMockDBClient(gomock.NewController(t))
			sessionID := uuid.New()
			userID := uuid.New()
			clientID := "client"

			db.EXPECT().ConsumeOAuth2CodeAndInsertRefreshToken(gomock.Any(), gomock.Any()).
				Return(sql.AuthOauth2RefreshToken{ID: sessionID}, nil)
			db.EXPECT().UpdateOAuth2RefreshToken(gomock.Any(), gomock.Any()).
				Return(sql.AuthOauth2RefreshToken{ID: sessionID}, nil)
			provider := oauth2.NewProvider(db, getter, nil, nil, oauth2.Config{
				Audience: getter.Audience(), AccessTokenTTL: 300, RefreshTokenTTL: 3600,
			}, nil)

			codeResp, oauthErr := provider.IssueTokensFromCode(
				context.Background(),
				&oauth2.ValidatedCodeExchange{
					UserID: userID, CodeHash: "code", AuthReq: sql.AuthOauth2AuthRequest{
						ClientID: clientID, Scopes: []string{"openid"},
					},
				},
				slog.Default(),
			)
			if oauthErr != nil {
				t.Fatal(oauthErr)
			}

			refreshResp, oauthErr := provider.IssueTokensFromRefresh(
				context.Background(),
				&oauth2.ValidatedRefreshGrant{
					UserID: userID, TokenHash: "hash", RefreshToken: sql.AuthOauth2RefreshToken{
						ID:       sessionID,
						ClientID: clientID,
						UserID:   userID,
						Scopes:   []string{"openid"},
					},
				},
				slog.Default(),
			)
			if oauthErr != nil {
				t.Fatal(oauthErr)
			}

			var previousJTI string
			for _, resp := range []*string{&codeResp.AccessToken, &refreshResp.AccessToken} {
				token, err := getter.Validate(*resp, tokenpurpose.OAuth2AccessToken)
				if err != nil {
					t.Fatal(err)
				}

				if token.Header["typ"] != string(tokenpurpose.OAuth2AccessToken) {
					t.Errorf("typ = %v", token.Header["typ"])
				}

				claims, ok := token.Claims.(jwt.MapClaims)
				if !ok {
					t.Fatal("unexpected access claims type")
				}

				expectedAud := audience
				if expectedAud == "" {
					expectedAud = clientID
				}

				if claims["sid"] != sessionID.String() || claims["client_id"] != clientID ||
					claims["aud"] != expectedAud ||
					claims["scope"] != "openid" {
					t.Errorf("unexpected access claims: %v", claims)
				}

				jti, ok := claims["jti"].(string)

				parsed, err := uuid.Parse(jti)
				if !ok || err != nil || parsed.Version() != 4 || jti == previousJTI {
					t.Errorf("invalid or repeated jti: %v", claims["jti"])
				}

				previousJTI = jti
			}

			for index, resp := range []*string{codeResp.IdToken, refreshResp.IdToken} {
				if resp == nil {
					t.Fatal("missing ID token")
				}

				token, err := getter.Validate(*resp, tokenpurpose.OIDCIDToken)
				if err != nil {
					t.Fatal(err)
				}

				if token.Header["typ"] != string(tokenpurpose.OIDCIDToken) {
					t.Errorf("ID typ = %v", token.Header["typ"])
				}

				claims, ok := token.Claims.(jwt.MapClaims)
				if !ok {
					t.Fatal("unexpected ID claims type")
				}

				accessToken := []string{codeResp.AccessToken, refreshResp.AccessToken}[index]
				digest := sha256.Sum256([]byte(accessToken))

				wantHash := base64.RawURLEncoding.EncodeToString(digest[:len(digest)/2])
				if claims["aud"] != clientID || claims["at_hash"] != wantHash {
					t.Errorf("ID audience or at_hash does not match the access token")
				}

				for _, key := range []string{"sid", "jti", "client_id"} {
					if _, present := claims[key]; present {
						t.Errorf("ID token contains %s", key)
					}
				}
			}
		})
	}
}

func TestOAuth2AudienceValidation(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name, configured                    string
		aud, clientID                       any
		hasAud, hasClientID, legacy, reject bool
	}{
		{name: "match", configured: "project", aud: "project", clientID: "client", hasAud: true, hasClientID: true},
		{name: "mismatch", configured: "project", aud: "other", clientID: "client", hasAud: true, hasClientID: true, reject: true},
		{name: "absent audience", configured: "project", clientID: "client", hasClientID: true},
		{name: "pre-change", configured: "project", aud: "client", hasAud: true},
		{name: "pre-change other audience", configured: "project", aud: "other", hasAud: true},
		{name: "own client", configured: "project", aud: "client", clientID: "client", hasAud: true, hasClientID: true},
		{name: "own client array", configured: "project", aud: []string{"client"}, clientID: "client", hasAud: true, hasClientID: true},
		{name: "own client plus other", configured: "project", aud: []string{"client", "other"}, clientID: "client", hasAud: true, hasClientID: true, reject: true},
		{name: "malformed null", configured: "project", hasAud: true, reject: true},
		{name: "malformed array", configured: "project", aud: []any{"project", 3}, hasAud: true, reject: true},
		{name: "non-string client", configured: "project", aud: "project", clientID: 123, hasAud: true, hasClientID: true, reject: true},
		{name: "unset", aud: "other", clientID: "client", hasAud: true, hasClientID: true},
		{name: "legacy typ", configured: "project", aud: "client", legacy: true, hasAud: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			getter := newAudienceGetter(t, tc.configured)

			claims := jwt.MapClaims{"sub": uuid.NewString(), "scope": "openid"}
			if tc.hasAud {
				claims["aud"] = tc.aud
			}

			if tc.hasClientID {
				claims["client_id"] = tc.clientID
			}

			purpose := tokenpurpose.OAuth2AccessToken
			if tc.legacy {
				purpose = tokenpurpose.OIDCIDToken
			}

			signed, err := getter.SignTokenWithClaims(claims, time.Now().Add(time.Hour), purpose)
			if err != nil {
				t.Fatal(err)
			}

			_, err = getter.Validate(signed, tokenpurpose.OAuth2AccessToken)
			if (err != nil) != tc.reject {
				t.Errorf("Validate error = %v, reject = %t", err, tc.reject)
			}
		})
	}
}
