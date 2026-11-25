package controller

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/oauth2"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/pkce"
	"github.com/nhost/nhost/services/auth/go/providers"
)

const (
	oidcStateClaim     = "oidc"
	maxOIDCStateLength = 4096
)

type oidcBrowserState struct {
	ProviderID        string          `json:"provider"`
	Issuer            string          `json:"issuer"`
	ClientID          string          `json:"clientId"`
	Nonce             string          `json:"nonce"`
	UpstreamChallenge string          `json:"upstreamChallenge"`
	ConnectUserID     *uuid.UUID      `json:"connectUserId,omitempty"`
	Intent            providers.State `json:"intent"`
}

func (ctrl *Controller) SignInOidc( //nolint:ireturn
	ctx context.Context, req api.SignInOidcRequestObject,
) (api.SignInOidcResponseObject, error) {
	location, cookie, apiErr := ctrl.startOIDC(ctx, req.Provider, req.Params, providers.FlowSignin)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	return api.SignInOidc302Response{
		Headers: api.SignInOidc302ResponseHeaders{Location: location, SetCookie: cookie},
	}, nil
}

func (ctrl *Controller) SignUpOidc( //nolint:ireturn
	ctx context.Context, req api.SignUpOidcRequestObject,
) (api.SignUpOidcResponseObject, error) {
	params := api.SignInOidcParams{
		CodeChallenge: &req.Params.CodeChallenge,
		Connect:       nil,
		RedirectTo:    req.Params.RedirectTo,
		State:         req.Params.State,
		AllowedRoles:  req.Params.AllowedRoles,
		DefaultRole:   req.Params.DefaultRole,
		DisplayName:   req.Params.DisplayName,
		Locale:        req.Params.Locale,
		Metadata:      req.Params.Metadata,
	}

	location, cookie, apiErr := ctrl.startOIDC(ctx, req.Provider, params, providers.FlowSignup)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	return api.SignUpOidc302Response{
		Headers: api.SignUpOidc302ResponseHeaders{Location: location, SetCookie: cookie},
	}, nil
}

func (ctrl *Controller) startOIDC( //nolint:funlen // Browser authorization keeps the signed state and cookie together.
	ctx context.Context,
	slug string,
	params api.SignInOidcParams,
	flow string,
) (string, *string, *APIError) {
	ctx = oidcRequestContext(ctx)
	logger := oapimw.LoggerFromContext(ctx).With(slog.String("provider", slug))

	redirect, apiErr := ctrl.validateProviderStart(
		ctx,
		params.RedirectTo,
		params.CodeChallenge,
		logger,
	)
	if apiErr != nil {
		return "", nil, apiErr
	}

	p := ctrl.oidcProviders.Get(slug)
	if p == nil {
		location := ctrl.sendRedirectError(redirect, ErrDisabledEndpoint).Headers.Location

		return location, nil, nil
	}

	if flow == providers.FlowSignup && ctrl.config.DisableSignup {
		return "", nil, ErrSignupDisabled
	}

	if params.Connect == nil && deptr(params.CodeChallenge) == "" {
		return "", nil, ErrInvalidRequest
	}

	connectUser, expiresAt, apiErr := ctrl.oidcConnectUser(
		params.Connect,
		time.Now().Add(In5Minutes),
	)
	if apiErr != nil {
		return "", nil, apiErr
	}

	verifier, nonce := oauth2.GenerateVerifier(), oauth2.GenerateVerifier()
	state := oidcBrowserState{
		ProviderID:        p.ID(),
		Issuer:            p.Issuer(),
		ClientID:          p.ClientID(),
		Nonce:             nonce,
		UpstreamChallenge: pkce.ComputeS256Challenge(verifier),
		ConnectUserID:     connectUser,
		Intent:            oidcBrowserIntent(params, redirect.String(), flow),
	}

	signedState, err := ctrl.wf.jwtGetter.SignTokenWithClaims(
		jwt.MapClaims{oidcStateClaim: state}, expiresAt,
	)
	if err != nil {
		logger.ErrorContext(ctx, "failed to sign OIDC state")
		return "", nil, ErrInternalServerError
	}

	if len(signedState) > maxOIDCStateLength {
		return "", nil, ErrInvalidRequest
	}

	location, err := p.AuthorizationURL(ctx, signedState, nonce, verifier)
	if err != nil {
		logger.WarnContext(ctx, "failed to start OIDC authorization")
		return "", nil, ErrOauthProviderError
	}

	return location, new(oidcCookie(nonce, verifier, int(In5Minutes.Seconds())).String()), nil
}

// Authorize the link before redirecting so the IdP never sees the access token.
func (ctrl *Controller) oidcConnectUser(
	connect *string, expiresAt time.Time,
) (*uuid.UUID, time.Time, *APIError) {
	if connect == nil {
		return nil, expiresAt, nil
	}

	token, err := ctrl.wf.jwtGetter.Validate(*connect)
	if err != nil {
		return nil, time.Time{}, ErrInvalidRequest
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, time.Time{}, ErrInvalidRequest
	}

	// OAuth2 tokens use the same signing key and issuer and carry a client audience.
	if _, hasAudience := claims["aud"]; hasAudience {
		return nil, time.Time{}, ErrInvalidRequest
	}

	userID, err := ctrl.wf.jwtGetter.GetUserID(token)
	if err != nil || userID == uuid.Nil ||
		ctrl.wf.jwtGetter.GetCustomClaim(token, "x-hasura-user-id") != userID.String() {
		return nil, time.Time{}, ErrInvalidRequest
	}

	expiration, err := token.Claims.GetExpirationTime()
	if err != nil || expiration == nil {
		return nil, time.Time{}, ErrInvalidRequest
	}

	if expiration.Before(expiresAt) {
		expiresAt = expiration.Time
	}

	return &userID, expiresAt, nil
}

func oidcBrowserIntent(params api.SignInOidcParams, redirect, flow string) providers.State {
	return providers.State{
		Connect: nil,
		Options: &api.SignUpOptions{
			AllowedRoles: params.AllowedRoles,
			DefaultRole:  params.DefaultRole,
			DisplayName:  params.DisplayName,
			Locale:       params.Locale,
			Metadata:     params.Metadata,
			RedirectTo:   &redirect,
		},
		State:         params.State,
		Flow:          flow,
		CodeChallenge: params.CodeChallenge,
	}
}

// Use the request context for upstream HTTP calls. Transport cleanup can
// outlive the handler, after Gin has returned its context to the pool.
func oidcRequestContext(ctx context.Context) context.Context {
	if ginCtx, ok := ctx.(*gin.Context); ok {
		return ginCtx.Request.Context()
	}

	return ctx
}

func oidcCookie(nonce, value string, maxAge int) *http.Cookie {
	// The __Host- prefix prevents sibling subdomains from setting this cookie.
	return &http.Cookie{ //nolint:exhaustruct
		Name:     "__Host-nhost-oidc-" + nonce,
		Value:    value,
		Path:     "/",
		MaxAge:   maxAge,
		Secure:   true,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	}
}

func (ctrl *Controller) decodeOIDCState(raw string) (*oidcBrowserState, *APIError) {
	if len(raw) > maxOIDCStateLength {
		return nil, ErrInvalidState
	}

	token, err := ctrl.wf.jwtGetter.Validate(raw)
	if err != nil {
		return nil, ErrInvalidState
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, ErrInvalidState
	}

	encoded, err := json.Marshal(claims[oidcStateClaim])
	if err != nil {
		return nil, ErrInvalidState
	}

	var state oidcBrowserState
	if err := json.Unmarshal(encoded, &state); err != nil || state.Intent.Connect != nil ||
		state.Intent.Options == nil || pkce.ValidateCodeChallengeFormat(state.Nonce) != nil {
		return nil, ErrInvalidState
	}

	if state.Intent.Flow != providers.FlowSignin && state.Intent.Flow != providers.FlowSignup {
		return nil, ErrInvalidState
	}

	if state.ConnectUserID == nil {
		if pkce.ValidateCodeChallengeFormat(deptr(state.Intent.CodeChallenge)) != nil {
			return nil, ErrInvalidState
		}
	} else if state.Intent.Flow != providers.FlowSignin || *state.ConnectUserID == uuid.Nil {
		return nil, ErrInvalidState
	}

	return &state, nil
}
