package graph

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/nhost/be/services/mimir/model"
)

func (r *mutationResolver) replaceConfigRawJSON(
	ctx context.Context, appID string, rawJSON string,
) (string, error) {
	var config model.ConfigConfigInsertInput

	dec := json.NewDecoder(strings.NewReader(rawJSON))
	dec.DisallowUnknownFields()

	if err := dec.Decode(&config); err != nil {
		return "", fmt.Errorf("failed to decode raw JSON: %w", err)
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
