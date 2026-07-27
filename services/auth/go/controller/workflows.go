//go:generate mockgen -package mock -destination mock/workflows.go --source=workflows.go
package controller

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/notifications"
	"github.com/nhost/nhost/services/auth/go/oidc"
	"github.com/nhost/nhost/services/auth/go/providers"
	"github.com/nhost/nhost/services/auth/go/sql"
	"github.com/oapi-codegen/runtime/types"
)

const anonymousRole = "anonymous"

type HIBPClient interface {
	IsPasswordPwned(ctx context.Context, password string) (bool, error)
}

type Workflows struct {
	config               *Config
	jwtGetter            *JWTGetter
	db                   DBClient
	hibp                 HIBPClient
	email                Emailer
	sms                  SMSer
	idTokenValidator     *oidc.IDTokenValidatorProviders
	redirectURLValidator func(redirectTo string) bool
	ValidateEmail        func(email string) bool
	gravatarURL          func(string) string
}

func NewWorkflows(
	cfg *Config,
	jwtGetter *JWTGetter,
	db DBClient,
	hibp HIBPClient,
	email Emailer,
	sms SMSer,
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
		sms:                  sms,
		redirectURLValidator: redirectURLValidator,
		ValidateEmail:        emailValidator,
		idTokenValidator:     idTokenValidator,
		gravatarURL:          gravatarURL,
	}, nil
}

func (wf *Workflows) ValidateSignupEmail(
	ctx context.Context, email types.Email, logger *slog.Logger,
) *APIError {
	if !wf.ValidateEmail(string(email)) {
		logger.WarnContext(ctx, "email didn't pass access control checks")
		return ErrInvalidEmailPassword
	}

	return nil
}

func (wf *Workflows) ValidatePassword(
	ctx context.Context, password string, logger *slog.Logger,
) *APIError {
	if len(password) < wf.config.PasswordMinLength {
		logger.WarnContext(ctx, "password too short")
		return ErrPasswordTooShort
	}

	if wf.config.PasswordHIBPEnabled {
		if pwned, err := wf.hibp.IsPasswordPwned(ctx, password); err != nil {
			logger.ErrorContext(ctx, "error checking password with HIBP", logError(err))
			return ErrInternalServerError
		} else if pwned {
			logger.WarnContext(ctx, "password is in HIBP database")
			return ErrPasswordInHibpDatabase
		}
	}

	return nil
}

func (wf *Workflows) ValidateSignUpOptions(
	ctx context.Context, options *api.SignUpOptions, defaultName string, logger *slog.Logger,
) (*api.SignUpOptions, *APIError) {
	if options == nil {
		options = &api.SignUpOptions{} //nolint:exhaustruct
	}

	if options.RedirectTo == nil {
		options.RedirectTo = new(wf.config.ClientURL.String())
	} else if !wf.redirectURLValidator(deptr(options.RedirectTo)) {
		logger.WarnContext(
			ctx,
			"redirect URL not allowed",
			slog.String("redirectTo", deptr(options.RedirectTo)),
		)

		return nil, ErrRedirecToNotAllowed
	}

	if options.DefaultRole == nil {
		options.DefaultRole = new(wf.config.DefaultRole)
	}

	if options.AllowedRoles == nil {
		options.AllowedRoles = new(wf.config.DefaultAllowedRoles)
	} else {
		for _, role := range deptr(options.AllowedRoles) {
			if !slices.Contains(wf.config.DefaultAllowedRoles, role) {
				logger.WarnContext(ctx, "role not allowed", slog.String("role", role))
				return options, ErrRoleNotAllowed
			}
		}
	}

	if !slices.Contains(deptr(options.AllowedRoles), deptr(options.DefaultRole)) {
		logger.WarnContext(ctx, "default role not in allowed roles")
		return options, ErrDefaultRoleMustBeInAllowedRoles
	}

	if options.DisplayName == nil {
		options.DisplayName = &defaultName
	}

	if options.Locale == nil {
		options.Locale = new(wf.config.DefaultLocale)
	}

	if !slices.Contains(wf.config.AllowedLocales, deptr(options.Locale)) {
		logger.WarnContext(
			ctx,
			"locale not allowed, using default",
			slog.String("locale", deptr(options.Locale)),
		)
		options.Locale = new(wf.config.DefaultLocale)
	}

	return options, nil
}

func (wf *Workflows) ValidateUser(
	ctx context.Context,
	user sql.AuthUser,
	logger *slog.Logger,
) *APIError {
	if !user.IsAnonymous && !wf.ValidateEmail(user.Email.String) {
		logger.WarnContext(ctx, "email didn't pass access control checks")
		return ErrInvalidEmailPassword
	}

	if user.Disabled {
		logger.WarnContext(ctx, "user is disabled")
		return ErrDisabledUser
	}

	if !user.EmailVerified && wf.config.RequireEmailVerification {
		logger.WarnContext(ctx, "user is unverified")
		return ErrUnverifiedUser
	}

	if user.IsAnonymous {
		logger.WarnContext(ctx, "user is anonymous")
		return ErrForbiddenAnonymous
	}

	return nil
}

func (wf *Workflows) ValidateUserEmailOptional(
	ctx context.Context,
	user sql.AuthUser,
	logger *slog.Logger,
) *APIError {
	if user.Email.Valid && !user.IsAnonymous && !wf.ValidateEmail(user.Email.String) {
		logger.WarnContext(ctx, "email didn't pass access control checks")
		return ErrInvalidEmailPassword
	}

	if user.Disabled {
		logger.WarnContext(ctx, "user is disabled")
		return ErrDisabledUser
	}

	if user.Email.Valid && !user.EmailVerified && wf.config.RequireEmailVerification {
		logger.WarnContext(ctx, "user is unverified")
		return ErrUnverifiedUser
	}

	if user.IsAnonymous {
		logger.WarnContext(ctx, "user is anonymous")
		return ErrForbiddenAnonymous
	}

	return nil
}

func (wf *Workflows) ValidateOptionsRedirectTo(
	ctx context.Context,
	options *api.OptionsRedirectTo,
	logger *slog.Logger,
) (*api.OptionsRedirectTo, *APIError) {
	if options == nil {
		options = &api.OptionsRedirectTo{} //nolint:exhaustruct
	}

	if options.RedirectTo == nil {
		options.RedirectTo = new(wf.config.ClientURL.String())
	} else if !wf.redirectURLValidator(deptr(options.RedirectTo)) {
		logger.WarnContext(
			ctx,
			"redirect URL not allowed",
			slog.String("redirectTo", deptr(options.RedirectTo)),
		)

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
		logger.WarnContext(ctx, "user not found")
		return sql.AuthUser{}, ErrInvalidEmailPassword
	}

	if err != nil {
		logger.ErrorContext(ctx, "error getting user by email", logError(err))
		return sql.AuthUser{}, ErrInternalServerError
	}

	if err := wf.ValidateUser(ctx, user, logger); err != nil {
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
		logger.WarnContext(ctx, "user not found")
		return false, nil
	}

	if err != nil {
		logger.ErrorContext(ctx, "error getting user by email", logError(err))
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
		logger.WarnContext(ctx, "user not found")
		return sql.AuthUser{}, ErrUserEmailNotFound
	}

	if err != nil {
		logger.ErrorContext(ctx, "error getting user by email", logError(err))
		return sql.AuthUser{}, ErrInternalServerError
	}

	if err := wf.ValidateUser(ctx, user, logger); err != nil {
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
		logger.WarnContext(ctx, "user provider not found")
		return sql.AuthUser{}, ErrUserProviderNotFound
	}

	if err != nil {
		logger.ErrorContext(ctx, "error getting user by provider id", logError(err))
		return sql.AuthUser{}, ErrInternalServerError
	}

	if err := wf.ValidateUserEmailOptional(ctx, user, logger); err != nil {
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
		logger.ErrorContext(ctx, "could not find user by refresh token")

		if refreshTokenType == sql.RefreshTokenTypePAT {
			return sql.AuthUser{}, ErrInvalidPat
		}

		return sql.AuthUser{}, ErrInvalidRefreshToken
	}

	if err != nil {
		logger.ErrorContext(ctx, "could not get user by refresh token", logError(err))
		return sql.AuthUser{}, ErrInternalServerError
	}

	if apiErr := wf.ValidateUser(ctx, user, logger); apiErr != nil {
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
		logger.WarnContext(ctx, "user not found")
		return sql.AuthUser{}, ErrInvalidTicket
	}

	if err != nil {
		logger.ErrorContext(ctx, "could not get user by ticket", logError(err))
		return sql.AuthUser{}, ErrInternalServerError
	}

	if apiErr := wf.ValidateUser(ctx, user, logger); apiErr != nil {
		return user, apiErr
	}

	return user, nil
}

func (wf *Workflows) VerifyEmailOTP(
	ctx context.Context,
	email string,
	otp string,
	logger *slog.Logger,
) (sql.AuthUser, *APIError) {
	// The query applies the attempt policy and reports the outcome in one
	// statement, so a failed guess needs no follow-up lookup. The burned case is
	// distinguished from a plain wrong/expired code so the user is told to
	// request a new one; ErrTooManyOTPAttempts is sensitive, so it collapses to
	// the generic error when ConcealErrors is enabled.
	status, err := wf.db.VerifyEmailOTP(
		ctx,
		sql.VerifyEmailOTPParams{
			Email:       sql.Text(email),
			Otp:         sql.Text(otp),
			MaxAttempts: pgtype.Int4{Int32: maxOTPVerificationAttempts, Valid: true},
		},
	)
	if err != nil {
		logger.ErrorContext(ctx, "could not verify email otp", logError(err))
		return sql.AuthUser{}, ErrInternalServerError
	}

	switch status {
	case otpStatusOK:
		// Correct code: the statement above cleared it and verified the email.
		// Load the updated user for the session below.
	case otpStatusBurned:
		logger.WarnContext(ctx, "otp burned after too many attempts")
		return sql.AuthUser{}, ErrTooManyOTPAttempts
	case otpStatusInvalid:
		logger.WarnContext(ctx, "invalid or expired otp")
		return sql.AuthUser{}, ErrInvalidOTP
	default:
		logger.ErrorContext(
			ctx, "unexpected otp verification status", slog.String("status", status),
		)

		return sql.AuthUser{}, ErrInternalServerError
	}

	user, err := wf.db.GetUserByEmail(ctx, sql.Text(email))
	if err != nil {
		logger.ErrorContext(ctx, "could not get user after otp verification", logError(err))
		return sql.AuthUser{}, ErrInternalServerError
	}

	if apiErr := wf.ValidateUser(ctx, user, logger); apiErr != nil {
		return user, apiErr
	}

	return user, nil
}

func pgtypeTextToOAPIEmail(pgemail pgtype.Text) *types.Email {
	var email *types.Email
	if pgemail.Valid {
		email = new(types.Email(pgemail.String))
	}

	return email
}

func (wf *Workflows) UpdateSession( //nolint:funlen
	ctx context.Context,
	user sql.AuthUser,
	oldRefreshToken string,
	logger *slog.Logger,
) (*api.Session, *APIError) {
	refreshToken := uuid.New().String()

	userRoles, err := wf.db.RefreshTokenAndGetUserRoles(ctx, sql.RefreshTokenAndGetUserRolesParams{
		NewRefreshTokenHash: sql.Text(hashRefreshToken([]byte(refreshToken))),
		ExpiresAt: sql.TimestampTz(
			time.Now().Add(time.Duration(wf.config.RefreshTokenExpiresIn) * time.Second),
		),
		OldRefreshTokenHash: sql.Text(hashRefreshToken([]byte(oldRefreshToken))),
	})
	if errors.Is(err, pgx.ErrNoRows) || len(userRoles) == 0 {
		logger.WarnContext(ctx, "invalid refresh token")
		return &api.Session{}, ErrInvalidRefreshToken
	}

	if err != nil {
		logger.ErrorContext(ctx, "error getting user roles by refresh token", logError(err))
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
		ctx, user.ID, user.IsAnonymous, allowedRoles, user.DefaultRole, nil, logger,
	)
	if err != nil {
		logger.ErrorContext(ctx, "error getting jwt", logError(err))
		return nil, ErrInternalServerError
	}

	var metadata map[string]any
	if len(user.Metadata) > 0 {
		if err := json.Unmarshal(user.Metadata, &metadata); err != nil {
			logger.ErrorContext(ctx, "error unmarshalling user metadata", logError(err))
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
			ActiveMfaType:       nil,
		},
	}, nil
}

func (wf *Workflows) NewSession( //nolint:funlen
	ctx context.Context,
	user sql.AuthUser,
	customClaims map[string]any,
	logger *slog.Logger,
) (*api.Session, error) {
	userRoles, err := wf.db.GetUserRoles(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("error getting roles by user id: %w", err)
	}

	allowedRoles := make([]string, 0, len(userRoles))
	for _, role := range userRoles {
		allowedRoles = append(allowedRoles, role.Role)
	}

	if !slices.Contains(allowedRoles, user.DefaultRole) {
		allowedRoles = append(allowedRoles, user.DefaultRole)
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
		ctx, user.ID, user.IsAnonymous, allowedRoles, user.DefaultRole, customClaims, logger,
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
			ActiveMfaType:       nil,
		},
	}, nil
}

func (wf *Workflows) GetJWTInContext(
	ctx context.Context,
	logger *slog.Logger,
) (uuid.UUID, *APIError) {
	jwtToken, ok := wf.jwtGetter.FromContext(ctx)
	if !ok {
		logger.ErrorContext(
			ctx,
			"jwt token not found in context, this should not be possible due to middleware",
		)

		return uuid.UUID{}, ErrInvalidRequest
	}

	sub, err := jwtToken.Claims.GetSubject()
	if err != nil {
		logger.ErrorContext(ctx, "error getting user id from jwt token", logError(err))
		return uuid.UUID{}, ErrInvalidRequest
	}

	logger = logger.With(slog.String("user_id", sub))

	userID, err := uuid.Parse(sub)
	if err != nil {
		logger.ErrorContext(ctx, "error parsing user id from jwt token's subject", logError(err))
		return uuid.UUID{}, ErrInvalidRequest
	}

	return userID, nil
}

func (wf *Workflows) GetUserFromJWTInContext(
	ctx context.Context,
	logger *slog.Logger,
) (sql.AuthUser, *APIError) {
	userID, apiErr := wf.GetJWTInContext(ctx, logger)
	if apiErr != nil {
		return sql.AuthUser{}, apiErr
	}

	user, apiErr := wf.GetUser(ctx, userID, logger)
	if apiErr != nil {
		return sql.AuthUser{}, apiErr
	}

	if apiErr := wf.ValidateUser(ctx, user, logger); apiErr != nil {
		return sql.AuthUser{}, apiErr
	}

	return user, nil
}

func (wf *Workflows) VerifyJWTToken(
	ctx context.Context,
	token string,
	logger *slog.Logger,
) *APIError {
	token = strings.TrimPrefix(token, "Bearer ")

	jwtToken, err := wf.jwtGetter.Validate(token)
	if err != nil {
		logger.WarnContext(ctx, "invalid JWT token", logError(err))
		return ErrUnauthenticatedUser
	}

	if !jwtToken.Valid {
		logger.WarnContext(ctx, "JWT token is not valid")
		return ErrUnauthenticatedUser
	}

	return nil
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
	var (
		b   []byte
		err error
	)

	if metadata != nil {
		b, err = json.Marshal(metadata)
		if err != nil {
			logger.ErrorContext(ctx, "error marshalling metadata", logError(err))
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
		logger.ErrorContext(ctx, "error updating user ticket", logError(err))
		return sql.AuthUser{}, ErrInternalServerError
	}

	return user, nil
}

func (wf *Workflows) ChangePassword(
	ctx context.Context,
	userID uuid.UUID,
	newPassword string,
	logger *slog.Logger,
) *APIError {
	if err := wf.ValidatePassword(ctx, newPassword, logger); err != nil {
		return err
	}

	hashedPassword, err := hashPassword(newPassword)
	if err != nil {
		logger.ErrorContext(ctx, "error hashing password", logError(err))
		return ErrInternalServerError
	}

	// UpdateUserChangePassword atomically rotates the password hash and revokes
	// session refresh tokens (regular rows in auth.refresh_tokens plus all
	// auth.oauth2_refresh_tokens) within a single CTE. Personal Access Tokens
	// (type='pat') are intentionally preserved so automation keeps working
	// across password changes.
	if _, err := wf.db.UpdateUserChangePassword(
		ctx,
		sql.UpdateUserChangePasswordParams{
			ID:           userID,
			PasswordHash: sql.Text(hashedPassword),
		},
	); err != nil {
		logger.ErrorContext(ctx, "error updating user password", logError(err))
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
	codeChallenge string,
	logger *slog.Logger,
) *APIError {
	link, err := GenLink(
		*wf.config.ServerURL,
		linkType,
		ticket,
		redirectTo,
		codeChallenge,
	)
	if err != nil {
		logger.ErrorContext(ctx, "problem generating email verification link", logError(err))
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
		logger.ErrorContext(ctx, "problem sending email", logError(err))
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
	codeChallenge string,
	logger *slog.Logger,
) (*api.Session, *APIError) {
	if (sendConfirmationEmail && wf.config.RequireEmailVerification) || wf.config.DisableNewUsers {
		return nil, wf.SignupUserWithouthSession(
			ctx, email, options, sendConfirmationEmail,
			databaseWithoutSession, codeChallenge, logger,
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
		logger.WarnContext(ctx, "signup disabled")
		return nil, ErrSignupDisabled
	}

	refreshToken := uuid.New()
	refreshTokenExpiresAt := time.Now().
		Add(time.Duration(wf.config.RefreshTokenExpiresIn) * time.Second)

	metadata, err := json.Marshal(options.Metadata)
	if err != nil {
		logger.ErrorContext(ctx, "error marshaling metadata", logError(err))
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
		return nil, sqlErrIsDuplicatedEmail(ctx, err, logger)
	}

	if wf.config.DisableNewUsers {
		logger.WarnContext(ctx, "new user disabled")
		return nil, ErrDisabledUser
	}

	accessToken, expiresIn, err := wf.jwtGetter.GetToken(
		ctx, userID, false, deptr(options.AllowedRoles), *options.DefaultRole, nil, logger,
	)
	if err != nil {
		logger.ErrorContext(ctx, "error getting jwt", logError(err))
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
			Email:               new(types.Email(email)),
			EmailVerified:       false,
			Id:                  userID.String(),
			IsAnonymous:         false,
			Locale:              deptr(options.Locale),
			Metadata:            deptr(options.Metadata),
			PhoneNumber:         nil,
			PhoneNumberVerified: false,
			Roles:               deptr(options.AllowedRoles),
			ActiveMfaType:       nil,
		},
	}, nil
}

func (wf *Workflows) SignupUserWithouthSession(
	ctx context.Context,
	email string,
	options *api.SignUpOptions,
	sendConfirmationEmail bool,
	databaseWithoutSession databaseWithoutSessionFn,
	codeChallenge string,
	logger *slog.Logger,
) *APIError {
	if wf.config.DisableSignup {
		logger.WarnContext(ctx, "signup disabled")
		return ErrSignupDisabled
	}

	metadata, err := json.Marshal(options.Metadata)
	if err != nil {
		logger.ErrorContext(ctx, "error marshaling metadata", logError(err))
		return ErrInternalServerError
	}

	gravatarURL := wf.gravatarURL(email)

	var ticket pgtype.Text

	ticketExpiresAt := sql.TimestampTz(time.Now())
	if sendConfirmationEmail {
		ticket = sql.Text(generateTicket(TicketTypeVerifyEmail))
		ticketExpiresAt = sql.TimestampTz(time.Now().Add(InAMonth))
	}

	if err := databaseWithoutSession(ticket, ticketExpiresAt, metadata, gravatarURL); err != nil {
		return sqlErrIsDuplicatedEmail(ctx, err, logger)
	}

	if wf.config.DisableNewUsers {
		logger.WarnContext(ctx, "new user disabled")
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
			codeChallenge,
			logger,
		); err != nil {
			return err
		}
	}

	return nil
}

func (wf *Workflows) SignupAnonymousUser( //nolint:funlen
	ctx context.Context,
	locale string,
	displayName string,
	reqMetadata map[string]any,
	logger *slog.Logger,
) (*api.Session, *APIError) {
	if wf.config.DisableSignup {
		logger.WarnContext(ctx, "signup disabled")
		return nil, ErrSignupDisabled
	}

	refreshToken := uuid.New()
	refreshTokenExpiresAt := time.Now().
		Add(time.Duration(wf.config.RefreshTokenExpiresIn) * time.Second)

	metadata, err := json.Marshal(reqMetadata)
	if err != nil {
		logger.ErrorContext(ctx, "error marshaling metadata", logError(err))
		return nil, ErrInternalServerError
	}

	resp, err := wf.db.InsertUserWithRefreshToken(
		ctx,
		sql.InsertUserWithRefreshTokenParams{
			Disabled:              false,
			DisplayName:           displayName,
			AvatarUrl:             "",
			Email:                 pgtype.Text{}, //nolint:exhaustruct
			PasswordHash:          pgtype.Text{}, //nolint:exhaustruct
			Ticket:                pgtype.Text{}, //nolint:exhaustruct
			TicketExpiresAt:       sql.TimestampTz(time.Now()),
			IsAnonymous:           true,
			EmailVerified:         false,
			Locale:                locale,
			DefaultRole:           anonymousRole,
			Metadata:              metadata,
			RefreshTokenHash:      sql.Text(hashRefreshToken([]byte(refreshToken.String()))),
			RefreshTokenExpiresAt: sql.TimestampTz(refreshTokenExpiresAt),
			Roles:                 []string{anonymousRole},
		},
	)
	if err != nil {
		logger.ErrorContext(ctx, "error inserting user", logError(err))
		return nil, &APIError{api.InternalServerError}
	}

	accessToken, expiresIn, err := wf.jwtGetter.GetToken(
		ctx, resp.ID, true, []string{anonymousRole}, anonymousRole, nil, logger,
	)
	if err != nil {
		logger.ErrorContext(ctx, "error getting jwt", logError(err))
		return nil, ErrInternalServerError
	}

	return &api.Session{
		AccessToken:          accessToken,
		AccessTokenExpiresIn: expiresIn,
		RefreshTokenId:       resp.RefreshTokenID.String(),
		RefreshToken:         refreshToken.String(),
		User: &api.User{
			AvatarUrl:           "",
			CreatedAt:           time.Now(),
			DefaultRole:         anonymousRole,
			DisplayName:         displayName,
			Email:               nil,
			EmailVerified:       false,
			Id:                  resp.ID.String(),
			IsAnonymous:         true,
			Locale:              locale,
			Metadata:            reqMetadata,
			PhoneNumber:         nil,
			PhoneNumberVerified: false,
			Roles:               []string{anonymousRole},
			ActiveMfaType:       nil,
		},
	}, nil
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
		logger.ErrorContext(ctx, "error deleting user roles", logError(err))
		return ErrInternalServerError
	}

	var (
		metadatab []byte
		err       error
	)

	if options.Metadata != nil {
		metadatab, err = json.Marshal(options.Metadata)
		if err != nil {
			logger.ErrorContext(ctx, "error marshalling metadata", logError(err))
			return ErrInternalServerError
		}
	}

	hashedPassword, err := hashPassword(password)
	if err != nil {
		logger.ErrorContext(ctx, "error hashing password", logError(err))
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
		logger.ErrorContext(ctx, "error updating user", logError(err))
		return ErrInternalServerError
	}

	if deleteRefreshTokens {
		if err := wf.db.DeleteRefreshTokens(ctx, userID); err != nil {
			logger.ErrorContext(ctx, "error deleting refresh tokens", logError(err))
			return ErrInternalServerError
		}
	}

	return nil
}

func (wf *Workflows) GetOIDCProfileFromIDToken(
	ctx context.Context,
	providerID api.IdTokenProvider,
	idToken string,
	pnonce *string,
	logger *slog.Logger,
) (oidc.Profile, *APIError) {
	idTokenValidator, apiError := wf.getIDTokenValidator(ctx, providerID, logger)
	if apiError != nil {
		logger.ErrorContext(ctx, "error getting id token validator", logError(apiError))
		return oidc.Profile{}, apiError
	}

	nonce := ""
	if pnonce != nil {
		nonce = *pnonce
	}

	var (
		token *jwt.Token
		err   error
	)

	if pnonce != nil && wf.isIssuerBoundProvider(providerID) {
		// Callers of an OIDC provider we bind to an issuer get strict
		// validation when they supplied a nonce: an id_token without the
		// claim cannot be bound to their request.
		token, err = idTokenValidator.ValidateWithRequiredNonce(idToken, nonce)
	} else {
		token, err = idTokenValidator.Validate(idToken, nonce)
	}

	if err != nil {
		logger.ErrorContext(ctx, "error validating id token", logError(err))
		return oidc.Profile{}, ErrInvalidRequest
	}

	profile, err := idTokenValidator.GetProfile(token)
	if err != nil {
		logger.ErrorContext(ctx, "error getting profile from token", logError(err))
		return oidc.Profile{}, ErrInvalidRequest
	}

	if profile.ProviderUserID == "" {
		logger.ErrorContext(ctx, "provider user id is empty")
		return oidc.Profile{}, ErrOauthProfileFetchFailed
	}

	return profile, nil
}

// isCustomProviderID reports whether providerID is spelled as a custom
// provider ("c:<slug>"). Use it for the two questions that are answered by
// the requested or recorded ID alone:
//
//   - telling an unconfigured "c:<slug>" (a disabled endpoint) apart from a
//     provider name we never supported (an invalid request), and
//   - deciding whether an identity came from an operator-supplied IdP, which
//     is what CheckCrossProviderEmailLink turns on. That has to be the
//     spelling: it must also cover an oauth2-type custom (which has no
//     configured issuer, and whose flat userinfo emailVerified field is the
//     least trustworthy signal of the lot) and a recorded identity whose slug
//     has since been removed from AUTH_PROVIDER_CUSTOM.
//
// It must NOT be used for the strict-nonce and issuer-recording decisions:
// those turn on the provider having a configured issuer, so they go through
// isIssuerBoundProvider. The two predicates are not substitutable in either
// direction.
func isCustomProviderID(providerID string) bool {
	return strings.HasPrefix(providerID, providers.CustomProviderPrefix)
}

// isIssuerBoundProvider reports whether the provider is an OIDC provider we
// pin to a configured issuer, which is what the strict-nonce and
// issuer-recording decisions actually turn on.
//
// It is deliberately not the "c:" prefix, and is narrower than
// isCustomProviderID in both directions: it covers only oidc-type customs
// (OAuth2Definition.Issuer() is always ""), only ones in the *current*
// configuration, and it will also cover the built-in providers scheduled to
// move onto the custom-provider engine as OIDC presets — those keep their
// built-in IDs, so a prefix test would silently stop requiring the nonce
// claim for them while the browser flow kept sending one.
func (wf *Workflows) isIssuerBoundProvider(providerID string) bool {
	_, ok := wf.config.CustomProviderIssuers[providerID]
	return ok
}

func (wf *Workflows) getIDTokenValidator(
	ctx context.Context,
	provider api.IdTokenProvider,
	logger *slog.Logger,
) (*oidc.IDTokenValidator, *APIError) {
	var validator *oidc.IDTokenValidator

	switch provider {
	case api.IdTokenProviderApple:
		validator = wf.idTokenValidator.AppleID
	case api.IdTokenProviderGoogle:
		validator = wf.idTokenValidator.Google
	case api.IdTokenProviderFake:
		validator = wf.idTokenValidator.FakeProvider
	default:
		return wf.getCustomIDTokenValidator(ctx, provider, logger)
	}

	if validator == nil {
		return nil, ErrDisabledEndpoint
	}

	return validator, nil
}

// getCustomIDTokenValidator resolves validators for custom OIDC providers
// ("c:<slug>"). OAuth2-type customs and unknown slugs degrade to the same
// disabled-endpoint error as unconfigured built-ins; anything else stays an
// invalid request.
func (wf *Workflows) getCustomIDTokenValidator(
	ctx context.Context,
	provider api.IdTokenProvider,
	logger *slog.Logger,
) (*oidc.IDTokenValidator, *APIError) {
	var lazy *oidc.LazyIDTokenValidator
	if wf.idTokenValidator != nil {
		lazy = wf.idTokenValidator.Custom[provider]
	}

	if lazy == nil {
		if isCustomProviderID(provider) {
			return nil, ErrDisabledEndpoint
		}

		return nil, ErrInvalidRequest
	}

	validator, err := lazy.Get(ctx)
	if err != nil {
		logger.ErrorContext(
			ctx, "error building custom id token validator", logError(err),
		)

		return nil, ErrInternalServerError
	}

	return validator, nil
}

// customProviderIssuer returns the configured issuer of an issuer-bound
// provider as a nullable column value; every other provider records NULL.
// Same source of truth as isIssuerBoundProvider.
func (wf *Workflows) customProviderIssuer(providerID string) pgtype.Text {
	issuer, ok := wf.config.CustomProviderIssuers[providerID]
	if !ok {
		return pgtype.Text{} //nolint:exhaustruct
	}

	return sql.Text(issuer)
}

// CheckCustomProviderIssuer rejects sign-ins where a custom provider's
// recorded identity was not established under the issuer the slug is
// configured with. A NULL recorded issuer is rejected too: the startup probe
// (checkIssuerConflict) refuses to boot while such rows exist, so one showing
// up at runtime means the row was written outside the normal flow and must
// not silently inherit the configured issuer. Built-in providers are
// unaffected (no configured issuer).
//
// It lives here, next to customProviderIssuer and isIssuerBoundProvider, so
// the "which issuer do we record" and "which issuer do we accept" decisions
// read the one wf.config rather than two copies of it.
func (wf *Workflows) CheckCustomProviderIssuer(
	ctx context.Context, providerID, providerUserID string, logger *slog.Logger,
) *APIError {
	configuredIssuer := wf.customProviderIssuer(providerID)
	if !configuredIssuer.Valid {
		return nil
	}

	row, err := wf.db.FindUserProviderByProviderId(
		ctx, sql.FindUserProviderByProviderIdParams{
			ProviderUserID: providerUserID,
			ProviderID:     providerID,
		},
	)
	if err != nil {
		logger.ErrorContext(ctx, "error getting user provider", logError(err))
		return ErrInternalServerError
	}

	if !row.Issuer.Valid || row.Issuer.String != configuredIssuer.String {
		logger.WarnContext(
			ctx,
			"refusing sign-in: identity was not recorded under the configured issuer",
			slog.String("provider", providerID),
		)

		return ErrDisabledEndpoint
	}

	return nil
}

// CheckCrossProviderEmailLink limits email-based auto-linking whenever a
// custom provider is on either side of the link. An operator-configured IdP
// can assert any email with email_verified true, which is the only gate
// ensureProviderLinkAllowed applies, so the email alone is not evidence that
// two identities belong to the same person.
//
// The rule is symmetric, because the takeover works in both directions:
//
//   - a c:<slug> identity may only auto-link into an account that already
//     holds an identity from that same slug (the "same user, new
//     provider-side id" edge), and
//   - an account that holds any c:<slug> identity may not be auto-linked
//     into from a different provider — otherwise the attacker signs up
//     through the custom IdP with the victim's address first and waits for
//     the victim's Google sign-in to land in that account.
//
// The cost is that a newly enabled custom provider never reaches a
// pre-existing account by email — including an account with no provider
// identity at all — so an SSO rollout onto an existing user base has to route
// every user through the authenticated connect flow or /link/idtoken once.
// That is documented in customProvidersUsage; failing closed is deliberate.
// Accounts with no custom identity keep today's built-in-to-built-in
// behavior.
func (wf *Workflows) CheckCrossProviderEmailLink(
	ctx context.Context, userID uuid.UUID, providerID string, logger *slog.Logger,
) *APIError {
	providerIDs, err := wf.db.GetUserProviderIDsByUserID(ctx, userID)
	if err != nil {
		logger.ErrorContext(ctx, "error getting user providers", logError(err))
		return ErrInternalServerError
	}

	if slices.Contains(providerIDs, providerID) {
		return nil
	}

	if !isCustomProviderID(providerID) && !slices.ContainsFunc(providerIDs, isCustomProviderID) {
		return nil
	}

	logger.WarnContext(
		ctx,
		"refusing email-based auto-link across a custom provider boundary",
		slog.String("provider", providerID),
	)

	return ErrUserAlreadyExists
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
			Issuer:         wf.customProviderIssuer(providerID),
		},
	)
	if err != nil {
		if sqlIsDuplcateError(err, "user_providers_provider_id_provider_user_id_key") {
			logger.ErrorContext(ctx, "user provider id already in use", logError(err))
			return sql.AuthUserProvider{}, ErrProviderAccountAlreadyLinked
		}

		logger.ErrorContext(ctx, "error inserting user provider", logError(err))

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
			logger.ErrorContext(ctx, "user email id already in use", logError(err))
			return sql.AuthUser{}, ErrUserAlreadyExists
		}

		logger.ErrorContext(ctx, "error updating user", logError(err))

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
		logger.ErrorContext(ctx, "error updating user", logError(err))
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
		logger.WarnContext(ctx, "security keys not found")
		return nil, ErrSecurityKeyNotFound
	}

	if err != nil {
		logger.ErrorContext(ctx, "error getting security keys", logError(err))
		return nil, ErrInternalServerError
	}

	return keys, nil
}

func (wf *Workflows) GetUserByPhoneNumber(
	ctx context.Context,
	phoneNumber string,
	logger *slog.Logger,
) (sql.AuthUser, *APIError) {
	user, err := wf.db.GetUserByPhoneNumber(ctx, sql.Text(phoneNumber))
	if errors.Is(err, pgx.ErrNoRows) {
		logger.WarnContext(ctx, "user not found by phone number")
		return sql.AuthUser{}, ErrUserPhoneNumberNotFound
	}

	if err != nil {
		logger.ErrorContext(ctx, "error getting user by phone number", logError(err))
		return sql.AuthUser{}, ErrInternalServerError
	}

	if user.Disabled {
		logger.WarnContext(ctx, "user is disabled")
		return sql.AuthUser{}, ErrDisabledUser
	}

	if user.IsAnonymous {
		logger.WarnContext(ctx, "user is anonymous")
		return sql.AuthUser{}, ErrForbiddenAnonymous
	}

	return user, nil
}

func (wf *Workflows) DeleteUserRefreshTokens(
	ctx context.Context,
	userID uuid.UUID,
	logger *slog.Logger,
) *APIError {
	if err := wf.db.DeleteRefreshTokens(ctx, userID); err != nil {
		logger.ErrorContext(ctx, "error deleting user refresh tokens", logError(err))
		return ErrInternalServerError
	}

	return nil
}

func (wf *Workflows) DeleteRefreshToken(
	ctx context.Context,
	refreshToken string,
	logger *slog.Logger,
) *APIError {
	if err := wf.db.DeleteRefreshToken(
		ctx, sql.Text(hashRefreshToken([]byte(refreshToken))),
	); err != nil {
		logger.ErrorContext(ctx, "error deleting refresh token", logError(err))
		return ErrInternalServerError
	}

	return nil
}
