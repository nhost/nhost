package controller

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/url"
	"time"

	"golang.org/x/oauth2"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/oidc"
	"github.com/nhost/nhost/services/auth/go/providers"
	"github.com/nhost/nhost/services/auth/go/sql"
)

type providerCallbackData struct {
	State            string
	Provider         string
	Code             *string
	IDToken          *string
	OauthToken       *string
	OauthVerifier    *string
	Error            *string
	ErrorDescription *string
	ErrorURI         *string
	Extras           map[string]any
}

func (ctrl *Controller) getStateData(
	ctx context.Context, state string, logger *slog.Logger,
) (*providers.State, *APIError) {
	stateToken, err := ctrl.wf.jwtGetter.Validate(state)
	if err != nil {
		logger.ErrorContext(ctx, "invalid state token", logError(err))
		return nil, ErrInvalidState
	}

	stateData := &providers.State{} //nolint:exhaustruct
	if err := stateData.Decode(stateToken.Claims); err != nil {
		logger.ErrorContext(ctx, "error decoding state token", logError(err))
		return nil, ErrInvalidState
	}

	return stateData, nil
}

func attachURLValues(u *url.URL, values map[string]string) {
	q := u.Query()
	for k, v := range values {
		q.Set(k, v)
	}

	u.RawQuery = q.Encode()
}

func (ctrl *Controller) signinProviderProviderCallbackValidate(
	ctx context.Context,
	req providerCallbackData,
	logger *slog.Logger,
) (*api.SignUpOptions, *string, *url.URL, *APIError) {
	redirectTo := ctrl.config.ClientURL

	stateData, apiErr := ctrl.getStateData(ctx, req.State, logger)
	if apiErr != nil {
		attachURLValues(redirectTo, map[string]string{
			"provider_state": req.State,
		})

		return nil, nil, redirectTo, apiErr
	}

	// we just care about the redirect URL for now, the rest is handled by the signin flow
	options, apiErr := ctrl.wf.ValidateOptionsRedirectTo(
		ctx,
		&api.OptionsRedirectTo{
			RedirectTo: stateData.Options.RedirectTo,
		},
		logger,
	)
	if apiErr != nil {
		return nil, nil, redirectTo, apiErr
	}

	if req.Error != nil && *req.Error != "" {
		values := map[string]string{
			"provider_error":             deptr(req.Error),
			"provider_error_description": deptr(req.ErrorDescription),
			"provider_error_url":         deptr(req.ErrorURI),
		}

		if stateData.State != nil && *stateData.State != "" {
			values["state"] = *stateData.State
		}

		attachURLValues(redirectTo, values)

		return nil, nil, redirectTo, ErrOauthProviderError
	}

	optionsRedirectTo, err := url.Parse(*options.RedirectTo)
	if err != nil {
		logger.ErrorContext(ctx, "error parsing redirect URL", logError(err))
		return nil, nil, redirectTo, ErrInvalidRequest
	}

	if stateData.State != nil && *stateData.State != "" {
		attachURLValues(optionsRedirectTo, map[string]string{
			"state": *stateData.State,
		})
	}

	return stateData.Options, stateData.Connect, optionsRedirectTo, nil
}

func tokenToProviderSession(token *oauth2.Token) api.ProviderSession {
	expiresIn := int(token.ExpiresIn)
	if expiresIn == 0 && !token.Expiry.IsZero() {
		expiresIn = int(time.Until(token.Expiry).Seconds())
	}

	expiresAt := token.Expiry
	if token.Expiry.IsZero() {
		expiresAt = time.Now().Add(time.Duration(expiresIn) * time.Second)
	}

	return api.ProviderSession{
		AccessToken:  token.AccessToken,
		ExpiresIn:    expiresIn,
		ExpiresAt:    expiresAt,
		RefreshToken: ptr(token.RefreshToken),
	}
}

func (ctrl *Controller) signinProviderProviderCallbackOauthFlow(
	ctx context.Context,
	req providerCallbackData,
	logger *slog.Logger,
) (oidc.Profile, api.ProviderSession, *APIError) {
	p := ctrl.Providers.Get(req.Provider)
	if p == nil {
		logger.ErrorContext(ctx, "provider not enabled")
		return oidc.Profile{}, api.ProviderSession{}, ErrDisabledEndpoint
	}

	var (
		profile         oidc.Profile
		providerSession api.ProviderSession
	)
	switch {
	case p.IsOauth1():
		accessTokenValue, accessTokenSecret, err := p.Oauth1().AccessToken(
			ctx, deptr(req.OauthToken), deptr(req.OauthVerifier),
		)
		if err != nil {
			logger.ErrorContext(ctx, "failed to request token", logError(err))
			return oidc.Profile{}, api.ProviderSession{}, ErrOauthProfileFetchFailed
		}

		profile, err = p.Oauth1().GetProfile(ctx, accessTokenValue, accessTokenSecret)
		if err != nil {
			logger.ErrorContext(ctx, "failed to get user info", logError(err))
			return oidc.Profile{}, api.ProviderSession{}, ErrOauthProfileFetchFailed
		}

		providerSession.AccessToken = accessTokenValue
	default:
		token, err := p.Oauth2().Exchange(ctx, deptr(req.Code))
		if err != nil {
			logger.ErrorContext(ctx, "failed to exchange token", logError(err))
			return oidc.Profile{}, api.ProviderSession{}, ErrOauthTokenExchangeFailed
		}

		profile, err = p.Oauth2().GetProfile(ctx, token.AccessToken, req.IDToken, req.Extras)
		if err != nil {
			logger.ErrorContext(ctx, "failed to get user info", logError(err))
			return oidc.Profile{}, api.ProviderSession{}, ErrOauthProfileFetchFailed
		}

		providerSession = tokenToProviderSession(token)
	}

	if profile.ProviderUserID == "" {
		logger.ErrorContext(ctx, "provider user id is empty")
		return oidc.Profile{}, api.ProviderSession{}, ErrOauthProfileFetchFailed
	}

	return profile, providerSession, nil
}

func encryptProviderSession(
	ctx context.Context,
	encrypter Encrypter,
	providerSession api.ProviderSession,
	logger *slog.Logger,
) (string, *APIError) {
	b, err := json.Marshal(providerSession)
	if err != nil {
		logger.ErrorContext(ctx, "failed to marshal provider session", logError(err))
		return "", ErrInternalServerError
	}

	providerSessionEnc, err := encrypter.Encrypt(b)
	if err != nil {
		logger.ErrorContext(ctx, "failed to encrypt provider session", logError(err))
		return "", ErrInternalServerError
	}

	return string(providerSessionEnc), nil
}

func (ctrl *Controller) signinProviderProviderCallback(
	ctx context.Context,
	req providerCallbackData,
) (*url.URL, *APIError) {
	logger := oapimw.LoggerFromContext(ctx)

	options, connnect, redirectTo, apiErr := ctrl.signinProviderProviderCallbackValidate(
		ctx,
		req,
		logger,
	)
	if apiErr != nil {
		return redirectTo, apiErr
	}

	profile, providerSession, apiErr := ctrl.signinProviderProviderCallbackOauthFlow(
		ctx,
		req,
		logger,
	)
	if apiErr != nil {
		return redirectTo, apiErr
	}

	if connnect != nil {
		if apiErr := ctrl.signinProviderProviderCallbackConnect(
			ctx, *connnect, req.Provider, profile, logger,
		); apiErr != nil {
			return redirectTo, apiErr
		}
	} else {
		session, apiErr := ctrl.providerSignInFlow(
			ctx, profile, req.Provider, options, logger,
		)
		if apiErr != nil {
			return redirectTo, apiErr
		}

		if session != nil {
			values := redirectTo.Query()
			values.Add("refreshToken", session.RefreshToken)
			redirectTo.RawQuery = values.Encode()
		}
	}

	providerSessionEnc, apiErr := encryptProviderSession(
		ctx, ctrl.encrypter, providerSession, logger,
	)
	if apiErr != nil {
		return redirectTo, apiErr
	}

	if err := ctrl.wf.db.UpdateProviderSession(ctx, sql.UpdateProviderSessionParams{
		ProviderID:     req.Provider,
		ProviderUserID: profile.ProviderUserID,
		AccessToken:    providerSessionEnc,
	}); err != nil {
		logger.ErrorContext(ctx, "failed to update provider tokens", logError(err))
		return redirectTo, ErrInternalServerError
	}

	return redirectTo, nil
}

func (ctrl *Controller) SignInProviderCallbackGet( //nolint:ireturn
	ctx context.Context,
	req api.SignInProviderCallbackGetRequestObject,
) (api.SignInProviderCallbackGetResponseObject, error) {
	providerCallbackData := providerCallbackData{
		State:            req.Params.State,
		Provider:         string(req.Provider),
		Code:             req.Params.Code,
		IDToken:          req.Params.IdToken,
		OauthToken:       req.Params.OauthToken,
		OauthVerifier:    req.Params.OauthVerifier,
		Extras:           map[string]any{},
		Error:            req.Params.Error,
		ErrorDescription: req.Params.ErrorDescription,
		ErrorURI:         req.Params.ErrorUri,
	}

	redirectTo, apiErr := ctrl.signinProviderProviderCallback(
		ctx,
		providerCallbackData,
	)
	if apiErr != nil {
		return ctrl.sendRedirectError(redirectTo, apiErr), nil
	}

	return api.SignInProviderCallbackGet302Response{
		Headers: api.SignInProviderCallbackGet302ResponseHeaders{
			Location: redirectTo.String(),
		},
	}, nil
}

func (ctrl *Controller) signinProviderProviderCallbackConnect(
	ctx context.Context,
	connnect string,
	provider string,
	profile oidc.Profile,
	logger *slog.Logger,
) *APIError {
	// Decode JWT token from connect parameter
	jwtToken, err := ctrl.wf.jwtGetter.Validate(connnect)
	if err != nil {
		logger.ErrorContext(ctx, "invalid jwt token", logError(err))
		return ErrInvalidRequest
	}

	// Extract user ID from JWT token
	userID, err := ctrl.wf.jwtGetter.GetUserID(jwtToken)
	if err != nil {
		logger.ErrorContext(ctx, "error getting user id from jwt token", logError(err))
		return ErrInvalidRequest
	}

	// Verify user exists
	if _, apiError := ctrl.wf.GetUser(ctx, userID, logger); apiError != nil {
		logger.ErrorContext(ctx, "error getting user", logError(apiError))
		return apiError
	}

	// Insert user provider
	if _, apiErr := ctrl.wf.InsertUserProvider(
		ctx,
		userID,
		provider,
		profile.ProviderUserID,
		logger,
	); apiErr != nil {
		return apiErr
	}

	return nil
}

func (ctrl *Controller) SignInProviderCallbackPost( //nolint:ireturn
	ctx context.Context,
	req api.SignInProviderCallbackPostRequestObject,
) (api.SignInProviderCallbackPostResponseObject, error) {
	providerCallbackData := providerCallbackData{
		State:         req.Body.State,
		Provider:      string(req.Provider),
		Code:          req.Body.Code,
		IDToken:       req.Body.IdToken,
		OauthToken:    nil,
		OauthVerifier: nil,
		Extras: map[string]any{
			"user": req.Body.User,
		},
		Error:            req.Body.Error,
		ErrorDescription: req.Body.ErrorDescription,
		ErrorURI:         req.Body.ErrorUri,
	}

	redirectTo, apiErr := ctrl.signinProviderProviderCallback(
		ctx,
		providerCallbackData,
	)
	if apiErr != nil {
		return ctrl.sendRedirectError(redirectTo, apiErr), nil
	}

	return api.SignInProviderCallbackPost302Response{
		Headers: api.SignInProviderCallbackPost302ResponseHeaders{
			Location: redirectTo.String(),
		},
	}, nil
}
