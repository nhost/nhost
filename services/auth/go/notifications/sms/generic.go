package sms

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/nhost/nhost/services/auth/go/notifications"
	"github.com/valyala/fasttemplate"
)

const (
	contentTypeFormURLEncoded = "application/x-www-form-urlencoded"
	contentTypeJSON           = "application/json"
	maxErrorBodySize          = 4 * 1024
	httpStatusErrorThreshold  = 400
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
	mediaType, _, err := mime.ParseMediaType(s.contentType)
	if err != nil {
		return fmt.Errorf("invalid content type %q: %w", s.contentType, err)
	}

	renderedBody, err := s.renderBody(mediaType, to, body)
	if err != nil {
		return err
	}

	bodyReader, err := encodeBody(mediaType, renderedBody)
	if err != nil {
		return err
	}

	return s.sendRequest(bodyReader)
}

// renderBody substitutes the to/body template variables, JSON-escaping them
// first when the rendered output must be valid JSON.
func (s *GenericSMS) renderBody(mediaType, to, body string) (string, error) {
	toValue, bodyValue := to, body

	if mediaType == contentTypeJSON || mediaType == contentTypeFormURLEncoded {
		escapedTo, err := jsonStringEscape(to)
		if err != nil {
			return "", fmt.Errorf("failed to json-escape to: %w", err)
		}

		escapedBody, err := jsonStringEscape(body)
		if err != nil {
			return "", fmt.Errorf("failed to json-escape body: %w", err)
		}

		toValue, bodyValue = escapedTo, escapedBody
	}

	rendered, err := s.bodyTemplate.ExecuteFuncStringWithErr(
		func(w io.Writer, tag string) (int, error) {
			switch strings.TrimSpace(tag) {
			case "to":
				return w.Write([]byte(toValue))
			case "body":
				return w.Write([]byte(bodyValue))
			default:
				return 0, fmt.Errorf("unknown template variable %q", tag) //nolint:err113
			}
		},
	)
	if err != nil {
		return "", fmt.Errorf("failed to render body template: %w", err)
	}

	return rendered, nil
}

// encodeBody turns the rendered template into the wire payload for the chosen
// content type. For form-urlencoded the rendered body must be a JSON object
// whose fields become form values; for everything else the rendered bytes are
// sent verbatim.
func encodeBody(mediaType, renderedBody string) (io.Reader, error) {
	if mediaType != contentTypeFormURLEncoded {
		return strings.NewReader(renderedBody), nil
	}

	var data map[string]any
	if err := json.Unmarshal([]byte(renderedBody), &data); err != nil {
		return nil, fmt.Errorf(
			"body template must render to valid JSON when content type is %s: %w",
			contentTypeFormURLEncoded, err,
		)
	}

	values := url.Values{}
	for k, v := range data {
		values.Set(k, fmt.Sprint(v))
	}

	return strings.NewReader(values.Encode()), nil
}

func (s *GenericSMS) sendRequest(bodyReader io.Reader) error {
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

	if resp.StatusCode >= httpStatusErrorThreshold {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, maxErrorBodySize))

		return fmt.Errorf( //nolint:err113
			"generic sms provider returned status: %d: %s",
			resp.StatusCode, strings.TrimSpace(string(respBody)),
		)
	}

	return nil
}

// jsonStringEscape returns the JSON-escaped form of s, suitable for textual
// substitution into a JSON string literal (the surrounding quotes that
// json.Marshal adds are stripped — the template author supplies them).
func jsonStringEscape(s string) (string, error) {
	encoded, err := json.Marshal(s)
	if err != nil {
		return "", fmt.Errorf("json.Marshal: %w", err)
	}

	return string(encoded[1 : len(encoded)-1]), nil
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
