package controller_test

import (
	"context"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/controller"
	"github.com/nhost/hasura-auth/go/controller/mock"
	"github.com/nhost/hasura-auth/go/sql"
	"go.uber.org/mock/gomock"
)

func TestPostPat(t *testing.T) {
	t.Parallel()

	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")
	refreshTokenID := uuid.MustParse("5030DC8E-9813-40C5-8522-80B36D53607D")

	jwtTokenFn := func() *jwt.Token {
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
					"x-hasura-user-id":           "db477732-48fa-4289-b694-2886a646b6eb",
					"x-hasura-user-is-anonymous": "false",
				},
				"iat": float64(time.Now().Unix()),
				"iss": "hasura-auth",
				"sub": "db477732-48fa-4289-b694-2886a646b6eb",
			},
			Signature: []byte{},
			Valid:     true,
		}
	}

	cases := []struct {
		name             string
		config           func() *controller.Config
		db               func(ctrl *gomock.Controller) controller.DBClient
		jwtTokenFn       func() *jwt.Token
		request          api.PostPatRequestObject
		expectedResponse api.PostPatResponseObject
	}{
		{
			name:   "simple",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().
					GetUser(gomock.Any(), userID).
					Return(sql.AuthUser{ //nolint:exhaustruct
						ID:    userID,
						Email: sql.Text("jane@acme.com"),
					}, nil)

				mock.EXPECT().
					InsertRefreshtoken(
						gomock.Any(),
						cmpDBParams(sql.InsertRefreshtokenParams{
							UserID:           userID,
							RefreshTokenHash: sql.Text("asdadasdasdasd"),
							ExpiresAt:        sql.TimestampTz(time.Now().Add(time.Hour)),
							Type:             "pat",
							Metadata:         nil,
						})).
					Return(refreshTokenID, nil)

				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.PostPatRequestObject{
				Body: &api.CreatePATRequest{
					ExpiresAt: time.Now().Add(time.Hour),
					Metadata:  nil,
				},
			},
			expectedResponse: api.PostPat200JSONResponse{
				Id:                  refreshTokenID.String(),
				PersonalAccessToken: "",
			},
		},

		{
			name:   "with metadata",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().
					GetUser(gomock.Any(), userID).
					Return(sql.AuthUser{ //nolint:exhaustruct
						ID:    userID,
						Email: sql.Text("jane@acme.com"),
					}, nil)

				mock.EXPECT().
					InsertRefreshtoken(
						gomock.Any(),
						cmpDBParams(sql.InsertRefreshtokenParams{
							UserID:           userID,
							RefreshTokenHash: sql.Text("asdadasdasdasd"),
							ExpiresAt:        sql.TimestampTz(time.Now().Add(time.Hour)),
							Type:             "pat",
							Metadata:         []byte(`{"key":"value"}`),
						})).
					Return(refreshTokenID, nil)

				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.PostPatRequestObject{
				Body: &api.CreatePATRequest{
					ExpiresAt: time.Now().Add(time.Hour),
					Metadata:  ptr(map[string]any{"key": "value"}),
				},
			},
			expectedResponse: api.PostPat200JSONResponse{
				Id:                  refreshTokenID.String(),
				PersonalAccessToken: "",
			},
		},

		{
			name:   "user is disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().
					GetUser(gomock.Any(), userID).
					Return(sql.AuthUser{ //nolint:exhaustruct
						ID:       userID,
						Email:    sql.Text("jane@acme.com"),
						Disabled: true,
					}, nil)

				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.PostPatRequestObject{
				Body: &api.CreatePATRequest{
					ExpiresAt: time.Now().Add(time.Hour),
					Metadata:  nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-user",
				Message: "User is disabled",
				Status:  401,
			},
		},

		{
			name: "user is unverified",
			config: func() *controller.Config {
				c := getConfig()
				c.RequireEmailVerification = true
				return c
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().
					GetUser(gomock.Any(), userID).
					Return(sql.AuthUser{ //nolint:exhaustruct
						ID:    userID,
						Email: sql.Text("jane@acme.com"),
					}, nil)

				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.PostPatRequestObject{
				Body: &api.CreatePATRequest{
					ExpiresAt: time.Now().Add(time.Hour),
					Metadata:  nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "unverified-user",
				Message: "User is not verified.",
				Status:  401,
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, jwtGetter := getController(t, ctrl, tc.config, tc.db, getControllerOpts{
				customClaimer: nil,
				emailer:       nil,
				hibp:          nil,
			})

			ctx := jwtGetter.ToContext(context.Background(), tc.jwtTokenFn())

			cmpopts := []cmp.Option{
				cmpopts.IgnoreFields(
					api.PostPat200JSONResponse{}, //nolint:exhaustruct
					"PersonalAccessToken",
				),
			}

			assertRequest(ctx, t, c.PostPat, tc.request, tc.expectedResponse, cmpopts...)
		})
	}
}
