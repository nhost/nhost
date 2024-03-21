//go:generate mockgen -package mock -destination mock/workflows.go --source=workflows.go
package controller

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/url"
	"slices"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/notifications"
	"github.com/nhost/hasura-auth/go/sql"
	"github.com/oapi-codegen/runtime/types"
)

type HIBPClient interface {
	IsPasswordPwned(ctx context.Context, password string) (bool, error)
}

type Workflows struct {
	config               *Config
	jwtGetter            JWTGetter
	db                   DBClient
	hibp                 HIBPClient
	email                Emailer
	redirectURLValidator func(redirectTo string) bool
	ValidateEmail        func(email string) bool
	gravatarURL          func(string) string
}

func NewWorkflows(
	cfg *Config,
	jwtGetter JWTGetter,
	db DBClient,
	hibp HIBPClient,
	email Emailer,
	gravatarURL func(string) string,
) (*Workflows, error) {
	allowedURLs := make([]*url.URL, len(cfg.AllowedRedirectURLs)+1)
	allowedURLs[0] = cfg.ClientURL
	for i, u := range cfg.AllowedRedirectURLs {
		allowedURLs[i+1] = u
	}

	redirectURLValidator, err := ValidateRedirectTo(allowedURLs)
	if err != nil {
		return nil, fmt.Errorf("error creating redirect URL wf: %w", err)
	}

	emailValidator := ValidateEmail(
		cfg.BlockedEmailDomains,
		cfg.BlockedEmails,
		cfg.AllowedEmailDomains,
		cfg.AllowedEmails,
	)

	return &Workflows{
		config:               cfg,
		jwtGetter:            jwtGetter,
		db:                   db,
		hibp:                 hibp,
		email:                email,
		redirectURLValidator: redirectURLValidator,
		ValidateEmail:        emailValidator,
		gravatarURL:          gravatarURL,
	}, nil
}

func (wf *Workflows) ValidateSignupEmail(
	ctx context.Context, email types.Email, logger *slog.Logger,
) *APIError {
	_, err := wf.db.GetUserByEmail(ctx, sql.Text(email))
	if err == nil {
		logger.Warn("email already in use")
		return ErrEmailAlreadyInUse
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		logger.Error("error getting user by email", logError(err))
		return ErrInternalServerError
	}

	if !wf.ValidateEmail(string(email)) {
		logger.Warn("email didn't pass access control checks")
		return ErrInvalidEmailPassword
	}

	return nil
}

func (wf *Workflows) ValidatePassword(
	ctx context.Context, password string, logger *slog.Logger,
) *APIError {
	if len(password) < wf.config.PasswordMinLength {
		logger.Warn("password too short")
		return ErrPasswordTooShort
	}

	if wf.config.PasswordHIBPEnabled {
		if pwned, err := wf.hibp.IsPasswordPwned(ctx, password); err != nil {
			logger.Error("error checking password with HIBP", logError(err))
			return ErrInternalServerError
		} else if pwned {
			logger.Warn("password is in HIBP database")
			return ErrPasswordInHibpDatabase
		}
	}

	return nil
}

func (wf *Workflows) ValidateSignUpOptions( //nolint:cyclop
	options *api.SignUpOptions, defaultName string, logger *slog.Logger,
) (*api.SignUpOptions, *APIError) {
	if options == nil {
		options = &api.SignUpOptions{} //nolint:exhaustruct
	}

	if options.DefaultRole == nil {
		options.DefaultRole = ptr(wf.config.DefaultRole)
	}

	if options.AllowedRoles == nil {
		options.AllowedRoles = ptr(wf.config.DefaultAllowedRoles)
	} else {
		for _, role := range deptr(options.AllowedRoles) {
			if !slices.Contains(wf.config.DefaultAllowedRoles, role) {
				logger.Warn("role not allowed", slog.String("role", role))
				return nil, ErrRoleNotAllowed
			}
		}
	}

	if !slices.Contains(deptr(options.AllowedRoles), deptr(options.DefaultRole)) {
		logger.Warn("default role not in allowed roles")
		return nil, ErrDefaultRoleMustBeInAllowedRoles
	}

	if options.DisplayName == nil {
		options.DisplayName = &defaultName
	}

	if options.Locale == nil {
		options.Locale = ptr(wf.config.DefaultLocale)
	}
	if !slices.Contains(wf.config.AllowedLocales, deptr(options.Locale)) {
		logger.Warn(
			"locale not allowed, using default",
			slog.String("locale", deptr(options.Locale)),
		)
		options.Locale = ptr(wf.config.DefaultLocale)
	}

	if options.RedirectTo == nil {
		options.RedirectTo = ptr(wf.config.ClientURL.String())
	} else if !wf.redirectURLValidator(deptr(options.RedirectTo)) {
		logger.Warn("redirect URL not allowed", slog.String("redirectTo", deptr(options.RedirectTo)))
		return nil, ErrRedirecToNotAllowed
	}

	return options, nil
}

func (wf *Workflows) ValidateUser(
	user sql.AuthUser,
	logger *slog.Logger,
) *APIError {
	if !wf.ValidateEmail(user.Email.String) {
		logger.Warn("email didn't pass access control checks")
		return ErrInvalidEmailPassword
	}

	if user.Disabled {
		logger.Warn("user is disabled")
		return ErrDisabledUser
	}

	if !user.EmailVerified && wf.config.RequireEmailVerification {
		logger.Warn("user is unverified")
		return ErrUnverifiedUser
	}

	return nil
}

func (wf *Workflows) ValidateOptionsRedirectTo(
	options *api.OptionsRedirectTo,
	logger *slog.Logger,
) (*api.OptionsRedirectTo, *APIError) {
	if options == nil {
		options = &api.OptionsRedirectTo{} //nolint:exhaustruct
	}

	if options.RedirectTo == nil {
		options.RedirectTo = ptr(wf.config.ClientURL.String())
	} else if !wf.redirectURLValidator(deptr(options.RedirectTo)) {
		logger.Warn("redirect URL not allowed", slog.String("redirectTo", deptr(options.RedirectTo)))
		return nil, ErrRedirecToNotAllowed
	}

	return options, nil
}

func (wf *Workflows) GetUser(
	ctx context.Context,
	id uuid.UUID,
	logger *slog.Logger,
) (sql.AuthUser, *APIError) {
	user, err := wf.db.GetUser(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		logger.Warn("user not found")
		return sql.AuthUser{}, ErrInvalidEmailPassword //nolint:exhaustruct
	}
	if err != nil {
		logger.Error("error getting user by email", logError(err))
		return sql.AuthUser{}, ErrInternalServerError //nolint:exhaustruct
	}

	if err := wf.ValidateUser(user, logger); err != nil {
		return sql.AuthUser{}, err //nolint:exhaustruct
	}

	return user, nil
}

func (wf *Workflows) GetUserByEmail(
	ctx context.Context,
	email string,
	logger *slog.Logger,
) (sql.AuthUser, *APIError) {
	user, err := wf.db.GetUserByEmail(ctx, sql.Text(email))
	if errors.Is(err, pgx.ErrNoRows) {
		logger.Warn("user not found")
		return sql.AuthUser{}, ErrUserEmailNotFound //nolint:exhaustruct
	}
	if err != nil {
		logger.Error("error getting user by email", logError(err))
		return sql.AuthUser{}, ErrInternalServerError //nolint:exhaustruct
	}

	if err := wf.ValidateUser(user, logger); err != nil {
		return user, err
	}

	return user, nil
}

func (wf *Workflows) GetUserByRefreshTokenHash(
	ctx context.Context,
	refreshToken string,
	refreshTokenType sql.RefreshTokenType,
	logger *slog.Logger,
) (sql.AuthUser, *APIError) {
	user, err := wf.db.GetUserByRefreshTokenHash(
		ctx,
		sql.GetUserByRefreshTokenHashParams{
			RefreshTokenHash: sql.Text(hashRefreshToken([]byte(refreshToken))),
			Type:             refreshTokenType,
		},
	)
	if errors.Is(err, pgx.ErrNoRows) {
		logger.Error("could not find user by refresh token")
		return sql.AuthUser{}, ErrInvalidPat //nolint:exhaustruct
	}
	if err != nil {
		logger.Error("could not get user by refresh token", logError(err))
		return sql.AuthUser{}, ErrInternalServerError //nolint:exhaustruct
	}

	if apiErr := wf.ValidateUser(user, logger); apiErr != nil {
		return sql.AuthUser{}, apiErr //nolint:exhaustruct
	}

	return user, nil
}

func (wf *Workflows) NewSession(
	ctx context.Context,
	user sql.AuthUser,
	logger *slog.Logger,
) (*api.Session, error) {
	userRoles, err := wf.db.GetUserRoles(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("error getting roles by user id: %w", err)
	}
	allowedRoles := make([]string, len(userRoles))
	for i, role := range userRoles {
		allowedRoles[i] = role.Role
	}

	refreshToken := uuid.New()
	expiresAt := time.Now().Add(time.Duration(wf.config.RefreshTokenExpiresIn) * time.Second)
	if _, apiErr := wf.InsertRefreshtoken(
		ctx, user.ID, refreshToken.String(), expiresAt, sql.RefreshTokenTypeRegular, nil, logger,
	); apiErr != nil {
		return nil, apiErr
	}

	if _, err := wf.db.UpdateUserLastSeen(ctx, user.ID); err != nil {
		return nil, fmt.Errorf("error updating last seen: %w", err)
	}

	accessToken, expiresIn, err := wf.jwtGetter.GetToken(
		ctx, user.ID, allowedRoles, user.DefaultRole, logger,
	)
	if err != nil {
		return nil, fmt.Errorf("error getting jwt: %w", err)
	}

	var metadata map[string]any
	if err := json.Unmarshal(user.Metadata, &metadata); err != nil {
		return nil, fmt.Errorf("error unmarshalling user metadata: %w", err)
	}
	return &api.Session{
		AccessToken:          accessToken,
		AccessTokenExpiresIn: expiresIn,
		RefreshToken:         refreshToken.String(),
		User: &api.User{
			AvatarUrl:           user.AvatarUrl,
			CreatedAt:           user.CreatedAt.Time,
			DefaultRole:         user.DefaultRole,
			DisplayName:         user.DisplayName,
			Email:               types.Email(user.Email.String),
			EmailVerified:       user.EmailVerified,
			Id:                  user.ID.String(),
			IsAnonymous:         false,
			Locale:              user.Locale,
			Metadata:            metadata,
			PhoneNumber:         user.PhoneNumber.String,
			PhoneNumberVerified: user.PhoneNumberVerified,
			Roles:               allowedRoles,
		},
	}, nil
}

func (wf *Workflows) GetUserFromJWTInContext(
	ctx context.Context,
	logger *slog.Logger,
) (sql.AuthUser, *APIError) {
	jwtToken, ok := wf.jwtGetter.FromContext(ctx)
	if !ok {
		logger.Error(
			"jwt token not found in context, this should not be possilble due to middleware",
		)
		return sql.AuthUser{}, ErrInternalServerError //nolint:exhaustruct
	}

	sub, err := jwtToken.Claims.GetSubject()
	if err != nil {
		logger.Error("error getting user id from jwt token", logError(err))
		return sql.AuthUser{}, ErrInvalidRequest //nolint:exhaustruct
	}
	logger = logger.With(slog.String("user_id", sub))

	userID, err := uuid.Parse(sub)
	if err != nil {
		logger.Error("error parsing user id from jwt token's subject", logError(err))
		return sql.AuthUser{}, ErrInvalidRequest //nolint:exhaustruct
	}

	user, apiErr := wf.GetUser(ctx, userID, logger)
	if apiErr != nil {
		return sql.AuthUser{}, apiErr //nolint:exhaustruct
	}

	if apiErr := wf.ValidateUser(user, logger); apiErr != nil {
		return sql.AuthUser{}, apiErr //nolint:exhaustruct
	}

	return user, nil
}

func (wf *Workflows) InsertRefreshtoken(
	ctx context.Context,
	userID uuid.UUID,
	refreshToken string,
	refreshTokenExpiresAt time.Time,
	refreshTokenType sql.RefreshTokenType,
	metadata map[string]any,
	logger *slog.Logger,
) (uuid.UUID, *APIError) {
	var b []byte
	var err error
	if metadata != nil {
		b, err = json.Marshal(metadata)
		if err != nil {
			logger.Error("error marshalling metadata", logError(err))
			return uuid.UUID{}, ErrInternalServerError
		}
	}

	refreshTokenID, err := wf.db.InsertRefreshtoken(ctx, sql.InsertRefreshtokenParams{
		UserID:           userID,
		RefreshTokenHash: sql.Text(hashRefreshToken([]byte(refreshToken))),
		ExpiresAt:        sql.TimestampTz(refreshTokenExpiresAt),
		Type:             refreshTokenType,
		Metadata:         b,
	})
	if err != nil {
		return uuid.UUID{}, ErrInternalServerError
	}

	return refreshTokenID, nil
}

func (wf *Workflows) ChangeEmail(
	ctx context.Context,
	userID uuid.UUID,
	newEmail string,
	logger *slog.Logger,
) (sql.AuthUser, *APIError) {
	ticket := generateTicket(TicketTypeEmailConfirmChange)
	ticketExpiresAt := time.Now().Add(time.Hour)

	user, err := wf.db.UpdateUserChangeEmail(
		ctx,
		sql.UpdateUserChangeEmailParams{
			ID:              userID,
			Ticket:          sql.Text(ticket),
			TicketExpiresAt: sql.TimestampTz(ticketExpiresAt),
			NewEmail:        sql.Text(newEmail),
		},
	)
	if err != nil {
		logger.Error("error updating user ticket", logError(err))
		return sql.AuthUser{}, ErrInternalServerError //nolint:exhaustruct
	}

	return user, nil
}

func (wf *Workflows) SendEmail(
	to string,
	locale string,
	linkType LinkType,
	ticket string,
	redirectTo string,
	templateName notifications.TemplateName,
	displayName string,
	email string,
	newEmail string,
	logger *slog.Logger,
) *APIError {
	link, err := GenLink(
		*wf.config.ServerURL,
		linkType,
		ticket,
		redirectTo,
	)
	if err != nil {
		logger.Error("problem generating email verification link", logError(err))
		return ErrInternalServerError
	}

	if err := wf.email.SendEmail(
		to,
		locale,
		templateName,
		notifications.TemplateData{
			Link:        link,
			DisplayName: displayName,
			Email:       email,
			NewEmail:    newEmail,
			Ticket:      ticket,
			RedirectTo:  redirectTo,
			Locale:      locale,
			ServerURL:   wf.config.ServerURL.String(),
			ClientURL:   wf.config.ClientURL.String(),
		},
	); err != nil {
		logger.Error("problem sending email", logError(err))
		return ErrInternalServerError
	}

	return nil
}

type SignUpFn func(input *sql.InsertUserParams) error

func SignupUserWithTicket(ticket string, expiresAt time.Time) SignUpFn {
	return func(input *sql.InsertUserParams) error {
		input.Ticket = sql.Text(ticket)
		input.TicketExpiresAt = sql.TimestampTz(expiresAt)
		return nil
	}
}

func SignupUserWithPassword(password string) SignUpFn {
	return func(input *sql.InsertUserParams) error {
		hashedPassword, err := hashPassword(password)
		if err != nil {
			return fmt.Errorf("error hashing password: %w", err)
		}

		input.PasswordHash = sql.Text(hashedPassword)

		return nil
	}
}

func (wf *Workflows) SignUpUser( //nolint:funlen
	ctx context.Context,
	email string,
	options *api.SignUpOptions,
	logger *slog.Logger,
	withInputFn ...SignUpFn,
) (sql.AuthUser, *APIError) {
	if wf.config.DisableSignup {
		logger.Warn("signup disabled")
		return sql.AuthUser{}, ErrSignupDisabled //nolint:exhaustruct
	}

	metadata, err := json.Marshal(options.Metadata)
	if err != nil {
		logger.Error("error marshaling metadata", logError(err))
		return sql.AuthUser{}, ErrInternalServerError //nolint:exhaustruct
	}

	gravatarURL := wf.gravatarURL(email)

	input := sql.InsertUserParams{
		Disabled:        wf.config.DisableNewUsers,
		DisplayName:     deptr(options.DisplayName),
		AvatarUrl:       gravatarURL,
		Email:           sql.Text(email),
		PasswordHash:    pgtype.Text{}, //nolint:exhaustruct
		Ticket:          pgtype.Text{}, //nolint:exhaustruct
		TicketExpiresAt: sql.TimestampTz(time.Now()),
		EmailVerified:   false,
		Locale:          deptr(options.Locale),
		DefaultRole:     deptr(options.DefaultRole),
		Metadata:        metadata,
		Roles:           deptr(options.AllowedRoles),
	}

	for _, fn := range withInputFn {
		if err := fn(&input); err != nil {
			logger.Error("error applying input function to user signup", logError(err))
			return sql.AuthUser{}, ErrInternalServerError //nolint:exhaustruct
		}
	}

	insertedUser, err := wf.db.InsertUser(ctx, input)
	if err != nil {
		logger.Error("error inserting user", logError(err))
		return sql.AuthUser{}, ErrInternalServerError //nolint:exhaustruct
	}

	if wf.config.DisableNewUsers {
		logger.Warn("new user disabled")
		return sql.AuthUser{}, ErrDisabledUser //nolint:exhaustruct
	}

	return sql.AuthUser{ //nolint:exhaustruct
		ID:                  insertedUser.UserID,
		Disabled:            wf.config.DisableNewUsers,
		DisplayName:         deptr(options.DisplayName),
		AvatarUrl:           gravatarURL,
		Locale:              deptr(options.Locale),
		Email:               sql.Text(email),
		EmailVerified:       false,
		PhoneNumberVerified: false,
		DefaultRole:         deptr(options.DefaultRole),
		IsAnonymous:         false,
		Metadata:            metadata,
	}, nil
}

func (wf *Workflows) SignupUserWithRefreshToken( //nolint:funlen
	ctx context.Context,
	email string,
	password string,
	refreshToken uuid.UUID,
	expiresAt time.Time,
	options *api.SignUpOptions,
	logger *slog.Logger,
) (*api.User, uuid.UUID, *APIError) {
	if wf.config.DisableSignup {
		logger.Warn("signup disabled")
		return nil, uuid.UUID{}, ErrSignupDisabled
	}

	metadata, err := json.Marshal(options.Metadata)
	if err != nil {
		logger.Error("error marshaling metadata", logError(err))
		return nil, uuid.UUID{}, ErrInternalServerError
	}

	gravatarURL := wf.gravatarURL(email)

	hashedPassword, err := hashPassword(password)
	if err != nil {
		logger.Error("error hashing password", logError(err))
		return nil, uuid.UUID{}, ErrInternalServerError
	}

	userID, err := wf.db.InsertUserWithRefreshToken(
		ctx, sql.InsertUserWithRefreshTokenParams{
			Disabled:              wf.config.DisableNewUsers,
			DisplayName:           deptr(options.DisplayName),
			AvatarUrl:             gravatarURL,
			Email:                 sql.Text(email),
			PasswordHash:          sql.Text(hashedPassword),
			Ticket:                pgtype.Text{}, //nolint:exhaustruct
			TicketExpiresAt:       sql.TimestampTz(time.Now()),
			EmailVerified:         false,
			Locale:                deptr(options.Locale),
			DefaultRole:           deptr(options.DefaultRole),
			Metadata:              metadata,
			Roles:                 deptr(options.AllowedRoles),
			RefreshTokenHash:      sql.Text(hashRefreshToken([]byte(refreshToken.String()))),
			RefreshTokenExpiresAt: sql.TimestampTz(expiresAt),
		},
	)
	if err != nil {
		logger.Error("error inserting user", logError(err))
		return nil, uuid.UUID{}, ErrInternalServerError
	}

	if wf.config.DisableNewUsers {
		logger.Warn("new user disabled")
		return nil, uuid.UUID{}, ErrDisabledUser
	}

	return &api.User{
		AvatarUrl:           gravatarURL,
		CreatedAt:           time.Now(),
		DefaultRole:         *options.DefaultRole,
		DisplayName:         deptr(options.DisplayName),
		Email:               types.Email(email),
		EmailVerified:       false,
		Id:                  userID.String(),
		IsAnonymous:         false,
		Locale:              deptr(options.Locale),
		Metadata:            deptr(options.Metadata),
		PhoneNumber:         "",
		PhoneNumberVerified: false,
		Roles:               deptr(options.AllowedRoles),
	}, userID, nil
}
