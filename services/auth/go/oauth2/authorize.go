package oauth2

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/url"
	"slices"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/sql"
)

func (p *Provider) ValidateAuthorizeRequest(
	ctx context.Context,
	params api.Oauth2AuthorizePostFormdataBody,
	logger *slog.Logger,
) (string, *Error) {
	client, oauthErr := p.resolveClient(ctx, params.ClientId, logger)
	if oauthErr != nil {
		return "", oauthErr
	}

	if !slices.Contains(client.RedirectUris, params.RedirectUri) {
		logger.WarnContext(
			ctx,
			"redirect URI not registered",
			slog.String("redirect_uri", params.RedirectUri),
		)

		return "", &Error{
			Err:         "invalid_request",
			Description: "Invalid redirect_uri",
		}
	}

	errorRedirect := func(oauthErr *Error) string {
		return ErrorRedirectURL(
			params.RedirectUri,
			deptr(params.State),
			p.signer.Issuer(),
			oauthErr,
		)
	}

	requestedScopes, oauthErr := p.validateAuthorizeParams(params, client)
	if oauthErr != nil {
		return errorRedirect(oauthErr), oauthErr
	}

	redirectURL, oauthErr := p.createAuthRequest(ctx, params, requestedScopes, logger)
	if oauthErr != nil {
		return errorRedirect(oauthErr), oauthErr
	}

	return redirectURL, nil
}

func (p *Provider) resolveClient(
	ctx context.Context,
	clientID string,
	logger *slog.Logger,
) (sql.AuthOauth2Client, *Error) {
	if p.config.CIMDEnabled &&
		IsCIMDClientID(clientID, p.config.CIMDAllowInsecureTransport) {
		return p.ResolveCIMDClient(ctx, clientID, logger)
	}

	client, err := p.db.GetOAuth2ClientByClientID(ctx, clientID)

	if errors.Is(err, pgx.ErrNoRows) {
		logger.WarnContext(
			ctx,
			"OAuth2 client not found",
			slog.String("client_id", clientID),
		)

		return client, &Error{Err: "invalid_client", Description: "Unknown client"}
	}

	if err != nil {
		logger.ErrorContext(ctx, "error getting OAuth2 client", logError(err))
		return client, &Error{Err: "server_error", Description: "Internal server error"}
	}

	return client, nil
}

func (p *Provider) validateAuthorizeParams(
	params api.Oauth2AuthorizePostFormdataBody,
	client sql.AuthOauth2Client,
) ([]string, *Error) {
	if params.ResponseType != "code" {
		return nil, &Error{
			Err:         "unsupported_response_type",
			Description: "Only response_type=code is supported",
		}
	}

	requestedScopes := []string{"openid"}
	if params.Scope != nil && *params.Scope != "" {
		requestedScopes = strings.Split(*params.Scope, " ")
	}

	for _, s := range requestedScopes {
		if !slices.Contains(client.Scopes, s) {
			return nil, &Error{
				Err:         "invalid_scope",
				Description: fmt.Sprintf("Scope %q not allowed for this client", s),
			}
		}
	}

	if !client.ClientSecretHash.Valid &&
		(params.CodeChallenge == nil || *params.CodeChallenge == "") {
		return nil, &Error{
			Err:         "invalid_request",
			Description: "PKCE code_challenge is required for public clients",
		}
	}

	return requestedScopes, nil
}

func (p *Provider) createAuthRequest(
	ctx context.Context,
	params api.Oauth2AuthorizePostFormdataBody,
	scopes []string,
	logger *slog.Logger,
) (string, *Error) {
	expiresAt := time.Now().Add(AuthRequestTTL)

	codeChallengeMethod := pgtype.Text{} //nolint:exhaustruct
	if params.CodeChallengeMethod != nil {
		codeChallengeMethod = pgtype.Text{String: *params.CodeChallengeMethod, Valid: true}
	}

	authReq, err := p.db.InsertOAuth2AuthRequest(ctx, sql.InsertOAuth2AuthRequestParams{
		ClientID:            params.ClientId,
		Scopes:              scopes,
		RedirectUri:         params.RedirectUri,
		State:               pgText(params.State),
		Nonce:               pgText(params.Nonce),
		ResponseType:        params.ResponseType,
		CodeChallenge:       pgText(params.CodeChallenge),
		CodeChallengeMethod: codeChallengeMethod,
		Resource:            pgText(params.Resource),
		ExpiresAt:           sql.TimestampTz(expiresAt),
	})
	if err != nil {
		logger.ErrorContext(ctx, "error inserting OAuth2 auth request", logError(err))
		return "", &Error{Err: "server_error", Description: "Internal server error"}
	}

	loginURL := p.config.LoginURL
	if loginURL == "" {
		loginURL = p.config.ClientURL + "/oauth2/login"
	}

	redirectURL := fmt.Sprintf("%s?request_id=%s", loginURL, authReq.ID.String())

	if params.Prompt != nil && *params.Prompt != "" {
		redirectURL += "&prompt=" + url.QueryEscape(*params.Prompt)
	}

	return redirectURL, nil
}
