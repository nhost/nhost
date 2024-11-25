//go:generate mockgen -package mock -destination mock/workflows.go --source=workflows.go
package controller

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/notifications"
	"github.com/nhost/hasura-auth/go/oidc"
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
	idTokenValidator     *oidc.IDTokenValidatorProviders
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
	idTokenValidator *oidc.IDTokenValidatorProviders,
	gravatarURL func(string) string,
) (*Workflows, error) {
	allowedURLs := make([]string, len(cfg.AllowedRedirectURLs)+1)
	allowedURLs[0] = cfg.ClientURL.String()
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
		idTokenValidator:     idTokenValidator,
		gravatarURL:          gravatarURL,
	}, nil
}

func (wf *Workflows) ValidateSignupEmail(
	email types.Email, logger *slog.Logger,
) *APIError {
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
	if !user.IsAnonymous && !wf.ValidateEmail(user.Email.String) {
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

	if user.IsAnonymous {
		logger.Warn("user is anonymous")
		return ErrForbiddenAnonymous
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
		return sql.AuthUser{}, ErrInvalidEmailPassword
	}
	if err != nil {
		logger.Error("error getting user by email", logError(err))
		return sql.AuthUser{}, ErrInternalServerError
	}

	if err := wf.ValidateUser(user, logger); err != nil {
		return sql.AuthUser{}, err
	}

	return user, nil
}

func (wf *Workflows) UserByEmailExists(
	ctx context.Context,
	email string,
	logger *slog.Logger,
) (bool, *APIError) {
	_, err := wf.db.GetUserByEmail(ctx, sql.Text(email))
	if errors.Is(err, pgx.ErrNoRows) {
		logger.Warn("user not found")
		return false, nil
	}
	if err != nil {
		logger.Error("error getting user by email", logError(err))
		return false, ErrInternalServerError
	}

	return true, nil
}

func (wf *Workflows) GetUserByEmail(
	ctx context.Context,
	email string,
	logger *slog.Logger,
) (sql.AuthUser, *APIError) {
	user, err := wf.db.GetUserByEmail(ctx, sql.Text(email))
	if errors.Is(err, pgx.ErrNoRows) {
		logger.Warn("user not found")
		return sql.AuthUser{}, ErrUserEmailNotFound
	}
	if err != nil {
		logger.Error("error getting user by email", logError(err))
		return sql.AuthUser{}, ErrInternalServerError
	}

	if err := wf.ValidateUser(user, logger); err != nil {
		return user, err
	}

	return user, nil
}

func (wf *Workflows) GetUserByProviderUserID(
	ctx context.Context,
	providerID string,
	providerUserID string,
	logger *slog.Logger,
) (sql.AuthUser, *APIError) {
	user, err := wf.db.GetUserByProviderID(
		ctx,
		sql.GetUserByProviderIDParams{
			ProviderID:     providerID,
			ProviderUserID: providerUserID,
		},
	)
	if errors.Is(err, pgx.ErrNoRows) {
		logger.Warn("user provider not found")
		return sql.AuthUser{}, ErrUserProviderNotFound
	}
	if err != nil {
		logger.Error("error getting user by provider id", logError(err))
		return sql.AuthUser{}, ErrInternalServerError
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
		if refreshTokenType == sql.RefreshTokenTypePAT {
			return sql.AuthUser{}, ErrInvalidPat
		}
		return sql.AuthUser{}, ErrInvalidRefreshToken
	}
	if err != nil {
		logger.Error("could not get user by refresh token", logError(err))
		return sql.AuthUser{}, ErrInternalServerError
	}

	if apiErr := wf.ValidateUser(user, logger); apiErr != nil {
		return user, apiErr
	}

	return user, nil
}

func (wf *Workflows) GetUserByTicket(
	ctx context.Context,
	ticket string,
	logger *slog.Logger,
) (sql.AuthUser, *APIError) {
	user, err := wf.db.GetUserByTicket(ctx, sql.Text(ticket))
	if errors.Is(err, pgx.ErrNoRows) {
		logger.Warn("user not found")
		return sql.AuthUser{}, ErrInvalidTicket
	}
	if err != nil {
		logger.Error("could not get user by ticket", logError(err))
		return sql.AuthUser{}, ErrInternalServerError
	}

	if apiErr := wf.ValidateUser(user, logger); apiErr != nil {
		return user, apiErr
	}

	return user, nil
}

func (wf *Workflows) GetUserByEmailAndTicket(
	ctx context.Context,
	email string,
	ticket string,
	logger *slog.Logger,
) (sql.AuthUser, *APIError) {
	user, err := wf.db.GetUserByEmailAndTicket(
		ctx,
		sql.GetUserByEmailAndTicketParams{
			Email:  sql.Text(email),
			Ticket: sql.Text(ticket),
		},
	)
	if errors.Is(err, pgx.ErrNoRows) {
		logger.Warn("user not found")
		return sql.AuthUser{}, ErrInvalidTicket
	}
	if err != nil {
		logger.Error("could not get user by ticket", logError(err))
		return sql.AuthUser{}, ErrInternalServerError
	}

	if apiErr := wf.ValidateUser(user, logger); apiErr != nil {
		return user, apiErr
	}

	return user, nil
}

func pgtypeTextToOAPIEmail(pgemail pgtype.Text) *types.Email {
	var email *types.Email
	if pgemail.Valid {
		email = ptr(types.Email(pgemail.String))
	}
	return email
}

func (wf *Workflows) UpdateSession( //nolint:funlen
	ctx context.Context,
	user sql.AuthUser,
	refreshToken string,
	logger *slog.Logger,
) (*api.Session, *APIError) {
	userRoles, err := wf.db.RefreshTokenAndGetUserRoles(ctx, sql.RefreshTokenAndGetUserRolesParams{
		RefreshTokenHash: sql.Text(hashRefreshToken([]byte(refreshToken))),
		ExpiresAt: sql.TimestampTz(
			time.Now().Add(time.Duration(wf.config.RefreshTokenExpiresIn) * time.Second),
		),
	})
	if errors.Is(err, pgx.ErrNoRows) {
		logger.Warn("invalid refresh token")
		return &api.Session{}, ErrInvalidRefreshToken
	}
	if err != nil {
		logger.Error("error getting user roles by refresh token", logError(err))
		return nil, ErrInternalServerError
	}

	allowedRoles := make([]string, 0, len(userRoles))
	for _, role := range userRoles {
		if role.Role.Valid {
			allowedRoles = append(allowedRoles, role.Role.String)
		}
	}

	if !slices.Contains(allowedRoles, user.DefaultRole) {
		allowedRoles = append(allowedRoles, user.DefaultRole)
	}

	accessToken, expiresIn, err := wf.jwtGetter.GetToken(
		ctx, user.ID, user.IsAnonymous, allowedRoles, user.DefaultRole, logger,
	)
	if err != nil {
		logger.Error("error getting jwt", logError(err))
		return nil, ErrInternalServerError
	}

	var metadata map[string]any
	if len(user.Metadata) > 0 {
		if err := json.Unmarshal(user.Metadata, &metadata); err != nil {
			logger.Error("error unmarshalling user metadata", logError(err))
			return nil, ErrInternalServerError
		}
	}

	return &api.Session{
		AccessToken:          accessToken,
		AccessTokenExpiresIn: expiresIn,
		RefreshToken:         refreshToken,
		RefreshTokenId:       userRoles[0].RefreshTokenID.String(),
		User: &api.User{
			AvatarUrl:           user.AvatarUrl,
			CreatedAt:           user.CreatedAt.Time,
			DefaultRole:         user.DefaultRole,
			DisplayName:         user.DisplayName,
			Email:               pgtypeTextToOAPIEmail(user.Email),
			EmailVerified:       user.EmailVerified,
			Id:                  user.ID.String(),
			IsAnonymous:         user.IsAnonymous,
			Locale:              user.Locale,
			Metadata:            metadata,
			PhoneNumber:         sql.ToPointerString(user.PhoneNumber),
			PhoneNumberVerified: user.PhoneNumberVerified,
			Roles:               allowedRoles,
		},
	}, nil
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
	refreshTokenID, apiErr := wf.InsertRefreshtoken(
		ctx, user.ID, refreshToken.String(), expiresAt, sql.RefreshTokenTypeRegular, nil, logger,
	)
	if apiErr != nil {
		return nil, apiErr
	}

	if _, err := wf.db.UpdateUserLastSeen(ctx, user.ID); err != nil {
		return nil, fmt.Errorf("error updating user last seen: %w", err)
	}

	accessToken, expiresIn, err := wf.jwtGetter.GetToken(
		ctx, user.ID, user.IsAnonymous, allowedRoles, user.DefaultRole, logger,
	)
	if err != nil {
		return nil, fmt.Errorf("error getting jwt: %w", err)
	}

	var metadata map[string]any
	if len(user.Metadata) > 0 {
		if err := json.Unmarshal(user.Metadata, &metadata); err != nil {
			return nil, fmt.Errorf("error unmarshalling user metadata: %w", err)
		}
	}
	return &api.Session{
		AccessToken:          accessToken,
		AccessTokenExpiresIn: expiresIn,
		RefreshTokenId:       refreshTokenID.String(),
		RefreshToken:         refreshToken.String(),
		User: &api.User{
			AvatarUrl:           user.AvatarUrl,
			CreatedAt:           user.CreatedAt.Time,
			DefaultRole:         user.DefaultRole,
			DisplayName:         user.DisplayName,
			Email:               pgtypeTextToOAPIEmail(user.Email),
			EmailVerified:       user.EmailVerified,
			Id:                  user.ID.String(),
			IsAnonymous:         false,
			Locale:              user.Locale,
			Metadata:            metadata,
			PhoneNumber:         sql.ToPointerString(user.PhoneNumber),
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
		return sql.AuthUser{}, ErrInternalServerError
	}

	sub, err := jwtToken.Claims.GetSubject()
	if err != nil {
		logger.Error("error getting user id from jwt token", logError(err))
		return sql.AuthUser{}, ErrInvalidRequest
	}
	logger = logger.With(slog.String("user_id", sub))

	userID, err := uuid.Parse(sub)
	if err != nil {
		logger.Error("error parsing user id from jwt token's subject", logError(err))
		return sql.AuthUser{}, ErrInvalidRequest
	}

	user, apiErr := wf.GetUser(ctx, userID, logger)
	if apiErr != nil {
		return sql.AuthUser{}, apiErr
	}

	if apiErr := wf.ValidateUser(user, logger); apiErr != nil {
		return sql.AuthUser{}, apiErr
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
		return sql.AuthUser{}, ErrInternalServerError
	}

	return user, nil
}

func (wf *Workflows) ChangePassword(
	ctx context.Context,
	userID uuid.UUID,
	newPassord string,
	logger *slog.Logger,
) *APIError {
	if err := wf.ValidatePassword(ctx, newPassord, logger); err != nil {
		return err
	}

	hashedPassword, err := hashPassword(newPassord)
	if err != nil {
		logger.Error("error hashing password", logError(err))
		return ErrInternalServerError
	}

	if _, err := wf.db.UpdateUserChangePassword(
		ctx,
		sql.UpdateUserChangePasswordParams{
			ID:           userID,
			PasswordHash: sql.Text(hashedPassword),
		},
	); err != nil {
		logger.Error("error updating user password", logError(err))
		return ErrInternalServerError
	}

	return nil
}

func (wf *Workflows) SendEmail(
	ctx context.Context,
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
		ctx,
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

type databaseWithSessionFn func(
	refreshTokenHash pgtype.Text,
	refreshTokenExpiresAt pgtype.Timestamptz,
	metadata []byte,
	gravatarURL string,
) (uuid.UUID, uuid.UUID, error)

type databaseWithoutSessionFn func(
	ticket pgtype.Text,
	ticketExpiresAt pgtype.Timestamptz,
	metadata []byte,
	gravatarURL string,
) error

func (wf *Workflows) SignupUserWithFn(
	ctx context.Context,
	email string,
	options *api.SignUpOptions,
	sendConfirmationEmail bool,
	databaseWithSession databaseWithSessionFn,
	databaseWithoutSession databaseWithoutSessionFn,
	logger *slog.Logger,
) (*api.Session, *APIError) {
	if wf.config.RequireEmailVerification || wf.config.DisableNewUsers {
		return nil, wf.SignupUserWithouthSession(
			ctx, email, options, sendConfirmationEmail, databaseWithoutSession, logger,
		)
	}

	return wf.SignupUserWithSession(ctx, email, options, databaseWithSession, logger)
}

func (wf *Workflows) SignupUserWithSession( //nolint:funlen
	ctx context.Context,
	email string,
	options *api.SignUpOptions,
	databaseWithUserSession databaseWithSessionFn,
	logger *slog.Logger,
) (*api.Session, *APIError) {
	if wf.config.DisableSignup {
		logger.Warn("signup disabled")
		return nil, ErrSignupDisabled
	}

	refreshToken := uuid.New()
	refreshTokenExpiresAt := time.Now().
		Add(time.Duration(wf.config.RefreshTokenExpiresIn) * time.Second)

	metadata, err := json.Marshal(options.Metadata)
	if err != nil {
		logger.Error("error marshaling metadata", logError(err))
		return nil, ErrInternalServerError
	}

	gravatarURL := wf.gravatarURL(email)

	userID, refreshTokenID, err := databaseWithUserSession(
		sql.Text(hashRefreshToken([]byte(refreshToken.String()))),
		sql.TimestampTz(refreshTokenExpiresAt),
		metadata,
		gravatarURL,
	)
	if err != nil {
		return nil, sqlErrIsDuplicatedEmail(err, logger)
	}

	if wf.config.DisableNewUsers {
		logger.Warn("new user disabled")
		return nil, ErrDisabledUser
	}

	accessToken, expiresIn, err := wf.jwtGetter.GetToken(
		ctx, userID, false, deptr(options.AllowedRoles), *options.DefaultRole, logger,
	)
	if err != nil {
		logger.Error("error getting jwt", logError(err))
		return nil, ErrInternalServerError
	}

	return &api.Session{
		AccessToken:          accessToken,
		AccessTokenExpiresIn: expiresIn,
		RefreshTokenId:       refreshTokenID.String(),
		RefreshToken:         refreshToken.String(),
		User: &api.User{
			AvatarUrl:           gravatarURL,
			CreatedAt:           time.Now(),
			DefaultRole:         *options.DefaultRole,
			DisplayName:         deptr(options.DisplayName),
			Email:               ptr(types.Email(email)),
			EmailVerified:       false,
			Id:                  userID.String(),
			IsAnonymous:         false,
			Locale:              deptr(options.Locale),
			Metadata:            deptr(options.Metadata),
			PhoneNumber:         nil,
			PhoneNumberVerified: false,
			Roles:               deptr(options.AllowedRoles),
		},
	}, nil
}

func (wf *Workflows) SignupUserWithouthSession(
	ctx context.Context,
	email string,
	options *api.SignUpOptions,
	sendConfirmationEmail bool,
	databaseWithoutSession databaseWithoutSessionFn,
	logger *slog.Logger,
) *APIError {
	if wf.config.DisableSignup {
		logger.Warn("signup disabled")
		return ErrSignupDisabled
	}

	metadata, err := json.Marshal(options.Metadata)
	if err != nil {
		logger.Error("error marshaling metadata", logError(err))
		return ErrInternalServerError
	}

	gravatarURL := wf.gravatarURL(email)

	var ticket pgtype.Text
	var ticketExpiresAt pgtype.Timestamptz
	if sendConfirmationEmail {
		ticket = sql.Text(generateTicket(TicketTypeVerifyEmail))
		ticketExpiresAt = sql.TimestampTz(time.Now().Add(InAMonth))
	}

	if err := databaseWithoutSession(ticket, ticketExpiresAt, metadata, gravatarURL); err != nil {
		return sqlErrIsDuplicatedEmail(err, logger)
	}

	if wf.config.DisableNewUsers {
		logger.Warn("new user disabled")
		return ErrDisabledUser
	}

	if sendConfirmationEmail {
		if err := wf.SendEmail(
			ctx,
			email,
			deptr(options.Locale),
			LinkTypeEmailVerify,
			ticket.String,
			deptr(options.RedirectTo),
			notifications.TemplateNameEmailVerify,
			deptr(options.DisplayName),
			email,
			"",
			logger,
		); err != nil {
			return err
		}
	}

	return nil
}

func (wf *Workflows) DeanonymizeUser(
	ctx context.Context,
	userID uuid.UUID,
	email string,
	password string,
	ticket string,
	ticketExpiresAt time.Time,
	options *api.SignUpOptions,
	deleteRefreshTokens bool,
	logger *slog.Logger,
) *APIError {
	if err := wf.db.DeleteUserRoles(ctx, userID); err != nil {
		logger.Error("error deleting user roles", logError(err))
		return ErrInternalServerError
	}

	var metadatab []byte
	var err error
	if options.Metadata != nil {
		metadatab, err = json.Marshal(options.Metadata)
		if err != nil {
			logger.Error("error marshalling metadata", logError(err))
			return ErrInternalServerError
		}
	}

	hashedPassword, err := hashPassword(password)
	if err != nil {
		logger.Error("error hashing password", logError(err))
		return ErrInternalServerError
	}

	if err := wf.db.UpdateUserDeanonymize(
		ctx,
		sql.UpdateUserDeanonymizeParams{
			Roles:           *options.AllowedRoles,
			Email:           sql.Text(email),
			DefaultRole:     sql.Text(*options.DefaultRole),
			DisplayName:     sql.Text(*options.DisplayName),
			Locale:          sql.Text(*options.Locale),
			Metadata:        metadatab,
			PasswordHash:    sql.Text(hashedPassword),
			Ticket:          sql.Text(ticket),
			TicketExpiresAt: sql.TimestampTz(ticketExpiresAt),
			ID:              pgtype.UUID{Bytes: userID, Valid: true},
		},
	); err != nil {
		logger.Error("error updating user", logError(err))
		return ErrInternalServerError
	}

	if deleteRefreshTokens {
		if err := wf.db.DeleteRefreshTokens(ctx, userID); err != nil {
			logger.Error("error deleting refresh tokens", logError(err))
			return ErrInternalServerError
		}
	}

	return nil
}

func (wf *Workflows) GetOIDCProfileFromIDToken(
	providerID api.Provider,
	idToken string,
	pnonce *string,
	logger *slog.Logger,
) (oidc.Profile, *APIError) {
	idTokenValidator, apiError := wf.getIDTokenValidator(providerID)
	if apiError != nil {
		logger.Error("error getting id token validator", logError(apiError))
		return oidc.Profile{}, apiError
	}

	nonce := ""
	if pnonce != nil {
		nonce = *pnonce
	}

	token, err := idTokenValidator.Validate(idToken, nonce)
	if err != nil {
		logger.Error("error validating id token", logError(err))
		return oidc.Profile{}, ErrInvalidRequest
	}

	profile, err := idTokenValidator.GetProfile(token)
	if err != nil {
		logger.Error("error getting profile from token", logError(err))
		return oidc.Profile{}, ErrInvalidRequest
	}

	return profile, nil
}

func (wf *Workflows) getIDTokenValidator(
	provider api.Provider,
) (*oidc.IDTokenValidator, *APIError) {
	var validator *oidc.IDTokenValidator
	switch provider {
	case api.Apple:
		validator = wf.idTokenValidator.AppleID
	case api.Google:
		validator = wf.idTokenValidator.Google
	case api.FakeProvider:
		validator = wf.idTokenValidator.FakeProvider
	default:
		return nil, ErrInvalidRequest
	}

	if validator == nil {
		return nil, ErrDisabledEndpoint
	}

	return validator, nil
}

func (wf *Workflows) InsertUserProvider(
	ctx context.Context,
	userID uuid.UUID,
	providerID string,
	providerUserID string,
	logger *slog.Logger,
) (sql.AuthUserProvider, *APIError) {
	userP, err := wf.db.InsertUserProvider(
		ctx,
		sql.InsertUserProviderParams{
			UserID:         userID,
			ProviderID:     providerID,
			ProviderUserID: providerUserID,
		},
	)
	if err != nil {
		if sqlIsDuplcateError(err, "user_providers_provider_id_provider_user_id_key") {
			logger.Error("user provider id already in use", logError(err))
			return sql.AuthUserProvider{}, ErrUserProviderAlreadyLinked
		}

		logger.Error("error inserting user provider", logError(err))
		return sql.AuthUserProvider{}, ErrInternalServerError
	}

	return userP, nil
}

func (wf *Workflows) UpdateUserConfirmChangeEmail(
	ctx context.Context,
	userID uuid.UUID,
	logger *slog.Logger,
) (sql.AuthUser, *APIError) {
	userP, err := wf.db.UpdateUserConfirmChangeEmail(
		ctx,
		userID,
	)
	if err != nil {
		if sqlIsDuplcateError(err, "users_email_key") {
			logger.Error("user email id already in use", logError(err))
			return sql.AuthUser{}, ErrEmailAlreadyInUse
		}

		logger.Error("error updating user", logError(err))
		return sql.AuthUser{}, ErrInternalServerError
	}

	return userP, nil
}

func (wf *Workflows) UpdateUserVerifyEmail(
	ctx context.Context,
	userID uuid.UUID,
	logger *slog.Logger,
) (sql.AuthUser, *APIError) {
	userP, err := wf.db.UpdateUserVerifyEmail(
		ctx,
		userID,
	)
	if err != nil {
		logger.Error("error updating user", logError(err))
		return sql.AuthUser{}, ErrInternalServerError
	}

	return userP, nil
}

func (wf *Workflows) GetUserSecurityKeys(
	ctx context.Context,
	userID uuid.UUID,
	logger *slog.Logger,
) ([]sql.AuthUserSecurityKey, *APIError) {
	keys, err := wf.db.GetSecurityKeys(ctx, userID)
	if errors.Is(err, pgx.ErrNoRows) || len(keys) == 0 {
		logger.Warn("security keys not found")
		return nil, ErrSecurityKeyNotFound
	}
	if err != nil {
		logger.Error("error getting security keys", logError(err))
		return nil, ErrInternalServerError
	}

	return keys, nil
}
