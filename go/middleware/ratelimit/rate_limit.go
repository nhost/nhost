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
		strings.HasSuffix(path, "/otp")
}

// signups.
func isSignup(path string) bool {
	return strings.HasPrefix(path, "/signup")
}

func RateLimit( //nolint:cyclop,funlen
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
	store Store,
) gin.HandlerFunc {
	perUserRL := NewSlidingWindow("user-global", globalLimit, globalInterval, store)

	var globalEmailRL *SlidingWindow
	var perUserEmailRL *SlidingWindow
	if emailIsGlobal {
		globalEmailRL = NewSlidingWindow("global-email", emailLimit, emailInterval, store)
	} else {
		perUserEmailRL = NewSlidingWindow("user-email", emailLimit, emailInterval, store)
	}

	globalSMSRL := NewSlidingWindow("user-sms", smsLimit, smsInterval, store)
	perUserBruteForceRL := NewSlidingWindow(
		"user-bruteforce", bruteForceLimit, bruteForceInterval, store,
	)
	perUserSignupsRL := NewSlidingWindow("user-bruteforce", signupsLimit, signupsInterval, store)

	return func(ctx *gin.Context) {
		clientIP := ctx.ClientIP()
		if !perUserRL.Allow(clientIP) {
			ctx.AbortWithStatus(http.StatusTooManyRequests)
			return
		}

		path := strings.TrimPrefix(ctx.Request.URL.Path, ignorePrefix)

		if sendsEmail(path, emailVerifyEnabled) {
			if globalEmailRL != nil && !globalEmailRL.Allow("global") {
				ctx.AbortWithStatus(http.StatusTooManyRequests)
			}

			if perUserEmailRL != nil && !perUserEmailRL.Allow(clientIP) {
				ctx.AbortWithStatus(http.StatusTooManyRequests)
			}
		}

		if sendsSMS(path) {
			if !globalSMSRL.Allow(clientIP) {
				ctx.AbortWithStatus(http.StatusTooManyRequests)
			}
		}

		if bruteForceProtected(path) {
			if !perUserBruteForceRL.Allow(clientIP) {
				ctx.AbortWithStatus(http.StatusTooManyRequests)
			}
		}

		if isSignup(path) {
			if !perUserSignupsRL.Allow(clientIP) {
				ctx.AbortWithStatus(http.StatusTooManyRequests)
			}
		}

		ctx.Next()
	}
}
