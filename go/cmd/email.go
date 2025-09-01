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
	"github.com/urfave/cli/v3"
)

func getSMTPEmailer(
	cmd *cli.Command,
	templates *notifications.Templates,
) (*notifications.Email, error) {
	headers := make(map[string]string)
	if cmd.String(flagSMTPAPIHedaer) != "" {
		headers["X-SMTPAPI"] = cmd.String(flagSMTPAPIHedaer)
	}

	host := cmd.String(flagSMTPHost)
	user := cmd.String(flagSMTPUser)
	password := cmd.String(flagSMTPPassword)

	var auth smtp.Auth

	switch cmd.String(flagSMTPAuthMethod) {
	case "LOGIN":
		auth = notifications.LoginAuth(user, password, host)
	case "PLAIN":
		auth = notifications.PlainAuth("", user, password, host)
	case "CRAM-MD5":
		auth = smtp.CRAMMD5Auth(user, password)
	default:
		return nil, errors.New("unsupported auth method") //nolint:err113
	}

	return notifications.NewEmail(
		cmd.String(flagSMTPHost),
		uint16(cmd.Uint(flagSMTPPort)), //nolint:gosec
		cmd.Bool(flagSMTPSecure),
		auth,
		cmd.String(flagSMTPSender),
		headers,
		templates,
	), nil
}

func getTemplates(cmd *cli.Command, logger *slog.Logger) (*notifications.Templates, error) {
	var templatesPath string
	for _, p := range []string{
		cmd.String(flagEmailTemplatesPath),
		"email-templates",
		filepath.Join("share", "email-templates"),
	} {
		if _, err := os.Stat(p); err == nil {
			templatesPath = p
			break
		}
	}

	if templatesPath == "" {
		return nil, errors.New("templates path not found") //nolint:err113
	}

	templates, err := notifications.NewTemplatesFromFilesystem(
		templatesPath,
		cmd.String(flagDefaultLocale),
		logger.With(slog.String("component", "mailer")),
	)
	if err != nil {
		return nil, fmt.Errorf("problem creating templates: %w", err)
	}

	return templates, nil
}

func getEmailer( //nolint:ireturn
	cmd *cli.Command,
	logger *slog.Logger,
) (controller.Emailer, *notifications.Templates, error) {
	if cmd.String(flagSMTPHost) == "postmark" {
		return postmark.New(cmd.String(flagSMTPSender), cmd.String(flagSMTPPassword)), nil, nil
	}

	templates, err := getTemplates(cmd, logger)
	if err != nil {
		return nil, nil, fmt.Errorf("problem creating templates: %w", err)
	}

	emailer, err := getSMTPEmailer(cmd, templates)

	return emailer, templates, err
}

func getSMS( //nolint:ireturn
	cmd *cli.Command,
	templates *notifications.Templates,
	db *sql.Queries,
	logger *slog.Logger,
) (controller.SMSer, error) {
	if !cmd.Bool(flagSMSPasswordlessEnabled) {
		return nil, nil //nolint:nilnil // SMS disabled, return nil client
	}

	provider := strings.ToLower(cmd.String(flagSMSProvider))
	if provider == "" {
		provider = "twilio" // Default to Twilio for backward compatibility
	}

	switch strings.ToLower(cmd.String(flagSMSProvider)) {
	case "twilio":
		return getTwilioSMS(cmd, templates, db)
	case "dev":
		return sms.NewDev(templates, db, logger), nil
	default:
		return nil, fmt.Errorf("unsupported SMS provider: %s", provider) //nolint:err113
	}
}

func getTwilioSMS( //nolint:ireturn
	cmd *cli.Command,
	templates *notifications.Templates,
	db *sql.Queries,
) (controller.SMSer, error) {
	accountSid := cmd.String(flagSMSTwilioAccountSid)
	authToken := cmd.String(flagSMSTwilioAuthToken)
	messagingServiceID := cmd.String(flagSMSTwilioMessagingServiceID)

	if accountSid == "" || authToken == "" || messagingServiceID == "" {
		return nil, errors.New("SMS is enabled but Twilio credentials are missing") //nolint:err113
	}

	if strings.HasPrefix(accountSid, "VA") {
		// If accountSid starts with "VA", it's a verification service
		return sms.NewTwilioVerificationService(
			accountSid, authToken, messagingServiceID, db,
		), nil
	}

	return sms.NewTwilioSMS(
		templates,
		accountSid,
		authToken,
		messagingServiceID,
		db,
	), nil
}
