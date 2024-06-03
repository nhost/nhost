package controller_test

import (
	"context"
	"testing"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/controller"
	"github.com/nhost/hasura-auth/go/controller/mock"
	"github.com/nhost/hasura-auth/go/testhelpers"
	"go.uber.org/mock/gomock"
)

type testWebauhtnRequest struct {
	testRequest[api.PostSignupWebauthnRequestObject, api.PostSignupWebauthnResponseObject]
	savedChallenge controller.WebauthnChallenge
}

//nolint:dupl
func TestPostSignupWebauthn(t *testing.T) { //nolint:maintidx
	t.Parallel()

	userID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")

	cases := []testWebauhtnRequest{
		{
			testRequest: testRequest[api.PostSignupWebauthnRequestObject, api.PostSignupWebauthnResponseObject]{
				name:   "simple",
				config: getConfig,
				db: func(ctrl *gomock.Controller) controller.DBClient {
					mock := mock.NewMockDBClient(ctrl)

					return mock
				},
				emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
					mock := mock.NewMockEmailer(ctrl)
					return mock
				},
				hibp: func(ctrl *gomock.Controller) *mock.MockHIBPClient {
					mock := mock.NewMockHIBPClient(ctrl)
					return mock
				},
				customClaimer: nil,
				request: api.PostSignupWebauthnRequestObject{
					Body: &api.PostSignupWebauthnJSONRequestBody{
						Email:   "jane@acme.com",
						Options: nil,
					},
				},
				expectedResponse: api.PostSignupWebauthn200JSONResponse{
					RelyingParty: protocol.RelyingPartyEntity{
						CredentialEntity: protocol.CredentialEntity{
							Name: "React Apollo Example",
							Icon: "",
						},
						ID: "react-apollo.example.nhost.io",
					},
					User: protocol.UserEntity{
						CredentialEntity: protocol.CredentialEntity{
							Name: "jane@acme.com",
							Icon: "",
						},
						DisplayName: "jane@acme.com",
						ID:          userID.String(),
					},
					Challenge: []byte{},
					Parameters: []protocol.CredentialParameter{
						{Type: "public-key", Algorithm: -7},
						{Type: "public-key", Algorithm: -35},
						{Type: "public-key", Algorithm: -36},
						{Type: "public-key", Algorithm: -257},
						{Type: "public-key", Algorithm: -258},
						{Type: "public-key", Algorithm: -259},
						{Type: "public-key", Algorithm: -37},
						{Type: "public-key", Algorithm: -38},
						{Type: "public-key", Algorithm: -39},
						{Type: "public-key", Algorithm: -8},
					},
					Timeout:               60000,
					CredentialExcludeList: nil,

					AuthenticatorSelection: protocol.AuthenticatorSelection{
						AuthenticatorAttachment: "",
						RequireResidentKey:      ptr(false),
						ResidentKey:             "preferred",
						UserVerification:        "preferred",
					},
					Attestation: "indirect",
					Extensions:  nil,
				},
				expectedJWT: nil,
				jwtTokenFn:  nil,
			},
			savedChallenge: controller.WebauthnChallenge{
				Session: webauthn.SessionData{
					Challenge:            "xxx",
					UserID:               []byte{},
					AllowedCredentialIDs: nil,
					Expires:              time.Now().Add(1 * time.Minute),
					UserVerification:     "preferred",
					Extensions:           nil,
				},
				User: controller.WebauthnUser{
					ID:    uuid.UUID{},
					Name:  "jane@acme.com",
					Email: "jane@acme.com",
				},
				Options: &api.SignUpOptions{
					AllowedRoles: &[]string{"user", "me"},
					DefaultRole:  ptr("user"),
					DisplayName:  ptr("jane@acme.com"),
					Locale:       ptr("en"),
					Metadata:     nil,
					RedirectTo:   ptr("http://localhost:3000"),
				},
			},
		},

		{
			testRequest: testRequest[api.PostSignupWebauthnRequestObject, api.PostSignupWebauthnResponseObject]{
				name:   "with options",
				config: getConfig,
				db: func(ctrl *gomock.Controller) controller.DBClient {
					mock := mock.NewMockDBClient(ctrl)

					return mock
				},
				emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
					mock := mock.NewMockEmailer(ctrl)
					return mock
				},
				hibp: func(ctrl *gomock.Controller) *mock.MockHIBPClient {
					mock := mock.NewMockHIBPClient(ctrl)
					return mock
				},
				customClaimer: nil,
				request: api.PostSignupWebauthnRequestObject{
					Body: &api.PostSignupWebauthnJSONRequestBody{
						Email: "jane@acme.com",
						Options: &api.SignUpOptions{
							AllowedRoles: &[]string{"user"},
							DefaultRole:  ptr("user"),
							DisplayName:  ptr("Jane Doe"),
							Locale:       ptr("en"),
							Metadata: &map[string]interface{}{
								"key": "value",
							},
							RedirectTo: ptr("http://localhost:3000/redirect"),
						},
					},
				},
				expectedResponse: api.PostSignupWebauthn200JSONResponse{
					RelyingParty: protocol.RelyingPartyEntity{
						CredentialEntity: protocol.CredentialEntity{
							Name: "React Apollo Example",
							Icon: "",
						},
						ID: "react-apollo.example.nhost.io",
					},
					User: protocol.UserEntity{
						CredentialEntity: protocol.CredentialEntity{
							Name: "Jane Doe",
							Icon: "",
						},
						DisplayName: "Jane Doe",
						ID:          userID.String(),
					},
					Challenge: []byte{},
					Parameters: []protocol.CredentialParameter{
						{Type: "public-key", Algorithm: -7},
						{Type: "public-key", Algorithm: -35},
						{Type: "public-key", Algorithm: -36},
						{Type: "public-key", Algorithm: -257},
						{Type: "public-key", Algorithm: -258},
						{Type: "public-key", Algorithm: -259},
						{Type: "public-key", Algorithm: -37},
						{Type: "public-key", Algorithm: -38},
						{Type: "public-key", Algorithm: -39},
						{Type: "public-key", Algorithm: -8},
					},
					Timeout:               60000,
					CredentialExcludeList: nil,

					AuthenticatorSelection: protocol.AuthenticatorSelection{
						AuthenticatorAttachment: "",
						RequireResidentKey:      ptr(false),
						ResidentKey:             "preferred",
						UserVerification:        "preferred",
					},
					Attestation: "indirect",
					Extensions:  nil,
				},
				expectedJWT: nil,
				jwtTokenFn:  nil,
			},
			savedChallenge: controller.WebauthnChallenge{
				Session: webauthn.SessionData{
					Challenge:            "xxx",
					UserID:               []byte{},
					AllowedCredentialIDs: nil,
					Expires:              time.Now().Add(1 * time.Minute),
					UserVerification:     "preferred",
					Extensions:           nil,
				},
				User: controller.WebauthnUser{
					ID:    uuid.UUID{},
					Name:  "Jane Doe",
					Email: "jane@acme.com",
				},
				Options: &api.SignUpOptions{
					AllowedRoles: &[]string{"user"},
					DefaultRole:  ptr("user"),
					DisplayName:  ptr("Jane Doe"),
					Locale:       ptr("en"),
					Metadata:     &map[string]interface{}{"key": "value"},
					RedirectTo:   ptr("http://localhost:3000/redirect"),
				},
			},
		},

		{
			testRequest: testRequest[api.PostSignupWebauthnRequestObject, api.PostSignupWebauthnResponseObject]{
				name: "webauthn disabled",
				config: func() *controller.Config {
					c := getConfig()
					c.WebauthnEnabled = false
					return c
				},
				db: func(ctrl *gomock.Controller) controller.DBClient {
					mock := mock.NewMockDBClient(ctrl)
					return mock
				},
				emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
					mock := mock.NewMockEmailer(ctrl)
					return mock
				},
				hibp: func(ctrl *gomock.Controller) *mock.MockHIBPClient {
					mock := mock.NewMockHIBPClient(ctrl)
					return mock
				},
				customClaimer: nil,
				request: api.PostSignupWebauthnRequestObject{
					Body: &api.PostSignupWebauthnJSONRequestBody{
						Email:   "jane@acme.com",
						Options: nil,
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
			savedChallenge: controller.WebauthnChallenge{}, //nolint:exhaustruct
		},

		{
			testRequest: testRequest[api.PostSignupWebauthnRequestObject, api.PostSignupWebauthnResponseObject]{
				name: "signup disabled",
				config: func() *controller.Config {
					c := getConfig()
					c.DisableSignup = true
					return c
				},
				db: func(ctrl *gomock.Controller) controller.DBClient {
					mock := mock.NewMockDBClient(ctrl)
					return mock
				},
				emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
					mock := mock.NewMockEmailer(ctrl)
					return mock
				},
				hibp: func(ctrl *gomock.Controller) *mock.MockHIBPClient {
					mock := mock.NewMockHIBPClient(ctrl)
					return mock
				},
				customClaimer: nil,
				request: api.PostSignupWebauthnRequestObject{
					Body: &api.PostSignupWebauthnJSONRequestBody{
						Email:   "jane@acme.com",
						Options: nil,
					},
				},
				expectedResponse: controller.ErrorResponse{
					Error:   "signup-disabled",
					Message: "Sign up is disabled.",
					Status:  403,
				},
				expectedJWT: nil,
				jwtTokenFn:  nil,
			},
			savedChallenge: controller.WebauthnChallenge{}, //nolint:exhaustruct
		},

		{
			testRequest: testRequest[api.PostSignupWebauthnRequestObject, api.PostSignupWebauthnResponseObject]{
				name:   "user exists",
				config: getConfig,
				db: func(ctrl *gomock.Controller) controller.DBClient {
					mock := mock.NewMockDBClient(ctrl)

					return mock
				},
				emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
					mock := mock.NewMockEmailer(ctrl)
					return mock
				},
				hibp: func(ctrl *gomock.Controller) *mock.MockHIBPClient {
					mock := mock.NewMockHIBPClient(ctrl)
					return mock
				},
				customClaimer: nil,
				request: api.PostSignupWebauthnRequestObject{
					Body: &api.PostSignupWebauthnJSONRequestBody{
						Email:   "jane@acme.com",
						Options: nil,
					},
				},
				expectedResponse: api.PostSignupWebauthn200JSONResponse{
					RelyingParty: protocol.RelyingPartyEntity{
						CredentialEntity: protocol.CredentialEntity{
							Name: "React Apollo Example",
							Icon: "",
						},
						ID: "react-apollo.example.nhost.io",
					},
					User: protocol.UserEntity{
						CredentialEntity: protocol.CredentialEntity{
							Name: "jane@acme.com",
							Icon: "",
						},
						DisplayName: "jane@acme.com",
						ID:          userID.String(),
					},
					Challenge: []byte{},
					Parameters: []protocol.CredentialParameter{
						{Type: "public-key", Algorithm: -7},
						{Type: "public-key", Algorithm: -35},
						{Type: "public-key", Algorithm: -36},
						{Type: "public-key", Algorithm: -257},
						{Type: "public-key", Algorithm: -258},
						{Type: "public-key", Algorithm: -259},
						{Type: "public-key", Algorithm: -37},
						{Type: "public-key", Algorithm: -38},
						{Type: "public-key", Algorithm: -39},
						{Type: "public-key", Algorithm: -8},
					},
					Timeout:               60000,
					CredentialExcludeList: nil,

					AuthenticatorSelection: protocol.AuthenticatorSelection{
						AuthenticatorAttachment: "",
						RequireResidentKey:      ptr(false),
						ResidentKey:             "preferred",
						UserVerification:        "preferred",
					},
					Attestation: "indirect",
					Extensions:  nil,
				},
				expectedJWT: nil,
				jwtTokenFn:  nil,
			},
			savedChallenge: controller.WebauthnChallenge{
				Session: webauthn.SessionData{
					Challenge:            "xxx",
					UserID:               []byte{},
					AllowedCredentialIDs: nil,
					Expires:              time.Now().Add(1 * time.Minute),
					UserVerification:     "preferred",
					Extensions:           nil,
				},
				User: controller.WebauthnUser{
					ID:    uuid.UUID{},
					Name:  "jane@acme.com",
					Email: "jane@acme.com",
				},
				Options: &api.SignUpOptions{
					AllowedRoles: &[]string{"user", "me"},
					DefaultRole:  ptr("user"),
					DisplayName:  ptr("jane@acme.com"),
					Locale:       ptr("en"),
					Metadata:     nil,
					RedirectTo:   ptr("http://localhost:3000"),
				},
			},
		},

		{
			testRequest: testRequest[api.PostSignupWebauthnRequestObject, api.PostSignupWebauthnResponseObject]{
				name:   "wrong redirectTo",
				config: getConfig,
				db: func(ctrl *gomock.Controller) controller.DBClient {
					mock := mock.NewMockDBClient(ctrl)
					return mock
				},
				emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
					mock := mock.NewMockEmailer(ctrl)
					return mock
				},
				hibp: func(ctrl *gomock.Controller) *mock.MockHIBPClient {
					mock := mock.NewMockHIBPClient(ctrl)
					return mock
				},
				customClaimer: nil,
				request: api.PostSignupWebauthnRequestObject{
					Body: &api.PostSignupWebauthnJSONRequestBody{
						Email: "jane@acme.com",
						Options: &api.SignUpOptions{
							AllowedRoles: nil,
							DefaultRole:  nil,
							DisplayName:  nil,
							Locale:       nil,
							Metadata:     nil,
							RedirectTo:   ptr("http://evil.com/redirect"),
						},
					},
				},
				expectedResponse: controller.ErrorResponse{
					Error:   "redirectTo-not-allowed",
					Message: `The value of "options.redirectTo" is not allowed.`,
					Status:  400,
				},
				expectedJWT: nil,
				jwtTokenFn:  nil,
			},
			savedChallenge: controller.WebauthnChallenge{}, //nolint:exhaustruct
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, _ := getController(t, ctrl, tc.config, tc.db, getControllerOpts{
				customClaimer: tc.customClaimer,
				emailer:       tc.emailer,
				hibp:          tc.hibp,
			})

			//nolint:exhaustruct
			_ = assertRequest(
				context.Background(), t, c.PostSignupWebauthn, tc.request, tc.expectedResponse,
				cmpopts.IgnoreFields(api.PostSignupWebauthn200JSONResponse{}, "Challenge"),
				cmpopts.IgnoreFields(protocol.UserEntity{}, "ID"),
			)

			if !tc.config().WebauthnEnabled {
				return
			}

			var gotSavedChallenge controller.WebauthnChallenge
			for _, v := range c.Webauthn.Storage {
				gotSavedChallenge = v
			}

			cmpOpts := cmp.Options{
				testhelpers.FilterPathLast(
					[]string{".Expires"}, cmpopts.EquateApproxTime(time.Minute),
				),
				cmpopts.IgnoreFields(
					webauthn.SessionData{}, "Challenge", "UserID", //nolint:exhaustruct
				),
				cmpopts.IgnoreFields(
					controller.WebauthnUser{}, "ID", //nolint:exhaustruct
				),
			}

			if diff := cmp.Diff(tc.savedChallenge, gotSavedChallenge, cmpOpts...); diff != "" {
				t.Errorf("unexpected storage (-want +got):\n%s", diff)
			}
		})
	}
}
