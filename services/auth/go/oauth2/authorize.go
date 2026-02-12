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

type AuthorizeParams struct {
	ClientID            string
	RedirectURI         string
	ResponseType        string
	Scope               *string
	State               *string
	Nonce               *string
	CodeChallenge       *string
	CodeChallengeMethod *string
	Resource            *string
	Prompt              *string
}

func AuthorizeParamsFromGet(params api.Oauth2AuthorizeParams) AuthorizeParams {
	var codeChallengeMethod *string
	if params.CodeChallengeMethod != nil {
		codeChallengeMethod = (*string)(params.CodeChallengeMethod)
	}

	return AuthorizeParams{
		ClientID:            params.ClientId,
		RedirectURI:         params.RedirectUri,
		Scope:               params.Scope,
		State:               params.State,
		Nonce:               params.Nonce,
		CodeChallenge:       params.CodeChallenge,
		Resource:            params.Resource,
		Prompt:              params.Prompt,
		ResponseType:        params.ResponseType,
		CodeChallengeMethod: codeChallengeMethod,
	}
}

func AuthorizeParamsFromPost(
	body *api.Oauth2AuthorizePostFormdataRequestBody,
) AuthorizeParams {
	var codeChallengeMethod *string
	if body.CodeChallengeMethod != nil {
		codeChallengeMethod = body.CodeChallengeMethod
	}

	return AuthorizeParams{
		ClientID:            body.ClientId,
		RedirectURI:         body.RedirectUri,
		Scope:               body.Scope,
		State:               body.State,
		Nonce:               body.Nonce,
		CodeChallenge:       body.CodeChallenge,
		Resource:            body.Resource,
		Prompt:              body.Prompt,
		ResponseType:        body.ResponseType,
		CodeChallengeMethod: codeChallengeMethod,
	}
}

func (p *Provider) ValidateAuthorizeRequest( //nolint:cyclop,funlen
	ctx context.Context,
	params AuthorizeParams,
	logger *slog.Logger,
) (string, *Error) {
	var client sql.AuthOauth2Client

	if p.config.CIMDEnabled &&
		IsCIMDClientID(params.ClientID, p.config.CIMDAllowInsecureTransport) {
		var oauthErr *Error

		client, oauthErr = p.ResolveCIMDClient(ctx, params.ClientID, logger)

		if oauthErr != nil {
			return "", oauthErr
		}
	} else {
		var err error

		client, err = p.db.GetOAuth2ClientByClientID(ctx, params.ClientID)

		if errors.Is(err, pgx.ErrNoRows) {
			logger.WarnContext(
				ctx,
				"OAuth2 client not found",
				slog.String("client_id", params.ClientID),
			)

			return "", &Error{Err: "invalid_client", Description: "Unknown client"}
		}

		if err != nil {
			logger.ErrorContext(ctx, "error getting OAuth2 client", logError(err))
			return "", &Error{Err: "server_error", Description: "Internal server error"}
		}
	}

	if !slices.Contains(client.RedirectUris, params.RedirectURI) {
		logger.WarnContext(
			ctx,
			"redirect URI not registered",
			slog.String("redirect_uri", params.RedirectURI),
		)

		return "", &Error{
			Err:         "invalid_request",
			Description: "Invalid redirect_uri",
		}
	}

	errorRedirect := func(oauthErr *Error) string {
		return ErrorRedirectURL(params.RedirectURI, deptr(params.State), oauthErr)
	}

	if params.ResponseType != "code" {
		oauthErr := &Error{
			Err:         "unsupported_response_type",
			Description: "Only response_type=code is supported",
		}

		return errorRedirect(oauthErr), oauthErr
	}

	requestedScopes := []string{"openid"}
	if params.Scope != nil && *params.Scope != "" {
		requestedScopes = strings.Split(*params.Scope, " ")
	}

	for _, s := range requestedScopes {
		if !slices.Contains(client.Scopes, s) {
			oauthErr := &Error{
				Err:         "invalid_scope",
				Description: fmt.Sprintf("Scope %q not allowed for this client", s),
			}

			return errorRedirect(oauthErr), oauthErr
		}
	}

	expiresAt := time.Now().Add(AuthRequestTTL)

	codeChallengeMethod := pgtype.Text{} //nolint:exhaustruct
	if params.CodeChallengeMethod != nil {
		codeChallengeMethod = pgtype.Text{String: *params.CodeChallengeMethod, Valid: true}
	}

	authReq, err := p.db.InsertOAuth2AuthRequest(ctx, sql.InsertOAuth2AuthRequestParams{
		ClientID:            params.ClientID,
		Scopes:              requestedScopes,
		RedirectUri:         params.RedirectURI,
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

		oauthErr := &Error{Err: "server_error", Description: "Internal server error"}

		return errorRedirect(oauthErr), oauthErr
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
