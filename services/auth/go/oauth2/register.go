package oauth2

import (
	"context"
	"log/slog"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/sql"
)

func (p *Provider) RegisterClient( //nolint:funlen,cyclop
	ctx context.Context,
	req *api.OAuth2RegisterRequest,
	userID uuid.UUID,
	maxClientsPerUser int,
	logger *slog.Logger,
) (*api.OAuth2RegisterResponse, *Error) {
	if maxClientsPerUser > 0 {
		count, err := p.db.CountOAuth2ClientsByCreatedBy(
			ctx,
			pgtype.UUID{Bytes: userID, Valid: true},
		)
		if err != nil {
			logger.ErrorContext(ctx, "error counting OAuth2 clients", logError(err))
			return nil, &Error{Err: "server_error", Description: "Internal server error"}
		}

		if count >= int64(maxClientsPerUser) {
			return nil, &Error{
				Err:         "invalid_request",
				Description: "Maximum number of clients reached",
			}
		}
	}

	if len(req.RedirectUris) == 0 {
		return nil, &Error{
			Err:         "invalid_client_metadata",
			Description: "At least one redirect_uri is required",
		}
	}

	grantTypes := []string{"authorization_code"}
	if req.GrantTypes != nil {
		grantTypes = *req.GrantTypes
	}

	responseTypes := []string{"code"}
	if req.ResponseTypes != nil {
		responseTypes = *req.ResponseTypes
	}

	scopes := DefaultScopes()
	if req.Scope != nil && *req.Scope != "" {
		scopes = strings.Split(*req.Scope, " ")
	}

	authMethod := AuthMethodClientSecretPost
	if req.TokenEndpointAuthMethod != nil {
		authMethod = string(*req.TokenEndpointAuthMethod)
	}

	isPublic := authMethod == AuthMethodNone

	clientID := GenerateClientID()

	var clientSecretHash string

	var clientSecretPtr *string

	if !isPublic {
		clientSecret := uuid.NewString() + uuid.NewString()
		clientSecretPtr = &clientSecret

		hash, err := p.hasher.Hash(clientSecret)
		if err != nil {
			logger.ErrorContext(ctx, "error hashing client secret", logError(err))
			return nil, &Error{Err: "server_error", Description: "Internal server error"}
		}

		clientSecretHash = hash
	}

	accessTokenLifetime := int32(p.config.AccessTokenTTL)   //nolint:gosec
	refreshTokenLifetime := int32(p.config.RefreshTokenTTL) //nolint:gosec

	_, err := p.db.InsertOAuth2Client(ctx, sql.InsertOAuth2ClientParams{
		ClientID:                 clientID,
		ClientSecretHash:         pgTextFromString(clientSecretHash),
		ClientName:               req.ClientName,
		ClientUri:                pgText(req.ClientUri),
		LogoUri:                  pgText(req.LogoUri),
		RedirectUris:             req.RedirectUris,
		GrantTypes:               grantTypes,
		ResponseTypes:            responseTypes,
		Scopes:                   scopes,
		IsPublic:                 isPublic,
		TokenEndpointAuthMethod:  authMethod,
		IDTokenSignedResponseAlg: "RS256",
		AccessTokenLifetime:      accessTokenLifetime,
		RefreshTokenLifetime:     refreshTokenLifetime,
		Type:                     sql.OAuth2ClientTypeDCR,
		CreatedBy:                pgtype.UUID{Bytes: userID, Valid: true},
	})
	if err != nil {
		logger.ErrorContext(ctx, "error inserting OAuth2 client", logError(err))
		return nil, &Error{Err: "server_error", Description: "Internal server error"}
	}

	scope := strings.Join(scopes, " ")

	var secretExpiresAt *int
	if clientSecretPtr != nil {
		zero := 0
		secretExpiresAt = &zero
	}

	return &api.OAuth2RegisterResponse{
		ClientId:                clientID,
		ClientSecret:            clientSecretPtr,
		ClientSecretExpiresAt:   secretExpiresAt,
		ClientName:              req.ClientName,
		ClientUri:               req.ClientUri,
		LogoUri:                 req.LogoUri,
		RedirectUris:            req.RedirectUris,
		GrantTypes:              &grantTypes,
		ResponseTypes:           &responseTypes,
		Scope:                   &scope,
		TokenEndpointAuthMethod: &authMethod,
	}, nil
}
