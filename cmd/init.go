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
	"path/filepath"
	"strings"

	"github.com/manifoldco/promptui"
	"github.com/nhost/cli/hasura"
	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/util"
	"github.com/spf13/cobra"
)

var (
	project string
	remote  bool
	name    string
)

//  initCmd represents the init command
var initCmd = &cobra.Command{
	Use:   "init [--remote]",
	Short: "Initialize current directory as Nhost app",
	Long: `Initialize current working directory as an Nhost application.

--remote flag must be added in the of the command.`,
	PreRun: func(cmd *cobra.Command, args []string) {

		if util.PathExists(nhost.NHOST_DIR) {
			status.Info("To start development environment, run 'nhost' or 'nhost dev'")
			status.Errorln("App already exists in this directory")
			os.Exit(0)
		}

		/* 		if contains(args, "-r") || contains(args, "--remote") {
		   			remote = true
		   		}
		*/

	},
	Run: func(cmd *cobra.Command, args []string) {

		var err error
		var location string
		var selectedProject nhost.App

		//  if user has already passed remote_project as a flag,
		//  then fetch list of remote projects,
		//  iterate through those projects and filter that project
		if remote {

			//  Validate authentication
			user, err := getUser(nhost.AUTH_PATH)
			if err != nil {

				//	Login the user
				loginCmd.Run(cmd, args)
			}

			//  concatenate personal and team projects
			projects := prepareAppList(user)

			if len(projects) == 0 {
				status.Errorln("No remote apps found")
				status.Infoln("Run `nhost init` to create new one locally")
				os.Exit(0)
			}

			//  if flag is empty, present selection list
			if project != "" {

				for _, item := range projects {
					if item.Name == project {
						selectedProject = item
					}
				}

				if selectedProject.ID == "" {
					status.Fatal(fmt.Sprintf("Remote app '%v' not found", project))
				}
			} else {

				//  configure interactive prompt template
				templates := promptui.SelectTemplates{
					//Label:    "{{ . }}?",
					Active:   `{{ "✔" | green | bold }} {{ .Name | cyan | bold }} {{ .Workspace | faint }}`,
					Inactive: `   {{ .Name | cyan }}  {{ .Workspace | faint }}`,
					Selected: `{{ "✔" | green | bold }} {{ "Selected" | bold }}: {{ .Name | cyan }}  {{ .Workspace | faint }}`,
				}

				//  configure interative prompt
				prompt := promptui.Select{
					Label:     "Select app",
					Items:     projects,
					Templates: &templates,
				}

				index, _, err := prompt.Run()
				if err != nil {
					os.Exit(0)
				}

				selectedProject = projects[index]
				location = strings.ReplaceAll(selectedProject.Name, " ", "_")
			}
		} else {

			if name == "" {
				prompt := promptui.Prompt{
					Label: "Name of your new app",
				}

				name, err = prompt.Run()
				if err != nil {
					os.Exit(0)
				}
			}

			location = filepath.Join(util.WORKING_DIR, name)
		}

		//  Create the app directory
		if err := os.MkdirAll(location, os.ModePerm); err != nil {
			log.Debug(err)
			status.Fatal("Failed to create app directory")
		}

		//  Update Working Directory
		nhost.UpdateLocations(util.WORKING_DIR, location)
		util.WORKING_DIR = location

		status.Executing("Creating your app...")

		//  prepare all the mandatorily required locations
		if err := nhost.InitLocations(); err != nil {
			status.Errorln(err.Error())
		}

		//  generate Nhost configuration
		//  which will contain the information for GraphQL, Minio and other services
		nhostConfig := nhost.GenerateConfig(selectedProject)

		//  save the Nhost configuration
		if err := nhostConfig.Save(); err != nil {
			log.Debug(err)
			status.Fatal("Failed to save Nhost configuration")
		}

		//  save the default templates
		for _, item := range entities {
			if item.Default {

				//	download the files
				if err := clone(fmt.Sprintf("github.com/%s/%s", item.Repository, item.Path), *item.Destination); err != nil {
					log.WithField("compnent", "templates").Debug(err)
					status.Errorln("Failed to clone templates for " + item.Name)
				}
			}
		}

		//  append to .gitignore
		log.Debug("Writing ", util.Rel(nhost.GITIGNORE))
		if err := writeToFile(
			nhost.GITIGNORE,
			strings.Join([]string{
				".nhost",
				util.Rel(filepath.Join(nhost.WEB_DIR, "node_modules")),
				util.Rel(filepath.Join(util.WORKING_DIR, "node_modules")),
				util.Rel(filepath.Join(nhost.API_DIR, "node_modules")),
			}, "\n"), "end"); err != nil {
			log.Debug(err)
			status.Errorln("Failed to write to .gitignore file")
		}

		if remote {

			//	Save the app information
			if err := updateNhostProject(selectedProject); err != nil {
				log.Debug(err)
				status.Fatal("Failed to save app configuration")
			}

			hasuraEndpoint := fmt.Sprintf("https://%s.%s", selectedProject.Subdomain, nhost.DOMAIN)
			//	hasuraEndpoint := "http://localhost:9231"
			adminSecret := selectedProject.GraphQLAdminSecret
			//	adminSecret := "hasura-admin-secret"

			//  create new hasura client
			hasuraClient := hasura.Client{}
			if err := hasuraClient.Init(hasuraEndpoint, adminSecret, nil); err != nil {
				log.Debug(err)
				status.Fatal("Failed to initialize Hasura client")
			}

			//  create migrations from remote
			_, err := pullMigration(hasuraClient, "init")
			if err != nil {
				log.Debug(err)
				status.Fatal("Failed to pull migrations from remote")
			}

			//  write ENV variables to .env.development
			var envArray []string
			for _, row := range selectedProject.EnvVars {
				envArray = append(envArray, fmt.Sprintf(`%s=%s`, row.Name, row.Value))
			}

			envData := strings.Join(envArray, "\n")
			log.Debug("Saving environment variables")
			if err = writeToFile(nhost.ENV_FILE, envData, "end"); err != nil {
				log.Debug(err)
				status.Errorln(fmt.Sprintf("Failed to write app environment variables to %s file", util.Rel(nhost.ENV_FILE)))
			}
		}
	},
	PostRun: func(cmd *cobra.Command, args []string) {
		status.Success("Successful! Start your app with `nhost dev`")
	},
}

func prepareAppList(user nhost.User) []nhost.App {
	var projects []nhost.App
	for _, member := range user.WorkspaceMembers {
		for _, item := range member.Workspace.Apps {
			clone := item
			clone.Workspace = member.Workspace.Name
			projects = append(projects, clone)
		}
	}

	return projects
}

/*
func getProviders(endpoint, secret string) ([]string, error) {

	log.Debug("Fetching providers from remote")

	var providers []string

	//Encode the data
	postBody, _ := json.Marshal(map[string]interface{}{
		"type": "run_sql",
		"args": map[string]interface{}{
			"sql": "SELECT * FROM auth.providers;",
		},
	})

	req, _ := http.NewRequest(
		http.MethodPost,
		endpoint+"/v1/query",
		bytes.NewBuffer(postBody),
	)

	req.Header.Set("X-Hasura-Admin-Secret", secret)

	client := http.Client{}

	//Leverage Go's HTTP Post function to make request
	resp, err := client.Do(req)
	if err != nil {
		return providers, err
	}

	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)

	var responseData map[string]interface{}
	json.Unmarshal(body, &responseData)

	//  Remove the first row/head and filter providers from following rows
	//  Following is a sample result:
	//  [github facebook twitter google apple linkedin windowslive]
	result := responseData["result"].([]interface{})[1:]

	for _, value := range result {
		providers = append(providers, value.([]interface{})[0].(string))
	}

	return providers, nil
}

func getRoles(endpoint, secret string) ([]string, error) {

	log.Debug("Fetching roles from remote")

	var roles []string

	//Encode the data
	postBody, _ := json.Marshal(map[string]interface{}{
		"type": "run_sql",
		"args": map[string]interface{}{
			"sql": "SELECT * FROM auth.roles;",
		},
	})

	req, _ := http.NewRequest(
		http.MethodPost,
		endpoint+"/v1/query",
		bytes.NewBuffer(postBody),
	)

	req.Header.Set("X-Hasura-Admin-Secret", secret)

	client := http.Client{}

	//Leverage Go's HTTP Post function to make request
	resp, err := client.Do(req)
	if err != nil {
		return roles, err
	}

	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)

	var responseData map[string]interface{}
	json.Unmarshal(body, &responseData)

	//  Remove the first row/head and filter roles from following rows
	//  Following is a sample result:
	//  [user me anonymous]
	result := responseData["result"].([]interface{})[1:]

	for _, value := range result {
		roles = append(roles, value.([]interface{})[0].(string))
	}

	return roles, nil
}

*/

func init() {
	rootCmd.AddCommand(initCmd)

	//  Here you will define your flags and configuration settings.

	//  Cobra supports Persistent Flags which will work for this command
	//  and all subcommands, e.g.:
	//  initCmd.PersistentFlags().String("foo", "", "A help for foo")
	initCmd.Flags().StringVarP(&name, "name", "n", "", "Name of new app")
	initCmd.Flags().BoolVarP(&remote, "remote", "r", false, "Initialize app from remote?")
	initCmd.Flags().BoolVarP(&approve, "yes", "y", false, "Approve & bypass app initialization prompt")

	//  Cobra supports local flags which will only run when this command
	//  is called directly, e.g.:
	//  initCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}
