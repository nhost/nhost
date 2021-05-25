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
			log.Error("Failed to validate authentication")

			// begin the login procedure
			loginCmd.Run(cmd, args)
		}

		// concatenate personal and team projects
		projects := userData.Projects

		// if user is part of teams which have projects, append them as well
		teams := userData.Teams

		for _, team := range teams {

			// check if particular team has projects
			if len(team.Team.Projects) > 0 {
				// append the projects
				projects = append(projects, team.Team.Projects...)
			}
		}

		if len(projects) == 0 {
			log.Info("Go to https://console.nhost.io/new and create a new project")
			log.Fatal("We couldn't find any projects related to this account")
		}

		// configure interactive prompt template
		templates := promptui.SelectTemplates{
			Active:   `{{ "✔" | green | bold }} {{ .Name | cyan | bold }}`,
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
			log.Debug(err)
			log.Fatal("Input prompt failed")
		}

		// create .nhost, if it doesn't exists
		if err := os.MkdirAll(dotNhost, os.ModePerm); err != nil {
			log.Debug(err)
			log.Fatal("Failed to initialize nhost specific directory")
		}

		// create nhost.yaml to write it
		f, err := os.Create(path.Join(dotNhost, "nhost.yaml"))
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to instantiate Nhost auth configuration")
		}

		defer f.Close()

		// write the file
		if err = writeToFile(
			path.Join(dotNhost, "nhost.yaml"),
			fmt.Sprintf(`project_id: %s`, selectedProject.ID),
			"start",
		); err != nil {
			log.Debug(err)
			log.Fatal("Failed to save /nhost.yaml config")
		}

		// project linking complete
		log.Infof("Project %s linked to existing Nhost configuration", selectedProject.Name)
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
