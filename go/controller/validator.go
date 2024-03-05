//go:generate mockgen -package mock -destination mock/validator.go --source=validator.go
package controller

import (
	"context"
	"errors"
	"fmt"
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

type ValidationError struct {
	ErrorRespnseError api.ErrorResponseError
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("validation error: %s", e.ErrorRespnseError)
}

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

	return &Validator{
		cfg:                  cfg,
		db:                   db,
		hibp:                 hibp,
		redirectURLValidator: redirectURLValidator,
	}, nil
}

func (validator *Validator) PostSignupEmailPassword(
	ctx context.Context, req api.PostSignupEmailPasswordRequestObject,
) (api.PostSignupEmailPasswordRequestObject, error) {
	if err := validator.postSignupEmailPasswordEmail(ctx, req.Body.Email); err != nil {
		return api.PostSignupEmailPasswordRequestObject{}, err
	}

	if err := validator.postSignupEmailPasswordPassword(ctx, req.Body.Password); err != nil {
		return api.PostSignupEmailPasswordRequestObject{}, err
	}

	options, err := validator.postSignupEmailPasswordOptions(
		req.Body.Options, string(req.Body.Email),
	)
	if err != nil {
		return api.PostSignupEmailPasswordRequestObject{}, err
	}

	req.Body.Options = options
	return req, nil
}

func (validator *Validator) postSignupEmailPasswordEmail(
	ctx context.Context,
	email types.Email,
) error {
	_, err := validator.db.GetUserByEmail(ctx, sql.Text(email))
	if err == nil {
		return &ValidationError{api.EmailAlreadyInUse}
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("error getting user: %w", err)
	}

	return nil
}

func (validator *Validator) postSignupEmailPasswordPassword(
	ctx context.Context, password string,
) error {
	if len(password) < validator.cfg.PasswordMinLength {
		return &ValidationError{api.PasswordTooShort}
	}

	if validator.cfg.PasswordHIBPEnabled {
		if pwned, err := validator.hibp.IsPasswordPwned(ctx, password); err != nil {
			return fmt.Errorf("error checking password with HIBP: %w", err)
		} else if pwned {
			return &ValidationError{api.PasswordInHibpDatabase}
		}
	}

	return nil
}

func (validator *Validator) postSignupEmailPasswordOptions( //nolint:cyclop
	options *api.SignUpOptions, defaultName string,
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
				return nil, &ValidationError{api.RoleNotAllowed}
			}
		}
	}

	if !slices.Contains(deptr(options.AllowedRoles), deptr(options.DefaultRole)) {
		return nil, &ValidationError{api.DefaultRoleMustBeInAllowedRoles}
	}

	if options.DisplayName == nil {
		options.DisplayName = &defaultName
	}

	if options.Locale == nil {
		options.Locale = ptr(validator.cfg.DefaultLocale)
	}
	if !slices.Contains(validator.cfg.AllowedLocales, deptr(options.Locale)) {
		return nil, &ValidationError{api.LocaleNotAllowed}
	}

	if options.RedirectTo == nil {
		options.RedirectTo = ptr(validator.cfg.ClientURL.String())
	} else if !validator.redirectURLValidator(deptr(options.RedirectTo)) {
		return nil, &ValidationError{api.RedirecToNotAllowed}
	}

	return options, nil
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
