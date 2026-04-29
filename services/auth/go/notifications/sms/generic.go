package sms

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/nhost/nhost/services/auth/go/notifications"
	"github.com/valyala/fasttemplate"
)

// GenericSMS is a generic SMS provider that sends requests to a configured webhook.
type GenericSMS struct {
	client       *http.Client
	url          string
	contentType  string
	headers      map[string]string
	bodyTemplate *fasttemplate.Template
}

// NewGenericSMS creates a new GenericSMS provider.
func NewGenericSMS(
	url, contentType, bodyTemplate string,
	headers map[string]string,
	timeout time.Duration,
) *GenericSMS {
	return &GenericSMS{
		client:       &http.Client{Timeout: timeout},
		url:          url,
		contentType:  contentType,
		headers:      headers,
		bodyTemplate: fasttemplate.New(bodyTemplate, "${", "}"),
	}
}

// SendSMS sends an SMS by rendering the body template and making a POST request.
func (s *GenericSMS) SendSMS(to, body string) error {
	// Support both "${to}" and "${ to }" formats
	renderData := map[string]any{
		"to":   to,
		"body": body,
		" to ":  to,
		" body ": body,
	}

	renderedBody := s.bodyTemplate.ExecuteString(renderData)

	var bodyReader io.Reader
	if s.contentType == "application/x-www-form-urlencoded" {
		var data map[string]any
		if err := json.Unmarshal([]byte(renderedBody), &data); err == nil {
			values := url.Values{}
			for k, v := range data {
				values.Set(k, fmt.Sprint(v))
			}
			bodyReader = strings.NewReader(values.Encode())
		} else {
			bodyReader = strings.NewReader(renderedBody)
		}
	} else {
		bodyReader = strings.NewReader(renderedBody)
	}

	req, err := http.NewRequestWithContext(
		context.Background(),
		http.MethodPost,
		s.url,
		bodyReader,
	)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", s.contentType)
	for k, v := range s.headers {
		req.Header.Set(k, v)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("generic sms provider returned status: %d", resp.StatusCode)
	}

	return nil
}

// NewGenericSMSProvider returns a new SMS instance configured with the GenericSMS backend.
func NewGenericSMSProvider(
	url, contentType, bodyTemplate string,
	headers map[string]string,
	timeout time.Duration,
	templates *notifications.Templates,
	db DB,
) *SMS {
	return NewSMS(
		NewGenericSMS(url, contentType, bodyTemplate, headers, timeout),
		templates,
		db,
	)
}
