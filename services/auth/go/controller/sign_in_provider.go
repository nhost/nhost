package controller

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"
	"net/url"
	"time"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/oidc"
	"github.com/nhost/nhost/services/auth/go/pkce"
	"github.com/nhost/nhost/services/auth/go/providers"
	"golang.org/x/oauth2"
)

// nonceSize is the raw entropy behind an OIDC nonce, in bytes, before hex
// encoding for the signed state and SHA-256 hashing for the authorize URL. The
// nonce's only job is to be unguessable to anyone who did not start the flow,
// so this is sized to the 256 bits of oidc.HashNonce's digest rather than to
// any protocol-mandated length — the spec sets none.
const nonceSize = 32

func (ctrl *Controller) getSigninProviderValidateRequest(
	ctx context.Context,
	req api.SignInProviderRequestObject,
	logger *slog.Logger,
) (*url.URL, *APIError) {
	options, apiErr := ctrl.wf.ValidateOptionsRedirectTo(
		ctx,
		&api.OptionsRedirectTo{
			RedirectTo: req.Params.RedirectTo,
		},
		logger,
	)
	if apiErr != nil {
		return nil, apiErr
	}

	redirectTo, err := url.Parse(*options.RedirectTo)
	if err != nil {
		logger.ErrorContext(ctx, "error parsing redirect URL",
			slog.String("redirectTo", *options.RedirectTo), logError(err))

		return nil, ErrInvalidRequest
	}

	if cc := deptr(req.Params.CodeChallenge); cc != "" {
		if err := pkce.ValidateCodeChallengeFormat(cc); err != nil {
			logger.WarnContext(ctx, "invalid code challenge format", logError(err))
			return nil, ErrInvalidRequest
		}
	}

	return redirectTo, nil
}

// providerAuthCodeURL builds the provider's authorization URL for either
// protocol. Both branches can fail: Oauth1 fetches a request token over
// HTTP, and Oauth2 providers may discover their endpoints lazily.
func (ctrl *Controller) providerAuthCodeURL(
	ctx context.Context,
	provider *providers.Provider,
	state string,
	params *api.ProviderSpecificParams,
	logger *slog.Logger,
	opts ...oauth2.AuthCodeOption,
) (string, *APIError) {
	var (
		url string
		err error
	)

	switch {
	case provider.IsOauth1():
		url, err = provider.Oauth1().AuthCodeURL(ctx, state)
	default:
		url, err = provider.Oauth2().AuthCodeURL(ctx, state, params, opts...)
	}

	if err != nil {
		logger.ErrorContext(ctx, "error getting auth code URL from provider",
			slog.Bool("oauth1", provider.IsOauth1()), logError(err))

		return "", ErrInternalServerError
	}

	return url, nil
}

// nonceForProvider returns the raw nonce to bind into the signed state and
// the authorize-URL option carrying oidc.HashNonce(raw) — the form id_token
// nonce claims are compared against — for providers that round-trip an OIDC
// nonce (custom OIDC providers). Built-ins don't, so they are
// feature-detected via type assertion and get (nil, nil, nil): no nonce
// parameter is added to their authorize URLs.
func nonceForProvider(provider *providers.Provider) (*string, []oauth2.AuthCodeOption, error) {
	if provider.IsOauth1() {
		return nil, nil, nil
	}

	np, ok := provider.Oauth2().(providers.NonceProvider)
	if !ok || !np.UsesNonce() {
		return nil, nil, nil
	}

	buf := make([]byte, nonceSize)
	if _, err := rand.Read(buf); err != nil {
		return nil, nil, fmt.Errorf("generating nonce: %w", err)
	}

	raw := hex.EncodeToString(buf)

	return &raw, []oauth2.AuthCodeOption{
		oauth2.SetAuthURLParam("nonce", oidc.HashNonce(raw)),
	}, nil
}

func (ctrl *Controller) SignInProvider( //nolint:ireturn
	ctx context.Context,
	req api.SignInProviderRequestObject,
) (api.SignInProviderResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx).
		With(slog.String("provider", req.Provider))

	redirectTo, apiErr := ctrl.getSigninProviderValidateRequest(ctx, req, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	provider := ctrl.Providers.Get(req.Provider)
	if provider == nil {
		logger.ErrorContext(ctx, "provider not enabled")
		return ctrl.sendRedirectError(redirectTo, ErrDisabledEndpoint), nil
	}

	rawNonce, nonceOpts, err := nonceForProvider(provider)
	if err != nil {
		logger.ErrorContext(ctx, "error generating nonce", logError(err))
		return ctrl.sendRedirectError(redirectTo, ErrInternalServerError), nil
	}

	stateData := providers.State{
		Connect: req.Params.Connect,
		Options: &api.SignUpOptions{
			AllowedRoles: req.Params.AllowedRoles,
			DefaultRole:  req.Params.DefaultRole,
			DisplayName:  req.Params.DisplayName,
			Locale:       req.Params.Locale,
			Metadata:     req.Params.Metadata,
			RedirectTo:   new(redirectTo.String()),
		},
		State:         req.Params.State,
		Flow:          providers.FlowSignin,
		CodeChallenge: req.Params.CodeChallenge,
		Nonce:         rawNonce,
	}

	state, err := ctrl.wf.jwtGetter.SignTokenWithClaims(
		stateData.Encode(),
		time.Now().Add(time.Minute),
	)
	if err != nil {
		logger.ErrorContext(ctx, "error signing state token", logError(err))
		return ctrl.sendRedirectError(redirectTo, ErrInternalServerError), nil
	}

	url, apiErr := ctrl.providerAuthCodeURL(
		ctx, provider, state, req.Params.ProviderSpecificParams, logger, nonceOpts...,
	)
	if apiErr != nil {
		return ctrl.sendRedirectError(redirectTo, apiErr), nil
	}

	return api.SignInProvider302Response{
		Headers: api.SignInProvider302ResponseHeaders{
			Location: url,
		},
	}, nil
}
