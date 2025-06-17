package cmd

import (
	"errors"
	"fmt"
	"log/slog"
	"net/smtp"
	"os"
	"path/filepath"
	"strings"

	"github.com/nhost/hasura-auth/go/controller"
	"github.com/nhost/hasura-auth/go/notifications"
	"github.com/nhost/hasura-auth/go/notifications/postmark"
	"github.com/nhost/hasura-auth/go/notifications/sms"
	"github.com/nhost/hasura-auth/go/sql"
	"github.com/urfave/cli/v2"
)

func getSMTPEmailer(
	cCtx *cli.Context,
	templates *notifications.Templates,
) (*notifications.Email, error) {
	headers := make(map[string]string)
	if cCtx.String(flagSMTPAPIHedaer) != "" {
		headers["X-SMTPAPI"] = cCtx.String(flagSMTPAPIHedaer)
	}

	host := cCtx.String(flagSMTPHost)
	user := cCtx.String(flagSMTPUser)
	password := cCtx.String(flagSMTPPassword)
	var auth smtp.Auth
	switch GetEnumValue(cCtx, flagSMTPAuthMethod) {
	case "LOGIN":
		auth = notifications.LoginAuth(user, password, host)
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

func getTemplates(cCtx *cli.Context, logger *slog.Logger) (*notifications.Templates, error) {
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

	return templates, nil
}

func getEmailer( //nolint:ireturn
	cCtx *cli.Context,
	logger *slog.Logger,
) (controller.Emailer, *notifications.Templates, error) {
	if cCtx.String(flagSMTPHost) == "postmark" {
		return postmark.New(cCtx.String(flagSMTPSender), cCtx.String(flagSMTPPassword)), nil, nil
	}

	templates, err := getTemplates(cCtx, logger)
	if err != nil {
		return nil, nil, fmt.Errorf("problem creating templates: %w", err)
	}

	emailer, err := getSMTPEmailer(cCtx, templates)
	return emailer, templates, err
}

func getSMS( //nolint:ireturn
	cCtx *cli.Context,
	templates *notifications.Templates,
	db *sql.Queries,
	logger *slog.Logger,
) (controller.SMSer, error) {
	if !cCtx.Bool(flagSMSPasswordlessEnabled) {
		return nil, nil //nolint:nilnil // SMS disabled, return nil client
	}

	accountSid := cCtx.String(flagSMSTwilioAccountSid)
	authToken := cCtx.String(flagSMSTwilioAuthToken)
	messagingServiceID := cCtx.String(flagSMSTwilioMessagingServiceID)

	if accountSid == "" || authToken == "" || messagingServiceID == "" {
		return nil, errors.New("SMS is enabled but Twilio credentials are missing") //nolint:err113
	}

	if strings.HasPrefix(accountSid, "VA") {
		// If accountSid starts with "VA", it's a verification service
		return sms.NewTwilioVerificationService(
			accountSid, authToken, messagingServiceID, db,
		), nil
	}

	if templates == nil {
		var err error
		templates, err = getTemplates(cCtx, logger)
		if err != nil {
			return nil, fmt.Errorf("problem creating templates: %w", err)
		}
	}

	return sms.NewTwilioSMS(
		templates,
		controller.GenerateOTP,
		controller.HashOTP,
		accountSid,
		authToken,
		messagingServiceID,
		db,
	), nil
}
