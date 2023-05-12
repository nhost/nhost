package cmd

import (
	"github.com/nhost/cli/v2/controller"
	"github.com/nhost/cli/v2/nhostclient"
	"github.com/spf13/cobra"
)

func listCmd() *cobra.Command {
	return &cobra.Command{ //nolint:exhaustruct
		Use:        "list",
		Aliases:    []string{"ls"},
		SuggestFor: []string{"init"},
		Short:      "List remote apps",
		Long: `Fetch the list of remote personal and team apps
for the logged in user from Nhost console.`,
		RunE: func(cmd *cobra.Command, _ []string) error {
			cl := nhostclient.New(cmd.Flag(flagDomain).Value.String())
			return controller.List(cmd.Context(), cmd, cl) //nolint:wrapcheck
		},
	}
}
