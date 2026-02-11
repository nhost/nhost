package controller

import (
	"context"
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	oauth2provider "github.com/nhost/nhost/services/auth/go/oauth2"
	"github.com/nhost/nhost/services/auth/go/sql"
)

func pgText(s *string) pgtype.Text {
	if s == nil || *s == "" {
		return pgtype.Text{} //nolint:exhaustruct
	}

	return pgtype.Text{String: *s, Valid: true}
}

func pgTextFromString(s string) pgtype.Text {
	if s == "" {
		return pgtype.Text{} //nolint:exhaustruct
	}

	return pgtype.Text{String: s, Valid: true}
}

func (ctrl *Controller) Oauth2ClientsList( //nolint:ireturn
	ctx context.Context,
	_ api.Oauth2ClientsListRequestObject,
) (api.Oauth2ClientsListResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if !ctrl.config.OAuth2ProviderEnabled {
		return oauth2ClientsListError(
			http.StatusBadRequest, "OAuth2 provider is disabled",
		), nil
	}

	clients, err := ctrl.wf.db.ListOAuth2Clients(ctx)
	if err != nil {
		logger.ErrorContext(ctx, "error listing OAuth2 clients", logError(err))

		return oauth2ClientsListError(
			http.StatusInternalServerError, "Internal server error",
		), nil
	}

	resp := make([]api.OAuth2ClientResponse, 0, len(clients))
	for _, c := range clients {
		resp = append(resp, oauth2provider.ClientToResponse(c))
	}

	return api.Oauth2ClientsList200JSONResponse{Clients: resp}, nil
}

func (ctrl *Controller) Oauth2ClientsCreate( //nolint:ireturn,cyclop,funlen
	ctx context.Context,
	request api.Oauth2ClientsCreateRequestObject,
) (api.Oauth2ClientsCreateResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if !ctrl.config.OAuth2ProviderEnabled {
		return oauth2ClientsCreateError(
			http.StatusBadRequest, "OAuth2 provider is disabled",
		), nil
	}

	user, apiErr := ctrl.wf.GetUserFromJWTInContext(ctx, logger)
	if apiErr != nil {
		return oauth2ClientsCreateError( //nolint:nilerr
			http.StatusUnauthorized,
			"Authentication required",
		), nil
	}

	if request.Body == nil {
		return oauth2ClientsCreateError(
			http.StatusBadRequest, "Missing request body",
		), nil
	}

	isPublic := deptr(request.Body.IsPublic)

	authMethod := oauth2provider.AuthMethodClientSecretPost
	if request.Body.TokenEndpointAuthMethod != nil {
		authMethod = *request.Body.TokenEndpointAuthMethod
	}

	if isPublic {
		authMethod = oauth2provider.AuthMethodNone
	}

	grantTypes := []string{"authorization_code"}
	if request.Body.GrantTypes != nil {
		grantTypes = *request.Body.GrantTypes
	}

	responseTypes := []string{"code"}
	if request.Body.ResponseTypes != nil {
		responseTypes = *request.Body.ResponseTypes
	}

	scopes := []string{"openid", "profile", "email"}
	if request.Body.Scopes != nil {
		scopes = *request.Body.Scopes
	}

	accessTokenLifetime := int32(ctrl.config.OAuth2ProviderAccessTokenTTL) //nolint:gosec
	if request.Body.AccessTokenLifetime != nil {
		accessTokenLifetime = int32(*request.Body.AccessTokenLifetime) //nolint:gosec
	}

	refreshTokenLifetime := int32(ctrl.config.OAuth2ProviderRefreshTokenTTL) //nolint:gosec
	if request.Body.RefreshTokenLifetime != nil {
		refreshTokenLifetime = int32(*request.Body.RefreshTokenLifetime) //nolint:gosec
	}

	var (
		clientSecretHash string
		clientSecret     *string
	)

	if !isPublic {
		secret := oauth2provider.GenerateClientSecret()
		clientSecret = &secret

		hash, err := hashPassword(secret)
		if err != nil {
			logger.ErrorContext(ctx, "error hashing client secret", logError(err))

			return oauth2ClientsCreateError(
				http.StatusInternalServerError, "Internal server error",
			), nil
		}

		clientSecretHash = hash
	}

	client, err := ctrl.wf.db.InsertOAuth2Client(ctx, sql.InsertOAuth2ClientParams{
		ClientID:                 oauth2provider.GenerateClientID(),
		ClientSecretHash:         pgTextFromString(clientSecretHash),
		ClientName:               request.Body.ClientName,
		ClientUri:                pgText(request.Body.ClientUri),
		LogoUri:                  pgText(request.Body.LogoUri),
		RedirectUris:             request.Body.RedirectUris,
		GrantTypes:               grantTypes,
		ResponseTypes:            responseTypes,
		Scopes:                   scopes,
		IsPublic:                 isPublic,
		TokenEndpointAuthMethod:  authMethod,
		IDTokenSignedResponseAlg: "RS256",
		AccessTokenLifetime:      accessTokenLifetime,
		RefreshTokenLifetime:     refreshTokenLifetime,
		CreatedBy:                pgtype.UUID{Bytes: user.ID, Valid: true},
	})
	if err != nil {
		logger.ErrorContext(ctx, "error creating OAuth2 client", logError(err))

		return oauth2ClientsCreateError(
			http.StatusInternalServerError, "Internal server error",
		), nil
	}

	return api.Oauth2ClientsCreate201JSONResponse(
		oauth2provider.ClientToCreateResponse(client, clientSecret),
	), nil
}

func (ctrl *Controller) Oauth2ClientsGet( //nolint:ireturn
	ctx context.Context,
	request api.Oauth2ClientsGetRequestObject,
) (api.Oauth2ClientsGetResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if !ctrl.config.OAuth2ProviderEnabled {
		return oauth2ClientsGetError(
			http.StatusBadRequest, "OAuth2 provider is disabled",
		), nil
	}

	client, err := ctrl.wf.db.GetOAuth2ClientByClientID(ctx, request.ClientId)
	if errors.Is(err, pgx.ErrNoRows) {
		return oauth2ClientsGetError(http.StatusNotFound, "Client not found"), nil
	}

	if err != nil {
		logger.ErrorContext(ctx, "error getting OAuth2 client", logError(err))

		return oauth2ClientsGetError(
			http.StatusInternalServerError, "Internal server error",
		), nil
	}

	return api.Oauth2ClientsGet200JSONResponse(oauth2provider.ClientToResponse(client)), nil
}

func (ctrl *Controller) Oauth2ClientsUpdate( //nolint:ireturn,cyclop,funlen
	ctx context.Context,
	request api.Oauth2ClientsUpdateRequestObject,
) (api.Oauth2ClientsUpdateResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if !ctrl.config.OAuth2ProviderEnabled {
		return oauth2ClientsUpdateError(
			http.StatusBadRequest, "OAuth2 provider is disabled",
		), nil
	}

	if request.Body == nil {
		return oauth2ClientsUpdateError(
			http.StatusBadRequest, "Missing request body",
		), nil
	}

	isPublic := deptr(request.Body.IsPublic)

	authMethod := oauth2provider.AuthMethodClientSecretPost
	if request.Body.TokenEndpointAuthMethod != nil {
		authMethod = *request.Body.TokenEndpointAuthMethod
	}

	if isPublic {
		authMethod = oauth2provider.AuthMethodNone
	}

	grantTypes := []string{"authorization_code"}
	if request.Body.GrantTypes != nil {
		grantTypes = *request.Body.GrantTypes
	}

	responseTypes := []string{"code"}
	if request.Body.ResponseTypes != nil {
		responseTypes = *request.Body.ResponseTypes
	}

	scopes := []string{"openid", "profile", "email"}
	if request.Body.Scopes != nil {
		scopes = *request.Body.Scopes
	}

	accessTokenLifetime := int32(ctrl.config.OAuth2ProviderAccessTokenTTL) //nolint:gosec
	if request.Body.AccessTokenLifetime != nil {
		accessTokenLifetime = int32(*request.Body.AccessTokenLifetime) //nolint:gosec
	}

	refreshTokenLifetime := int32(ctrl.config.OAuth2ProviderRefreshTokenTTL) //nolint:gosec
	if request.Body.RefreshTokenLifetime != nil {
		refreshTokenLifetime = int32(*request.Body.RefreshTokenLifetime) //nolint:gosec
	}

	client, err := ctrl.wf.db.UpdateOAuth2Client(ctx, sql.UpdateOAuth2ClientParams{
		ClientID:                request.ClientId,
		ClientName:              request.Body.ClientName,
		ClientUri:               pgText(request.Body.ClientUri),
		LogoUri:                 pgText(request.Body.LogoUri),
		RedirectUris:            request.Body.RedirectUris,
		GrantTypes:              grantTypes,
		ResponseTypes:           responseTypes,
		Scopes:                  scopes,
		IsPublic:                isPublic,
		TokenEndpointAuthMethod: authMethod,
		AccessTokenLifetime:     accessTokenLifetime,
		RefreshTokenLifetime:    refreshTokenLifetime,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return oauth2ClientsUpdateError(http.StatusNotFound, "Client not found"), nil
	}

	if err != nil {
		logger.ErrorContext(ctx, "error updating OAuth2 client", logError(err))

		return oauth2ClientsUpdateError(
			http.StatusInternalServerError, "Internal server error",
		), nil
	}

	return api.Oauth2ClientsUpdate200JSONResponse(oauth2provider.ClientToResponse(client)), nil
}

func (ctrl *Controller) Oauth2ClientsDelete( //nolint:ireturn
	ctx context.Context,
	request api.Oauth2ClientsDeleteRequestObject,
) (api.Oauth2ClientsDeleteResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if !ctrl.config.OAuth2ProviderEnabled {
		return oauth2ClientsDeleteError(
			http.StatusBadRequest, "OAuth2 provider is disabled",
		), nil
	}

	if err := ctrl.wf.db.DeleteOAuth2Client(ctx, request.ClientId); err != nil {
		logger.ErrorContext(ctx, "error deleting OAuth2 client", logError(err))

		return oauth2ClientsDeleteError(
			http.StatusInternalServerError, "Internal server error",
		), nil
	}

	return api.Oauth2ClientsDelete204Response{}, nil
}

func oauth2ClientsListError(
	statusCode int, message string,
) api.Oauth2ClientsListdefaultJSONResponse {
	return api.Oauth2ClientsListdefaultJSONResponse{
		StatusCode: statusCode,
		Body: api.ErrorResponse{
			Status:  statusCode,
			Error:   api.InvalidRequest,
			Message: message,
		},
	}
}

func oauth2ClientsCreateError(
	statusCode int, message string,
) api.Oauth2ClientsCreatedefaultJSONResponse {
	return api.Oauth2ClientsCreatedefaultJSONResponse{
		StatusCode: statusCode,
		Body: api.ErrorResponse{
			Status:  statusCode,
			Error:   api.InvalidRequest,
			Message: message,
		},
	}
}

func oauth2ClientsGetError(
	statusCode int, message string,
) api.Oauth2ClientsGetdefaultJSONResponse {
	return api.Oauth2ClientsGetdefaultJSONResponse{
		StatusCode: statusCode,
		Body: api.ErrorResponse{
			Status:  statusCode,
			Error:   api.InvalidRequest,
			Message: message,
		},
	}
}

func oauth2ClientsUpdateError(
	statusCode int, message string,
) api.Oauth2ClientsUpdatedefaultJSONResponse {
	return api.Oauth2ClientsUpdatedefaultJSONResponse{
		StatusCode: statusCode,
		Body: api.ErrorResponse{
			Status:  statusCode,
			Error:   api.InvalidRequest,
			Message: message,
		},
	}
}

func oauth2ClientsDeleteError(
	statusCode int, message string,
) api.Oauth2ClientsDeletedefaultJSONResponse {
	return api.Oauth2ClientsDeletedefaultJSONResponse{
		StatusCode: statusCode,
		Body: api.ErrorResponse{
			Status:  statusCode,
			Error:   api.InvalidRequest,
			Message: message,
		},
	}
}
