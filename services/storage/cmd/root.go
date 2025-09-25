package cmd

import (
	"fmt"
	"os"
	"strings"

	"github.com/nhost/hasura-storage/controller"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

const (
	name       = "hasura-storage"
	debugFlag  = "debug"
	configFlag = "config"
)

var (
	cfgFile *string
	rootCmd = &cobra.Command{ //nolint:exhaustruct
		Use:        name,
		Aliases:    []string{},
		SuggestFor: []string{},
		Short:      "Hasura Storage utilizes hasura and s3 to build a cloud storage",
		Version:    controller.Version(),
	}
)

// Execute executes the root command.
func Execute() error {
	return rootCmd.Execute() //nolint: wrapcheck
}

func init() {
	cobra.OnInitialize(initConfig)

	cfgFile = rootCmd.PersistentFlags().StringP(configFlag, "c", "", "use this configuration file")
	addBoolFlag(rootCmd.PersistentFlags(), debugFlag, false, "enable debug messages")
}

func initConfig() {
	viper.AutomaticEnv()
	viper.SetEnvKeyReplacer(strings.NewReplacer("-", "_"))

	if *cfgFile != "" {
		// Use config file from the flag.
		viper.SetConfigFile(*cfgFile)
	} else {
		// Find home directory.
		viper.SetConfigName(name)
		viper.AddConfigPath("$HOME")
		viper.AddConfigPath(".")
	}

	if err := viper.ReadInConfig(); err != nil {
		fmt.Fprintf(os.Stderr, "problem reading %s: %s\n", viper.ConfigFileUsed(), err)
	} else {
		fmt.Fprintln(os.Stderr, "using config file:", viper.ConfigFileUsed())
	}
}
