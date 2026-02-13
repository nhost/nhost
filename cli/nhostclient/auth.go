package nhostclient

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/nhost/nhost/cli/nhostclient/credentials"
	"github.com/nhost/nhost/cli/nhostclient/graphql"
)

const (
	PATDuration = 90 * 24 * time.Hour
)

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (n *Client) Login(ctx context.Context, email, password string) (credentials.Session, error) {
	var resp credentials.Session
	if err := MakeJSONRequest(
		ctx,
		n.client,
		fmt.Sprintf("%s%s", n.baseURL, "/signin/email-password"),
		http.MethodPost,
		LoginRequest{
			Email:    email,
			Password: password,
		},
		http.Header{},
		&resp,
		func(resp *http.Response) error {
			if resp.StatusCode != http.StatusOK {
				b, _ := io.ReadAll(resp.Body)

				var reqErr *RequestError

				_ = json.Unmarshal(b, &reqErr)

				return reqErr
			}

			return nil
		},
		n.retryer,
	); err != nil {
		return credentials.Session{}, fmt.Errorf("failed to login: %w", err)
	}

	return resp, nil
}

type VerifyEmailRequest struct {
	Email string `json:"email"`
}

func (n *Client) VerifyEmail(ctx context.Context, email string) error {
	var resp any
	if err := MakeJSONRequest(
		ctx,
		n.client,
		fmt.Sprintf("%s%s", n.baseURL, "/user/email/send-verification-email"),
		http.MethodPost,
		VerifyEmailRequest{
			Email: email,
		},
		http.Header{},
		&resp,
		func(resp *http.Response) error {
			if resp.StatusCode != http.StatusOK {
				b, _ := io.ReadAll(resp.Body)

				var reqErr *RequestError

				_ = json.Unmarshal(b, &reqErr)

				return reqErr
			}

			return nil
		},
		n.retryer,
	); err != nil {
		return fmt.Errorf("failed to login: %w", err)
	}

	return nil
}

type LoginPATRequest struct {
	PersonalAccessToken string `json:"personalAccessToken"`
}

func (n *Client) LoginPAT(ctx context.Context, pat string) (credentials.Session, error) {
	var resp credentials.Session
	if err := MakeJSONRequest(
		ctx,
		n.client,
		fmt.Sprintf("%s%s", n.baseURL, "/signin/pat"),
		http.MethodPost,
		LoginPATRequest{
			PersonalAccessToken: pat,
		},
		http.Header{},
		&resp,
		func(resp *http.Response) error {
			if resp.StatusCode != http.StatusOK {
				b, _ := io.ReadAll(resp.Body)

				return fmt.Errorf( //nolint:err113
					"unexpected status code: %d, message: %s",
					resp.StatusCode,
					string(b),
				)
			}

			return nil
		},
		n.retryer,
	); err != nil {
		return credentials.Session{}, fmt.Errorf("failed to login: %w", err)
	}

	return resp, nil
}

type CreatePATRequest struct {
	ExpiresAt time.Time      `json:"expiresAt"`
	Metadata  map[string]any `json:"metadata"`
}

func (n *Client) CreatePAT(
	ctx context.Context,
	accessToken string,
) (credentials.Credentials, error) {
	var resp credentials.Credentials
	if err := MakeJSONRequest(
		ctx,
		n.client,
		fmt.Sprintf("%s%s", n.baseURL, "/pat"),
		http.MethodPost,
		CreatePATRequest{
			ExpiresAt: time.Now().Add(PATDuration),
			Metadata: map[string]any{
				"application": "nhost-cli",
			},
		},
		http.Header{
			"Authorization": []string{"Bearer " + accessToken},
		},
		&resp,
		func(resp *http.Response) error {
			if resp.StatusCode != http.StatusOK {
				b, _ := io.ReadAll(resp.Body)

				return fmt.Errorf( //nolint:err113
					"unexpected status code: %d, message: %s",
					resp.StatusCode,
					string(b),
				)
			}

			return nil
		},
		n.retryer,
	); err != nil {
		return credentials.Credentials{}, fmt.Errorf("failed to create PAT: %w", err)
	}

	return resp, nil
}

func (n *Client) Logout(ctx context.Context, refreshTokenID string, accessToken string) error {
	if _, err := n.DeleteRefreshToken(
		ctx,
		//nolint:exhaustruct
		graphql.AuthRefreshTokensBoolExp{
			ID: &graphql.UUIDComparisonExp{
				Eq: &refreshTokenID,
			},
		},
		graphql.WithAccessToken(accessToken),
	); err != nil {
		return fmt.Errorf("failed to delete refresh token: %w", err)
	}

	return nil
}

type RefreshTokenRequest struct {
	RefreshToken string `json:"refreshToken"`
}

type RefreshTokenResponse struct {
	AccessToken string `json:"accessToken"`
}

func (n *Client) RefreshToken(
	ctx context.Context,
	refreshToken string,
) (RefreshTokenResponse, error) {
	var resp RefreshTokenResponse
	if err := MakeJSONRequest(
		ctx,
		n.client,
		fmt.Sprintf("%s%s", n.baseURL, "/token"),
		http.MethodPost,
		RefreshTokenRequest{
			RefreshToken: refreshToken,
		},
		http.Header{},
		&resp,
		func(resp *http.Response) error {
			if resp.StatusCode != http.StatusOK {
				b, _ := io.ReadAll(resp.Body)

				return fmt.Errorf( //nolint:err113
					"unexpected status code: %d, message: %s",
					resp.StatusCode,
					string(b),
				)
			}

			return nil
		},
		n.retryer,
	); err != nil {
		return RefreshTokenResponse{}, fmt.Errorf("failed to refresh session: %w", err)
	}

	return resp, nil
}
