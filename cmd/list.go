/*
MIT License

Copyright (c) Nhost

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

package cmd

import (
	"github.com/mrinalwahal/cli/nhost"
	"github.com/spf13/cobra"
)

// listCmd fetches and lists the user's projects
var listCmd = &cobra.Command{
	Use:   "list",
	Short: "List the projects",
	Long: `Fetch the list of personal and team projects
for the logged in user from Nhost console and present them.`,
	Run: func(cmd *cobra.Command, args []string) {

		// validate authentication
		userData, err := validateAuth(nhost.AUTH_PATH)
		if err != nil {
			log.Debug(err)
			log.Error("Failed to validate authentication")

			// begin the login procedure
			loginCmd.Run(cmd, args)
		}

		// concatenate personal and team projects
		projects := userData.Projects

		// if user is part of teams which have projects, append them as well
		teams := userData.Teams

		for _, team := range teams {
			// append the projects
			projects = append(projects, team.Team.Projects...)
		}

		// log every project for the user
		for _, item := range projects {

			if item.TeamID != "" {
				item.Type = item.Team.Name
			} else {
				item.Type = "personal"
			}

			log.WithField("component", item.Type).Info(item.Name)
		}
	},
}

func init() {
	rootCmd.AddCommand(listCmd)
}
