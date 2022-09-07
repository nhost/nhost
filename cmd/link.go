/*
MIT License

# Copyright (c) Nhost

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
	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/util"
	"github.com/spf13/cobra"
)

var User nhost.User

// linkCmd represents the link command
var linkCmd = &cobra.Command{
	Use:        "link",
	SuggestFor: []string{"list"},
	Short:      "Link local app to a remote one",
	Long:       `Connect your already hosted Nhost app to local environment and start development or testings.`,
	PreRun: func(cmd *cobra.Command, args []string) {

		//  validate authentication
		response, err := getUser(nhost.AUTH_PATH)
		if err != nil {

			//  begin the login procedure
			if err := loginCmd.RunE(cmd, args); err != nil {
				log.Debug(err)
				status.Fatal("Failed to authenticate")
			}
		}

		response, err = getUser(nhost.AUTH_PATH)
		if err != nil {
			status.Fatal("Failed to authenticate")
		}

		User = response
	},
	Run: func(cmd *cobra.Command, args []string) {

		//  concatenate personal and team projects
		projects := prepareAppList(User)

		if len(projects) == 0 {
			status.Fatal("No apps found")
		}

		/*
			//  add the option of a new project to the existing selection payload
			projects = append(projects, nhost.App{
				Name: "Create New App",
				ID:   "new",
			})
		*/

		//  configure interactive prompt template
		templates := promptui.SelectTemplates{
			//Label:    "{{ . }}?",
			Active:   `{{ "✔" | green | bold }} {{ .Name | cyan | bold }} {{ .Workspace | faint }}`,
			Inactive: `   {{ .Name | cyan }}  {{ .Workspace | faint }}`,
			Selected: `{{ "✔" | green | bold }} {{ "Selected" | bold }}: {{ .Name | cyan }}  {{ .Workspace | faint }}`,
		}

		//  configure interactive prompt search function
		searcher := func(input string, index int) bool {
			project := projects[index]
			name := strings.Replace(strings.ToLower(project.Name), " ", "", -1)
			input = strings.Replace(strings.ToLower(input), " ", "", -1)

			return strings.Contains(name, input)
		}

		//  configure interative prompt
		prompt := promptui.Select{
			Label:     "Select app",
			Items:     projects,
			Templates: &templates,
			Searcher:  searcher,
		}

		index, _, err := prompt.Run()
		if err != nil {
			return
		}

		project := projects[index]

		//  if a new project is selected,
		//  then begin input prompts
		if project.ID == "new" {

			//  input the project name
			var names []string

			for _, project := range projects {
				names = append(names, project.Name)
			}

			for ok := true; ok; ok = contains(names, project.Name) {

				inputPrompt := promptui.Prompt{
					Label: "Name of the app",
				}

				project.Name, err = inputPrompt.Run()
				if err != nil {
					os.Exit(0)
				}

				if contains(names, project.Name) {
					status.Fatal("App with that name already exists")
				}
			}

			//  select the server location
			servers, err := nhost.Servers()
			if err != nil {
				log.Debug(err)
				status.Fatal("Failed to fetch list of servers")
			}

			//  configure interactive prompt template
			templates := promptui.SelectTemplates{
				//Label:    "{{ . }}?",
				Active:   `{{ "✔" | green | bold }} {{ .Name | cyan | bold }}`,
				Inactive: `   {{ .Name | cyan }}`,
				Selected: `{{ "✔" | green | bold }} {{ "Selected" | bold }}: {{ .Name | cyan }}`,
			}

			//  configure interative prompt for selecting server
			prompt := promptui.Select{
				Label:     "Select server location",
				Items:     servers,
				Templates: &templates,
			}

			index, _, err := prompt.Run()
			if err != nil {
				os.Exit(0)
			}
			selectedServer := servers[index].ID

			//  ask whether it's a team project or a personal one
			prompt = promptui.Select{
				Label: "Choose App Type",
				Items: []string{"Personal App", "Team App"},
			}

			index, _, err = prompt.Run()
			if err != nil {
				return
			}

			if index == 0 {

				project.ID, err = createProject(project.Name, selectedServer, User.ID, "")
				if err != nil {
					log.Debug(err)
					log.Fatal("Failed to create a new app")
				}

				log.WithField("component", project.Name).Info("App created successfully")

			} else {

				//  configure interactive prompt template
				templates = promptui.SelectTemplates{
					Active:   `{{ "✔" | green | bold }} {{ .Name | cyan | bold }}`,
					Inactive: `   {{ .Name | cyan }}`,
					Selected: `{{ "✔" | green | bold }} {{ "Selected" | bold }}: {{ .Name | cyan }}`,
				}

				//  select the team
				prompt = promptui.Select{
					Label:     "Choose your workspace",
					Items:     User.WorkspaceMembers,
					Templates: &templates,
				}

				index, _, err = prompt.Run()
				if err != nil {
					os.Exit(0)
				}

				project.ID, err = createProject(project.Name, selectedServer, User.ID, User.WorkspaceMembers[index].ID)
				if err != nil {
					log.Debug(err)
					status.Fatal("Failed to create a new app")
				}

			}

		} else {

			if err != nil {
				return
			}

			//  configure interative prompt
			confirmationPrompt := promptui.Prompt{
				Label: "Enter the app's name to confirm linking (case sensitive)",
			}

			response, err := confirmationPrompt.Run()
			if err != nil {
				return
			}

			if response != project.Name {
				status.Fatal("Unexpected name. Linking aborted.")
			}
		}

		//  update the project ID
		if err = updateNhostProject(project); err != nil {
			log.Debug(err)
			status.Fatal("Failed to update Nhost app configuration locally")
		}

		//  project linking complete
	},
	PostRun: func(cmd *cobra.Command, args []string) {
		status.Info("App linked to local Nhost environment")
	},
}

func updateNhostProject(app nhost.App) error {

	//  create .nhost, if it doesn't exists
	if util.PathExists(nhost.INFO_PATH) {

		//  first delete any existing nhost.yaml file
		if err := util.DeletePath(nhost.INFO_PATH); err != nil {
			return err
		}
	}

	log.Debug("Saving app information in ", util.Rel(nhost.INFO_PATH))

	//  create nhost.yaml to write it
	f, err := os.Create(nhost.INFO_PATH)
	if err != nil {
		log.Debug(err)
		log.Fatal("Failed to instantiate Nhost auth configuration")
	}

	defer f.Close()

	//  write the file
	payload, _ := json.Marshal(app)
	if err = writeToFile(
		nhost.INFO_PATH,
		string(payload),
		"start",
	); err != nil {
		status.Errorln(fmt.Sprintf("Failed to save %s config", util.Rel(nhost.INFO_PATH)))
	}

	return err
}

// creates a new remote project
func createProject(name, server, User, team string) (string, error) {

	log.Debugf("Creating project '%s'", name)

	var response nhost.Response

	//Encode the data
	reqBody := map[string]string{
		"name":               name,
		"User_id":            User,
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

	//  read our opened xmlFile as a byte array.
	body, _ := ioutil.ReadAll(resp.Body)

	defer resp.Body.Close()

	//  we unmarshal our body byteArray which contains our
	//  jsonFile's content into 'server' strcuture
	json.Unmarshal(body, &response)

	if response.Error.Code != "" {
		return "", errors.New(response.Error.Code)
	}

	return response.Project.ID, nil
}

func init() {
	rootCmd.AddCommand(linkCmd)

	//  Here you will define your flags and configuration settings.

	//  Cobra supports Persistent Flags which will work for this command
	//  and all subcommands, e.g.:
	//  linkCmd.PersistentFlags().String("foo", "", "A help for foo")

	//  Cobra supports local flags which will only run when this command
	//  is called directly, e.g.:
	//  linkCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}
