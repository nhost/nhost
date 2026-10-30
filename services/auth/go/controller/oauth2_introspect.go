package controller

import (
	"context"
	"log/slog"

	"github.com/gin-gonic/gin"
	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
)

func (ctrl *Controller) Oauth2Introspect( //nolint:ireturn
	ctx context.Context,
	request api.Oauth2IntrospectRequestObject,
) (api.Oauth2IntrospectResponseObject, error) {
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

	resp, oauthErr := ctrl.oauth2.IntrospectToken(
		ctx, request.Body, logger,
	)
	if oauthErr != nil {
		return oauth2Error(oauthErr.Err, oauthErr.Description), nil
	}

	addIntrospectedTokenLogAttrs(ctx, resp)

	return api.Oauth2Introspect200JSONResponse(*resp), nil
}

func addIntrospectedTokenLogAttrs(ctx context.Context, resp *api.OAuth2IntrospectResponse) {
	if !resp.Active {
		return
	}

	ginCtx, ok := ctx.(*gin.Context)
	if !ok {
		return
	}

	var attrs []slog.Attr
	for _, field := range []struct {
		name  string
		value *string
	}{
		{"client_id", resp.ClientId},
		{"sid", resp.Sid},
		{"jti", resp.Jti},
	} {
		if field.value != nil && *field.value != "" {
			attrs = append(attrs, slog.String(field.name, *field.value))
		}
	}

	if len(attrs) == 0 {
		return
	}

	// A strict handler runs after body binding; updating the gin request here keeps the
	// enriched logger visible to the outer completion middleware.
	//nolint:contextcheck // Inherits the gin request's context.
	ginCtx.Request = ginCtx.Request.WithContext(oapimw.AddLoggerAttrs(
		ginCtx.Request.Context(), slog.Group("introspected_token", attrsToAny(attrs)...),
	))
}
