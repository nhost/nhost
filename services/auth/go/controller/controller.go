//go:generate mockgen -package mock -destination mock/controller.go --source=controller.go
package controller

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/notifications"
	"github.com/nhost/nhost/services/auth/go/oidc"
	"github.com/nhost/nhost/services/auth/go/providers"
	"github.com/nhost/nhost/services/auth/go/sql"
)

const (
	In30Days   = 720 * time.Hour
	InAMonth   = 30 * 24 * time.Hour
	In5Minutes = 5 * time.Minute
)

func deptr[T any](x *T) T { //nolint:ireturn
	if x == nil {
		return *new(T)
	}

	return *x
}

func ptr[T any](x T) *T {
	return &x
}

type Emailer interface {
	SendEmail(
		ctx context.Context,
		to string,
		locale string,
		templateName notifications.TemplateName,
		data notifications.TemplateData,
	) error
}

type SMSer interface {
	SendVerificationCode(ctx context.Context, to string, locale string) (string, time.Time, error)
	CheckVerificationCode(ctx context.Context, to string, code string) (sql.AuthUser, error)
}

type DBClientGetUser interface {
	GetUser(ctx context.Context, id uuid.UUID) (sql.AuthUser, error)
	GetUserByEmail(ctx context.Context, email pgtype.Text) (sql.AuthUser, error)
	GetUserByPhoneNumber(ctx context.Context, phoneNumber pgtype.Text) (sql.AuthUser, error)
	GetUserByRefreshTokenHash(
		ctx context.Context, arg sql.GetUserByRefreshTokenHashParams,
	) (sql.AuthUser, error)
	GetUserByTicket(ctx context.Context, ticket pgtype.Text) (sql.AuthUser, error)
	GetUserByEmailAndTicket(
		ctx context.Context, arg sql.GetUserByEmailAndTicketParams,
	) (sql.AuthUser, error)
}

type DBClientInsertUser interface {
	InsertUser(ctx context.Context, arg sql.InsertUserParams) (sql.InsertUserRow, error)
	InsertUserWithRefreshToken(
		ctx context.Context, arg sql.InsertUserWithRefreshTokenParams,
	) (sql.InsertUserWithRefreshTokenRow, error)
	InsertUserWithSecurityKeyAndRefreshToken(
		ctx context.Context,
		arg sql.InsertUserWithSecurityKeyAndRefreshTokenParams,
	) (sql.InsertUserWithSecurityKeyAndRefreshTokenRow, error)
}

type DBClientUpdateUser interface { //nolint:interfacebloat
	UpdateUserChangeEmail(
		ctx context.Context,
		arg sql.UpdateUserChangeEmailParams,
	) (sql.AuthUser, error)
	UpdateUserDeanonymize(ctx context.Context, arg sql.UpdateUserDeanonymizeParams) error
	UpdateUserLastSeen(ctx context.Context, id uuid.UUID) (pgtype.Timestamptz, error)
	UpdateUserTicket(ctx context.Context, arg sql.UpdateUserTicketParams) (uuid.UUID, error)
	UpdateUserChangePassword(
		ctx context.Context, arg sql.UpdateUserChangePasswordParams,
	) (uuid.UUID, error)
	InsertUserWithSecurityKey(
		ctx context.Context, arg sql.InsertUserWithSecurityKeyParams,
	) (uuid.UUID, error)
	UpdateUserConfirmChangeEmail(ctx context.Context, id uuid.UUID) (sql.AuthUser, error)
	UpdateUserVerifyEmail(ctx context.Context, id uuid.UUID) (sql.AuthUser, error)
	UpdateUserTotpSecret(ctx context.Context, arg sql.UpdateUserTotpSecretParams) error
	UpdateUserActiveMFAType(ctx context.Context, arg sql.UpdateUserActiveMFATypeParams) error
	InsertSecurityKey(ctx context.Context, arg sql.InsertSecurityKeyParams) (uuid.UUID, error)
	UpdateUserOTPHash(ctx context.Context, arg sql.UpdateUserOTPHashParams) (uuid.UUID, error)
}

type DBClientUserProvider interface {
	GetUserByProviderID(
		ctx context.Context, arg sql.GetUserByProviderIDParams,
	) (sql.AuthUser, error)
	FindUserProviderByProviderId(
		ctx context.Context, arg sql.FindUserProviderByProviderIdParams,
	) (sql.AuthUserProvider, error)
	InsertUserWithUserProvider(
		ctx context.Context, arg sql.InsertUserWithUserProviderParams,
	) (uuid.UUID, error)
	InsertUserWithUserProviderAndRefreshToken(
		ctx context.Context, arg sql.InsertUserWithUserProviderAndRefreshTokenParams,
	) (sql.InsertUserWithUserProviderAndRefreshTokenRow, error)
	InsertUserProvider(
		ctx context.Context, arg sql.InsertUserProviderParams,
	) (sql.AuthUserProvider, error)
}

type DBClient interface { //nolint:interfacebloat
	DBClientGetUser
	DBClientInsertUser
	DBClientUpdateUser
	DBClientUserProvider

	CountSecurityKeysUser(ctx context.Context, userID uuid.UUID) (int64, error)
	GetSecurityKeys(ctx context.Context, userID uuid.UUID) ([]sql.AuthUserSecurityKey, error)
	DeleteRefreshTokens(ctx context.Context, userID uuid.UUID) error
	DeleteRefreshToken(ctx context.Context, refreshTokenHash pgtype.Text) error
	DeleteUserRoles(ctx context.Context, userID uuid.UUID) error
	GetUserRoles(ctx context.Context, userID uuid.UUID) ([]sql.AuthUserRole, error)
	InsertRefreshtoken(ctx context.Context, arg sql.InsertRefreshtokenParams) (uuid.UUID, error)
	RefreshTokenAndGetUserRoles(
		ctx context.Context,
		arg sql.RefreshTokenAndGetUserRolesParams,
	) ([]sql.RefreshTokenAndGetUserRolesRow, error)
}

type Encrypter interface {
	Encrypt(plainText []byte) ([]byte, error)
	Decrypt(cipherText []byte) ([]byte, error)
}

type Controller struct {
	totp             *Totp
	encrypter        Encrypter
	idTokenValidator *oidc.IDTokenValidatorProviders
	wf               *Workflows
	config           Config
	Webauthn         *Webauthn
	Providers        providers.Map
	version          string
}

func New(
	db DBClient,
	config Config,
	jwtGetter *JWTGetter,
	emailer Emailer,
	sms SMSer,
	hibp HIBPClient,
	providers providers.Map,
	idTokenValidator *oidc.IDTokenValidatorProviders,
	totp *Totp,
	encrypter Encrypter,
	version string,
) (*Controller, error) {
	validator, err := NewWorkflows(
		&config,
		*jwtGetter,
		db,
		hibp,
		emailer,
		sms,
		idTokenValidator,
		GravatarURLFunc(
			config.GravatarEnabled, config.GravatarDefault, config.GravatarRating,
		),
	)
	if err != nil {
		return nil, fmt.Errorf("error creating validator: %w", err)
	}

	var wa *Webauthn
	if config.WebauthnEnabled {
		wa, err = NewWebAuthn(config)
		if err != nil {
			return nil, err
		}
	}

	return &Controller{
		config:           config,
		wf:               validator,
		Webauthn:         wa,
		idTokenValidator: idTokenValidator,
		totp:             totp,
		encrypter:        encrypter,
		version:          version,
		Providers:        providers,
	}, nil
}
