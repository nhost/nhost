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
	"os"

	"github.com/mrinalwahal/cli/nhost"
	"github.com/spf13/cobra"
)

// listCmd fetches and lists the user's projects
var listCmd = &cobra.Command{
	Use:     "list",
	Aliases: []string{"ls"},
	Short:   "List remote apps",
	Long: `Fetch the list of remote personal and team app
for the logged in user from Nhost console.`,
	Run: func(cmd *cobra.Command, args []string) {

		// validate authentication
		user, err := getUser(nhost.AUTH_PATH)
		if err != nil {
			log.Debug(err)

			// begin the login procedure
			loginCmd.Run(cmd, args)
		}

		if !(len(user.WorkspaceMembers) > 0) {
			log.Error("No workspaces found")
			log.Info("Create new app with `nhost link`")
			os.Exit(0)
		}

		p := newPrinter()
		p.print("", "App", fmt.Sprint(Gray, "Workspace", Reset))
		p.print("header", "", "")

		// log every project for the user
		for _, member := range user.WorkspaceMembers {
			for _, app := range member.Workspace.Apps {
				p.print("", app.Name, fmt.Sprint(Gray, member.Workspace.Name, Reset))
			}
		}
		p.print("footer", "", "")
		p.close()
	},
}

func init() {
	rootCmd.AddCommand(listCmd)
}
