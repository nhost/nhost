package controller

import (
	"fmt"
	"log/slog"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/google/uuid"
	"github.com/nhost/hasura-auth/go/api"
)

type WebauthnUser struct {
	ID    uuid.UUID
	Name  string
	Email string
}

func (u WebauthnUser) WebAuthnID() []byte {
	return []byte(u.ID.String())
}

func (u WebauthnUser) WebAuthnName() string {
	return u.Name
}

func (u WebauthnUser) WebAuthnDisplayName() string {
	return u.Name
}

func (u WebauthnUser) WebAuthnCredentials() []webauthn.Credential {
	return nil
}

func (u WebauthnUser) WebAuthnIcon() string {
	return ""
}

type WebauthnChallenge struct {
	Session webauthn.SessionData
	User    WebauthnUser
	Options *api.SignUpOptions
}

type Webauthn struct {
	wa      *webauthn.WebAuthn
	Storage map[string]WebauthnChallenge
}

func NewWebAuthn(config Config) (*Webauthn, error) {
	wa, err := webauthn.New(&webauthn.Config{ //nolint:exhaustruct
		RPID:                  config.WebauthnRPID,
		RPDisplayName:         config.WebauthnRPName,
		RPOrigins:             config.WebauthnRPOrigins,
		AttestationPreference: protocol.PreferIndirectAttestation,
		EncodeUserIDAsString:  true,
		Timeouts: webauthn.TimeoutsConfig{
			Login: webauthn.TimeoutConfig{
				Enforce:    true,
				Timeout:    config.WebauhtnAttestationTimeout,
				TimeoutUVD: config.WebauhtnAttestationTimeout,
			},
			Registration: webauthn.TimeoutConfig{
				Enforce:    true,
				Timeout:    config.WebauhtnAttestationTimeout,
				TimeoutUVD: config.WebauhtnAttestationTimeout,
			},
		},
		AuthenticatorSelection: protocol.AuthenticatorSelection{
			AuthenticatorAttachment: "",
			RequireResidentKey:      ptr(false),
			ResidentKey:             protocol.ResidentKeyRequirementPreferred,
			UserVerification:        protocol.VerificationPreferred,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create webauthn: %w", err)
	}

	return &Webauthn{
		wa:      wa,
		Storage: make(map[string]WebauthnChallenge),
	}, nil
}

func (w *Webauthn) cleanCache() {
	toDelete := make([]string, 0, len(w.Storage))
	for k, v := range w.Storage {
		// if expired
		if time.Now().After(v.Session.Expires) {
			toDelete = append(toDelete, k)
		}
	}

	for _, k := range toDelete {
		delete(w.Storage, k)
	}
}

func (w *Webauthn) BeginRegistration(
	user WebauthnUser,
	options *api.SignUpOptions,
	logger *slog.Logger,
) (*protocol.CredentialCreation, *APIError) {
	w.cleanCache()

	challenge, session, err := w.wa.BeginRegistration(user)
	if err != nil {
		logger.Info("failed to begin webauthn registration", logError(err))
		return nil, ErrInternalServerError
	}

	w.Storage[challenge.Response.Challenge.String()] = WebauthnChallenge{
		Session: *session,
		User:    user,
		Options: options,
	}

	return challenge, nil
}

func (w *Webauthn) FinishRegistration(
	response *protocol.ParsedCredentialCreationData,
	logger *slog.Logger,
) (*webauthn.Credential, WebauthnUser, *APIError) {
	challenge, ok := w.Storage[response.Response.CollectedClientData.Challenge]
	if !ok {
		logger.Info("webauthn challenge not found")
		return nil, WebauthnUser{}, ErrInvalidRequest
	}

	cred, err := w.wa.CreateCredential(challenge.User, challenge.Session, response)
	if err != nil {
		logger.Info("failed to create webauthn credential", logError(err))
		return nil, WebauthnUser{}, ErrInvalidRequest
	}

	w.cleanCache()

	return cred, challenge.User, nil
}
