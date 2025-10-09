package postmark

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/nhost/hasura-auth/go/notifications"
)

const url = "https://api.postmarkapp.com/email/withTemplate"

type Postmark struct {
	from        string
	serverToken string
	cl          *http.Client
}

func New(from string, serverToken string) *Postmark {
	return &Postmark{
		from:        from,
		serverToken: serverToken,
		cl:          &http.Client{}, //nolint:exhaustruct
	}
}

//nolint:tagliatelle
type SendWithTemplateRequest struct {
	TemplateAlias string `json:"TemplateAlias,omitempty"`
	TemplateModel any    `json:"TemplateModel"`
	From          string `json:"From"`
	To            string `json:"To"`
}

func (p *Postmark) request(
	ctx context.Context,
	requestBody any,
) error {
	b, err := json.Marshal(requestBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request body: %w", err)
	}

	body := io.NopCloser(bytes.NewReader(b))

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, body)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header = http.Header{
		"X-Postmark-Server-Token": []string{p.serverToken},
		"Content-Type":            []string{"application/json"},
	}

	resp, err := p.cl.Do(req)
	if err != nil {
		return fmt.Errorf("failed to make request: %w", err)
	}

	if resp.Header.Get("Content-Encoding") == "gzip" {
		reader, err := gzip.NewReader(resp.Body)
		if err != nil {
			return fmt.Errorf("failed to create gzip reader: %w", err)
		}
		defer reader.Close()

		resp.Body = reader
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)

		return fmt.Errorf( //nolint:err113
			"%s: %s", resp.Status, string(b),
		)
	}

	return nil
}

func (p *Postmark) SendEmail(
	ctx context.Context,
	to string,
	locale string,
	templateName notifications.TemplateName,
	data notifications.TemplateData,
) error {
	var templateModel any = data.ToMap(map[string]any{"locale": locale})

	template := fmt.Sprintf("%s.%s", locale, templateName)

	if err := p.request(ctx, SendWithTemplateRequest{
		TemplateAlias: template,
		TemplateModel: templateModel,
		From:          p.from,
		To:            to,
	}); err != nil {
		return fmt.Errorf("postmark: failed to send email with template `%s`: %w", template, err)
	}

	return nil
}
