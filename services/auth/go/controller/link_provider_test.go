package controller_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/go-cmp/cmp"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/internal/lib/oapi"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"github.com/nhost/nhost/services/auth/go/providers"
	"github.com/nhost/nhost/services/auth/go/sql"
	"go.uber.org/mock/gomock"
)

// linkProviderJWT returns an elevated access token for userID. Unit tests call
// the handler directly, so the BearerAuthElevated middleware is not exercised
// here; the elevated claim is included only for realism.
func linkProviderJWT(userID uuid.UUID) *jwt.Token {
	return &jwt.Token{
		Raw:    "",
		Method: jwt.SigningMethodHS256,
		Header: map[string]any{"alg": "HS256", "typ": "JWT"},
		Claims: jwt.MapClaims{
			"exp": float64(time.Now().Add(900 * time.Second).Unix()),
			"https://hasura.io/jwt/claims": map[string]any{
				"x-hasura-allowed-roles":     []any{"user"},
				"x-hasura-default-role":      "user",
				"x-hasura-user-id":           userID.String(),
				"x-hasura-user-is-anonymous": "false",
				"x-hasura-auth-elevated":     userID.String(),
			},
			"iat": float64(time.Now().Unix()),
			"iss": "hasura-auth",
			"sub": userID.String(),
		},
		Signature: []byte{},
		Valid:     true,
	}
}

func linkProviderTestUser(userID uuid.UUID, disabled bool) sql.AuthUser {
	return sql.AuthUser{
		ID:            userID,
		CreatedAt:     pgtype.Timestamptz{Time: time.Now(), Valid: true},
		Disabled:      disabled,
		DisplayName:   "John",
		Locale:        "en",
		Email:         sql.Text("fake@gmail.com"),
		DefaultRole:   "user",
		EmailVerified: true,
	}
}

// linkProviderCtx builds a context carrying both the injected JWT (the handler
// reads the user from it) and a gin context backed by a recorder (so the
// handler can set the link cookie). The recorder is returned so the response
// cookies can be inspected.
func linkProviderCtx(
	t *testing.T, jwtGetter *controller.JWTGetter, userID uuid.UUID,
) (context.Context, *httptest.ResponseRecorder) {
	t.Helper()

	rec := httptest.NewRecorder()
	ginCtx, _ := gin.CreateTestContext(rec)
	ginCtx.Request = httptest.NewRequest(http.MethodPost, "/link/provider/fake", nil)

	ctx := context.WithValue(
		jwtGetter.ToContext(t.Context(), linkProviderJWT(userID)),
		oapi.GinContextKey,
		ginCtx,
	)

	return ctx, rec
}

// assertConnectAuthorizeURL verifies the authorize URL carries an opaque
// connect-flow state with a nonce and no user identity, and returns the nonce.
func assertConnectAuthorizeURL(
	t *testing.T, jwtGetter *controller.JWTGetter, rawURL string, userID uuid.UUID,
) string {
	t.Helper()

	u, err := url.Parse(rawURL)
	if err != nil {
		t.Fatalf("authorize url not parseable: %v", err)
	}

	stateStr := u.Query().Get("state")
	if stateStr == "" {
		t.Fatal("authorize url missing state")
	}

	// Problem #2/#3: nothing identifying the user may appear in the URL.
	if strings.Contains(rawURL, userID.String()) {
		t.Errorf("user id leaked into authorize url: %s", rawURL)
	}

	stateToken, err := jwtGetter.Validate(stateStr)
	if err != nil {
		t.Fatalf("state token not valid: %v", err)
	}

	var state providers.State
	if err := state.Decode(stateToken.Claims); err != nil {
		t.Fatalf("state decode: %v", err)
	}

	if state.Flow != providers.FlowConnect {
		t.Errorf("state flow = %q, want %q", state.Flow, providers.FlowConnect)
	}

	if state.Connect != nil {
		t.Errorf("state must not carry a connect token, got %q", *state.Connect)
	}

	if state.Nonce == nil || *state.Nonce == "" {
		t.Fatal("state missing nonce")
	}

	return *state.Nonce
}

// assertLinkCookie verifies the link cookie is set with the expected security
// attributes and is a signed link-connect token bound to the user and nonce.
func assertLinkCookie(
	t *testing.T,
	jwtGetter *controller.JWTGetter,
	rec *httptest.ResponseRecorder,
	userID uuid.UUID,
	nonce string,
) {
	t.Helper()

	var linkCookie *http.Cookie

	for _, ck := range rec.Result().Cookies() {
		if ck.Name == "nhost-link-connect" {
			linkCookie = ck
		}
	}

	if linkCookie == nil {
		t.Fatal("nhost-link-connect cookie not set")
	}

	if !linkCookie.HttpOnly {
		t.Error("link cookie must be HttpOnly")
	}

	if !linkCookie.Secure {
		t.Error("link cookie must be Secure when server url is https")
	}

	if linkCookie.SameSite != http.SameSiteLaxMode {
		t.Errorf("link cookie SameSite = %v, want Lax", linkCookie.SameSite)
	}

	cookieToken, err := jwtGetter.Validate(linkCookie.Value)
	if err != nil {
		t.Fatalf("cookie token not valid: %v", err)
	}

	claims, ok := cookieToken.Claims.(jwt.MapClaims)
	if !ok {
		t.Fatal("cookie claims not a map")
	}

	wantClaims := map[string]string{
		"sub":      userID.String(),
		"purpose":  "link-connect",
		"provider": "fake",
		"nonce":    nonce,
	}
	for k, want := range wantClaims {
		if got, _ := claims[k].(string); got != want {
			t.Errorf("cookie claim %q = %q, want %q", k, got, want)
		}
	}
}

// TestLinkProviderSuccess locks in the security properties of the init step:
// the access token / user id never appears in the authorize URL or the OAuth
// state, and the user identity is carried only in a signed, HttpOnly cookie
// bound to the same nonce as the state.
func TestLinkProviderSuccess(t *testing.T) {
	t.Parallel()

	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")

	gmctrl := gomock.NewController(t)
	c, jwtGetter := getController(
		t, gmctrl, getConfig,
		func(ctrl *gomock.Controller) controller.DBClient {
			m := mock.NewMockDBClient(ctrl)
			m.EXPECT().GetUser(gomock.Any(), userID).
				Return(linkProviderTestUser(userID, false), nil)

			return m
		},
	)

	ctx, rec := linkProviderCtx(t, jwtGetter, userID)

	resp, err := c.LinkProvider(ctx, api.LinkProviderRequestObject{
		Provider: "fake",
		Body:     &api.LinkProviderRequest{},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	okResp, ok := resp.(api.LinkProvider200JSONResponse)
	if !ok {
		t.Fatalf("unexpected response type: %T", resp)
	}

	nonce := assertConnectAuthorizeURL(t, jwtGetter, okResp.Url, userID)
	assertLinkCookie(t, jwtGetter, rec, userID, nonce)
}

func TestLinkProviderErrors(t *testing.T) {
	t.Parallel()

	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")

	cases := []struct {
		name             string
		provider         api.LinkProviderParamsProvider
		body             *api.LinkProviderRequest
		db               func(ctrl *gomock.Controller) controller.DBClient
		expectedResponse controller.ErrorResponse
	}{
		{
			name:     "provider not enabled",
			provider: "github",
			body:     &api.LinkProviderRequest{},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetUser(gomock.Any(), userID).
					Return(linkProviderTestUser(userID, false), nil)

				return m
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-endpoint",
				Message: "This endpoint is disabled",
				Status:  409,
			},
		},
		{
			name:     "redirectTo not allowed",
			provider: "fake",
			body: &api.LinkProviderRequest{
				RedirectTo: ptr("http://evil.com"),
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetUser(gomock.Any(), userID).
					Return(linkProviderTestUser(userID, false), nil)

				return m
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "redirectTo-not-allowed",
				Message: `The value of "options.redirectTo" is not allowed.`,
				Status:  400,
			},
		},
		{
			name:     "user disabled",
			provider: "fake",
			body:     &api.LinkProviderRequest{},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetUser(gomock.Any(), userID).
					Return(linkProviderTestUser(userID, true), nil)

				return m
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-user",
				Message: "User is disabled",
				Status:  401,
			},
		},
		{
			name:     "user not found",
			provider: "fake",
			body:     &api.LinkProviderRequest{},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetUser(gomock.Any(), userID).
					Return(sql.AuthUser{}, pgx.ErrNoRows)

				return m
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-email-password",
				Message: "Incorrect email or password",
				Status:  401,
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			gmctrl := gomock.NewController(t)
			c, jwtGetter := getController(t, gmctrl, getConfig, tc.db)

			ctx, _ := linkProviderCtx(t, jwtGetter, userID)

			resp, err := c.LinkProvider(ctx, api.LinkProviderRequestObject{
				Provider: tc.provider,
				Body:     tc.body,
			})
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if diff := cmp.Diff(tc.expectedResponse, resp); diff != "" {
				t.Errorf("unexpected response (-want +got):\n%s", diff)
			}
		})
	}
}
