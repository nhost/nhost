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
	"strings"
	"text/tabwriter"

	"github.com/mrinalwahal/cli/nhost"
	"github.com/mrinalwahal/cli/util"
	"github.com/spf13/cobra"
)

// envCmd represents the env command
var envCmd = &cobra.Command{
	Use:   "env",
	Short: "Manage your Nhost env vars",
}

// lsCmd getches env vars from remote
var lsCmd = &cobra.Command{
	Use:     "list",
	Aliases: []string{"ls"},
	Short:   "Fetch env vars from remote",
	Long:    `List your environment variables stored on remote.`,
	Run: func(cmd *cobra.Command, args []string) {

		log.Info("Fetching variables from remote")

		app, err := nhost.Info()
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to read .nhost/nhost.yaml")
		}

		user, err := getUser(nhost.AUTH_PATH)
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to fetch user data from remote")
		}

		// concatenate personal and team projects
		var projects []nhost.App
		for _, member := range user.WorkspaceMembers {
			projects = append(projects, member.Workspace.Apps...)
		}

		if len(projects) == 0 {
			log.Info("Go to https://console.nhost.io/new and create a new apps")
			log.Fatal("We couldn't find any apps related to this account")
		}

		var savedProject nhost.App

		for _, project := range projects {
			if project.ID == app.ID {
				savedProject = project
			}
		}

		// print the filtered env vars
		fmt.Println()
		w := tabwriter.NewWriter(os.Stdout, 1, 1, 1, ' ', 0)

		fmt.Fprintln(w, "key\t\tvalue")
		fmt.Fprintln(w, "---\t\t-----")
		for _, envRow := range savedProject.EnvVars {
			fmt.Fprintf(w, "%v\t\t%v", envRow.Name, envRow.Value)
			fmt.Fprintln(w)
		}
		w.Flush()
	},
	PostRun: func(cmd *cobra.Command, args []string) {
		fmt.Println()
		log.Info("You can edit local variables in ", util.Rel(nhost.ENV_FILE))
	},
}

// pullCmd syncs env vars from remote with local environment
var envPullCmd = &cobra.Command{
	Use:   "pull",
	Short: "Sync env vars from remote with local env",
	Long:  `Pull and sync environment variables stored at remote with local environment.`,
	Run: func(cmd *cobra.Command, args []string) {

		app, err := nhost.Info()
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to read .nhost/nhost.yaml")
		}

		user, err := getUser(nhost.AUTH_PATH)
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to fetch user data from remote")
		}

		// concatenate personal and team projects
		var projects []nhost.App
		for _, member := range user.WorkspaceMembers {
			projects = append(projects, member.Workspace.Apps...)
		}

		if len(projects) == 0 {
			log.Info("Go to https://console.nhost.io/new and create a new apps")
			log.Fatal("We couldn't find any apps related to this account")
		}

		var savedProject nhost.App

		for _, project := range projects {
			if strings.EqualFold(project.ID, app.ID) {
				savedProject = project
			}
		}

		log.Infof("Downloading development environment variables for app: %s", savedProject.Name)

		vars, err := nhost.Env()
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to read .env.development file")
		}

		var existingVars []nhost.EnvVar
		for _, item := range vars {
			localParsedRow := strings.Split(item, "=")
			localKey, localValue := localParsedRow[0], localParsedRow[1]
			existingVars = append(existingVars, nhost.EnvVar{
				Name:  localKey,
				Value: localValue,
			})
		}

		for _, remote := range savedProject.EnvVars {
			added := false
			for index, local := range existingVars {
				if remote.Name == local.Name {
					existingVars[index].Value = remote.Value
					added = true
				}
			}
			if !added {
				existingVars = append(existingVars, remote)
			}
		}

		var envArray []string
		for _, item := range existingVars {
			envArray = append(envArray, fmt.Sprintf("%v=%v", item.Name, item.Value))
		}

		// delete the existing .env.development file
		util.DeletePath(nhost.ENV_FILE)

		// create a fresh one
		f, err := os.Create(nhost.ENV_FILE)
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to create fresh .env.development file")
		}

		defer f.Close()
		if _, err = f.WriteString(strings.Join(envArray, "\n")); err != nil {
			log.Debug(err)
			log.Fatal("Failed to write fresh .env.development file")
		}
		f.Sync()

		log.Info("Local environment vars successfully synced with remote")
	},
}

func init() {
	rootCmd.AddCommand(envCmd)
	envCmd.AddCommand(lsCmd)
	envCmd.AddCommand(envPullCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	// envCmd.PersistentFlags().String("foo", "", "A help for foo")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	// envCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}
