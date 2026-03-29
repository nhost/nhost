package nhostclient

import (
	"context"

	"golang.org/x/oauth2"
)

// RotatingTokenSource wraps an oauth2.Config and always uses the latest
// refresh token for each refresh call, since the server rotates them.
type RotatingTokenSource struct {
	cfg          *oauth2.Config
	RefreshToken string
}

func NewRotatingTokenSource(
	tokenEndpoint string,
	clientID string,
	refreshToken string,
) *RotatingTokenSource {
	return &RotatingTokenSource{
		cfg: &oauth2.Config{ //nolint:exhaustruct
			ClientID: clientID,
			Endpoint: oauth2.Endpoint{ //nolint:exhaustruct
				TokenURL:  tokenEndpoint,
				AuthStyle: oauth2.AuthStyleInParams,
			},
		},
		RefreshToken: refreshToken,
	}
}

func (s *RotatingTokenSource) Token() (*oauth2.Token, error) {
	token := &oauth2.Token{ //nolint:exhaustruct
		RefreshToken: s.RefreshToken,
	}

	fresh, err := s.cfg.TokenSource(context.Background(), token).Token()
	if err != nil {
		return nil, err //nolint:wrapcheck
	}

	if fresh.RefreshToken != "" {
		s.RefreshToken = fresh.RefreshToken
	}

	return fresh, nil
}
