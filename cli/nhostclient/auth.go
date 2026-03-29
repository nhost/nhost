package nhostclient

import (
	"context"
	"fmt"
	"io"
	"net/http"
)

type LoginPATRequest struct {
	PersonalAccessToken string `json:"personalAccessToken"`
}

type LoginPATResponse struct {
	Session struct {
		AccessToken          string `json:"accessToken"`
		AccessTokenExpiresIn int64  `json:"accessTokenExpiresIn"`
	} `json:"session"`
}

func (n *Client) LoginPAT(ctx context.Context, pat string) (LoginPATResponse, error) {
	var resp LoginPATResponse
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
		return LoginPATResponse{}, fmt.Errorf("failed to login with PAT: %w", err)
	}

	return resp, nil
}
