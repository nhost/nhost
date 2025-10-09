package providers

import (
	"encoding/json"
	"fmt"

	"github.com/golang-jwt/jwt/v5"
	"github.com/nhost/nhost/services/auth/go/api"
)

type State struct {
	Connect *string
	Options *api.SignUpOptions
}

func (s *State) Encode() jwt.MapClaims {
	return jwt.MapClaims{
		"connect": s.Connect,
		"options": s.Options,
	}
}

func (s *State) Decode(claims any) error {
	b, err := json.Marshal(claims)
	if err != nil {
		return fmt.Errorf("failed to marshal claims: %w", err)
	}

	if err := json.Unmarshal(b, s); err != nil {
		return fmt.Errorf("failed to unmarshal claims: %w", err)
	}

	return nil
}
