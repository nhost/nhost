package graph

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/nhost/be/services/mimir/model"
)

var errNullOIDCProvider = errors.New("auth.method.oidc entries must be objects")

func (r *mutationResolver) replaceConfigRawJSON(
	ctx context.Context, appID string, rawJSON string,
) (string, error) {
	var config model.ConfigConfigInsertInput

	dec := json.NewDecoder(strings.NewReader(rawJSON))
	dec.DisallowUnknownFields()

	if err := dec.Decode(&config); err != nil {
		return "", fmt.Errorf("failed to decode raw JSON: %w", err)
	}

	if slices.Contains(config.GetAuth().GetMethod().GetOidc(), nil) {
		return "", errNullOIDCProvider
	}

	cfg, err := r.replaceConfig(ctx, appID, config)
	if err != nil {
		return "", err
	}

	if cfg == nil {
		return "{}", nil
	}

	b, err := json.Marshal(cfg)
	if err != nil {
		return "{}", fmt.Errorf("failed to marshal config: %w", err)
	}

	return string(b), nil
}
