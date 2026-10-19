package controller_test

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/nhost/nhost/internal/lib/oapi"
	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"github.com/nhost/nhost/services/auth/go/tokenpurpose"
	"go.uber.org/mock/gomock"
)

func newAudienceGetter(t *testing.T, audience string) *controller.JWTGetter {
	t.Helper()

	getter, err := controller.NewJWTGetter(
		jwtSecret,
		time.Hour,
		nil,
		"disabled",
		nil,
		"hasura-auth",
		audience,
	)
	if err != nil {
		t.Fatal(err)
	}

	return getter
}

func assertSessionClaims(
	t *testing.T,
	token *jwt.Token,
	sessionID uuid.UUID,
	audience string,
) string {
	t.Helper()

	if token.Header["typ"] != string(tokenpurpose.Session) {
		t.Errorf("typ = %v", token.Header["typ"])
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		t.Fatal("session claims are not MapClaims")
	}

	if claims["sid"] != sessionID.String() {
		t.Errorf("sid = %v", claims["sid"])
	}

	jti, ok := claims["jti"].(string)
	if !ok {
		t.Fatal("jti is not a string")
	}

	parsed, err := uuid.Parse(jti)
	if err != nil || parsed.Version() != 4 {
		t.Errorf("jti is not a UUID v4: %v", err)
	}

	aud, present := claims["aud"]
	if present != (audience != "") || present && aud != audience {
		t.Errorf("aud = %v, present = %t", aud, present)
	}

	return jti
}

func TestSessionAudienceClaims(t *testing.T) {
	t.Parallel()

	sessionID := uuid.New()
	for _, tc := range []struct{ name, audience string }{
		{"configured", "https://local.nhost.run"},
		{"unset", ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			getter := newAudienceGetter(t, tc.audience)
			if getter.Audience() != tc.audience {
				t.Errorf("Audience() = %q, want %q", getter.Audience(), tc.audience)
			}

			var previous string
			for range 2 {
				signed, _, err := getter.GetToken(
					t.Context(),
					uuid.New(),
					sessionID,
					false,
					[]string{"user"},
					"user",
					nil,
					slog.Default(),
				)
				if err != nil {
					t.Fatal(err)
				}

				token, err := getter.Validate(signed, tokenpurpose.Session)
				if err != nil {
					t.Fatal(err)
				}

				jti := assertSessionClaims(t, token, sessionID, tc.audience)
				if jti == previous {
					t.Error("reused jti")
				}

				previous = jti
			}
		})
	}
}

func TestSessionAudienceValidation(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name, configured          string
		aud                       any
		present, rejected, legacy bool
	}{
		{name: "matching", configured: "project", aud: "project", present: true},
		{name: "mismatched", configured: "project", aud: "other", present: true, rejected: true},
		{name: "absent transition", configured: "project"},
		{name: "array containing", configured: "project", aud: []string{"other", "project"}, present: true},
		{name: "null", configured: "project", present: true, rejected: true},
		{name: "number", configured: "project", aud: 123, present: true, rejected: true},
		{name: "array malformed", configured: "project", aud: []any{"project", 123}, present: true, rejected: true},
		{name: "empty array", configured: "project", aud: []string{}, present: true, rejected: true},
		{name: "unset does not check", aud: 123, present: true},
		{name: "legacy JWT without audience", configured: "project", legacy: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			getter := newAudienceGetter(t, tc.configured)

			purpose := tokenpurpose.Session
			if tc.legacy {
				purpose = tokenpurpose.OIDCIDToken
			}

			claims := jwt.MapClaims{
				"sub":                          uuid.NewString(),
				"https://hasura.io/jwt/claims": map[string]any{"x-hasura-default-role": "user"},
			}
			if tc.present {
				claims["aud"] = tc.aud
			}

			signed, err := getter.SignTokenWithClaims(claims, time.Now().Add(time.Hour), purpose)
			if err != nil {
				t.Fatal(err)
			}

			_, err = getter.Validate(signed, tokenpurpose.Session)
			if (err != nil) != tc.rejected {
				t.Errorf("Validate error = %v, rejected = %t", err, tc.rejected)
			}
		})
	}
}

type emailChangeCapture struct {
	api.StrictServerInterface

	received *string
}

func (capture emailChangeCapture) ChangeUserEmail(
	_ context.Context,
	request api.ChangeUserEmailRequestObject,
) (api.ChangeUserEmailResponseObject, error) {
	*capture.received = string(request.Body.NewEmail)
	return api.ChangeUserEmail200JSONResponse("OK"), nil
}

func TestVerifiedSessionLogAndBody(t *testing.T) {
	t.Parallel()

	var logs bytes.Buffer

	logger := slog.New(slog.NewJSONHandler(&logs, nil))
	getter := newAudienceGetter(t, "project")
	sessionID := uuid.New()

	signed, _, err := getter.GetToken(
		t.Context(),
		uuid.New(),
		sessionID,
		false,
		[]string{"user"},
		"user",
		nil,
		logger,
	)
	if err != nil {
		t.Fatal(err)
	}

	token, err := getter.Validate(signed, tokenpurpose.Session)
	if err != nil {
		t.Fatal(err)
	}

	jti := assertSessionClaims(t, token, sessionID, "project")

	spec, err := api.GetSpec()
	if err != nil {
		t.Fatal(err)
	}

	router, validator, err := oapi.NewRouter(spec, "", getter.MiddlewareFunc, oapimw.CORSOptions{
		AllowOriginFunc:                      nil,
		AllowedOrigins:                       []string{},
		AllowedMethods:                       []string{http.MethodPost},
		AllowHeadersFunc:                     nil,
		AllowedHeaders:                       nil,
		ExposedHeaders:                       nil,
		AllowCredentials:                     false,
		MaxAge:                               "",
		UnsafeAllowAllOriginsWithCredentials: false,
	}, logger)
	if err != nil {
		t.Fatal(err)
	}

	var received string

	handler := api.NewStrictHandler(
		emailChangeCapture{StrictServerInterface: nil, received: &received},
		[]api.StrictMiddlewareFunc{controller.VerifiedTokenMiddleware()},
	)
	api.RegisterHandlersWithOptions(router, handler, api.GinServerOptions{
		BaseURL: "", Middlewares: []api.MiddlewareFunc{validator}, ErrorHandler: oapi.RecordError,
	})

	req := httptest.NewRequest(
		http.MethodPost,
		"/user/email/change",
		strings.NewReader(`{"newEmail":"new@example.com"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+signed)

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}

	if received != "new@example.com" {
		t.Errorf("bound email = %q", received)
	}

	var record map[string]any
	if err := json.Unmarshal(bytes.TrimSpace(logs.Bytes()), &record); err != nil {
		t.Fatal(err)
	}

	jwtGroup, ok := record["jwt"].(map[string]any)
	if !ok || jwtGroup["sid"] != sessionID.String() || jwtGroup["jti"] != jti {
		t.Errorf("completion jwt group = %v", jwtGroup)
	}

	if _, present := jwtGroup["client_id"]; present {
		t.Error("completion log included absent client_id")
	}

	if strings.Contains(logs.String(), signed) {
		t.Error("raw token logged")
	}
}

func TestVerifyTokenRejectsOtherAudience(t *testing.T) {
	t.Parallel()
	signer := newAudienceGetter(t, "")

	signed := signTestToken(
		t,
		signer,
		uuid.New(),
		tokenpurpose.Session,
		map[string]any{"aud": "other"},
	)
	if _, err := newAudienceGetter(
		t,
		"project",
	).Validate(signed, tokenpurpose.Session); err == nil {
		t.Error("wrong audience accepted")
	}

	c, _ := getController(
		t,
		gomock.NewController(t),
		getConfig,
		func(ctrl *gomock.Controller) controller.DBClient { return mock.NewMockDBClient(ctrl) },
		withAudience("project"),
	)

	response, err := c.VerifyToken(
		t.Context(),
		api.VerifyTokenRequestObject{Body: &api.VerifyTokenRequest{Token: &signed}},
	)
	if err != nil {
		t.Fatal(err)
	}

	if rejected, ok := response.(controller.ErrorResponse); !ok ||
		rejected.Status != http.StatusBadRequest {
		t.Errorf("/token/verify response = %#v, want invalid request", response)
	}
}
