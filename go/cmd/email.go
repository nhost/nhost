package cmd

import (
	"errors"
	"fmt"
	"log/slog"
	"net/smtp"
	"path/filepath"

	"github.com/nhost/hasura-auth/go/notifications"
	"github.com/urfave/cli/v2"
)

func getEmailer(cCtx *cli.Context, logger *slog.Logger) (*notifications.Email, error) {
	headers := make(map[string]string)
	if cCtx.String(flagSMTPAPIHedaer) != "" {
		headers["X-SMTPAPI"] = cCtx.String(flagSMTPAPIHedaer)
	}

	templates, err := notifications.NewTemplatesFromFilesystem(
		filepath.Join(cCtx.String(flagNodeServerPath), "email-templates"),
		cCtx.String(flagDefaultLocale),
		logger.With(slog.String("component", "mailer")),
	)
	if err != nil {
		return nil, fmt.Errorf("problem creating templates: %w", err)
	}

	host := cCtx.String(flagSMTPHost)
	user := cCtx.String(flagSMTPUser)
	password := cCtx.String(flagSMTPPassword)
	var auth smtp.Auth
	switch GetEnumValue(cCtx, flagSMTPAuthMethod) {
	case "LOGIN":
		logger.Warn("SMTP auth LOGIN method is deprecated, using PLAIN instead")
		auth = notifications.PlainAuth("", user, password, host)
	case "PLAIN":
		auth = notifications.PlainAuth("", user, password, host)
	case "CRAM-MD5":
		auth = smtp.CRAMMD5Auth(user, password)
	default:
		return nil, errors.New("unsupported auth method") //nolint:goerr113
	}

	return notifications.NewEmail(
		cCtx.String(flagSMTPHost),
		uint16(cCtx.Uint(flagSMTPPort)),
		auth,
		cCtx.String(flagSMTPSender),
		headers,
		templates,
	), nil
}
