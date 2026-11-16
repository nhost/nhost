package providers

import (
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/nhost/nhost/services/auth/go/api"
	"golang.org/x/oauth2"
)

// ErrReservedUpstreamParam is returned when upstreamParams contains a reserved
// OAuth2/OIDC parameter that the auth server controls.
var ErrReservedUpstreamParam = errors.New("reserved upstream parameter")

// reservedUpstreamParams are parameters the auth server owns; letting a caller
// override them via upstreamParams would allow hijacking the flow.
//
//nolint:gochecknoglobals
var reservedUpstreamParams = map[string]struct{}{
	"client_id":             {},
	"client_secret":         {},
	"redirect_uri":          {},
	"response_type":         {},
	"scope":                 {},
	"state":                 {},
	"code":                  {},
	"code_challenge":        {},
	"code_challenge_method": {},
	"nonce":                 {},
}

// UpstreamParamsToOpts converts upstreamParams into oauth2 auth-code options,
// rejecting reserved parameters. Options are ordered by key for determinism.
func UpstreamParamsToOpts(
	upstreamParams *api.UpstreamAuthParams,
) ([]oauth2.AuthCodeOption, error) {
	if upstreamParams == nil {
		return nil, nil
	}

	keys := make([]string, 0, len(*upstreamParams))
	for key := range *upstreamParams {
		keys = append(keys, key)
	}

	slices.Sort(keys)

	opts := make([]oauth2.AuthCodeOption, 0, len(keys))
	for _, key := range keys {
		if _, reserved := reservedUpstreamParams[strings.ToLower(key)]; reserved {
			return nil, fmt.Errorf("%w: %q", ErrReservedUpstreamParam, key)
		}

		opts = append(opts, oauth2.SetAuthURLParam(key, (*upstreamParams)[key]))
	}

	return opts, nil
}
