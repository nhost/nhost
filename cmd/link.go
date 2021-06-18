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
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"strings"

	"github.com/manifoldco/promptui"
	"github.com/mrinalwahal/cli/nhost"
	"github.com/spf13/cobra"
)

// linkCmd represents the link command
var linkCmd = &cobra.Command{
	Use:   "link",
	Short: "Link local project to a remote one",
	Long:  `Connect your already hosted Nhost Project to local environment and start development or testings.`,
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

		// add the option of a new project to the existing selection payload
		projects = append(projects, nhost.Project{
			Name: "Create New Project",
			ID:   "new",
		})

		// configure interactive prompt template
		templates := promptui.SelectTemplates{
			//Label:    "{{ . }}?",
			Active:   `{{ "✔" | green | bold }} {{ .Name | cyan | bold }} {{ .Team.Name | faint }}`,
			Inactive: `   {{ .Name | cyan }}  {{ .Team.Name | faint }}`,
			Selected: `{{ "✔" | green | bold }} {{ "Selected" | bold }}: {{ .Name | cyan }}  {{ .Team.Name | faint }}`,
		}

		// configure interactive prompt search function
		searcher := func(input string, index int) bool {
			project := projects[index]
			name := strings.Replace(strings.ToLower(project.Name), " ", "", -1)
			input = strings.Replace(strings.ToLower(input), " ", "", -1)

			return strings.Contains(name, input)
		}

		// configure interative prompt
		prompt := promptui.Select{
			Label:     "Select project",
			Items:     projects,
			Templates: &templates,
			Searcher:  searcher,
		}

		index, _, err := prompt.Run()
		if err != nil {
			log.Debug(err)
			log.Fatal("Aborted")
		}

		project := projects[index]

		// if a new project is selected,
		// then begin input prompts
		if project.ID == "new" {

			// input the project name

			names := []string{}

			for _, project := range projects {
				names = append(names, project.Name)
			}

			for ok := true; ok; ok = contains(names, project.Name) {

				inputPrompt := promptui.Prompt{
					Label: "Name of the project",
				}

				project.Name, err = inputPrompt.Run()
				if err != nil {
					log.Fatal("Aborted")
				}

				if contains(names, project.Name) {
					log.Error("Project with that name already exists")
				}
			}

			// select the server location
			servers, err := nhost.Servers()
			if err != nil {
				log.Debug(err)
				log.Fatal("Failed to fetch list of servers")
			}

			// configure interactive prompt template
			templates := promptui.SelectTemplates{
				//Label:    "{{ . }}?",
				Active:   `{{ "✔" | green | bold }} {{ .Name | cyan | bold }}`,
				Inactive: `   {{ .Name | cyan }}`,
				Selected: `{{ "✔" | green | bold }} {{ "Selected" | bold }}: {{ .Name | cyan }}`,
			}

			// configure interative prompt for selecting server
			prompt := promptui.Select{
				Label:     "Select server location",
				Items:     servers,
				Templates: &templates,
			}

			index, _, err := prompt.Run()
			if err != nil {
				log.Fatal("Aborted")
			}
			selectedServer := servers[index].ID

			// ask whether it's a team project or a personal one
			prompt = promptui.Select{
				Label: "Choose Project Type",
				Items: []string{"Personal Project", "Team Project"},
			}

			index, _, err = prompt.Run()
			if err != nil {
				log.Fatal("Aborted")
			}

			if index == 0 {

				project.ID, err = createProject(project.Name, selectedServer, userData.ID, "")
				if err != nil {
					log.Debug(err)
					log.Fatal("Failed to create a new project")
				}

				log.WithField("component", project.Name).Info("Project created successfully")

			} else {

				// configure interactive prompt template
				templates = promptui.SelectTemplates{
					Active:   `{{ "✔" | green | bold }} {{ .Team.Name | cyan | bold }}`,
					Inactive: `   {{ .Team.Name | cyan }}`,
					Selected: `{{ "✔" | green | bold }} {{ "Selected" | bold }}: {{ .Team.Name | cyan }}`,
				}

				// select the team
				prompt = promptui.Select{
					Label:     "Choose your team",
					Items:     userData.Teams,
					Templates: &templates,
				}

				index, _, err = prompt.Run()
				if err != nil {
					log.Fatal("Aborted")
				}

				project.ID, err = createProject(project.Name, selectedServer, userData.ID, userData.Teams[index].Team.ID)
				if err != nil {
					log.Debug(err)
					log.Fatal("Failed to create a new project")
				}

			}

		} else {

			if err != nil {
				log.Debug(err)
				log.Fatal("Input prompt failed")
			}

			// provide confirmation prompt
			log.Warn("If you linked to the wrong project, you could break your production environment.")
			log.Info("Therefore we need confirmation you are serious about this.")

			credentials, err := nhost.LoadCredentials()
			if err != nil {
				log.Debug(err)
				log.Fatal("Failed to load authentication credentials")
			}

			// configure interative prompt
			confirmationPrompt := promptui.Prompt{
				Label: "Enter your email to confirm this linking",
			}

			response, err := confirmationPrompt.Run()
			if err != nil {
				log.Debug(err)
				log.Fatal("Input prompt aborted")
			}

			if strings.ToLower(response) != credentials.Email {
				log.Fatal("Invalid email. Linking aborted.")
			}
		}

		// update the project ID
		if err = updateNhostProject(project.ID); err != nil {
			log.Debug(err)
			log.Fatal("Failed to update Nhost project configuration locally")
		}

		// project linking complete
		log.WithField("component", project.Name).Info("Project linked to local Nhost environment")
	},
}

func updateNhostProject(ID string) error {

	// create .nhost, if it doesn't exists
	if err := os.MkdirAll(nhost.DOT_NHOST, os.ModePerm); err != nil {
		log.Debug(err)
		log.Fatal("Failed to initialize nhost specific directory")
	}

	if pathExists(nhost.INFO_PATH) {

		// first delete any existing nhost.yaml file
		if err := deletePath(nhost.INFO_PATH); err != nil {
			return err
		}
	}

	// create nhost.yaml to write it
	f, err := os.Create(nhost.INFO_PATH)
	if err != nil {
		log.Debug(err)
		log.Fatal("Failed to instantiate Nhost auth configuration")
	}

	defer f.Close()

	// write the file
	if err = writeToFile(
		nhost.INFO_PATH,
		fmt.Sprintf(`project_id: %s`, ID),
		"start",
	); err != nil {
		log.Debug(err)
		log.Fatal("Failed to save /nhost.yaml config")
	}

	return err
}

// creates a new remote project
func createProject(name, server, user, team string) (string, error) {

	var response nhost.Response

	//Encode the data
	reqBody := map[string]string{
		"name":               name,
		"user_id":            user,
		"server_location_id": server,
	}

	if team != "" {
		reqBody["team_id"] = team
	}

	postBody, _ := json.Marshal(reqBody)
	responseBody := bytes.NewBuffer(postBody)

	//Leverage Go's HTTP Post function to make request
	resp, err := http.Post(nhost.API+"/custom/cli/create-project", "application/json", responseBody)
	if err != nil {
		return "", err
	}

	// read our opened xmlFile as a byte array.
	body, _ := ioutil.ReadAll(resp.Body)

	defer resp.Body.Close()

	// we unmarshal our body byteArray which contains our
	// jsonFile's content into 'server' strcuture
	json.Unmarshal(body, &response)

	if response.Error.Code != "" {
		return "", errors.New(response.Error.Code)
	}

	return response.Project.ID, nil
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
