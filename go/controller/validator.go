//go:generate mockgen -package mock -destination mock/validator.go --source=validator.go
package controller

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/url"
	"regexp"
	"slices"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/sql"
	"github.com/oapi-codegen/runtime/types"
)

type HIBPClient interface {
	IsPasswordPwned(ctx context.Context, password string) (bool, error)
}

type SQLQueries interface {
	GetUserByEmail(ctx context.Context, email pgtype.Text) (sql.AuthUser, error)
}

type Validator struct {
	cfg                  *Config
	db                   SQLQueries
	hibp                 HIBPClient
	redirectURLValidator func(redirectTo string) bool
	emailValidator       func(email string) bool
}

func NewValidator(cfg *Config, db SQLQueries, hibp HIBPClient) (*Validator, error) {
	allowedURLs := make([]*url.URL, len(cfg.AllowedRedirectURLs)+1)
	allowedURLs[0] = cfg.ClientURL
	for i, u := range cfg.AllowedRedirectURLs {
		allowedURLs[i+1] = u
	}

	redirectURLValidator, err := ValidateRedirectTo(allowedURLs)
	if err != nil {
		return nil, fmt.Errorf("error creating redirect URL validator: %w", err)
	}

	emailValidator := ValidateEmail(
		cfg.BlockedEmailDomains,
		cfg.BlockedEmails,
		cfg.AllowedEmailDomains,
		cfg.AllowedEmails,
	)

	return &Validator{
		cfg:                  cfg,
		db:                   db,
		hibp:                 hibp,
		redirectURLValidator: redirectURLValidator,
		emailValidator:       emailValidator,
	}, nil
}

func (validator *Validator) PostSignupEmailPassword(
	ctx context.Context, req api.PostSignupEmailPasswordRequestObject, logger *slog.Logger,
) (api.PostSignupEmailPasswordRequestObject, error) {
	if err := validator.postSignupEmailPasswordEmail(ctx, req.Body.Email, logger); err != nil {
		return api.PostSignupEmailPasswordRequestObject{}, err
	}

	if err := validator.postSignupEmailPasswordPassword(ctx, req.Body.Password, logger); err != nil {
		return api.PostSignupEmailPasswordRequestObject{}, err
	}

	options, err := validator.postSignUpOptions(
		req.Body.Options, string(req.Body.Email), logger,
	)
	if err != nil {
		return api.PostSignupEmailPasswordRequestObject{}, err
	}

	req.Body.Options = options
	return req, nil
}

func (validator *Validator) postSignupEmailPasswordEmail(
	ctx context.Context, email types.Email, logger *slog.Logger,
) error {
	_, err := validator.db.GetUserByEmail(ctx, sql.Text(email))
	if err == nil {
		logger.Warn("email already in use")
		return &APIError{api.EmailAlreadyInUse}
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		logger.Error("error getting user by email", logError(err))
		return fmt.Errorf("error getting user: %w", err)
	}

	if !validator.emailValidator(string(email)) {
		logger.Warn("email didn't pass access control checks")
		return &APIError{api.InvalidEmailPassword}
	}

	return nil
}

func (validator *Validator) postSignupEmailPasswordPassword(
	ctx context.Context, password string, logger *slog.Logger,
) error {
	if len(password) < validator.cfg.PasswordMinLength {
		logger.Warn("password too short")
		return &APIError{api.PasswordTooShort}
	}

	if validator.cfg.PasswordHIBPEnabled {
		if pwned, err := validator.hibp.IsPasswordPwned(ctx, password); err != nil {
			logger.Error("error checking password with HIBP", logError(err))
			return fmt.Errorf("error checking password with HIBP: %w", err)
		} else if pwned {
			logger.Warn("password is in HIBP database")
			return &APIError{api.PasswordInHibpDatabase}
		}
	}

	return nil
}

func (validator *Validator) postSignUpOptions( //nolint:cyclop
	options *api.SignUpOptions, defaultName string, logger *slog.Logger,
) (*api.SignUpOptions, error) {
	if options == nil {
		options = new(api.SignUpOptions)
	}

	if options.DefaultRole == nil {
		options.DefaultRole = ptr(validator.cfg.DefaultRole)
	}

	if options.AllowedRoles == nil {
		options.AllowedRoles = ptr(validator.cfg.DefaultAllowedRoles)
	} else {
		for _, role := range deptr(options.AllowedRoles) {
			if !slices.Contains(validator.cfg.DefaultAllowedRoles, role) {
				logger.Warn("role not allowed", slog.String("role", role))
				return nil, &APIError{api.RoleNotAllowed}
			}
		}
	}

	if !slices.Contains(deptr(options.AllowedRoles), deptr(options.DefaultRole)) {
		logger.Warn("default role not in allowed roles")
		return nil, &APIError{api.DefaultRoleMustBeInAllowedRoles}
	}

	if options.DisplayName == nil {
		options.DisplayName = &defaultName
	}

	if options.Locale == nil {
		options.Locale = ptr(validator.cfg.DefaultLocale)
	}
	if !slices.Contains(validator.cfg.AllowedLocales, deptr(options.Locale)) {
		logger.Warn(
			"locale not allowed, using default",
			slog.String("locale", deptr(options.Locale)),
		)
		options.Locale = ptr(validator.cfg.DefaultLocale)
	}

	if options.RedirectTo == nil {
		options.RedirectTo = ptr(validator.cfg.ClientURL.String())
	} else if !validator.redirectURLValidator(deptr(options.RedirectTo)) {
		logger.Warn("redirect URL not allowed", slog.String("redirectTo", deptr(options.RedirectTo)))
		return nil, &APIError{api.RedirecToNotAllowed}
	}

	return options, nil
}

func (validator *Validator) ValidateUserByEmail(
	ctx context.Context,
	email string,
	logger *slog.Logger,
) (sql.AuthUser, error) {
	if !validator.emailValidator(email) {
		logger.Warn("email didn't pass access control checks")
		//nolint:exhaustruct
		return sql.AuthUser{}, &APIError{api.InvalidEmailPassword}
	}

	user, err := validator.db.GetUserByEmail(ctx, sql.Text(email))
	if errors.Is(err, pgx.ErrNoRows) {
		logger.Warn("user not found")
		//nolint:exhaustruct
		return sql.AuthUser{}, &APIError{api.InvalidEmailPassword}
	}
	if err != nil {
		logger.Error("error getting user by email", logError(err))
		return sql.AuthUser{}, fmt.Errorf("error getting user by email: %w", err)
	}

	if user.Disabled {
		logger.Warn("user is disabled")
		//nolint:exhaustruct
		return sql.AuthUser{}, &APIError{api.DisabledUser}
	}

	return user, nil
}

type urlMatcher struct {
	Scheme   string
	Hostname *regexp.Regexp
	Port     string
	Path     string
}

func newURLMatcher(u *url.URL) (urlMatcher, error) {
	if u.Scheme == "" {
		return urlMatcher{}, fmt.Errorf( //nolint:goerr113
			"scheme is required for allowed redirect URL",
		)
	}

	port := u.Port()
	if port == "" && u.Scheme == "http" {
		port = "80"
	} else if port == "" && u.Scheme == "https" {
		port = "443"
	}

	r := regexp.QuoteMeta(u.Hostname())
	r = "^" + strings.ReplaceAll(r, `\*`, `(\w+|\w+-\w+)+`) + `$`
	re, err := regexp.Compile(r)
	if err != nil {
		return urlMatcher{}, fmt.Errorf("error compiling regex: %w", err)
	}

	return urlMatcher{
		Scheme:   u.Scheme,
		Hostname: re,
		Port:     port,
		Path:     u.Path,
	}, nil
}

func (m urlMatcher) Matches(scheme, host, port, path string) bool {
	return m.Scheme == scheme &&
		m.Port == port &&
		m.Hostname.MatchString(host) &&
		strings.HasPrefix(path, m.Path)
}

func ValidateRedirectTo( //nolint:cyclop
	allowedRedirectURLs []*url.URL,
) (
	func(redirectTo string) bool,
	error,
) {
	matchers := make([]urlMatcher, len(allowedRedirectURLs))
	for i, u := range allowedRedirectURLs {
		m, err := newURLMatcher(u)
		if err != nil {
			return nil, err
		}

		matchers[i] = m
	}

	return func(redirectTo string) bool {
		u, err := url.Parse(redirectTo)
		if err != nil {
			return false
		}

		if u.Scheme == "" || u.Hostname() == "" {
			return false
		}

		if len(allowedRedirectURLs) == 0 {
			return true
		}

		port := u.Port()
		if port == "" && u.Scheme == "http" {
			port = "80"
		} else if port == "" && u.Scheme == "https" {
			port = "443"
		}

		for _, m := range matchers {
			if m.Matches(u.Scheme, u.Hostname(), port, u.Path) {
				return true
			}
		}

		return false
	}, nil
}

func ValidateEmail(
	blockedEmailDomains []string,
	blockedEmails []string,
	allowedEmailDomains []string,
	allowedEmails []string,
) func(email string) bool {
	return func(email string) bool {
		parts := strings.Split(email, "@")
		if len(parts) != 2 { //nolint:gomnd
			return false
		}

		domain := parts[1]

		if slices.Contains(blockedEmailDomains, domain) {
			return false
		}

		if slices.Contains(blockedEmails, email) {
			return false
		}

		if len(allowedEmailDomains) > 0 && !slices.Contains(allowedEmailDomains, domain) {
			return false
		}

		if len(allowedEmails) > 0 && !slices.Contains(allowedEmails, email) {
			return false
		}

		return true
	}
}
