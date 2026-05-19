package cmd

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/smtp"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/notifications"
	"github.com/nhost/nhost/services/auth/go/notifications/postmark"
	"github.com/nhost/nhost/services/auth/go/notifications/sms"
	"github.com/nhost/nhost/services/auth/go/sql"
	"github.com/urfave/cli/v3"
)

// providerTimeoutDefault matches the timeout the legacy Modica client used and
// is a reasonable upper bound for the Twilio Messages API.
const providerTimeoutDefault = 30 * time.Second

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

	switch provider {
	case "modica":
		return getModicaSMS(cmd, templates, db, logger)
	case "twilio":
		return getTwilioSMS(cmd, templates, db, logger)
	case "generic":
		return getGenericSMS(cmd, templates, db, logger)
	case "dev":
		return sms.NewDev(templates, db, logger), nil
	default:
		return nil, fmt.Errorf("unsupported SMS provider: %s", provider) //nolint:err113
	}
}

// getTwilioSMS configures the generic SMS provider for Twilio's Messages API.
// Twilio Verification Services (Messaging Service SIDs starting with "VA")
// are no longer supported — operators must switch to a Messaging Service or
// a From phone number.
func getTwilioSMS( //nolint:ireturn
	cmd *cli.Command,
	templates *notifications.Templates,
	db *sql.Queries,
	logger *slog.Logger,
) (controller.SMSer, error) {
	accountSid := cmd.String(flagSMSTwilioAccountSid)
	authToken := cmd.String(flagSMSTwilioAuthToken)
	messagingServiceID := cmd.String(flagSMSTwilioMessagingServiceID)

	if accountSid == "" || authToken == "" || messagingServiceID == "" {
		return nil, errors.New("SMS is enabled but Twilio credentials are missing") //nolint:err113
	}

	if strings.HasPrefix(messagingServiceID, "VA") {
		return nil, errors.New( //nolint:err113
			`twilio Verification Services (Messaging Service SID starting with "VA") ` +
				"are no longer supported; use a Messaging Service SID (MG...) or a " +
				"From phone number instead",
		)
	}

	if templates == nil {
		var err error

		templates, err = getTemplates(cmd, logger)
		if err != nil {
			return nil, fmt.Errorf("problem creating templates: %w", err)
		}
	}

	url := fmt.Sprintf(
		"https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json", accountSid,
	)

	bodyTemplate, err := jsonBodyTemplate(map[string]string{
		"To":   "${to}",
		"Body": "${body}",
		"From": messagingServiceID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to build Twilio body template: %w", err)
	}

	headers := map[string]string{
		"Authorization": "Basic " + basicAuth(accountSid, authToken),
	}

	provider, err := sms.NewGenericSMSProvider(
		url,
		"application/x-www-form-urlencoded",
		bodyTemplate,
		headers,
		providerTimeoutDefault,
		templates,
		db,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create Twilio SMS provider: %w", err)
	}

	return provider, nil
}

// getModicaSMS configures the generic SMS provider for Modica's REST API.
func getModicaSMS( //nolint:ireturn
	cmd *cli.Command,
	templates *notifications.Templates,
	db *sql.Queries,
	logger *slog.Logger,
) (controller.SMSer, error) {
	username := cmd.String(flagSMSModicaUsername)
	password := cmd.String(flagSMSModicaPassword)

	if username == "" || password == "" {
		return nil, errors.New("SMS is enabled but Modica credentials are missing") //nolint:err113
	}

	if templates == nil {
		var err error

		templates, err = getTemplates(cmd, logger)
		if err != nil {
			return nil, fmt.Errorf("problem creating templates: %w", err)
		}
	}

	bodyTemplate, err := jsonBodyTemplate(map[string]string{
		"destination": "${to}",
		"content":     "${body}",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to build Modica body template: %w", err)
	}

	headers := map[string]string{
		"Authorization": "Basic " + basicAuth(username, password),
	}

	provider, err := sms.NewGenericSMSProvider(
		"https://api.modicagroup.com/rest/sms/v2/messages",
		"application/json",
		bodyTemplate,
		headers,
		providerTimeoutDefault,
		templates,
		db,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create Modica SMS provider: %w", err)
	}

	return provider, nil
}

func basicAuth(username, password string) string {
	return base64.StdEncoding.EncodeToString([]byte(username + ":" + password))
}

// jsonBodyTemplate marshals fields into a JSON object suitable as a generic
// SMS body template. ${to}/${body} placeholders survive marshalling unchanged
// while static values (e.g. a Messaging Service SID) are properly escaped.
func jsonBodyTemplate(fields map[string]string) (string, error) {
	b, err := json.Marshal(fields)
	if err != nil {
		return "", fmt.Errorf("marshal body template: %w", err)
	}

	return string(b), nil
}

func getGenericSMS( //nolint:ireturn
	cmd *cli.Command,
	templates *notifications.Templates,
	db *sql.Queries,
	logger *slog.Logger,
) (controller.SMSer, error) {
	if templates == nil {
		var err error

		templates, err = getTemplates(cmd, logger)
		if err != nil {
			return nil, fmt.Errorf("problem creating templates: %w", err)
		}
	}

	headers := make(map[string]string)

	headersJSON := cmd.String(flagSMSGenericHeaders)
	if headersJSON != "" {
		if err := json.Unmarshal([]byte(headersJSON), &headers); err != nil {
			return nil, fmt.Errorf("failed to parse generic SMS headers: %w", err)
		}
	}

	provider, err := sms.NewGenericSMSProvider(
		cmd.String(flagSMSGenericURL),
		cmd.String(flagSMSGenericContentType),
		cmd.String(flagSMSGenericBodyTemplate),
		headers,
		cmd.Duration(flagSMSGenericTimeout),
		templates,
		db,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create generic SMS provider: %w", err)
	}

	return provider, nil
}
