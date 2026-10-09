package project

import (
	"encoding/json"
	"fmt"
	"os"
	"slices"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/clienv"
)

// localOverlaySubdomain is the overlay `nhost up` applies, and no deployed
// project reads.
const localOverlaySubdomain = "local"

// allowRedirects adds urls to the redirect targets the auth service accepts,
// as a configure function for InitConfigAndSecrets. With no urls it changes
// nothing.
func allowRedirects(urls []string) func(*model.ConfigConfig) {
	return func(cfg *model.ConfigConfig) {
		if len(urls) == 0 {
			return
		}

		if cfg.Auth == nil {
			cfg.Auth = &model.ConfigAuth{} //nolint:exhaustruct // external type
		}

		if cfg.Auth.Redirections == nil {
			cfg.Auth.Redirections = &model.ConfigAuthRedirections{} //nolint:exhaustruct // external type
		}

		for _, u := range urls {
			if !slices.Contains(cfg.Auth.Redirections.AllowedUrls, u) {
				cfg.Auth.Redirections.AllowedUrls = append(cfg.Auth.Redirections.AllowedUrls, u)
			}
		}
	}
}

// jsonPatchOp is one RFC 6902 operation, the format an overlay is written in.
type jsonPatchOp struct {
	Op    string `json:"op"`
	Path  string `json:"path"`
	Value string `json:"value"`
}

// writeLocalRedirects allows urls on the local backend alone, by appending them
// in the overlay rather than writing them into nhost.toml. Appending keeps a
// change to the list in nhost.toml in effect locally too. The overlay needs
// that list to exist, which allowRedirects sees to for any template with
// local entries. It writes nothing when there are no urls.
func writeLocalRedirects(ps *clienv.PathStructure, urls []string) error {
	if len(urls) == 0 {
		return nil
	}

	ops := make([]jsonPatchOp, 0, len(urls))
	for _, u := range urls {
		ops = append(ops, jsonPatchOp{
			Op:    "add",
			Path:  "/auth/redirections/allowedUrls/-",
			Value: u,
		})
	}

	b, err := json.MarshalIndent(ops, "", "  ")
	if err != nil {
		return fmt.Errorf("encoding the local overlay: %w", err)
	}

	if err := os.MkdirAll(ps.OverlaysFolder(), 0o755); err != nil { //nolint:mnd
		return fmt.Errorf("creating %s: %w", ps.OverlaysFolder(), err)
	}

	dst := ps.Overlay(localOverlaySubdomain)
	if err := os.WriteFile(dst, append(b, '\n'), 0o600); err != nil { //nolint:mnd
		return fmt.Errorf("writing %s: %w", dst, err)
	}

	return nil
}

// missingRedirects are the urls cfg does not allow. A nil cfg, one that could
// not be read, is missing all of them.
func missingRedirects(urls []string, cfg *model.ConfigConfig) []string {
	allowed := cfg.GetAuth().GetRedirections().GetAllowedUrls()

	missing := make([]string, 0, len(urls))

	for _, u := range urls {
		if !slices.Contains(allowed, u) {
			missing = append(missing, u)
		}
	}

	return missing
}
