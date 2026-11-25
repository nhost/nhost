package transport

import (
	"context"
	"errors"
	"fmt"
)

type credentialSnapshot struct {
	id, secret, method string
	version            uint64
}

type registrationFlight struct {
	done   chan struct{}
	issuer string
	err    error
}

func serverChanged() error {
	return fmt.Errorf("OAuth issuer binding mismatch: %w", errors.Join(ErrAuthorizationServerChanged, ErrOAuthAuthorizationRequired))
}

// GetCredentialsIssuer returns the exact issuer bound to the client credentials.
// Persist it with the client ID, secret and token endpoint authentication method.
func (h *OAuthHandler) GetCredentialsIssuer() string {
	h.credentialsMu.Lock()
	defer h.credentialsMu.Unlock()
	return h.config.CredentialsIssuer
}

// metadataCurrent is called while credentialsMu prevents discovery resets.
func (h *OAuthHandler) metadataCurrent(metadata *AuthServerMetadata) bool {
	h.metadataMu.Lock()
	defer h.metadataMu.Unlock()
	return h.serverMetadata == metadata
}

func (h *OAuthHandler) boundCredentials(metadata *AuthServerMetadata) (credentialSnapshot, error) {
	h.credentialsMu.Lock()
	defer h.credentialsMu.Unlock()
	if metadata.Issuer == "" {
		return credentialSnapshot{}, errors.New("authorization server metadata missing issuer")
	}
	if !h.metadataCurrent(metadata) {
		return credentialSnapshot{}, serverChanged()
	}
	if h.config.CredentialsIssuer == "" {
		h.config.CredentialsIssuer = metadata.Issuer
		h.credentialsVersion++
	}
	if h.config.CredentialsIssuer != metadata.Issuer || (h.credentialsDCR && h.config.ClientID == "") {
		return credentialSnapshot{}, serverChanged()
	}
	return credentialSnapshot{
		id: h.config.ClientID, secret: h.config.ClientSecret,
		method: h.authMethodLocked(), version: h.credentialsVersion,
	}, nil
}

func (h *OAuthHandler) authorizationCredentials(ctx context.Context, metadata *AuthServerMetadata) (credentialSnapshot, error) {
	h.credentialsMu.Lock()
	migrate := h.credentialsDCR && (h.config.CredentialsIssuer != metadata.Issuer || h.config.ClientID == "")
	name := h.registrationName
	h.credentialsMu.Unlock()
	if migrate {
		if err := h.registerClient(ctx, metadata, name, true); err != nil {
			return credentialSnapshot{}, err
		}
	}
	return h.boundCredentials(metadata)
}

// registerClient shares a bounded registration flight; cancellation of one
// waiter must not abandon credentials already issued to the other waiters.
func (h *OAuthHandler) registerClient(ctx context.Context, metadata *AuthServerMetadata, name string, migrate bool) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if metadata.Issuer == "" {
		return errors.New("authorization server metadata missing issuer")
	}
	for {
		h.credentialsMu.Lock()
		if !h.metadataCurrent(metadata) {
			h.credentialsMu.Unlock()
			return serverChanged()
		}
		if migrate && h.config.CredentialsIssuer == metadata.Issuer && h.config.ClientID != "" {
			h.credentialsMu.Unlock()
			return nil
		}
		flight := h.registering
		if flight == nil {
			if migrate {
				h.config.ClientID = ""
				h.config.ClientSecret = ""
				h.config.TokenEndpointAuthMethod = ""
				h.registeredAuthMethod = ""
				h.credentialsVersion++
			}
			version := h.credentialsVersion
			flight = &registrationFlight{done: make(chan struct{}), issuer: metadata.Issuer}
			h.registering = flight
			registrationCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), refreshTimeout)
			go func() {
				defer cancel()
				err := h.performRegistration(registrationCtx, metadata, name, version)
				h.credentialsMu.Lock()
				flight.err = err
				h.registering = nil
				close(flight.done)
				h.credentialsMu.Unlock()
			}()
		}
		h.credentialsMu.Unlock()
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-flight.done:
			if flight.issuer == metadata.Issuer {
				return flight.err
			}
		}
	}
}

func (h *OAuthHandler) checkKnownTokenIssuer(token *Token) error {
	h.metadataMu.Lock()
	defer h.metadataMu.Unlock()
	if token.Issuer != "" && h.knownIssuer != "" && h.knownIssuer != token.Issuer {
		return serverChanged()
	}
	return nil
}

func (h *OAuthHandler) saveBoundToken(ctx context.Context, metadata *AuthServerMetadata, credentials credentialSnapshot, token *Token) error {
	h.credentialsMu.Lock()
	defer h.credentialsMu.Unlock()
	if h.credentialsVersion != credentials.version || !h.metadataCurrent(metadata) {
		return serverChanged()
	}
	token.Issuer = metadata.Issuer
	return h.config.TokenStore.SaveToken(ctx, token)
}
