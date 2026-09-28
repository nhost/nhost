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
)

// providerTimeoutDefault matches the timeout the legacy Modica client used and
// is a reasonable upper bound for the Twilio Messages API.
const providerTimeoutDefault = 30 * time.Second

func getSMTPEmailer(
	opts Options,
	templates *notifications.Templates,
) (*notifications.Email, error) {
	headers := make(map[string]string)
	if opts.SMTP.APIHeader != "" {
		headers["X-SMTPAPI"] = opts.SMTP.APIHeader
	}

	host := opts.SMTP.Host
	user := opts.SMTP.User
	password := opts.SMTP.Password

	var auth smtp.Auth

	switch opts.SMTP.AuthMethod {
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
		opts.SMTP.Host,
		opts.SMTP.Port,
		opts.SMTP.Secure,
		auth,
		opts.SMTP.Sender,
		headers,
		templates,
	), nil
}

func getTemplates(opts Options, logger *slog.Logger) (*notifications.Templates, error) {
	var templatesPath string
	for _, p := range []string{
		opts.EmailTemplatesPath,
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
		opts.DefaultLocale,
		logger.With(slog.String("component", "mailer")),
	)
	if err != nil {
		return nil, fmt.Errorf("problem creating templates: %w", err)
	}

	return templates, nil
}

func getEmailer( //nolint:ireturn
	opts Options,
	logger *slog.Logger,
) (controller.Emailer, *notifications.Templates, error) {
	if opts.SMTP.Host == "postmark" {
		return postmark.New(opts.SMTP.Sender, opts.SMTP.Password), nil, nil
	}

	templates, err := getTemplates(opts, logger)
	if err != nil {
		return nil, nil, fmt.Errorf("problem creating templates: %w", err)
	}

	emailer, err := getSMTPEmailer(opts, templates)

	return emailer, templates, err
}

func getSMS( //nolint:ireturn
	opts Options,
	templates *notifications.Templates,
	db *sql.Queries,
	logger *slog.Logger,
) (controller.SMSer, error) {
	if !opts.SMS.PasswordlessEnabled {
		return nil, nil //nolint:nilnil // SMS disabled, return nil client
	}

	provider := strings.ToLower(opts.SMS.Provider)
	if provider == "" {
		provider = "twilio" // Default to Twilio for backward compatibility
	}

	switch provider {
	case "modica":
		return getModicaSMS(opts, templates, db, logger)
	case "twilio":
		return getTwilioSMS(opts, templates, db, logger)
	case "generic":
		return getGenericSMS(opts, templates, db, logger)
	case "dev":
		return sms.NewDev(templates, db, opts.SMS.DevOutputDir, logger), nil
	default:
		return nil, fmt.Errorf("unsupported SMS provider: %s", provider) //nolint:err113
	}
}

// getTwilioSMS configures the generic SMS provider for Twilio's Messages API.
// Twilio Verification Services (Messaging Service SIDs starting with "VA")
// are no longer supported — operators must switch to a Messaging Service or
// a From phone number.
func getTwilioSMS( //nolint:ireturn
	opts Options,
	templates *notifications.Templates,
	db *sql.Queries,
	logger *slog.Logger,
) (controller.SMSer, error) {
	accountSid := opts.SMS.Twilio.AccountSID
	authToken := opts.SMS.Twilio.AuthToken
	messagingServiceID := opts.SMS.Twilio.MessagingServiceID

	if accountSid == "" || authToken == "" || messagingServiceID == "" {
		return nil, errors.New("SMS is enabled but Twilio credentials are missing") //nolint:err113
	}

	if strings.HasPrefix(accountSid, "VA") {
		return nil, errors.New( //nolint:err113
			"twilio Verify is no longer supported: AUTH_SMS_TWILIO_ACCOUNT_SID must be a Twilio Account SID (starts with 'AC'), not a Verify Service SID (starts with 'VA'). Use a Twilio Messaging Service SID (starts with 'MG') or a Twilio phone number for AUTH_SMS_TWILIO_MESSAGING_SERVICE_ID instead", //nolint:lll
		)
	}

	if strings.HasPrefix(messagingServiceID, "VA") {
		return nil, errors.New( //nolint:err113
			`twilio Verification Services (Messaging Service SID starting with "VA") ` +
				"are not supported; use a Messaging Service SID (MG...) or a " +
				"From phone number instead",
		)
	}

	if templates == nil {
		var err error

		templates, err = getTemplates(opts, logger)
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
	opts Options,
	templates *notifications.Templates,
	db *sql.Queries,
	logger *slog.Logger,
) (controller.SMSer, error) {
	username := opts.SMS.Modica.Username
	password := opts.SMS.Modica.Password

	if username == "" || password == "" {
		return nil, errors.New("SMS is enabled but Modica credentials are missing") //nolint:err113
	}

	if templates == nil {
		var err error

		templates, err = getTemplates(opts, logger)
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
	opts Options,
	templates *notifications.Templates,
	db *sql.Queries,
	logger *slog.Logger,
) (controller.SMSer, error) {
	if templates == nil {
		var err error

		templates, err = getTemplates(opts, logger)
		if err != nil {
			return nil, fmt.Errorf("problem creating templates: %w", err)
		}
	}

	headers := make(map[string]string)

	headersJSON := opts.SMS.Generic.Headers
	if headersJSON != "" {
		if err := json.Unmarshal([]byte(headersJSON), &headers); err != nil {
			return nil, fmt.Errorf("failed to parse generic SMS headers: %w", err)
		}
	}

	provider, err := sms.NewGenericSMSProvider(
		opts.SMS.Generic.URL,
		opts.SMS.Generic.ContentType,
		opts.SMS.Generic.BodyTemplate,
		headers,
		opts.SMS.Generic.Timeout,
		templates,
		db,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create generic SMS provider: %w", err)
	}

	return provider, nil
}
