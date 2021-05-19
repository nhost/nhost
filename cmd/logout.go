/*
Copyright © 2021 Mrinal Wahal mrinalwahal@gmail.com

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
	"github.com/spf13/cobra"
)

// logoutCmd represents the logout command
var logoutCmd = &cobra.Command{
	Use:   "logout",
	Short: "Logout from your Nhost account",
	Long:  "Remove locally installed authentication configuration, and logout from your Nhost account.",
	Run: func(cmd *cobra.Command, args []string) {

		// check if auth file exists
		if !pathExists(authPath) {
			throwError(nil, "credentials not found: please login first with `nhost login`", true)
		} else {
			if err := deletePath(authPath); err != nil {
				throwError(err, "couldn't delete credentials, and failed to logout.", true)
			}
			printMessage("You are now logged out of Nhost. To login use 'nhost login'", "info")
		}
	},
}

func init() {
	rootCmd.AddCommand(logoutCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	// logoutCmd.PersistentFlags().String("foo", "", "A help for foo")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	// logoutCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}
