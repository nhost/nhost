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
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"text/tabwriter"

	"github.com/mrinalwahal/cli/nhost"
	"github.com/mrinalwahal/cli/util"
	"github.com/spf13/cobra"
)

// envCmd represents the env command
var envCmd = &cobra.Command{
	Use:     "env",
	Aliases: []string{"e"},
	Short:   "Handle your Nhost env vars",
	Long: `A longer description that spans multiple lines and likely contains examples
and usage of using your command. For example:

Cobra is a CLI library for Go that empowers applications.
This application is a tool to generate the needed files
to quickly create a Cobra application.`,
}

// lsCmd getches env vars from remote
var lsCmd = &cobra.Command{
	Use:     "list",
	Aliases: []string{"ls"},
	Short:   "Fetch env vars from remote",
	Long:    `List your environment variables stored on remote.`,
	Run: func(cmd *cobra.Command, args []string) {

		log.Info("Fetching env vars from remote")

		info, err := nhost.Info()
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to read .nhost/nhost.yaml")
		}

		savedProjectID := info.ProjectID

		user, err := validateAuth(nhost.AUTH_PATH)
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to fetch user data from remote")
		}

		// concatenate personal and team projects
		projects := user.Projects

		// if user is part of teams which have projects, append them as well
		teams := user.Teams
		for _, team := range teams {

			// check if particular team has projects
			if len(team.Team.Projects) > 0 {
				// append the projects
				projects = append(projects, team.Team.Projects...)
			}
		}

		if len(projects) == 0 {
			log.Info("Go to https://console.nhost.io/new and create a new apps")
			log.Fatal("We couldn't find any apps related to this account")
		}

		var savedProject nhost.Project

		for _, project := range projects {
			if project.ID == savedProjectID {
				savedProject = project
			}
		}

		// print the filtered env vars
		fmt.Println()
		w := tabwriter.NewWriter(os.Stdout, 1, 1, 1, ' ', 0)

		fmt.Fprintln(w, "key\t\tvalue")
		fmt.Fprintln(w, "---\t\t-----")
		for _, envRow := range savedProject.ProjectEnvVars {
			fmt.Fprintf(w, "%v\t\t%v", envRow["name"], envRow["dev_value"])
			fmt.Fprintln(w)
		}
		w.Flush()
		fmt.Println()

		log.Info("You can edit these variables in ", filepath.Base(nhost.ENV_FILE))
	},
}

// pullCmd syncs env vars from remote with local environment
var envPullCmd = &cobra.Command{
	Use:     "pull",
	Aliases: []string{"p"},
	Short:   "Sync env vars from remote with local env",
	Long:    `Pull and sync environment variables stored at remote with local environment.`,
	Run: func(cmd *cobra.Command, args []string) {

		log.Info("Overwriting existing .env.development file")

		info, err := nhost.Info()
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to read .nhost/nhost.yaml")
		}

		savedProjectID := info.ProjectID

		user, err := validateAuth(nhost.AUTH_PATH)
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to fetch user data from remote")
		}

		// concatenate personal and team projects
		projects := user.Projects

		// if user is part of teams which have projects, append them as well
		teams := user.Teams
		for _, team := range teams {

			// check if particular team has projects
			if len(team.Team.Projects) > 0 {
				// append the projects
				projects = append(projects, team.Team.Projects...)
			}
		}

		if len(projects) == 0 {
			log.Info("Go to https://console.nhost.io/new and create a new apps")
			log.Fatal("We couldn't find any apps related to this account")
		}

		var savedProject nhost.Project

		for _, project := range projects {
			if project.ID == savedProjectID {
				savedProject = project
			}
		}

		log.Infof("Downloading development environment variables for app: %s", savedProject.Name)

		envData, err := ioutil.ReadFile(nhost.ENV_FILE)
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to read .env.development file")
		}

		envRows := strings.Split(string(envData), "\n")

		var envMap []map[string]interface{}
		for index, row := range envRows {

			if strings.Contains(row, "=") {
				localParsedRow := strings.Split(row, "=")
				localKey, localValue := localParsedRow[0], localParsedRow[1]

				// copy the pair as it is
				envMap = append(envMap, map[string]interface{}{
					localKey: localValue,
				})

				// if the same key is in response from remote, then override the previously copied value
				for _, remoteVarRow := range savedProject.ProjectEnvVars {
					if remoteVarRow["name"] == localKey {
						envMap[index][localKey] = remoteVarRow["dev_value"]
					}
				}
			}
		}

		// convert the new env var map to string
		var envArray []string
		for _, row := range envMap {
			for key, value := range row {
				envArray = append(envArray, fmt.Sprintf(`%s=%v`, key, value))
			}
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

		/*
			// Legacy code.
			// Might be required in the future to push local env changes to remote
			var remoteEnvVars []map[string]interface{}
			for _, variable := range savedProject.ProjectEnvVars {
				remoteEnvVars = append(remoteEnvVars, map[string]interface{}{
					"name":  variable["name"],
					"value": variable["dev_value"],
				})
			}

			remoteEnvVars = append(remoteEnvVars, map[string]interface{}{
				"name":  "REGISTRATION_CUSTOM_FIELDS",
				"value": savedProject.HBPRegistrationCustomFields,
			})

			remoteEnvVars = append(remoteEnvVars, map[string]interface{}{
				"name":  "JWT_CUSTOM_FIELDS",
				"value": savedProject.BackendUserFields,
			})

			remoteEnvVars = append(remoteEnvVars, map[string]interface{}{
				"name":  "DEFAULT_ALLOWED_USER_ROLES",
				"value": savedProject.HBPDefaultAllowedUserRoles,
			})

			remoteEnvVars = append(remoteEnvVars, map[string]interface{}{
				"name":  "ALLOWED_USER_ROLES",
				"value": savedProject.HBPAllowedUserRoles,
			})
		*/

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
