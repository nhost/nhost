package controller

import (
	"context"
	"log/slog"
	"net/http"
	"strings"

	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/middleware"
)

func getCookie(
	ctx context.Context, name string, cookieHeader string, logger *slog.Logger,
) *http.Cookie {
	cookies := strings.SplitSeq(cookieHeader, ";")

	for c := range cookies {
		cookie, err := http.ParseSetCookie(c)
		if err != nil {
			logger.WarnContext(ctx, "error parsing cookie", logError(err))
			continue
		}

		if cookie.Name == name {
			return cookie
		}
	}

	return nil
}

func (ctrl *Controller) GetProviderTokens( //nolint:ireturn
	ctx context.Context,
	req api.GetProviderTokensRequestObject,
) (api.GetProviderTokensResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)
	logger = logger.With("provider", req.Provider)

	_, apiErr := ctrl.wf.GetJWTInContext(ctx, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	accessToken := "fixme"
	refreshToken := "fixme"

	return api.GetProviderTokens200JSONResponse{
		AccessToken:  accessToken,
		RefreshToken: ptr(refreshToken),
	}, nil
}
