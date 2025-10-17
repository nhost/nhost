package controller

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/url"
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

	cookieName := string(req.Provider) + cookieSuffixProviderToken
	cookie := getCookie(ctx, cookieName, req.Params.Cookie, logger)

	var (
		accessToken  string
		refreshToken *string
	)
	if cookie != nil {
		v, err := url.QueryUnescape(cookie.Value)
		if err != nil {
			logger.WarnContext(ctx, "error unescaping cookie value", logError(err))
			return ctrl.sendError(ErrInternalServerError), nil
		}

		var m map[string]any
		if err := json.NewDecoder(strings.NewReader(v)).Decode(&m); err != nil {
			logger.WarnContext(ctx, "error decoding cookie value", logError(err))
			return ctrl.sendError(ErrInternalServerError), nil
		}

		accessToken, _ = m["accessToken"].(string)
		rt, _ := m["refreshToken"].(string)

		if rt != "" {
			refreshToken = &rt
		}
	}

	return api.GetProviderTokens200JSONResponse{
		Body: api.GetProviderTokensResponse{
			AccessToken:  accessToken,
			RefreshToken: refreshToken,
		},
		Headers: api.GetProviderTokens200ResponseHeaders{
			SetCookie: providerCookies(
				string(req.Provider), "", "", ctrl.config.UseSecureCookies(), -1,
			),
		},
	}, nil
}
