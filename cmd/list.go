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
	"fmt"

	"github.com/mrinalwahal/cli/nhost"
	"github.com/spf13/cobra"
)

// listCmd fetches and lists the user's projects
var listCmd = &cobra.Command{
	Use:     "list",
	Aliases: []string{"ls"},
	Short:   "List the apps",
	Long: `Fetch the list of personal and team app
for the logged in user from Nhost console and present them.`,
	Run: func(cmd *cobra.Command, args []string) {

		// validate authentication
		userData, err := validateAuth(nhost.AUTH_PATH)
		if err != nil {
			log.Debug(err)

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

		log.Info("Remote apps")

		p := newPrinter()
		p.print("header", "", "")

		// log every project for the user
		for _, item := range projects {

			if item.TeamID != "" {
				item.Type = item.Team.Name
			} else {
				item.Type = "Personal"
			}

			p.print("", item.Name, fmt.Sprintf("%s%v%s", Gray, item.Type, Reset))
		}
		p.print("footer", "", "")
		p.close()
	},
}

func init() {
	rootCmd.AddCommand(listCmd)
}
