package sms

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/nhost/nhost/services/auth/go/notifications"
)

const (
	modicaAPIURL         = "https://api.modicagroup.com/rest/sms/v2/messages"
	clientTimeoutSeconds = 30
	maxIdleConns         = 10
	idleTimeoutSeconds   = 30
	tlsTimeoutSeconds    = 10
)

var (
	ErrInvalidPhoneFormat = errors.New(
		"phone number must be in international format (e.g., +64211234567)",
	)
	ErrEmptyMessage = errors.New("message content cannot be empty")
	ErrSMSAPIError  = errors.New("SMS API error")
)

type ModicaSMS struct {
	client   *http.Client
	username string
	password string
}

type modicaSMSRequest struct {
	Destination string `json:"destination"`
	Content     string `json:"content"`
}

func NewModicaSMS(
	templates *notifications.Templates,
	username string, password string,
	db DB,
) *SMS {
	client := &http.Client{ //nolint:exhaustruct
		Timeout: clientTimeoutSeconds * time.Second,
		Transport: &http.Transport{ //nolint:exhaustruct
			MaxIdleConns:        maxIdleConns,
			IdleConnTimeout:     idleTimeoutSeconds * time.Second,
			DisableCompression:  false,
			TLSHandshakeTimeout: tlsTimeoutSeconds * time.Second,
		},
	}

	return NewSMS(
		&ModicaSMS{
			client:   client,
			username: username,
			password: password,
		},
		templates,
		db,
	)
}

func (s *ModicaSMS) SendSMS(to string, body string) error {
	// Validate inputs according to Modica API requirements
	if !strings.HasPrefix(to, "+") {
		return ErrInvalidPhoneFormat
	}

	if len(body) == 0 {
		return ErrEmptyMessage
	}

	reqBody := modicaSMSRequest{
		Destination: to,
		Content:     body,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(
		context.Background(),
		http.MethodPost,
		modicaAPIURL,
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Basic "+s.basicAuth())

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusAccepted {
		bodyBytes, _ := io.ReadAll(resp.Body)

		return fmt.Errorf("%w: HTTP %d: %s", ErrSMSAPIError, resp.StatusCode, string(bodyBytes))
	}

	return nil
}

func (s *ModicaSMS) basicAuth() string {
	auth := s.username + ":" + s.password
	return base64.StdEncoding.EncodeToString([]byte(auth))
}
