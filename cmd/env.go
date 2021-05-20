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
	"encoding/json"
	"fmt"
	"io/ioutil"
	"path"
	"strings"

	"github.com/spf13/cobra"
	"gopkg.in/yaml.v2"
)

// envCmd represents the env command
var envCmd = &cobra.Command{
	Use:   "env",
	Short: "Handle your Nhost env vars",
	Long: `A longer description that spans multiple lines and likely contains examples
and usage of using your command. For example:

Cobra is a CLI library for Go that empowers applications.
This application is a tool to generate the needed files
to quickly create a Cobra application.`,
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("env called")
	},
}

// lsCmd getches env vars from remote
var lsCmd = &cobra.Command{
	Use:   "ls",
	Short: "Fetch env vars from remote",
	Long:  `List your environment variables stored on remote.`,
	Run: func(cmd *cobra.Command, args []string) {

		if verbose {
			printMessage("fetching env vars from remote", "info")
		}

		var projectConfig map[string]interface{}

		config, err := ioutil.ReadFile(path.Join(dotNhost, "nhost.yaml"))
		if err != nil {
			throwError(err, "failed to read .nhost/nhost.yaml", true)
		}

		yaml.Unmarshal(config, &projectConfig)

		savedProjectID := projectConfig["project_id"].(string)

		user, err := validateAuth(authPath)
		if err != nil {
			throwError(err, "failed to fetch user data from remote", true)
		}

		// concatenate personal and team projects
		projects := user.Projects
		if len(projects) == 0 {
			throwError(nil, "We couldn't find any projects related to this account, go to https://console.nhost.io/new and create one.", true)
		}

		// if user is part of teams which have projects, append them as well
		teams := user.Teams
		for _, team := range teams {

			// check if particular team has projects
			if len(team.Projects) > 0 {
				// append the projects
				projects = append(projects, team.Projects...)
			}
		}

		var savedProject Project

		for _, project := range projects {
			if project.ID == savedProjectID {
				savedProject = project
			}
		}

		// print the filtered env vars
		envs, _ := json.Marshal(savedProject.ProjectEnvVars)
		printMessage("env vars are as followed:", "info")
		fmt.Println(string(envs))
	},
}

// pullCmd syncs env vars from remote with local environment
var pullCmd = &cobra.Command{
	Use:   "pull",
	Short: "Sync env vars from remote with local env",
	Long:  `Pull and sync environment variables stored at remote with local environment.`,
	Run: func(cmd *cobra.Command, args []string) {

		if verbose {
			printMessage("overwriting existing .env.development file", "info")
		}

		var projectConfig map[string]interface{}

		config, err := ioutil.ReadFile(path.Join(dotNhost, "nhost.yaml"))
		if err != nil {
			throwError(err, "failed to read .nhost/nhost.yaml", true)
		}

		yaml.Unmarshal(config, &projectConfig)

		savedProjectID := projectConfig["project_id"].(string)

		user, err := validateAuth(authPath)
		if err != nil {
			throwError(err, "failed to fetch user data from remote", true)
		}

		// concatenate personal and team projects
		projects := user.Projects
		if len(projects) == 0 {
			throwError(nil, "We couldn't find any projects related to this account, go to https://console.nhost.io/new and create one.", true)
		}

		// if user is part of teams which have projects, append them as well
		teams := user.Teams
		for _, team := range teams {

			// check if particular team has projects
			if len(team.Projects) > 0 {
				// append the projects
				projects = append(projects, team.Projects...)
			}
		}

		var savedProject Project

		for _, project := range projects {
			if project.ID == savedProjectID {
				savedProject = project
			}
		}

		printMessage(fmt.Sprintf("downloading development environment variables for project: %s", savedProject.Name), "info")

		envData, err := ioutil.ReadFile(envFile)
		if err != nil {
			throwError(err, "failed to read .env.development file", true)
		}

		envRows := strings.Split(string(envData), "\n")

		var envMap []map[string]interface{}
		for index, row := range envRows {

			if strings.Contains(row, "=") {
				pair := strings.Split(row, "=")
				fmt.Println(pair)
				/*
					envMap = append(envMap, map[string]interface{}{
						envMap[pair[0]]: pair[1],
					})
				*/
			} else {
				envRows = removeElement(envRows, index)
			}
		}

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

		var updatedProjectEnvVarIndices []int
		var newEnvVars []map[string]interface{}
		for _, existingVar := range envMap {

			var remoteVarIndex int
			for remoteIndex, remoteVar := range remoteEnvVars {
				if remoteVar["name"].(string) == envMap[remoteIndex]["name"].(string) {
					remoteVarIndex = remoteIndex
				}
			}
			tempEnvVar := remoteEnvVars[remoteVarIndex]
			updatedProjectEnvVarIndices = append(updatedProjectEnvVarIndices, remoteVarIndex)
			newEnvVars = append(newEnvVars, map[string]interface{}{
				"name":  existingVar["name"],
				"value": tempEnvVar["value"],
			})
		}
	},
}

func removeElement(s []string, index int) []string {
	return append(s[:index], s[index+1:]...)
}

func init() {
	rootCmd.AddCommand(envCmd)
	envCmd.AddCommand(lsCmd)
	envCmd.AddCommand(pullCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	// envCmd.PersistentFlags().String("foo", "", "A help for foo")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	// envCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}
