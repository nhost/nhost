package oauth2_test

import (
	"context"
	"errors"
	"log/slog"
	"testing"

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

func TestGetUserinfo(t *testing.T) { //nolint:maintidx
	t.Parallel()

	logger := slog.Default()
	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")

	fullUser := sql.AuthUser{ //nolint:exhaustruct
		ID:                  userID,
		DisplayName:         "John Doe",
		AvatarUrl:           "https://example.com/avatar.png",
		Locale:              "en",
		Email:               pgtype.Text{String: "john@example.com", Valid: true},
		EmailVerified:       true,
		PhoneNumber:         pgtype.Text{String: "+1234567890", Valid: true},
		PhoneNumberVerified: true,
	}

	cases := []struct {
		name             string
		db               func(ctrl *gomock.Controller) *mock.MockDBClient
		signer           func(ctrl *gomock.Controller) *mock.MockSigner
		scopes           []string
		expectedResponse *api.OAuth2UserinfoResponse
		expectedErr      *oauth2.Error
	}{
		{
			name: "success - all scopes with full user",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetUser(gomock.Any(), userID).Return(fullUser, nil)

				return m
			},
			signer: nil,
			scopes: []string{"openid", "email", "profile", "phone"},
			expectedResponse: &api.OAuth2UserinfoResponse{ //nolint:exhaustruct
				Sub:                 userID.String(),
				Email:               new("john@example.com"),
				EmailVerified:       new(true),
				Name:                new("John Doe"),
				Picture:             new("https://example.com/avatar.png"),
				Locale:              new("en"),
				PhoneNumber:         new("+1234567890"),
				PhoneNumberVerified: new(true),
			},
			expectedErr: nil,
		},
		{
			name: "success - no scopes returns only sub",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetUser(gomock.Any(), userID).Return(fullUser, nil)

				return m
			},
			signer: nil,
			scopes: []string{},
			expectedResponse: &api.OAuth2UserinfoResponse{ //nolint:exhaustruct
				Sub:                 userID.String(),
				Email:               nil,
				EmailVerified:       nil,
				Name:                nil,
				Picture:             nil,
				Locale:              nil,
				PhoneNumber:         nil,
				PhoneNumberVerified: nil,
			},
			expectedErr: nil,
		},
		{
			name: "success - openid only returns sub",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetUser(gomock.Any(), userID).Return(fullUser, nil)

				return m
			},
			signer: nil,
			scopes: []string{"openid"},
			expectedResponse: &api.OAuth2UserinfoResponse{ //nolint:exhaustruct
				Sub:                 userID.String(),
				Email:               nil,
				EmailVerified:       nil,
				Name:                nil,
				Picture:             nil,
				Locale:              nil,
				PhoneNumber:         nil,
				PhoneNumberVerified: nil,
			},
			expectedErr: nil,
		},
		{
			name: "success - email scope with valid email",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetUser(gomock.Any(), userID).Return(fullUser, nil)

				return m
			},
			signer: nil,
			scopes: []string{"email"},
			expectedResponse: &api.OAuth2UserinfoResponse{ //nolint:exhaustruct
				Sub:                 userID.String(),
				Email:               new("john@example.com"),
				EmailVerified:       new(true),
				Name:                nil,
				Picture:             nil,
				Locale:              nil,
				PhoneNumber:         nil,
				PhoneNumberVerified: nil,
			},
			expectedErr: nil,
		},
		{
			name: "success - email scope with invalid email",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				user := sql.AuthUser{ //nolint:exhaustruct
					ID:    userID,
					Email: pgtype.Text{}, //nolint:exhaustruct
				}
				m.EXPECT().GetUser(gomock.Any(), userID).Return(user, nil)

				return m
			},
			signer: nil,
			scopes: []string{"email"},
			expectedResponse: &api.OAuth2UserinfoResponse{ //nolint:exhaustruct
				Sub:                 userID.String(),
				Email:               nil,
				EmailVerified:       nil,
				Name:                nil,
				Picture:             nil,
				Locale:              nil,
				PhoneNumber:         nil,
				PhoneNumberVerified: nil,
			},
			expectedErr: nil,
		},
		{
			name: "success - email scope with unverified email",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				user := sql.AuthUser{ //nolint:exhaustruct
					ID:            userID,
					Email:         pgtype.Text{String: "john@example.com", Valid: true},
					EmailVerified: false,
				}
				m.EXPECT().GetUser(gomock.Any(), userID).Return(user, nil)

				return m
			},
			signer: nil,
			scopes: []string{"email"},
			expectedResponse: &api.OAuth2UserinfoResponse{ //nolint:exhaustruct
				Sub:                 userID.String(),
				Email:               new("john@example.com"),
				EmailVerified:       new(false),
				Name:                nil,
				Picture:             nil,
				Locale:              nil,
				PhoneNumber:         nil,
				PhoneNumberVerified: nil,
			},
			expectedErr: nil,
		},
		{
			name: "success - profile scope with all fields",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetUser(gomock.Any(), userID).Return(fullUser, nil)

				return m
			},
			signer: nil,
			scopes: []string{"profile"},
			expectedResponse: &api.OAuth2UserinfoResponse{ //nolint:exhaustruct
				Sub:                 userID.String(),
				Email:               nil,
				EmailVerified:       nil,
				Name:                new("John Doe"),
				Picture:             new("https://example.com/avatar.png"),
				Locale:              new("en"),
				PhoneNumber:         nil,
				PhoneNumberVerified: nil,
			},
			expectedErr: nil,
		},
		{
			name: "success - profile scope with empty fields",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				user := sql.AuthUser{ //nolint:exhaustruct
					ID:          userID,
					DisplayName: "",
					AvatarUrl:   "",
					Locale:      "",
				}
				m.EXPECT().GetUser(gomock.Any(), userID).Return(user, nil)

				return m
			},
			signer: nil,
			scopes: []string{"profile"},
			expectedResponse: &api.OAuth2UserinfoResponse{ //nolint:exhaustruct
				Sub:                 userID.String(),
				Email:               nil,
				EmailVerified:       nil,
				Name:                nil,
				Picture:             nil,
				Locale:              nil,
				PhoneNumber:         nil,
				PhoneNumberVerified: nil,
			},
			expectedErr: nil,
		},
		{
			name: "success - profile scope with partial fields",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				user := sql.AuthUser{ //nolint:exhaustruct
					ID:          userID,
					DisplayName: "Jane",
					AvatarUrl:   "",
					Locale:      "fr",
				}
				m.EXPECT().GetUser(gomock.Any(), userID).Return(user, nil)

				return m
			},
			signer: nil,
			scopes: []string{"profile"},
			expectedResponse: &api.OAuth2UserinfoResponse{ //nolint:exhaustruct
				Sub:                 userID.String(),
				Email:               nil,
				EmailVerified:       nil,
				Name:                new("Jane"),
				Picture:             nil,
				Locale:              new("fr"),
				PhoneNumber:         nil,
				PhoneNumberVerified: nil,
			},
			expectedErr: nil,
		},
		{
			name: "success - phone scope with valid phone",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetUser(gomock.Any(), userID).Return(fullUser, nil)

				return m
			},
			signer: nil,
			scopes: []string{"phone"},
			expectedResponse: &api.OAuth2UserinfoResponse{ //nolint:exhaustruct
				Sub:                 userID.String(),
				Email:               nil,
				EmailVerified:       nil,
				Name:                nil,
				Picture:             nil,
				Locale:              nil,
				PhoneNumber:         new("+1234567890"),
				PhoneNumberVerified: new(true),
			},
			expectedErr: nil,
		},
		{
			name: "success - phone scope with invalid phone",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				user := sql.AuthUser{ //nolint:exhaustruct
					ID:          userID,
					PhoneNumber: pgtype.Text{}, //nolint:exhaustruct
				}
				m.EXPECT().GetUser(gomock.Any(), userID).Return(user, nil)

				return m
			},
			signer: nil,
			scopes: []string{"phone"},
			expectedResponse: &api.OAuth2UserinfoResponse{ //nolint:exhaustruct
				Sub:                 userID.String(),
				Email:               nil,
				EmailVerified:       nil,
				Name:                nil,
				Picture:             nil,
				Locale:              nil,
				PhoneNumber:         nil,
				PhoneNumberVerified: nil,
			},
			expectedErr: nil,
		},
		{
			name: "success - phone scope with unverified phone",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				user := sql.AuthUser{ //nolint:exhaustruct
					ID:                  userID,
					PhoneNumber:         pgtype.Text{String: "+1234567890", Valid: true},
					PhoneNumberVerified: false,
				}
				m.EXPECT().GetUser(gomock.Any(), userID).Return(user, nil)

				return m
			},
			signer: nil,
			scopes: []string{"phone"},
			expectedResponse: &api.OAuth2UserinfoResponse{ //nolint:exhaustruct
				Sub:                 userID.String(),
				Email:               nil,
				EmailVerified:       nil,
				Name:                nil,
				Picture:             nil,
				Locale:              nil,
				PhoneNumber:         new("+1234567890"),
				PhoneNumberVerified: new(false),
			},
			expectedErr: nil,
		},
		{
			name: "success - graphql scope includes claims",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				graphqlUser := fullUser
				graphqlUser.DefaultRole = "user"
				m.EXPECT().GetUser(gomock.Any(), userID).Return(graphqlUser, nil)
				m.EXPECT().GetUserRoles(gomock.Any(), userID).Return(
					[]sql.AuthUserRole{
						{Role: "user"},   //nolint:exhaustruct
						{Role: "editor"}, //nolint:exhaustruct
					}, nil,
				)

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				m.EXPECT().RawGraphQLClaims(
					gomock.Any(), userID, false,
					gomock.Any(), "user", nil, gomock.Any(),
				).Return("https://hasura.io/jwt/claims", map[string]any{
					"x-hasura-user-id":       userID.String(),
					"x-hasura-default-role":  "user",
					"x-hasura-allowed-roles": []string{"user", "editor"},
				}, nil)

				return m
			},
			scopes: []string{"graphql"},
			expectedResponse: &api.OAuth2UserinfoResponse{ //nolint:exhaustruct
				Sub: userID.String(),
				AdditionalProperties: map[string]any{
					"https://hasura.io/jwt/claims": map[string]any{
						"x-hasura-user-id":       userID.String(),
						"x-hasura-default-role":  "user",
						"x-hasura-allowed-roles": []string{"user", "editor"},
					},
				},
			},
			expectedErr: nil,
		},
		{
			name: "success - graphql with profile scope",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				graphqlUser := fullUser
				graphqlUser.DefaultRole = "user"
				m.EXPECT().GetUser(gomock.Any(), userID).Return(graphqlUser, nil)
				m.EXPECT().GetUserRoles(gomock.Any(), userID).Return(
					[]sql.AuthUserRole{
						{Role: "user"}, //nolint:exhaustruct
					}, nil,
				)

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				m.EXPECT().RawGraphQLClaims(
					gomock.Any(), userID, false,
					gomock.Any(), "user", nil, gomock.Any(),
				).Return("https://hasura.io/jwt/claims", map[string]any{
					"x-hasura-user-id": userID.String(),
				}, nil)

				return m
			},
			scopes: []string{"profile", "graphql"},
			expectedResponse: &api.OAuth2UserinfoResponse{ //nolint:exhaustruct
				Sub:     userID.String(),
				Name:    new("John Doe"),
				Picture: new("https://example.com/avatar.png"),
				Locale:  new("en"),
				AdditionalProperties: map[string]any{
					"https://hasura.io/jwt/claims": map[string]any{
						"x-hasura-user-id": userID.String(),
					},
				},
			},
			expectedErr: nil,
		},
		{
			name: "error - graphql scope GetUserRoles failure",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetUser(gomock.Any(), userID).Return(fullUser, nil)
				m.EXPECT().GetUserRoles(gomock.Any(), userID).
					Return(nil, errors.New("db error")) //nolint:err113

				return m
			},
			signer:           nil,
			scopes:           []string{"graphql"},
			expectedResponse: nil,
			expectedErr: &oauth2.Error{
				Err:         "server_error",
				Description: "Internal server error",
			},
		},
		{
			name: "error - graphql scope GraphQLClaims failure",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				graphqlUser := fullUser
				graphqlUser.DefaultRole = "user"
				m.EXPECT().GetUser(gomock.Any(), userID).Return(graphqlUser, nil)
				m.EXPECT().GetUserRoles(gomock.Any(), userID).Return(
					[]sql.AuthUserRole{{Role: "user"}}, nil, //nolint:exhaustruct
				)

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				m.EXPECT().RawGraphQLClaims(
					gomock.Any(), userID, false,
					gomock.Any(), "user", nil, gomock.Any(),
				).Return("", nil, errors.New("claims error")) //nolint:err113

				return m
			},
			scopes:           []string{"graphql"},
			expectedResponse: nil,
			expectedErr: &oauth2.Error{
				Err:         "server_error",
				Description: "Internal server error",
			},
		},
		{
			name: "error - user not found",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetUser(gomock.Any(), userID).
					Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				return m
			},
			signer:           nil,
			scopes:           []string{"openid"},
			expectedResponse: nil,
			expectedErr: &oauth2.Error{
				Err:         "invalid_token",
				Description: "User not found",
			},
		},
		{
			name: "error - database error",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetUser(gomock.Any(), userID).
					Return(sql.AuthUser{}, errors.New("db error")) //nolint:exhaustruct,err113

				return m
			},
			signer:           nil,
			scopes:           []string{"openid"},
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

			var mockSigner oauth2.Signer
			if tc.signer != nil {
				mockSigner = tc.signer(ctrl)
			}

			provider := oauth2.NewProvider(
				mockDB, mockSigner, nil, nil,
				oauth2.Config{}, //nolint:exhaustruct
				nil,
			)

			gotResp, gotErr := provider.GetUserinfo(
				context.Background(), userID, tc.scopes, logger,
			)

			if diff := cmp.Diff(tc.expectedResponse, gotResp); diff != "" {
				t.Errorf("response mismatch (-want +got):\n%s", diff)
			}

			if diff := cmp.Diff(tc.expectedErr, gotErr); diff != "" {
				t.Errorf("error mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
