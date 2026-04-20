package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

var ErrTurnstileFailed = errors.New("failed to pass turnstile")

const (
	tunrstileURL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
)

type TurnstileResponse struct {
	Success    bool     `json:"success"`
	ErrorCodes []string `json:"error-codes"`
	Messages   []string `json:"messages"`
	Raw        []byte
}

func makeTurnstileRequest(
	ctx context.Context,
	cl *http.Client,
	secret string,
	tokenResponse string,
) (*TurnstileResponse, error) {
	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		tunrstileURL,
		bytes.NewBufferString(`{"secret": "`+secret+`","response":"`+tokenResponse+`"}`),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create turnstile request: %w", err)
	}

	request.Header.Set("Content-Type", "application/json")

	response, err := cl.Do(request)
	if err != nil {
		return nil, fmt.Errorf("failed to send turnstile request: %w", err)
	}
	defer response.Body.Close()

	b, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read turnstile response: %w", err)
	}

	var turnstileResponse TurnstileResponse
	if err := json.Unmarshal(b, &turnstileResponse); err != nil {
		return nil, fmt.Errorf("failed to unmarshal turnstile response: %w", err)
	}

	turnstileResponse.Raw = b

	return &turnstileResponse, nil
}

// requiresTurnstile reports whether the Turnstile check should be applied to
// the given request path. Apply to:
//   - Signup (any method)
//   - Passwordless signin (magic-link email, email OTP, SMS)
//   - Password reset
//
// Do not apply to:
//   - Verification endpoints (/verify suffix, or the SMS OTP verify endpoint
//     which ends in /otp)
//   - OAuth callback endpoints (/callback suffix)
//   - OAuth GET redirect initiators (/signin/provider/* and /signup/provider/*):
//     the browser cannot attach custom headers to a window.location redirect,
//     so a Turnstile token cannot be delivered on these paths.
func requiresTurnstile(path, prefix string) bool {
	if strings.HasSuffix(path, "/verify") ||
		strings.HasSuffix(path, "/callback") ||
		path == prefix+"/signin/passwordless/sms/otp" {
		return false
	}

	if strings.HasPrefix(path, prefix+"/signin/provider/") ||
		strings.HasPrefix(path, prefix+"/signup/provider/") {
		return false
	}

	return strings.HasPrefix(path, prefix+"/signup/") ||
		strings.HasPrefix(path, prefix+"/signin/passwordless/") ||
		strings.HasPrefix(path, prefix+"/signin/otp/") ||
		path == prefix+"/user/password/reset"
}

func Turnstile(secret string, prefix string) gin.HandlerFunc {
	cl := http.Client{} //nolint:exhaustruct

	return func(ctx *gin.Context) {
		if !requiresTurnstile(ctx.Request.URL.Path, prefix) {
			ctx.Next()
			return
		}

		token := ctx.Request.Header.Get("x-cf-turnstile-response")

		if token == "" {
			_ = ctx.Error(
				fmt.Errorf("%w: missing x-cf-turnstile-response header", ErrTurnstileFailed),
			)
			ctx.AbortWithStatusJSON(
				http.StatusForbidden,
				gin.H{"error": "missing x-cf-turnstile-response header"},
			)

			return
		}

		turnstileResponse, err := makeTurnstileRequest(ctx.Request.Context(), &cl, secret, token)
		if err != nil {
			_ = ctx.Error(fmt.Errorf("%w: %w", ErrTurnstileFailed, err))
			ctx.AbortWithStatusJSON(
				http.StatusInternalServerError,
				gin.H{"error": "internal server error when attempting to pass turnstile"},
			)

			return
		}

		if !turnstileResponse.Success {
			_ = ctx.Error(fmt.Errorf("%w: %s", ErrTurnstileFailed, string(turnstileResponse.Raw)))
			ctx.AbortWithStatusJSON(
				http.StatusForbidden,
				gin.H{
					"error": fmt.Sprintf(
						"failed to pass turnstile: %v",
						turnstileResponse.Messages,
					),
				},
			)

			return
		}

		ctx.Next()
	}
}
