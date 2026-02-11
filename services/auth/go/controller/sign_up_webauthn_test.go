package controller_test

import (
	"testing"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"github.com/nhost/nhost/services/auth/go/testhelpers"
	"go.uber.org/mock/gomock"
)

type testWebauhtnRequest struct {
	testRequest[api.SignUpWebauthnRequestObject, api.SignUpWebauthnResponseObject]

	savedChallenge controller.WebauthnChallenge
}

//nolint:dupl
func TestSignUpWebauthn(t *testing.T) { //nolint:maintidx
	t.Parallel()

	userID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")

	cases := []testWebauhtnRequest{
		{
			testRequest: testRequest[api.SignUpWebauthnRequestObject, api.SignUpWebauthnResponseObject]{
				name:   "simple",
				config: getConfig,
				db: func(ctrl *gomock.Controller) controller.DBClient {
					mock := mock.NewMockDBClient(ctrl)

					return mock
				},
				request: api.SignUpWebauthnRequestObject{
					Body: &api.SignUpWebauthnJSONRequestBody{
						Email:   "jane@acme.com",
						Options: nil,
					},
				},
				expectedResponse: api.SignUpWebauthn200JSONResponse{
					RelyingParty: protocol.RelyingPartyEntity{
						CredentialEntity: protocol.CredentialEntity{
							Name: "React Apollo Example",
						},
						ID: "react-apollo.example.nhost.io",
					},
					User: protocol.UserEntity{
						CredentialEntity: protocol.CredentialEntity{
							Name: "jane@acme.com",
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
					AttestationFormats:    nil,
					AuthenticatorSelection: protocol.AuthenticatorSelection{
						AuthenticatorAttachment: "",
						RequireResidentKey:      new(false),
						ResidentKey:             "preferred",
						UserVerification:        "preferred",
					},
					Attestation: "indirect",
					Extensions:  nil,
					Hints:       nil,
				},
				expectedJWT:       nil,
				jwtTokenFn:        nil,
				getControllerOpts: []getControllerOptsFunc{},
			},
			savedChallenge: controller.WebauthnChallenge{
				Session: webauthn.SessionData{
					Challenge:            "xxx",
					UserID:               []byte{},
					AllowedCredentialIDs: nil,
					Expires:              time.Now().Add(1 * time.Minute),
					UserVerification:     "preferred",
					Extensions:           nil,
					RelyingPartyID:       "react-apollo.example.nhost.io",
				},
				User: controller.WebauthnUser{
					ID:           uuid.UUID{},
					Name:         "jane@acme.com",
					Email:        "jane@acme.com",
					Credentials:  nil,
					Discoverable: false,
				},
				Options: &api.SignUpOptions{
					AllowedRoles: &[]string{"user", "me"},
					DefaultRole:  new("user"),
					DisplayName:  new("jane@acme.com"),
					Locale:       new("en"),
					Metadata:     nil,
					RedirectTo:   new("http://localhost:3000"),
				},
			},
		},

		{
			testRequest: testRequest[api.SignUpWebauthnRequestObject, api.SignUpWebauthnResponseObject]{
				name:   "with options",
				config: getConfig,
				db: func(ctrl *gomock.Controller) controller.DBClient {
					mock := mock.NewMockDBClient(ctrl)

					return mock
				},
				request: api.SignUpWebauthnRequestObject{
					Body: &api.SignUpWebauthnJSONRequestBody{
						Email: "jane@acme.com",
						Options: &api.SignUpOptions{
							AllowedRoles: &[]string{"user"},
							DefaultRole:  new("user"),
							DisplayName:  new("Jane Doe"),
							Locale:       new("en"),
							Metadata: &map[string]any{
								"key": "value",
							},
							RedirectTo: new("http://localhost:3000/redirect"),
						},
					},
				},
				expectedResponse: api.SignUpWebauthn200JSONResponse{
					RelyingParty: protocol.RelyingPartyEntity{
						CredentialEntity: protocol.CredentialEntity{
							Name: "React Apollo Example",
						},
						ID: "react-apollo.example.nhost.io",
					},
					User: protocol.UserEntity{
						CredentialEntity: protocol.CredentialEntity{
							Name: "Jane Doe",
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
						RequireResidentKey:      new(false),
						ResidentKey:             "preferred",
						UserVerification:        "preferred",
					},
					AttestationFormats: nil,
					Attestation:        "indirect",
					Extensions:         nil,
					Hints:              nil,
				},
				expectedJWT:       nil,
				jwtTokenFn:        nil,
				getControllerOpts: []getControllerOptsFunc{},
			},
			savedChallenge: controller.WebauthnChallenge{
				Session: webauthn.SessionData{
					Challenge:            "xxx",
					UserID:               []byte{},
					AllowedCredentialIDs: nil,
					Expires:              time.Now().Add(1 * time.Minute),
					UserVerification:     "preferred",
					Extensions:           nil,
					RelyingPartyID:       "react-apollo.example.nhost.io",
				},
				User: controller.WebauthnUser{
					ID:           uuid.UUID{},
					Name:         "Jane Doe",
					Email:        "jane@acme.com",
					Credentials:  nil,
					Discoverable: false,
				},
				Options: &api.SignUpOptions{
					AllowedRoles: &[]string{"user"},
					DefaultRole:  new("user"),
					DisplayName:  new("Jane Doe"),
					Locale:       new("en"),
					Metadata:     &map[string]any{"key": "value"},
					RedirectTo:   new("http://localhost:3000/redirect"),
				},
			},
		},

		{
			testRequest: testRequest[api.SignUpWebauthnRequestObject, api.SignUpWebauthnResponseObject]{
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
				request: api.SignUpWebauthnRequestObject{
					Body: &api.SignUpWebauthnJSONRequestBody{
						Email:   "jane@acme.com",
						Options: nil,
					},
				},
				expectedResponse: controller.ErrorResponse{
					Error:   "disabled-endpoint",
					Message: "This endpoint is disabled",
					Status:  409,
				},
				expectedJWT:       nil,
				jwtTokenFn:        nil,
				getControllerOpts: []getControllerOptsFunc{},
			},
			savedChallenge: controller.WebauthnChallenge{}, //nolint:exhaustruct
		},

		{
			testRequest: testRequest[api.SignUpWebauthnRequestObject, api.SignUpWebauthnResponseObject]{
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
				request: api.SignUpWebauthnRequestObject{
					Body: &api.SignUpWebauthnJSONRequestBody{
						Email:   "jane@acme.com",
						Options: nil,
					},
				},
				expectedResponse: controller.ErrorResponse{
					Error:   "signup-disabled",
					Message: "Sign up is disabled.",
					Status:  403,
				},
				expectedJWT:       nil,
				jwtTokenFn:        nil,
				getControllerOpts: []getControllerOptsFunc{},
			},
			savedChallenge: controller.WebauthnChallenge{}, //nolint:exhaustruct
		},

		{
			testRequest: testRequest[api.SignUpWebauthnRequestObject, api.SignUpWebauthnResponseObject]{
				name:   "user exists",
				config: getConfig,
				db: func(ctrl *gomock.Controller) controller.DBClient {
					mock := mock.NewMockDBClient(ctrl)

					return mock
				},
				request: api.SignUpWebauthnRequestObject{
					Body: &api.SignUpWebauthnJSONRequestBody{
						Email:   "jane@acme.com",
						Options: nil,
					},
				},
				expectedResponse: api.SignUpWebauthn200JSONResponse{
					RelyingParty: protocol.RelyingPartyEntity{
						CredentialEntity: protocol.CredentialEntity{
							Name: "React Apollo Example",
						},
						ID: "react-apollo.example.nhost.io",
					},
					User: protocol.UserEntity{
						CredentialEntity: protocol.CredentialEntity{
							Name: "jane@acme.com",
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
						RequireResidentKey:      new(false),
						ResidentKey:             "preferred",
						UserVerification:        "preferred",
					},
					AttestationFormats: nil,
					Attestation:        "indirect",
					Extensions:         nil,
					Hints:              nil,
				},
				expectedJWT:       nil,
				jwtTokenFn:        nil,
				getControllerOpts: []getControllerOptsFunc{},
			},
			savedChallenge: controller.WebauthnChallenge{
				Session: webauthn.SessionData{
					Challenge:            "xxx",
					UserID:               []byte{},
					AllowedCredentialIDs: nil,
					Expires:              time.Now().Add(1 * time.Minute),
					UserVerification:     "preferred",
					Extensions:           nil,
					RelyingPartyID:       "react-apollo.example.nhost.io",
				},
				User: controller.WebauthnUser{
					ID:           uuid.UUID{},
					Name:         "jane@acme.com",
					Email:        "jane@acme.com",
					Credentials:  nil,
					Discoverable: false,
				},
				Options: &api.SignUpOptions{
					AllowedRoles: &[]string{"user", "me"},
					DefaultRole:  new("user"),
					DisplayName:  new("jane@acme.com"),
					Locale:       new("en"),
					Metadata:     nil,
					RedirectTo:   new("http://localhost:3000"),
				},
			},
		},

		{
			testRequest: testRequest[api.SignUpWebauthnRequestObject, api.SignUpWebauthnResponseObject]{
				name:   "wrong redirectTo",
				config: getConfig,
				db: func(ctrl *gomock.Controller) controller.DBClient {
					mock := mock.NewMockDBClient(ctrl)
					return mock
				},
				request: api.SignUpWebauthnRequestObject{
					Body: &api.SignUpWebauthnJSONRequestBody{
						Email: "jane@acme.com",
						Options: &api.SignUpOptions{
							AllowedRoles: nil,
							DefaultRole:  nil,
							DisplayName:  nil,
							Locale:       nil,
							Metadata:     nil,
							RedirectTo:   new("http://evil.com/redirect"),
						},
					},
				},
				expectedResponse: controller.ErrorResponse{
					Error:   "redirectTo-not-allowed",
					Message: `The value of "options.redirectTo" is not allowed.`,
					Status:  400,
				},
				expectedJWT:       nil,
				jwtTokenFn:        nil,
				getControllerOpts: []getControllerOptsFunc{},
			},
			savedChallenge: controller.WebauthnChallenge{}, //nolint:exhaustruct
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, _ := getController(t, ctrl, tc.config, tc.db, tc.getControllerOpts...)

			//nolint:exhaustruct
			_ = assertRequest(
				t.Context(), t, c.SignUpWebauthn, tc.request, tc.expectedResponse,
				cmpopts.IgnoreFields(api.SignUpWebauthn200JSONResponse{}, "Challenge"),
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
