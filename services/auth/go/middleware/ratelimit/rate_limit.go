package ratelimit

import (
	"math"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// abortTooManyRequests responds 429 with Retry-After in whole seconds (at least 1).
func abortTooManyRequests(ctx *gin.Context, retryAfter time.Duration) {
	seconds := max(int(math.Ceil(retryAfter.Seconds())), 1)
	ctx.Header("Retry-After", strconv.Itoa(seconds))
	ctx.AbortWithStatus(http.StatusTooManyRequests)
}

// endpints that send emails.
func sendsEmail(path string, verifyEmailEnabled bool) bool {
	base := []string{
		"/signin/passwordless/email",
		"/signin/otp/email",
		"/signup/passwordless/email",
		"/signup/otp/email",
		"/user/email/change",
		"/user/password/reset",
	}
	if verifyEmailEnabled {
		base = append(
			base,
			"/user/email/send-verification-email",
			"/signup/email-password",
			"/user/deanonymize",
		)
	}

	return slices.Contains(base, path)
}

// endpoints that send SMS.
func sendsSMS(path string) bool {
	return slices.Contains([]string{
		"/signin/passwordless/sms",
		"/signup/passwordless/sms",
		"/user/deanonymize/sms",
		"/user/phone-number/change",
	}, path)
}

// endpnits that can be brute forced.
func bruteForceProtected(path string) bool {
	return strings.HasPrefix(path, "/signin") ||
		strings.HasPrefix(path, "/elevate/") ||
		strings.HasSuffix(path, "/verify") ||
		strings.HasSuffix(path, "/otp") ||
		path == "/oauth2/authorize" ||
		path == "/oauth2/login"
}

// signups.
func isSignup(path string) bool {
	return strings.HasPrefix(path, "/signup")
}

// oauth2 server-to-server endpoints (token, introspect).
func isOAuth2Server(path string) bool {
	return path == "/oauth2/token" ||
		path == "/oauth2/introspect"
}

func RateLimit( //nolint:funlen,gocognit
	ignorePrefix string,
	globalLimit int,
	globalInterval time.Duration,
	emailLimit int,
	emailInterval time.Duration,
	emailIsGlobal bool,
	emailVerifyEnabled bool,
	smsLimit int,
	smsInterval time.Duration,
	bruteForceLimit int,
	bruteForceInterval time.Duration,
	signupsLimit int,
	signupsInterval time.Duration,
	oauth2ServerLimit int,
	oauth2ServerInterval time.Duration,
	store Store,
) gin.HandlerFunc {
	perUserRL := NewSlidingWindow("user-global", globalLimit, globalInterval, store)

	emailRL := NewSlidingWindow("user-email", emailLimit, emailInterval, store)
	if emailIsGlobal {
		emailRL = NewSlidingWindow("global-email", emailLimit, emailInterval, store)
	}

	globalSMSRL := NewSlidingWindow("user-sms", smsLimit, smsInterval, store)
	perUserBruteForceRL := NewSlidingWindow(
		"user-bruteforce", bruteForceLimit, bruteForceInterval, store,
	)
	perUserSignupsRL := NewSlidingWindow("user-signups", signupsLimit, signupsInterval, store)
	perUserOAuth2ServerRL := NewSlidingWindow(
		"user-oauth2-server", oauth2ServerLimit, oauth2ServerInterval, store,
	)

	return func(ctx *gin.Context) {
		clientIP := ctx.ClientIP()
		if ok, retryAfter := perUserRL.Allow(ctx, clientIP); !ok {
			abortTooManyRequests(ctx, retryAfter)
			return
		}

		path := strings.TrimPrefix(ctx.Request.URL.Path, ignorePrefix)

		if sendsEmail(path, emailVerifyEnabled) {
			emailKey := clientIP
			if emailIsGlobal {
				emailKey = "global"
			}

			if ok, retryAfter := emailRL.Allow(ctx, emailKey); !ok {
				abortTooManyRequests(ctx, retryAfter)
				return
			}
		}

		if sendsSMS(path) {
			if ok, retryAfter := globalSMSRL.Allow(ctx, clientIP); !ok {
				abortTooManyRequests(ctx, retryAfter)
				return
			}
		}

		if bruteForceProtected(path) {
			if ok, retryAfter := perUserBruteForceRL.Allow(ctx, clientIP); !ok {
				abortTooManyRequests(ctx, retryAfter)
				return
			}
		}

		if isSignup(path) {
			if ok, retryAfter := perUserSignupsRL.Allow(ctx, clientIP); !ok {
				abortTooManyRequests(ctx, retryAfter)
				return
			}
		}

		if isOAuth2Server(path) {
			if ok, retryAfter := perUserOAuth2ServerRL.Allow(ctx, clientIP); !ok {
				abortTooManyRequests(ctx, retryAfter)
				return
			}
		}

		ctx.Next()
	}
}
