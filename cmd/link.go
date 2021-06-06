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
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"path"
	"strings"

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

		// add the option of a new project to the existing selection payload
		projects = append(projects, Project{
			Name: "Create New Project",
			ID:   "new",
		})

		// configure interactive prompt template
		templates := promptui.SelectTemplates{
			Active:   `{{ "✔" | green | bold }} {{ .Name | cyan | bold }}`,
			Inactive: `   {{ .Name | cyan }}`,
			Selected: `{{ "✔" | green | bold }} {{ "Selected" | bold }}: {{ .Name | cyan }}`,
		}

		// configure interative prompt
		prompt := promptui.Select{
			Label:     "Select project",
			Items:     projects,
			Templates: &templates,
		}

		index := -1
		index, _, err = prompt.Run()

		project := projects[index]

		// if a new project is selected,
		// then begin input prompts
		if index == -1 {

			// input the project name

			inputPrompt := promptui.Prompt{
				Label: "Name of the project",
			}

			name, err := inputPrompt.Run()
			if err != nil {
				log.Fatal("Aborted")
			}

			// select the server location

			servers, err := getServers()
			if err != nil {
				log.Debug(err)
				log.Fatal("Failed to fetch list of servers")
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

			// select the team
			index = -1
			userData.Teams = append(userData.Teams, TeamData{
				Team{
					Name: "No team. Publish as personal project",
				},
			})

			// configure interative prompt for selecting team
			prompt = promptui.Select{
				Label:     "Choose your team",
				Items:     userData.Teams,
				Templates: &templates,
			}

			index, _, err = prompt.Run()
			if err != nil {
				log.Fatal("Aborted")
			}

			if index == -1 {

				project, err = createProject(name, selectedServer, userData.Projects[0].UserID, "")
				if err != nil {
					log.Debug(err)
					log.Fatal("Failed to create a new project")
				}

			} else {

				project, err = createProject(name, selectedServer, "", userData.Teams[index].Team.Projects[0].TeamID)
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

			credentials, err := getCredentials(authPath)
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
		log.Infof("Project %s linked to existing Nhost configuration", project.Name)
	},
}

func updateNhostProject(ID string) error {

	nhostProjectConfigPath := path.Join(dotNhost, "nhost.yaml")

	// create .nhost, if it doesn't exists
	if !pathExists(nhostProjectConfigPath) {
		if err := os.MkdirAll(dotNhost, os.ModePerm); err != nil {
			log.Debug(err)
			log.Fatal("Failed to initialize nhost specific directory")
		}
	} else {
		// first delete any existing nhost.yaml file
		deletePath(nhostProjectConfigPath)
	}

	// create nhost.yaml to write it
	f, err := os.Create(nhostProjectConfigPath)
	if err != nil {
		log.Debug(err)
		log.Fatal("Failed to instantiate Nhost auth configuration")
	}

	defer f.Close()

	// write the file
	if err = writeToFile(
		nhostProjectConfigPath,
		fmt.Sprintf(`project_id: %s`, ID),
		"start",
	); err != nil {
		log.Debug(err)
		log.Fatal("Failed to save /nhost.yaml config")
	}

	return err
}

// creates a new remote project
func createProject(name, server, user, team string) (Project, error) {

	var response Project

	//Encode the data
	postBody, _ := json.Marshal(map[string]string{
		"name":               name,
		"server_location_id": server,
		"team_id":            team,
		"user_id":            user,
	})

	responseBody := bytes.NewBuffer(postBody)

	//Leverage Go's HTTP Post function to make request
	resp, err := http.Post(apiURL+"/custom/cli/get-server-locations", "application/json", responseBody)
	if err != nil {
		return response, err
	}

	// read our opened xmlFile as a byte array.
	body, _ := ioutil.ReadAll(resp.Body)

	defer resp.Body.Close()

	var res map[string]interface{}
	// we unmarshal our body byteArray which contains our
	// jsonFile's content into 'server' strcuture
	json.Unmarshal(body, &res)
	filteredResponse, _ := json.Marshal(res["project"])
	json.Unmarshal(filteredResponse, &response)

	return response, nil
}

// fetches the list of Nhost production servers
func getServers() ([]Server, error) {

	var response []Server

	resp, err := http.Get(apiURL + "/custom/cli/get-server-locations")
	if err != nil {
		return response, err
	}

	// read our opened xmlFile as a byte array.
	body, _ := ioutil.ReadAll(resp.Body)

	defer resp.Body.Close()

	var res map[string]interface{}
	// we unmarshal our body byteArray which contains our
	// jsonFile's content into 'server' strcuture
	json.Unmarshal(body, &res)
	json.Unmarshal(res["server_locations"].([]byte), &response)

	return response, nil
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
