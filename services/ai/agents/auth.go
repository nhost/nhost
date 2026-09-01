package agents

import (
	"context"
	"crypto/subtle"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/Yamashou/gqlgenc/clientv2"
	"github.com/gin-gonic/gin"
)

var errForbidden = errors.New("forbidden")

const authorizeTimeout = 10 * time.Second

func (s *Service) authorizeRequest(c *gin.Context, sessionID string) error {
	adminSecret := c.GetHeader("X-Hasura-Admin-Secret")
	role := c.GetHeader("X-Hasura-Role")
	// Only bypass when the caller is acting as admin. If X-Hasura-Role is set
	// to a non-admin role, Hasura's contract is to impersonate that role and
	// apply its permissions, so fall through and let Hasura evaluate.
	if s.adminSecret != "" &&
		subtle.ConstantTimeCompare([]byte(adminSecret), []byte(s.adminSecret)) == 1 &&
		(role == "" || role == "admin") {
		return nil
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), authorizeTimeout)
	defer cancel()

	resp, err := s.hasuraAuth.GetAgentSession(
		ctx,
		sessionID,
		withUserHeaders(c.Request.Header),
	)
	if err != nil || resp.AiAgentSession == nil {
		return errForbidden
	}

	return nil
}

func withUserHeaders(headers http.Header) clientv2.RequestInterceptor {
	return func(
		ctx context.Context,
		req *http.Request,
		gqlInfo *clientv2.GQLRequestInfo,
		res any,
		next clientv2.RequestInterceptorFunc,
	) error {
		if auth := headers.Get("Authorization"); auth != "" {
			req.Header.Set("Authorization", auth)
		}

		for key, values := range headers {
			if !strings.HasPrefix(strings.ToLower(key), "x-hasura-") {
				continue
			}

			req.Header.Del(key)

			for _, v := range values {
				req.Header.Add(key, v)
			}
		}

		return next(ctx, req, gqlInfo, res)
	}
}
