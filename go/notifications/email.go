package notifications

import (
	"bytes"
	"fmt"
	"net/smtp"
)

type Email struct {
	from         string
	address      string
	extraHeaders map[string]string
	auth         smtp.Auth
	templates    *Templates
}

func NewEmail(
	host string,
	port uint16,
	auth smtp.Auth,
	from string,
	extraHeaders map[string]string,
	templates *Templates,
) *Email {
	address := fmt.Sprintf("%s:%d", host, port)

	return &Email{
		from:         from,
		address:      address,
		extraHeaders: extraHeaders,
		auth:         auth,
		templates:    templates,
	}
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
	buf.WriteString("To: " + to + "\r\n")
	buf.WriteString("Subject: " + subject + "\r\n")
	buf.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	buf.WriteString("\r\n")
	buf.WriteString(contents + "\r\n")

	if err := smtp.SendMail(
		sm.address,
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
	to string, locale string, templateName TemplateName, data TemplateData,
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
