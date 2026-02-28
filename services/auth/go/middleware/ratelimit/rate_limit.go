package ratelimit

import (
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// endpints that send emails.
func sendsEmail(path string, verifyEmailEnabled bool) bool {
	if verifyEmailEnabled {
		return slices.Contains([]string{
			"/signin/passwordless/email",
			"/user/email/change",
			"/user/email/send-verification-email",
			"/user/password/reset",
			"/signup/email-password",
			"/user/deanonymize",
		}, path)
	}

	return slices.Contains([]string{
		"/signin/passwordless/email",
		"/user/email/change",
		"/user/password/reset",
	}, path)
}

// endpoints that send SMS.
func sendsSMS(path string) bool {
	return slices.Contains([]string{
		"/signin/passwordless/sms",
	}, path)
}

// endpnits that can be brute forced.
func bruteForceProtected(path string) bool {
	return strings.HasPrefix(path, "/signin") ||
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

func RateLimit( //nolint:cyclop,funlen,cyclop,gocognit
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

	var (
		globalEmailRL  *SlidingWindow
		perUserEmailRL *SlidingWindow
	)

	if emailIsGlobal {
		globalEmailRL = NewSlidingWindow("global-email", emailLimit, emailInterval, store)
	} else {
		perUserEmailRL = NewSlidingWindow("user-email", emailLimit, emailInterval, store)
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
		if !perUserRL.Allow(ctx, clientIP) {
			ctx.AbortWithStatus(http.StatusTooManyRequests)
			return
		}

		path := strings.TrimPrefix(ctx.Request.URL.Path, ignorePrefix)

		if sendsEmail(path, emailVerifyEnabled) {
			if globalEmailRL != nil && !globalEmailRL.Allow(ctx, "global") {
				ctx.AbortWithStatus(http.StatusTooManyRequests)
				return
			}

			if perUserEmailRL != nil && !perUserEmailRL.Allow(ctx, clientIP) {
				ctx.AbortWithStatus(http.StatusTooManyRequests)
				return
			}
		}

		if sendsSMS(path) {
			if !globalSMSRL.Allow(ctx, clientIP) {
				ctx.AbortWithStatus(http.StatusTooManyRequests)
				return
			}
		}

		if bruteForceProtected(path) {
			if !perUserBruteForceRL.Allow(ctx, clientIP) {
				ctx.AbortWithStatus(http.StatusTooManyRequests)
				return
			}
		}

		if isSignup(path) {
			if !perUserSignupsRL.Allow(ctx, clientIP) {
				ctx.AbortWithStatus(http.StatusTooManyRequests)
				return
			}
		}

		if isOAuth2Server(path) {
			if !perUserOAuth2ServerRL.Allow(ctx, clientIP) {
				ctx.AbortWithStatus(http.StatusTooManyRequests)
				return
			}
		}

		ctx.Next()
	}
}
