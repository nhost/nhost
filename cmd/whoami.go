/*
Copyright © 2021 NAME HERE <EMAIL ADDRESS>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
package cmd

import (
	"github.com/mrinalwahal/cli/nhost"
	"github.com/spf13/cobra"
)

// whoamiCmd represents the whoami command
var whoamiCmd = &cobra.Command{
	Use:     "whoami",
	Aliases: []string{"who", "me"},
	Short:   "Credentials with which you are logged in",
	Long: `Reads authentication credentials and displays
the email/username with which you are currently logged in
to your Nhost account from CLI.`,
	Run: func(cmd *cobra.Command, args []string) {

		credentials, err := nhost.LoadCredentials()
		if err != nil {
			log.Debug(err)
			log.Fatal(ErrNotLoggedIn)
		}

		log.WithField("component", "email").Info(credentials.Email)
	},
}

func init() {
	rootCmd.AddCommand(whoamiCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	// whoamiCmd.PersistentFlags().String("foo", "", "A help for foo")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	// whoamiCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}
