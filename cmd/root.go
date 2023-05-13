package cmd

import (
	"errors"
	"fmt"
	"log"
	"os"

	"github.com/Yamashou/gqlgenc/clientv2"
	v2cmd "github.com/nhost/cli/v2/cmd"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

const (
	ErrNotLoggedIn = "Please login with `nhost login`"
	ErrLoggedIn    = "You are already logged in, first logout with `nhost logout`"
)

var (
	Version string
	rootCmd = &cobra.Command{ //nolint:exhaustruct,gochecknoglobals
		Use:           "nhost",
		Short:         "Nhost: The Open Source Firebase Alternative with GraphQL",
		SilenceUsage:  true,
		SilenceErrors: true,
		Long: fmt.Sprintf(`
      _   ____               __
     / | / / /_  ____  _____/ /_
    /  |/ / __ \/ __ \/ ___/ __/
   / /|  / / / / /_/ (__  ) /_
  /_/ |_/_/ /_/\____/____/\__/


  Nhost: The Open Source Firebase Alternative with GraphQL.
  Version - %s
  Documentation - https://docs.nhost.io
  `, Version),
	}
)

// Initialize common constants and variables used by multiple commands
// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	err := rootCmd.Execute()

	var graphqlErr *clientv2.ErrorResponse

	switch {
	case errors.As(err, &graphqlErr):
		log.Fatal(graphqlErr.GqlErrors)
	case err != nil:
		log.Fatal(err)
	}
}

func init() { //nolint:gochecknoinits
	// rootCmd.PersistentFlags().StringVar(&nhost.DOMAIN, flagDomain, "nhost.run", "Auth domain - for internal testing")

	viper.SetDefault("author", "Nhost Team")
	viper.SetDefault("license", "MIT")

	path, _ := os.Getwd()
	rootCmd.PersistentFlags().
		StringVar(&path, "path", path, "Current working directory to execute CLI in")

	v2cmd.Register(rootCmd)
}
