package cmd

import (
	"errors"
	"fmt"
	"log/slog"
	"net/smtp"
	"os"
	"path/filepath"

	"github.com/nhost/hasura-auth/go/controller"
	"github.com/nhost/hasura-auth/go/notifications"
	"github.com/nhost/hasura-auth/go/notifications/postmark"
	"github.com/urfave/cli/v2"
)

func getSMTPEmailer(cCtx *cli.Context, logger *slog.Logger) (*notifications.Email, error) {
	headers := make(map[string]string)
	if cCtx.String(flagSMTPAPIHedaer) != "" {
		headers["X-SMTPAPI"] = cCtx.String(flagSMTPAPIHedaer)
	}

	var templatesPath string
	for _, p := range []string{
		cCtx.String(flagEmailTemplatesPath),
		filepath.Join(cCtx.String(flagNodeServerPath), "email-templates"),
	} {
		if _, err := os.Stat(p); err == nil {
			templatesPath = p
			break
		}
	}
	if templatesPath == "" {
		return nil, errors.New("templates path not found") //nolint:goerr113
	}

	templates, err := notifications.NewTemplatesFromFilesystem(
		templatesPath,
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
		uint16(cCtx.Uint(flagSMTPPort)), //nolint:gosec
		cCtx.Bool(flagSMTPSecure),
		auth,
		cCtx.String(flagSMTPSender),
		headers,
		templates,
	), nil
}

func getEmailer( //nolint:ireturn
	cCtx *cli.Context,
	logger *slog.Logger,
) (controller.Emailer, error) {
	if cCtx.String(flagSMTPHost) == "postmark" {
		return postmark.New(cCtx.String(flagSMTPSender), cCtx.String(flagSMTPPassword)), nil
	}

	return getSMTPEmailer(cCtx, logger)
}
