package controller

import (
	"context"
	"log/slog"
	"net/url"

	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
	"github.com/nhost/hasura-auth/go/oidc"
	"github.com/nhost/hasura-auth/go/providers"
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

func (ctrl *Controller) signinProviderProviderCallbackValidate(
	req providerCallbackData,
	logger *slog.Logger,
) (*api.SignUpOptions, *string, *url.URL, *APIError) {
	redirectTo := ctrl.config.ClientURL

	stateToken, err := ctrl.wf.jwtGetter.Validate(req.State)
	if err != nil {
		logger.Error("invalid state token", logError(err))
		return nil, nil, redirectTo, ErrInvalidState
	}

	stateData := &providers.State{} //nolint:exhaustruct
	if err := stateData.Decode(stateToken.Claims); err != nil {
		logger.Error("error decoding state token", logError(err))
		return nil, nil, redirectTo, ErrInvalidState
	}

	// we just care about the redirect URL for now, the rest is handled by the signin flow
	options, apiErr := ctrl.wf.ValidateOptionsRedirectTo(
		&api.OptionsRedirectTo{
			RedirectTo: stateData.Options.RedirectTo,
		},
		logger,
	)
	if apiErr != nil {
		return nil, nil, redirectTo, apiErr
	}

	if req.Error != nil && *req.Error != "" {
		values := redirectTo.Query()
		values.Add("provider_error", deptr(req.Error))
		values.Add("provider_error_description", deptr(req.ErrorDescription))
		values.Add("provider_error_url", deptr(req.ErrorURI))
		redirectTo.RawQuery = values.Encode()

		return nil, nil, redirectTo, ErrOauthProviderError
	}

	optionsRedirectTo, err := url.Parse(*options.RedirectTo)
	if err != nil {
		logger.Error("error parsing redirect URL", logError(err))
		return nil, nil, redirectTo, ErrInvalidRequest
	}

	return stateData.Options, stateData.Connect, optionsRedirectTo, nil
}

func (ctrl *Controller) signinProviderProviderCallbackOauthFlow(
	ctx context.Context,
	req providerCallbackData,
	logger *slog.Logger,
) (oidc.Profile, *APIError) {
	p := ctrl.Providers.Get(req.Provider)
	if p == nil {
		logger.Error("provider not enabled")
		return oidc.Profile{}, ErrDisabledEndpoint
	}

	var profile oidc.Profile
	switch {
	case p.IsOauth1():
		accessTokenValue, accessTokenSecret, err := p.Oauth1().AccessToken(
			ctx, deptr(req.OauthToken), deptr(req.OauthVerifier),
		)
		if err != nil {
			logger.Error("failed to request token", logError(err))
			return oidc.Profile{}, ErrOauthProfileFetchFailed
		}

		profile, err = p.Oauth1().GetProfile(ctx, accessTokenValue, accessTokenSecret)
		if err != nil {
			logger.Error("failed to get user info", logError(err))
			return oidc.Profile{}, ErrOauthProfileFetchFailed
		}
	default:
		token, err := p.Oauth2().Exchange(ctx, deptr(req.Code))
		if err != nil {
			logger.Error("failed to exchange token", logError(err))
			return oidc.Profile{}, ErrOauthTokenExchangeFailed
		}

		profile, err = p.Oauth2().GetProfile(ctx, token.AccessToken, req.IDToken, req.Extras)
		if err != nil {
			logger.Error("failed to get user info", logError(err))
			return oidc.Profile{}, ErrOauthProfileFetchFailed
		}
	}

	return profile, nil
}

func (ctrl *Controller) signinProviderProviderCallback(
	ctx context.Context,
	req providerCallbackData,
) (*url.URL, *APIError) {
	logger := middleware.LoggerFromContext(ctx)

	options, connnect, redirectTo, apiErr := ctrl.signinProviderProviderCallbackValidate(
		req,
		logger,
	)
	if apiErr != nil {
		return redirectTo, apiErr
	}

	profile, apiErr := ctrl.signinProviderProviderCallbackOauthFlow(ctx, req, logger)
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

	return redirectTo, nil
}

func (ctrl *Controller) GetSigninProviderProviderCallback( //nolint:ireturn
	ctx context.Context,
	req api.GetSigninProviderProviderCallbackRequestObject,
) (api.GetSigninProviderProviderCallbackResponseObject, error) {
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

	return api.GetSigninProviderProviderCallback302Response{
		Headers: api.GetSigninProviderProviderCallback302ResponseHeaders{
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
		logger.Error("invalid jwt token", logError(err))
		return ErrInvalidRequest
	}

	// Extract user ID from JWT token
	userID, err := ctrl.wf.jwtGetter.GetUserID(jwtToken)
	if err != nil {
		logger.Error("error getting user id from jwt token", logError(err))
		return ErrInvalidRequest
	}

	// Verify user exists
	if _, apiError := ctrl.wf.GetUser(ctx, userID, logger); apiError != nil {
		logger.Error("error getting user", logError(apiError))
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

func (ctrl *Controller) PostSigninProviderProviderCallback( //nolint:ireturn
	ctx context.Context,
	req api.PostSigninProviderProviderCallbackRequestObject,
) (api.PostSigninProviderProviderCallbackResponseObject, error) {
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

	return api.PostSigninProviderProviderCallback302Response{
		Headers: api.PostSigninProviderProviderCallback302ResponseHeaders{
			Location: redirectTo.String(),
		},
	}, nil
}
