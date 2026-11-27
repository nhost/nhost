package graph

import (
	"fmt"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/schema/appconfig"
)

// Option configures optional Resolver behaviour.
type Option func(*Resolver)

// WithMinVersions refuses new apps and version changes below a minimum. Without
// it, versions aren't checked, which is what the CLI's local config server wants.
func WithMinVersions(rules []appconfig.MinVersion) Option {
	return func(r *Resolver) {
		r.minVersions = rules
	}
}

// verifyMinVersions checks newApp against the minimum versions. oldApp is nil
// when the app is being created.
func (r *mutationResolver) verifyMinVersions(oldApp, newApp *App) error {
	if len(r.minVersions) == 0 {
		return nil
	}

	newConfig, err := newApp.ResolveConfig(r.schema, false)
	if err != nil {
		return fmt.Errorf("failed to resolve new app config: %w", err)
	}

	var oldConfig *model.ConfigConfig
	if oldApp != nil {
		oldConfig, err = oldApp.ResolveConfig(r.schema, false)
		if err != nil {
			return fmt.Errorf("failed to resolve old app config: %w", err)
		}
	}

	if err := appconfig.CheckMinVersions(r.minVersions, oldConfig, newConfig); err != nil {
		return fmt.Errorf("unsupported version: %w", err)
	}

	return nil
}
