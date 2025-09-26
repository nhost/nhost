package cmd

import (
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
	"github.com/spf13/viper"
)

func addBoolFlag(
	flags *pflag.FlagSet,
	name string,
	defaultValue bool, //nolint:unparam
	help string,
) {
	flags.Bool(name, defaultValue, help)

	if err := viper.BindPFlag(name, flags.Lookup(name)); err != nil {
		cobra.CheckErr(err)
	}
}

func addStringFlag(flags *pflag.FlagSet, name string, defaultValue string, help string) {
	flags.String(name, defaultValue, help)

	if err := viper.BindPFlag(name, flags.Lookup(name)); err != nil {
		cobra.CheckErr(err)
	}
}

func addStringArrayFlag(flags *pflag.FlagSet, name string, defaultValue []string, help string) {
	flags.StringArray(name, defaultValue, help)

	if err := viper.BindPFlag(name, flags.Lookup(name)); err != nil {
		cobra.CheckErr(err)
	}
}
