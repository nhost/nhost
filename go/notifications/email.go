package notifications

import (
	"bytes"
	"context"
	"fmt"
	"net/smtp"
	"strings"
	"time"
)

type Email struct {
	from             string
	host             string
	port             uint16
	useTLSConnection bool
	extraHeaders     map[string]string
	auth             smtp.Auth
	templates        *Templates
}

func NewEmail(
	host string,
	port uint16,
	useTLSConnection bool,
	auth smtp.Auth,
	from string,
	extraHeaders map[string]string,
	templates *Templates,
) *Email {
	return &Email{
		from:             from,
		host:             host,
		port:             port,
		useTLSConnection: useTLSConnection,
		extraHeaders:     extraHeaders,
		auth:             auth,
		templates:        templates,
	}
}

func sanitize(s string) string {
	return strings.Map(func(r rune) rune {
		switch r {
		case '\n', '\r':
			return -1
		default:
			return r
		}
	}, s)
}

func (sm *Email) Send(to, subject, contents string, headers map[string]string) error {
	buf := new(bytes.Buffer)
	for k, v := range sm.extraHeaders {
		fmt.Fprintf(buf, "%s: %s\r\n", k, v)
	}
	for k, v := range headers {
		fmt.Fprintf(buf, "%s: %s\r\n", k, v)
	}
	buf.WriteString("From: " + sm.from + "\r\n")
	buf.WriteString("To: " + sanitize(to) + "\r\n")
	buf.WriteString("Date: " + time.Now().Format(time.RFC1123Z) + "\r\n")
	buf.WriteString("Subject: " + sanitize(subject) + "\r\n")
	buf.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	buf.WriteString("\r\n")
	buf.WriteString(contents + "\r\n")

	if err := sendMail(
		sm.host,
		sm.port,
		sm.useTLSConnection,
		sm.auth,
		sm.from,
		[]string{to},
		buf.Bytes(),
	); err != nil {
		return fmt.Errorf("error sending email: %w", err)
	}
	return nil
}

func (sm *Email) SendEmail(
	_ context.Context, to string, locale string, templateName TemplateName, data TemplateData,
) error {
	body, subject, err := sm.templates.Render(locale, templateName, data)
	if err != nil {
		return fmt.Errorf("error rendering email template: %w", err)
	}

	headers := map[string]string{
		"X-Ticket":         data.Ticket,
		"X-Redirect-To":    data.RedirectTo,
		"X-Email-Template": string(templateName),
		"X-Link":           data.Link,
	}

	if err := sm.Send(to, subject, body, headers); err != nil {
		return fmt.Errorf("error sending email: %w", err)
	}

	return nil
}
