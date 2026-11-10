package controller_test

import (
	"errors"
	"log/slog"
	"testing"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/google/go-cmp/cmp"
	"github.com/google/uuid"
	"github.com/nhost/nhost/services/auth/go/controller"
)

func TestWebauthnFinishLoginRejectsDiscoverableChallengeWithoutHandler(t *testing.T) {
	t.Parallel()

	w, err := controller.NewWebAuthn(*getConfig())
	if err != nil {
		t.Fatal(err)
	}

	w.Storage.Store("discoverable", controller.WebauthnChallenge{
		Session: webauthn.SessionData{
			Challenge:            "discoverable",
			UserID:               nil,
			AllowedCredentialIDs: nil,
			Expires:              time.Now().Add(time.Minute),
			UserVerification:     "preferred",
			Extensions:           nil,
			RelyingPartyID:       "react-apollo.example.nhost.io",
		},
		User: controller.WebauthnUser{
			ID:           uuid.Nil,
			Name:         "",
			Email:        "",
			Credentials:  nil,
			Discoverable: true,
		},
		Options: nil,
	})

	response := &protocol.ParsedCredentialAssertionData{}
	response.Response.CollectedClientData.Challenge = "discoverable"
	// a non-empty user handle gets past the library's own checks so the
	// nil handler would be called if FinishLogin didn't reject it first
	response.Response.UserHandle = []byte("d0902ee3-d160-4853-af6a-8d4b6248117e")

	cred, user, apiErr := w.FinishLogin(
		t.Context(), response, nil, slog.New(slog.DiscardHandler),
	)
	if !errors.Is(apiErr, controller.ErrInvalidRequest) {
		t.Errorf("expected ErrInvalidRequest, got %v", apiErr)
	}

	if cred != nil {
		t.Errorf("expected no credential, got %v", cred)
	}

	if diff := cmp.Diff(controller.WebauthnUser{}, user); diff != "" {
		t.Errorf("expected zero user (-want +got):\n%s", diff)
	}
}
