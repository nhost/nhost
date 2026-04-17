package providers

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/golang-jwt/jwt/v5"
	"github.com/nhost/nhost/services/auth/go/api"
)

// ErrInvalidFlow is returned by State.Decode when the state JWT carries a
// flow claim that is not one of the allowed values.
var ErrInvalidFlow = errors.New("invalid flow claim in state")

// Flow values for the OAuth state JWT. The provider callback uses this claim
// to decide whether to apply signin or signup behaviour, and rejects any
// other value. Binding the intent into the signed claims prevents a state
// token issued for one flow from being interpreted as the other.
const (
	FlowSignin = "signin"
	FlowSignup = "signup"
)

type State struct {
	Connect       *string
	Options       *api.SignUpOptions
	State         *string
	Flow          string
	CodeChallenge *string
}

func (s *State) Encode() jwt.MapClaims {
	return jwt.MapClaims{
		"connect":       s.Connect,
		"options":       s.Options,
		"state":         s.State,
		"flow":          s.Flow,
		"codeChallenge": s.CodeChallenge,
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

	switch s.Flow {
	case FlowSignin, FlowSignup:
	default:
		return fmt.Errorf("%w: %q", ErrInvalidFlow, s.Flow)
	}

	return nil
}
