package controller

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/google/uuid"
	"github.com/nhost/nhost/services/auth/go/api"
)

type WebauthnUser struct {
	ID           uuid.UUID
	Name         string
	Email        string
	Credentials  []webauthn.Credential
	Discoverable bool
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
	return u.Credentials
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
	ctx context.Context,
	user WebauthnUser,
	options *api.SignUpOptions,
	logger *slog.Logger,
	opts ...webauthn.RegistrationOption,
) (*protocol.CredentialCreation, *APIError) {
	w.cleanCache()

	challenge, session, err := w.wa.BeginRegistration(user, opts...)
	if err != nil {
		logger.InfoContext(ctx, "failed to begin webauthn registration", logError(err))
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
	ctx context.Context,
	response *protocol.ParsedCredentialCreationData,
	logger *slog.Logger,
) (*webauthn.Credential, WebauthnUser, *APIError) {
	challenge, ok := w.Storage[response.Response.CollectedClientData.Challenge]
	if !ok {
		logger.InfoContext(ctx, "webauthn challenge not found")
		return nil, WebauthnUser{}, ErrInvalidRequest
	}

	cred, err := w.wa.CreateCredential(challenge.User, challenge.Session, response)
	if err != nil {
		logger.InfoContext(ctx, "failed to create webauthn credential", logError(err))
		return nil, WebauthnUser{}, ErrInvalidRequest
	}

	w.cleanCache()

	return cred, challenge.User, nil
}

func (w *Webauthn) BeginLogin(
	ctx context.Context,
	user WebauthnUser,
	logger *slog.Logger,
) (*protocol.CredentialAssertion, *APIError) {
	w.cleanCache()

	creds := user.WebAuthnCredentials()

	allowList := make([]protocol.CredentialDescriptor, len(creds))
	for i, cred := range creds {
		allowList[i] = protocol.CredentialDescriptor{
			Type:            protocol.CredentialType("public-key"),
			CredentialID:    cred.ID,
			Transport:       nil,
			AttestationType: "",
		}
	}

	challenge, session, err := w.wa.BeginLogin(
		user,
		webauthn.WithAllowedCredentials(allowList),
	)
	if err != nil {
		logger.InfoContext(ctx, "failed to begin webauthn login", logError(err))
		return nil, ErrInternalServerError
	}

	w.Storage[challenge.Response.Challenge.String()] = WebauthnChallenge{
		Session: *session,
		User:    user,
		Options: nil,
	}

	return challenge, nil
}

func (w *Webauthn) FinishLogin(
	ctx context.Context,
	response *protocol.ParsedCredentialAssertionData,
	userHandler webauthn.DiscoverableUserHandler,
	logger *slog.Logger,
) (*webauthn.Credential, WebauthnUser, *APIError) {
	challenge, ok := w.Storage[response.Response.CollectedClientData.Challenge]
	if !ok {
		logger.InfoContext(ctx, "webauthn challenge not found")
		return nil, WebauthnUser{}, ErrInvalidRequest
	}

	if challenge.User.Discoverable {
		return w.FinishDiscoverableLogin(ctx, response, userHandler, logger)
	}

	// we don't track the flags so we just copy them
	for i, userCreds := range challenge.User.Credentials {
		if bytes.Equal(response.RawID, userCreds.ID) {
			userCreds.Flags = webauthn.CredentialFlags{
				UserPresent:    response.Response.AuthenticatorData.Flags.UserPresent(),
				UserVerified:   response.Response.AuthenticatorData.Flags.UserVerified(),
				BackupEligible: response.Response.AuthenticatorData.Flags.HasBackupEligible(),
				BackupState:    response.Response.AuthenticatorData.Flags.HasBackupState(),
			}
			challenge.User.Credentials[i] = userCreds
		}
	}

	// we do this in case the userHandle hasn't been urlencoded by the library
	b, err := json.Marshal(protocol.URLEncodedBase64(response.Response.UserHandle))
	if err == nil {
		potentialUUID, err := uuid.Parse(string(b))
		if err == nil && bytes.Equal(potentialUUID[:], challenge.User.ID[:]) {
			response.Response.UserHandle = challenge.User.WebAuthnID()
		}
	}

	cred, err := w.wa.ValidateLogin(challenge.User, challenge.Session, response)
	if err != nil {
		logger.InfoContext(ctx, "failed to validate webauthn login", logError(err))
		return nil, WebauthnUser{}, ErrInvalidRequest
	}

	w.cleanCache()

	return cred, challenge.User, nil
}

func (w *Webauthn) BeginDiscoverableLogin(
	ctx context.Context, logger *slog.Logger,
) (*protocol.CredentialAssertion, *APIError) {
	w.cleanCache()

	challenge, sessionData, err := w.wa.BeginDiscoverableLogin()
	if err != nil {
		logger.ErrorContext(ctx, "failed to begin discoverable webauthn login", logError(err))
		return nil, ErrInternalServerError
	}

	w.Storage[challenge.Response.Challenge.String()] = WebauthnChallenge{
		Session: *sessionData,
		User: WebauthnUser{
			ID:           uuid.Nil,
			Name:         "",
			Email:        "",
			Credentials:  []webauthn.Credential{},
			Discoverable: true,
		},
		Options: nil,
	}

	return challenge, nil
}

func (w *Webauthn) FinishDiscoverableLogin(
	ctx context.Context,
	response *protocol.ParsedCredentialAssertionData,
	userHandler webauthn.DiscoverableUserHandler,
	logger *slog.Logger,
) (*webauthn.Credential, WebauthnUser, *APIError) {
	challenge, ok := w.Storage[response.Response.CollectedClientData.Challenge]
	if !ok {
		logger.InfoContext(ctx, "webauthn challenge not found")
		return nil, WebauthnUser{}, ErrInvalidRequest
	}

	cred, err := w.wa.ValidateDiscoverableLogin(userHandler, challenge.Session, response)
	if err != nil {
		logger.InfoContext(ctx, "failed to validate webauthn discoverable login", logError(err))
		return nil, WebauthnUser{}, ErrInvalidRequest
	}

	w.cleanCache()

	return cred, challenge.User, nil
}
