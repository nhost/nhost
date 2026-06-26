package create

import (
	"context"
	"fmt"

	"github.com/nhost/nhost/cli/clienv"
)

func fetchTemplate(
	_ context.Context,
	_ *clienv.CliEnv,
	repo string,
	ref string,
	tmpl Template,
	_ string,
) error {
	return fmt.Errorf( //nolint:err113
		"fetching template %q from %s at %s requires git template fetching; use --template-path for local templates",
		tmpl.Name,
		repo,
		ref,
	)
}
