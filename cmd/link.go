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
	"errors"
	"fmt"
	"os"
	"path"

	"github.com/manifoldco/promptui"
	"github.com/spf13/cobra"
)

// linkCmd represents the link command
var linkCmd = &cobra.Command{
	Use:   "link",
	Short: "Link Project",
	Long:  `Connect your already hosted Nhost Project to local environment and start development or testings.`,
	Run: func(cmd *cobra.Command, args []string) {

		// validate authentication
		userData, err := validateAuth(authPath)
		if err != nil {
			throwError(err, "couldn't validate authentication", true)
		}

		// concatenate personal and team projects
		projects := userData.Projects
		if len(projects) == 0 {
			throwError(nil, "We couldn't find any projects related to this account, go to https://console.nhost.io/new and create one.", true)
		}

		// if user is part of teams which have projects, append them as well
		teams := userData.Teams

		for _, team := range teams {

			// check if particular team has projects
			if len(team.Projects) > 0 {
				// append the projects
				projects = append(projects, team.Projects...)
			}
		}

		if len(projects) == 0 {
			throwError(errors.New("no projects found for this account, create new one by going to \"https://console.nhost.io/new\""), "no projects found", true)
		}

		// configure interactive prompt template
		templates := promptui.SelectTemplates{
			Active:   `❤️ {{ .Name | cyan | bold }}`,
			Inactive: `   {{ .Name | cyan }}`,
			Selected: `{{ "✔" | green | bold }} {{ "Project" | bold }}: {{ .Name | cyan }}`,
		}

		// configure interative prompt
		prompt := promptui.Select{
			Label:     "Select project",
			Items:     projects,
			Templates: &templates,
		}

		index, _, err := prompt.Run()
		selectedProject := projects[index]

		if err != nil {
			throwError(err, "prompt failed", true)
		}

		// check if .nhost exists
		if !pathExists(dotNhost) {
			if err := os.MkdirAll(dotNhost, os.ModePerm); err != nil {
				throwError(err, "couldn't initialize nhost specific directory", true)
			}
		}

		deletePath(path.Join(dotNhost, "nhost.yaml"))
		if err = writeToFile(
			path.Join(dotNhost, "nhost.yaml"),
			fmt.Sprintf(`project_id: %s`, selectedProject.ID),
			"start",
		); err != nil {
			throwError(err, "failed to save /nhost.yaml config", true)
		}

		// project linking complete
		printMessage("Project linked: "+selectedProject.Name, "success")
	},
}

func init() {
	rootCmd.AddCommand(linkCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	// linkCmd.PersistentFlags().String("foo", "", "A help for foo")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	// linkCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}
