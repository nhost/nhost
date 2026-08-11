package controller_test

import (
	"context"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"github.com/nhost/nhost/services/auth/go/oidc"
	"github.com/nhost/nhost/services/auth/go/sql"
	"github.com/oapi-codegen/runtime/types"
	"go.uber.org/mock/gomock"
)

// getCustomIDTokenValidatorProviders extends the standard test validators
// with two custom OIDC providers on the fake IdP, the shape the startup registry
// produces: "c:test" with the nonce on, "c:nonceless" with disableNonce set.
// They share an issuer, so only the nonce policy differs.
func getCustomIDTokenValidatorProviders() func(t *testing.T) *oidc.IDTokenValidatorProviders {
	return func(t *testing.T) *oidc.IDTokenValidatorProviders {
		t.Helper()

		fakeValidator := func() *oidc.LazyIDTokenValidator {
			return oidc.NewLazyIDTokenValidator(
				func(ctx context.Context) (*oidc.IDTokenValidator, error) {
					return oidc.NewIDTokenValidatorForProvider(
						ctx, &oidc.FakeProvider{}, []string{"myapp.local"},
					)
				},
			)
		}

		validators := getTestIDTokenValidatorProviders()(t)
		validators.Custom = map[string]*oidc.LazyIDTokenValidator{
			"c:test":      fakeValidator(),
			"c:nonceless": fakeValidator(),
		}

		return validators
	}
}

func getCustomIDTokenConfig() *controller.Config {
	config := getConfig()
	config.CustomProviders = map[string]controller.CustomProviderConfig{
		"c:test":      {Issuer: "fake.issuer", NonceDisabled: false},
		"c:nonceless": {Issuer: "fake.issuer", NonceDisabled: true},
	}

	return config
}

// customIDTokenUser mirrors the user shape used by the built-in id_token
// tests.
func customIDTokenUser(userID uuid.UUID) sql.AuthUser {
	return sql.AuthUser{
		ID: userID,
		CreatedAt: pgtype.Timestamptz{
			Time: time.Now(),
		},
		UpdatedAt:   pgtype.Timestamptz{},
		LastSeen:    pgtype.Timestamptz{},
		Disabled:    false,
		DisplayName: "Jane",
		AvatarUrl:   "https://myapp.local/jane.jpg",
		Locale:      "en",
		Email:       sql.Text("jane@myapp.local"),
		PhoneNumber: pgtype.Text{},
		PasswordHash: sql.Text(
			"$2a$10$pyv7eu9ioQcFnLSz7u/enex22P3ORdh6z6116Vj5a3vSjo0oxFa1u",
		),
		EmailVerified:            true,
		PhoneNumberVerified:      false,
		NewEmail:                 pgtype.Text{},
		OtpMethodLastUsed:        pgtype.Text{},
		OtpHash:                  pgtype.Text{},
		OtpHashExpiresAt:         pgtype.Timestamptz{},
		DefaultRole:              "user",
		IsAnonymous:              false,
		TotpSecret:               pgtype.Text{},
		ActiveMfaType:            pgtype.Text{},
		Ticket:                   pgtype.Text{},
		TicketExpiresAt:          sql.TimestampTz(time.Now()),
		Metadata:                 []byte{},
		WebauthnCurrentChallenge: pgtype.Text{},
	}
}

func customIDTokenUserProviderRow(
	userID uuid.UUID, issuer pgtype.Text,
) sql.AuthUserProvider {
	return sql.AuthUserProvider{
		ID:             uuid.MustParse("2c812f0b-d0d0-4e7b-b3c1-cc4b48f7c0b6"),
		CreatedAt:      pgtype.Timestamptz{},
		UpdatedAt:      pgtype.Timestamptz{},
		UserID:         userID,
		AccessToken:    "unset",
		RefreshToken:   pgtype.Text{},
		ProviderID:     "c:test",
		ProviderUserID: "106964149809169421082",
		Issuer:         issuer,
	}
}

func expectCustomSession(
	mock *mock.MockDBClient, userID, refreshTokenID uuid.UUID,
) {
	mock.EXPECT().GetUserRoles(
		gomock.Any(), userID,
	).Return([]sql.AuthUserRole{
		{UserID: userID, Role: "user"},
		{UserID: userID, Role: "me"},
	}, nil)

	mock.EXPECT().InsertRefreshtoken(
		gomock.Any(),
		cmpDBParams(sql.InsertRefreshtokenParams{
			UserID:           userID,
			RefreshTokenHash: pgtype.Text{},
			ExpiresAt:        sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
			Type:             sql.RefreshTokenTypeRegular,
			Metadata:         nil,
		}),
	).Return(refreshTokenID, nil)

	mock.EXPECT().UpdateUserLastSeen(
		gomock.Any(), userID,
	).Return(sql.TimestampTz(time.Now()), nil)
}

func customIDTokenExpectedJWT(userID uuid.UUID) *jwt.Token {
	return &jwt.Token{
		Raw:    "",
		Method: jwt.SigningMethodHS256,
		Header: map[string]any{
			"alg": "HS256",
			"typ": "JWT",
		},
		Claims: jwt.MapClaims{
			"exp": float64(time.Now().Add(900 * time.Second).Unix()),
			"https://hasura.io/jwt/claims": map[string]any{
				"x-hasura-allowed-roles":     []any{"user", "me"},
				"x-hasura-default-role":      "user",
				"x-hasura-user-id":           userID.String(),
				"x-hasura-user-is-anonymous": "false",
			},
			"iat": float64(time.Now().Unix()),
			"iss": "hasura-auth",
			"sub": userID.String(),
		},
		Signature: []byte{},
		Valid:     true,
	}
}

func customIDTokenExpectedSession(userID, refreshTokenID uuid.UUID) *api.Session {
	return &api.Session{
		AccessToken:          "",
		AccessTokenExpiresIn: 900,
		RefreshTokenId:       refreshTokenID.String(),
		RefreshToken:         "1fb17604-86c7-444e-b337-09a644465f2d",
		User: &api.User{
			AvatarUrl:           "https://myapp.local/jane.jpg",
			CreatedAt:           time.Now(),
			DefaultRole:         "user",
			DisplayName:         "Jane",
			Email:               ptr(types.Email("jane@myapp.local")),
			EmailVerified:       true,
			Id:                  userID.String(),
			IsAnonymous:         false,
			Locale:              "en",
			Metadata:            nil,
			PhoneNumber:         nil,
			PhoneNumberVerified: false,
			Roles:               []string{"user", "me"},
			ActiveMfaType:       nil,
		},
	}
}

func TestSignInIdTokenCustomProvider(t *testing.T) { //nolint:maintidx
	t.Parallel()

	nonce := "4laVSZd0rNanAE0TS5iouQ=="
	token := testToken(t, nonce)
	tokenWithoutNonce := testToken(t, "")

	// Signed by the fake IdP but minted for another client: only the audience
	// is wrong.
	foreignAudienceToken := func() string {
		fake := oidc.FakeProvider{}

		signed, err := fake.GenerateTestIDToken(jwt.MapClaims{
			"iss":            "fake.issuer",
			"aud":            "someone-elses-app",
			"sub":            "106964149809169421082",
			"email":          "jane@myapp.local",
			"email_verified": true,
			"name":           "Jane",
			"iat":            time.Now().Unix(),
			"exp":            time.Now().Add(time.Hour).Unix(),
		})
		if err != nil {
			t.Fatalf("failed to mint the foreign-audience token: %v", err)
		}

		return signed
	}()

	userID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")
	refreshTokenID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")

	customOpts := []getControllerOptsFunc{
		withIDTokenValidatorProviders(getCustomIDTokenValidatorProviders()),
	}

	cases := []testRequest[api.SignInIdTokenRequestObject, api.SignInIdTokenResponseObject]{
		{
			name:   "provider identity found - recorded issuer matches",
			config: getCustomIDTokenConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByProviderID(
					gomock.Any(),
					sql.GetUserByProviderIDParams{
						ProviderID:     "c:test",
						ProviderUserID: "106964149809169421082",
					},
				).Return(customIDTokenUser(userID), nil)

				mock.EXPECT().FindUserProviderByProviderId(
					gomock.Any(),
					sql.FindUserProviderByProviderIdParams{
						ProviderUserID: "106964149809169421082",
						ProviderID:     "c:test",
					},
				).Return(
					customIDTokenUserProviderRow(userID, sql.Text("fake.issuer")), nil,
				)

				expectCustomSession(mock, userID, refreshTokenID)

				return mock
			},
			getControllerOpts: customOpts,
			request: api.SignInIdTokenRequestObject{
				Body: &api.SignInIdTokenRequest{
					IdToken:  token,
					Nonce:    ptr(nonce),
					Options:  nil,
					Provider: "c:test",
				},
			},
			expectedResponse: api.SignInIdToken200JSONResponse{
				Session: customIDTokenExpectedSession(userID, refreshTokenID),
			},
			expectedJWT: customIDTokenExpectedJWT(userID),
			jwtTokenFn:  nil,
		},

		{
			// The startup probe fails closed while NULL-issuer rows exist, so
			// a NULL row at runtime was written outside the normal flow and
			// must not inherit the configured issuer.
			name:   "provider identity found - recorded issuer is NULL - rejected",
			config: getCustomIDTokenConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByProviderID(
					gomock.Any(),
					sql.GetUserByProviderIDParams{
						ProviderID:     "c:test",
						ProviderUserID: "106964149809169421082",
					},
				).Return(customIDTokenUser(userID), nil)

				mock.EXPECT().FindUserProviderByProviderId(
					gomock.Any(),
					sql.FindUserProviderByProviderIdParams{
						ProviderUserID: "106964149809169421082",
						ProviderID:     "c:test",
					},
				).Return(
					customIDTokenUserProviderRow(
						userID, pgtype.Text{},
					), nil,
				)

				return mock
			},
			getControllerOpts: customOpts,
			request: api.SignInIdTokenRequestObject{
				Body: &api.SignInIdTokenRequest{
					IdToken:  token,
					Nonce:    ptr(nonce),
					Options:  nil,
					Provider: "c:test",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-endpoint",
				Message: "This endpoint is disabled",
				Status:  409,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},

		{
			name:   "provider identity found - recorded issuer differs - rejected",
			config: getCustomIDTokenConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByProviderID(
					gomock.Any(),
					sql.GetUserByProviderIDParams{
						ProviderID:     "c:test",
						ProviderUserID: "106964149809169421082",
					},
				).Return(customIDTokenUser(userID), nil)

				mock.EXPECT().FindUserProviderByProviderId(
					gomock.Any(),
					sql.FindUserProviderByProviderIdParams{
						ProviderUserID: "106964149809169421082",
						ProviderID:     "c:test",
					},
				).Return(
					customIDTokenUserProviderRow(
						userID, sql.Text("https://other-idp.example.com"),
					), nil,
				)

				return mock
			},
			getControllerOpts: customOpts,
			request: api.SignInIdTokenRequestObject{
				Body: &api.SignInIdTokenRequest{
					IdToken:  token,
					Nonce:    ptr(nonce),
					Options:  nil,
					Provider: "c:test",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-endpoint",
				Message: "This endpoint is disabled",
				Status:  409,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},

		{
			name:   "email match - account already uses this slug - links",
			config: getCustomIDTokenConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByProviderID(
					gomock.Any(),
					sql.GetUserByProviderIDParams{
						ProviderID:     "c:test",
						ProviderUserID: "106964149809169421082",
					},
				).Return(sql.AuthUser{}, pgx.ErrNoRows)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@myapp.local"),
				).Return(customIDTokenUser(userID), nil)

				mock.EXPECT().GetUserProviderIDsByUserID(
					gomock.Any(),
					userID,
				).Return([]string{"c:test"}, nil)

				mock.EXPECT().InsertUserProvider(
					gomock.Any(),
					sql.InsertUserProviderParams{
						UserID:         userID,
						ProviderID:     "c:test",
						ProviderUserID: "106964149809169421082",
						Issuer:         sql.Text("fake.issuer"),
					},
				).Return(
					customIDTokenUserProviderRow(userID, sql.Text("fake.issuer")), nil,
				)

				expectCustomSession(mock, userID, refreshTokenID)

				return mock
			},
			getControllerOpts: customOpts,
			request: api.SignInIdTokenRequestObject{
				Body: &api.SignInIdTokenRequest{
					IdToken:  token,
					Nonce:    ptr(nonce),
					Options:  nil,
					Provider: "c:test",
				},
			},
			expectedResponse: api.SignInIdToken200JSONResponse{
				Session: customIDTokenExpectedSession(userID, refreshTokenID),
			},
			expectedJWT: customIDTokenExpectedJWT(userID),
			jwtTokenFn:  nil,
		},

		{
			// Pins the ordering of the email-verification gate
			// (ensureProviderLinkAllowed) relative to the custom email-link
			// check: an unverified email must never auto-link a new
			// provider-side id, even when the account already uses the slug.
			name:   "email match - account already uses this slug - email not verified - refuses to link",
			config: getCustomIDTokenConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByProviderID(
					gomock.Any(),
					sql.GetUserByProviderIDParams{
						ProviderID:     "c:test",
						ProviderUserID: "106964149809169421082",
					},
				).Return(sql.AuthUser{}, pgx.ErrNoRows)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@myapp.local"),
				).Return(customIDTokenUser(userID), nil)

				mock.EXPECT().GetUserProviderIDsByUserID(
					gomock.Any(),
					userID,
				).Return([]string{"c:test"}, nil)

				// No InsertUserProvider and no session: the link is refused.
				return mock
			},
			getControllerOpts: customOpts,
			request: api.SignInIdTokenRequestObject{
				Body: &api.SignInIdTokenRequest{
					IdToken:  testTokenWithEmailVerified(t, nonce, false),
					Nonce:    ptr(nonce),
					Options:  nil,
					Provider: "c:test",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "unverified-user",
				Message: "User is not verified.",
				Status:  401,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},

		{ //nolint:dupl // the mirror case below is deliberately the same shape
			name:   "email match - account does not use this slug - rejected",
			config: getCustomIDTokenConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByProviderID(
					gomock.Any(),
					sql.GetUserByProviderIDParams{
						ProviderID:     "c:test",
						ProviderUserID: "106964149809169421082",
					},
				).Return(sql.AuthUser{}, pgx.ErrNoRows)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@myapp.local"),
				).Return(customIDTokenUser(userID), nil)

				mock.EXPECT().GetUserProviderIDsByUserID(
					gomock.Any(),
					userID,
				).Return([]string{"github"}, nil)

				return mock
			},
			getControllerOpts: customOpts,
			request: api.SignInIdTokenRequestObject{
				Body: &api.SignInIdTokenRequest{
					IdToken:  token,
					Nonce:    ptr(nonce),
					Options:  nil,
					Provider: "c:test",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "user-already-exists",
				Message: "User already exists",
				Status:  409,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},

		{ //nolint:dupl // the mirror case is deliberately the same shape
			// The mirror image of the case above: the attacker signs up
			// through the custom IdP first, asserting the victim's address,
			// and the victim's later built-in sign-in must not auto-link
			// into that account.
			name:   "email match - account holds a custom identity - built-in provider refused",
			config: getCustomIDTokenConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByProviderID(
					gomock.Any(),
					sql.GetUserByProviderIDParams{
						ProviderID:     "fake",
						ProviderUserID: "106964149809169421082",
					},
				).Return(sql.AuthUser{}, pgx.ErrNoRows)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@myapp.local"),
				).Return(customIDTokenUser(userID), nil)

				mock.EXPECT().GetUserProviderIDsByUserID(
					gomock.Any(),
					userID,
				).Return([]string{"c:test"}, nil)

				// No InsertUserProvider and no session.
				return mock
			},
			getControllerOpts: customOpts,
			request: api.SignInIdTokenRequestObject{
				Body: &api.SignInIdTokenRequest{
					IdToken:  token,
					Nonce:    ptr(nonce),
					Options:  nil,
					Provider: "fake",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "user-already-exists",
				Message: "User already exists",
				Status:  409,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},

		{ //nolint:dupl // deliberately the same shape as the mirror case above
			// An oauth2-type custom has no issuer, so isIssuerBoundProvider is
			// false for it — yet its emailVerified is a flat, operator-chosen
			// userinfo field with no id_token behind it. This is the case that
			// separates the two predicates: keyed on isIssuerBoundProvider, the
			// built-in sign-in below would auto-link into the account.
			name:   "email match - account holds an oauth2-type custom identity - refused",
			config: getCustomIDTokenConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByProviderID(
					gomock.Any(),
					sql.GetUserByProviderIDParams{
						ProviderID:     "fake",
						ProviderUserID: "106964149809169421082",
					},
				).Return(sql.AuthUser{}, pgx.ErrNoRows)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@myapp.local"),
				).Return(customIDTokenUser(userID), nil)

				// "c:legacy" is not in CustomProviders — see
				// getCustomIDTokenConfig, which configures only "c:test".
				mock.EXPECT().GetUserProviderIDsByUserID(
					gomock.Any(),
					userID,
				).Return([]string{"c:legacy"}, nil)

				// No InsertUserProvider and no session.
				return mock
			},
			getControllerOpts: customOpts,
			request: api.SignInIdTokenRequestObject{
				Body: &api.SignInIdTokenRequest{
					IdToken:  token,
					Nonce:    ptr(nonce),
					Options:  nil,
					Provider: "fake",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "user-already-exists",
				Message: "User already exists",
				Status:  409,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},

		{
			// The control: accounts with no custom identity keep the
			// pre-existing built-in-to-built-in auto-link behavior.
			name:   "email match - only built-in identities - built-in provider still links",
			config: getCustomIDTokenConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByProviderID(
					gomock.Any(),
					sql.GetUserByProviderIDParams{
						ProviderID:     "fake",
						ProviderUserID: "106964149809169421082",
					},
				).Return(sql.AuthUser{}, pgx.ErrNoRows)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@myapp.local"),
				).Return(customIDTokenUser(userID), nil)

				mock.EXPECT().GetUserProviderIDsByUserID(
					gomock.Any(),
					userID,
				).Return([]string{"github"}, nil)

				mock.EXPECT().InsertUserProvider(
					gomock.Any(),
					sql.InsertUserProviderParams{
						UserID:         userID,
						ProviderID:     "fake",
						ProviderUserID: "106964149809169421082",
						Issuer:         pgtype.Text{},
					},
				).Return(
					customIDTokenUserProviderRow(userID, pgtype.Text{}), nil,
				)

				expectCustomSession(mock, userID, refreshTokenID)

				return mock
			},
			getControllerOpts: customOpts,
			request: api.SignInIdTokenRequestObject{
				Body: &api.SignInIdTokenRequest{
					IdToken:  token,
					Nonce:    ptr(nonce),
					Options:  nil,
					Provider: "fake",
				},
			},
			expectedResponse: api.SignInIdToken200JSONResponse{
				Session: customIDTokenExpectedSession(userID, refreshTokenID),
			},
			expectedJWT: customIDTokenExpectedJWT(userID),
			jwtTokenFn:  nil,
		},

		{
			name:   "unknown custom provider - disabled endpoint",
			config: getCustomIDTokenConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			getControllerOpts: customOpts,
			request: api.SignInIdTokenRequestObject{
				Body: &api.SignInIdTokenRequest{
					IdToken:  token,
					Nonce:    ptr(nonce),
					Options:  nil,
					Provider: "c:unknown",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-endpoint",
				Message: "This endpoint is disabled",
				Status:  409,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},

		{
			name:   "nonce supplied but id_token has no nonce claim - rejected",
			config: getCustomIDTokenConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			getControllerOpts: customOpts,
			request: api.SignInIdTokenRequestObject{
				Body: &api.SignInIdTokenRequest{
					IdToken:  tokenWithoutNonce,
					Nonce:    ptr(nonce),
					Options:  nil,
					Provider: "c:test",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-request",
				Message: "The request payload is incorrect",
				Status:  400,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},

		{
			// Omitting "nonce" used to select the lenient validator, letting the
			// caller pick its own strictness. Policy now comes from the config,
			// so this is rejected before any DB call — hence the bare mock.
			name:   "no nonce supplied - rejected for a strict issuer-bound provider",
			config: getCustomIDTokenConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			getControllerOpts: customOpts,
			request: api.SignInIdTokenRequestObject{
				Body: &api.SignInIdTokenRequest{
					IdToken:  tokenWithoutNonce,
					Nonce:    nil,
					Options:  nil,
					Provider: "c:test",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-request",
				Message: "The request payload is incorrect",
				Status:  400,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},

		{ //nolint:dupl // identical to the Cognito-shape case below on purpose
			// Mirror of the case above: the same nonce-less request is accepted
			// when the provider has disableNonce. The LinkedIn shape.
			name:   "nonce disabled - no nonce and no nonce claim - accepted",
			config: getCustomIDTokenConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByProviderID(
					gomock.Any(),
					sql.GetUserByProviderIDParams{
						ProviderID:     "c:nonceless",
						ProviderUserID: "106964149809169421082",
					},
				).Return(customIDTokenUser(userID), nil)

				mock.EXPECT().FindUserProviderByProviderId(
					gomock.Any(),
					sql.FindUserProviderByProviderIdParams{
						ProviderUserID: "106964149809169421082",
						ProviderID:     "c:nonceless",
					},
				).Return(
					customIDTokenUserProviderRow(userID, sql.Text("fake.issuer")), nil,
				)

				expectCustomSession(mock, userID, refreshTokenID)

				return mock
			},
			getControllerOpts: customOpts,
			request: api.SignInIdTokenRequestObject{
				Body: &api.SignInIdTokenRequest{
					IdToken:  tokenWithoutNonce,
					Nonce:    nil,
					Options:  nil,
					Provider: "c:nonceless",
				},
			},
			expectedResponse: api.SignInIdToken200JSONResponse{
				Session: customIDTokenExpectedSession(userID, refreshTokenID),
			},
			expectedJWT: customIDTokenExpectedJWT(userID),
			jwtTokenFn:  nil,
		},

		{ //nolint:dupl // every expectation must match the case above; only the token differs
			// The AWS Cognito shape: no nonce sent, but an IdP-minted claim in
			// the id_token. Validate(idToken, "") would reject it, so this pins
			// that the disabled arm calls ValidateIgnoringNonce.
			name:   "nonce disabled - IdP-minted nonce claim - accepted",
			config: getCustomIDTokenConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByProviderID(
					gomock.Any(),
					sql.GetUserByProviderIDParams{
						ProviderID:     "c:nonceless",
						ProviderUserID: "106964149809169421082",
					},
				).Return(customIDTokenUser(userID), nil)

				mock.EXPECT().FindUserProviderByProviderId(
					gomock.Any(),
					sql.FindUserProviderByProviderIdParams{
						ProviderUserID: "106964149809169421082",
						ProviderID:     "c:nonceless",
					},
				).Return(
					customIDTokenUserProviderRow(userID, sql.Text("fake.issuer")), nil,
				)

				expectCustomSession(mock, userID, refreshTokenID)

				return mock
			},
			getControllerOpts: customOpts,
			request: api.SignInIdTokenRequestObject{
				Body: &api.SignInIdTokenRequest{
					IdToken:  token,
					Nonce:    nil,
					Options:  nil,
					Provider: "c:nonceless",
				},
			},
			expectedResponse: api.SignInIdToken200JSONResponse{
				Session: customIDTokenExpectedSession(userID, refreshTokenID),
			},
			expectedJWT: customIDTokenExpectedJWT(userID),
			jwtTokenFn:  nil,
		},

		{
			// Scoped to the nonce: a nonce-disabled provider still rejects a
			// wrong audience.
			name:   "nonce disabled - wrong audience still rejected",
			config: getCustomIDTokenConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			getControllerOpts: customOpts,
			request: api.SignInIdTokenRequestObject{
				Body: &api.SignInIdTokenRequest{
					IdToken:  foreignAudienceToken,
					Nonce:    nil,
					Options:  nil,
					Provider: "c:nonceless",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-request",
				Message: "The request payload is incorrect",
				Status:  400,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, jwtGetter := getController(t, ctrl, tc.config, tc.db, tc.getControllerOpts...)

			resp := assertRequest(
				t.Context(),
				t,
				c.SignInIdToken,
				tc.request,
				tc.expectedResponse,
			)

			resp200, ok := resp.(api.SignInIdToken200JSONResponse)
			if ok {
				assertSession(t, jwtGetter, resp200.Session, tc.expectedJWT)
			}
		})
	}
}
