package controller

import (
	"context"
	"log/slog"
	"math/rand/v2"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	oauth2provider "github.com/nhost/nhost/services/auth/go/oauth2"
)

func (ctrl *Controller) Oauth2Token( //nolint:ireturn
	ctx context.Context,
	request api.Oauth2TokenRequestObject,
) (api.Oauth2TokenResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if !ctrl.config.OAuth2ProviderEnabled {
		return oauth2Error("server_error", "OAuth2 provider is disabled"), nil
	}

	if request.Body == nil {
		return oauth2Error("invalid_request", "Missing request body"), nil
	}

	if err := extractBasicAuthCredentials(
		ctx,
		&request.Body.ClientId,
		&request.Body.ClientSecret,
	); err != nil {
		return oauth2Error("invalid_request", err.Error()), nil
	}

	var (
		resp     *api.OAuth2TokenResponse
		oauthErr *oauth2provider.Error
	)

	switch request.Body.GrantType {
	case api.AuthorizationCode:
		resp, oauthErr = ctrl.oauth2TokenAuthorizationCode(ctx, request.Body, logger)
	case api.RefreshToken:
		resp, oauthErr = ctrl.oauth2TokenRefreshToken(ctx, request.Body, logger)
	default:
		return oauth2Error("unsupported_grant_type", "Unsupported grant_type"), nil
	}

	if oauthErr != nil {
		return oauth2Error(oauthErr.Err, oauthErr.Description), nil
	}

	// no need to be cryptographically secure, performance of pseudo-random number is preferred
	if rand.IntN(1000) < 1 { //nolint:gosec,mnd
		ctrl.oauth2.DeleteExpiredRecords(ctx, logger)
	}

	return api.Oauth2Token200JSONResponse{
		Body: *resp,
		Headers: api.Oauth2Token200ResponseHeaders{
			CacheControl: "no-store",
			Pragma:       "no-cache",
		},
	}, nil
}

func (ctrl *Controller) oauth2TokenAuthorizationCode(
	ctx context.Context,
	req *api.OAuth2TokenRequest,
	logger *slog.Logger,
) (*api.OAuth2TokenResponse, *oauth2provider.Error) {
	validated, oauthErr := ctrl.oauth2.ValidateCodeExchange(ctx, req, logger)
	if oauthErr != nil {
		return nil, oauthErr
	}

	if apiErr := ctrl.oauth2ValidateUser(ctx, validated.UserID, logger); apiErr != nil {
		return nil, apiErr
	}

	return ctrl.oauth2.IssueTokensFromCode(ctx, validated, logger)
}

func (ctrl *Controller) oauth2TokenRefreshToken(
	ctx context.Context,
	req *api.OAuth2TokenRequest,
	logger *slog.Logger,
) (*api.OAuth2TokenResponse, *oauth2provider.Error) {
	validated, oauthErr := ctrl.oauth2.ValidateRefreshGrant(ctx, req, logger)
	if oauthErr != nil {
		return nil, oauthErr
	}

	if apiErr := ctrl.oauth2ValidateUser(ctx, validated.UserID, logger); apiErr != nil {
		return nil, apiErr
	}

	return ctrl.oauth2.IssueTokensFromRefresh(ctx, validated, logger)
}

func (ctrl *Controller) oauth2ValidateUser(
	ctx context.Context,
	userID uuid.UUID,
	logger *slog.Logger,
) *oauth2provider.Error {
	user, apiErr := ctrl.wf.GetUser(ctx, userID, logger)
	if apiErr != nil {
		return &oauth2provider.Error{Err: "invalid_grant", Description: "User not found"}
	}

	if apiErr := ctrl.wf.ValidateUser(ctx, user, logger); apiErr != nil {
		return &oauth2provider.Error{
			Err:         "invalid_grant",
			Description: "User account is not active",
		}
	}

	return nil
}

// extractBasicAuthCredentials supports client_secret_basic (RFC 6749 Section 2.3.1)
// by extracting client credentials from the Authorization: Basic header
// when they are not provided in the request body.
// Per RFC 6749 Section 2.3.1, if credentials are provided in both the
// Authorization header and the request body, the request is rejected.
func extractBasicAuthCredentials(
	ctx context.Context,
	clientID **string,
	clientSecret **string,
) error {
	bodyHasCredentials := *clientID != nil || *clientSecret != nil

	ginCtx, ok := ctx.(*gin.Context)
	if !ok {
		return nil
	}

	basicID, basicSecret, hasBasicAuth := ginCtx.Request.BasicAuth()

	if bodyHasCredentials && hasBasicAuth {
		return errDuplicateClientCredentials
	}

	if hasBasicAuth {
		*clientID = &basicID
		*clientSecret = &basicSecret
	}

	return nil
}
