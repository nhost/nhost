package controller

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/nhost/nhost/internal/lib/oapi"
)

const (
	// linkConnectCookieName is the dedicated, single-purpose cookie used only
	// by the account linking (connect) flow. It is set by the authenticated
	// init endpoint and read + cleared at the provider callback. No other part
	// of the service reads or writes it.
	linkConnectCookieName = "nhost-link-connect"

	// linkConnectPurpose distinguishes the signed link cookie from a regular
	// access token: both are signed with the same key, so the callback rejects
	// any token that does not carry this purpose.
	linkConnectPurpose = "link-connect"
)

var (
	errGinContextNotFound = errors.New("gin context not found in request context")

	// errInvalidLinkConnectCookie is returned when the link cookie is missing,
	// malformed, expired, or is not a link-connect token.
	errInvalidLinkConnectCookie = errors.New("invalid link-connect cookie")
)

// linkConnectData is the identity captured at the authenticated init step and
// recovered, in the user's own browser, at the callback. It never appears in
// any URL or in the OAuth state.
type linkConnectData struct {
	UserID   uuid.UUID
	Provider string
	Nonce    string
}

func (ctrl *Controller) signLinkConnectCookie(data linkConnectData) (string, error) {
	token, err := ctrl.jwtGetter.SignTokenWithClaims(
		jwt.MapClaims{
			"sub":      data.UserID.String(),
			"purpose":  linkConnectPurpose,
			"provider": data.Provider,
			"nonce":    data.Nonce,
		},
		time.Now().Add(In5Minutes),
	)
	if err != nil {
		return "", fmt.Errorf("error signing link-connect cookie: %w", err)
	}

	return token, nil
}

func (ctrl *Controller) newLinkConnectCookie(value string) *http.Cookie {
	return &http.Cookie{ //nolint:exhaustruct
		Name:     linkConnectCookieName,
		Value:    value,
		Path:     "/",
		MaxAge:   int(In5Minutes.Seconds()),
		Secure:   ctrl.config.UseSecureCookies(),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	}
}

// setLinkConnectCookie signs and writes the single-use link cookie onto the
// current response. The identity comes from data and is never placed in a URL.
func (ctrl *Controller) setLinkConnectCookie(ctx context.Context, data linkConnectData) error {
	ginCtx := oapi.GetGinContext(ctx)
	if ginCtx == nil {
		return errGinContextNotFound
	}

	value, err := ctrl.signLinkConnectCookie(data)
	if err != nil {
		return err
	}

	http.SetCookie(ginCtx.Writer, ctrl.newLinkConnectCookie(value))

	return nil
}

// clearLinkConnectCookie expires the link cookie so it can only be redeemed
// once.
func (ctrl *Controller) clearLinkConnectCookie(w http.ResponseWriter) {
	cookie := ctrl.newLinkConnectCookie("")
	cookie.MaxAge = -1
	http.SetCookie(w, cookie)
}

// readLinkConnectCookie validates the link cookie and returns the captured
// identity. It rejects anything that is not a fresh link-connect token.
func (ctrl *Controller) readLinkConnectCookie(r *http.Request) (linkConnectData, error) {
	cookie, err := r.Cookie(linkConnectCookieName)
	if err != nil {
		return linkConnectData{}, fmt.Errorf("%w: %w", errInvalidLinkConnectCookie, err)
	}

	token, err := ctrl.jwtGetter.Validate(cookie.Value)
	if err != nil {
		return linkConnectData{}, fmt.Errorf("%w: %w", errInvalidLinkConnectCookie, err)
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return linkConnectData{}, errInvalidLinkConnectCookie
	}

	if purpose, _ := claims["purpose"].(string); purpose != linkConnectPurpose {
		return linkConnectData{}, errInvalidLinkConnectCookie
	}

	sub, ok := claims["sub"].(string)
	if !ok {
		return linkConnectData{}, errInvalidLinkConnectCookie
	}

	userID, err := uuid.Parse(sub)
	if err != nil {
		return linkConnectData{}, fmt.Errorf("%w: %w", errInvalidLinkConnectCookie, err)
	}

	provider, _ := claims["provider"].(string)
	nonce, _ := claims["nonce"].(string)

	return linkConnectData{
		UserID:   userID,
		Provider: provider,
		Nonce:    nonce,
	}, nil
}
