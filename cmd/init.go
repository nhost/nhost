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
	"github.com/mrinalwahal/cli/hasura"
	"github.com/mrinalwahal/cli/nhost"
	"github.com/mrinalwahal/cli/util"
	"github.com/spf13/cobra"
)

var (
	project string
	remote  bool
)

// initCmd represents the init command
var initCmd = &cobra.Command{
	Use:                "init",
	Short:              "Initialize current directory as Nhost app",
	Long:               `Initialize current working directory as an Nhost application.`,
	DisableFlagParsing: true,
	PreRun: func(cmd *cobra.Command, args []string) {

		if util.PathExists(nhost.NHOST_DIR) {
			log.Error("App already exists in this directory")
			log.Info("To start development environment, run 'nhost' or 'nhost dev'")
			os.Exit(0)
		}

		cmd.Flags().Parse(args)
		if contains(args, "-r") || contains(args, "--remote") {
			remote = true
		}

	},
	Run: func(cmd *cobra.Command, args []string) {

		if !approve {
			prompt := promptui.Prompt{
				Label:     "Do you want to initialize a new Nhost app in this directory",
				IsConfirm: true,
			}

			_, err := prompt.Run()
			if err != nil {
				os.Exit(0)
			}
		}

		//	Prepare list of required directories before you create them
		requiredDirs := []*string{
			&nhost.ROOT,
			&nhost.NHOST_DIR,
			&nhost.MIGRATIONS_DIR,
			&nhost.METADATA_DIR,
			&nhost.SEEDS_DIR,
			&nhost.EMAILS_DIR,
			&nhost.DOT_NHOST,
			&nhost.EMAILS_DIR,
		}

		//	Prepare list of required files before you create them
		requiredFiles := []*string{
			&nhost.CONFIG_PATH,
			&nhost.ENV_FILE,
			&nhost.GITIGNORE,
			&nhost.INFO_PATH,
		}

		var selectedProject nhost.App

		// if user has already passed remote_project as a flag,
		// then fetch list of remote projects,
		// iterate through those projects and filter that project
		if remote {

			// validate authentication
			user, err := getUser(nhost.AUTH_PATH)
			if err != nil {
				log.Debug(err)
				log.Fatal("Failed to fetch user information")
			}

			// concatenate personal and team projects
			projects := prepareAppList(user)

			if len(projects) == 0 {
				log.Error("No remote apps found")
				log.Info("Run `nhost init` to create new one locally")
				return
			}

			// if flag is empty, present selection list
			if project != "" {

				for _, item := range projects {
					if item.Name == project {
						selectedProject = item
					}
				}

				if selectedProject.ID == "" {
					log.Errorf("Remote app '%v' not found", project)
					os.Exit(0)
				}
			} else {

				// configure interactive prompt template
				templates := promptui.SelectTemplates{
					//Label:    "{{ . }}?",
					Active:   `{{ "✔" | green | bold }} {{ .Name | cyan | bold }} {{ .Workspace | faint }}`,
					Inactive: `   {{ .Name | cyan }}  {{ .Workspace | faint }}`,
					Selected: `{{ "✔" | green | bold }} {{ "Selected" | bold }}: {{ .Name | cyan }}  {{ .Workspace | faint }}`,
				}

				// configure interative prompt
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
			}
		}

		//	if required directories don't exist, then create them
		for _, dir := range requiredDirs {
			if err := os.MkdirAll(*dir, os.ModePerm); err != nil {
				log.Debug(err)
				log.WithField("component", filepath.Base(*dir)).Fatal("Failed to create directory")
			}
		}

		//	if required files don't exist, then create them
		for _, file := range requiredFiles {
			if _, err := os.Create(*file); err != nil {
				log.Debug(err)
				log.WithField("component", filepath.Base(*file)).Fatal("Failed to create file")
			}
		}

		// generate Nhost configuration
		// which will contain the information for GraphQL, Minio and other services
		nhostConfig := nhost.GenerateConfig(selectedProject)

		// save the Nhost configuration
		if err := nhostConfig.Save(); err != nil {
			log.Debug(err)
			log.Fatal("Failed to save Nhost configuration")
		}

		// save the default templates
		for _, item := range entities {
			if item.Default {

				//	download the files
				if err := clone(item.Source, item.Destination); err != nil {
					log.WithField("compnent", "templates").Debug(err)
					log.Error("Failed to clone template")
				}
			}
		}

		// append to .gitignore
		if err := writeToFile(
			nhost.GITIGNORE,
			fmt.Sprintf("%v\n%v\n%v\n%v",
				nhost.DOT_NHOST,
				filepath.Join(nhost.WEB_DIR, "node_modules"),
				filepath.Join(nhost.WORKING_DIR, "node_modules"),
				filepath.Join(nhost.API_DIR, "node_modules")), "end"); err != nil {
			log.Debug(err)
			log.Error("Failed to write to .gitignore file")
		}

		if remote {

			//	Save the app information
			if err := updateNhostProject(selectedProject); err != nil {
				log.Debug(err)
				log.Fatal("Failed to save app configuration")
			}

			hasuraEndpoint := fmt.Sprintf("https://%s.%s", selectedProject.Subdomain, nhost.DOMAIN)
			//	hasuraEndpoint := "http://localhost:9231"
			adminSecret := selectedProject.GraphQLAdminSecret
			//	adminSecret := "hasura-admin-secret"

			// create new hasura client
			hasuraClient := hasura.Client{}
			if err := hasuraClient.Init(hasuraEndpoint, adminSecret, nil); err != nil {
				log.Debug(err)
				log.Fatal("Failed to initialize Hasura client")
			}

			commonOptions := []string{"--endpoint", hasuraEndpoint, "--admin-secret", adminSecret, "--skip-update-check"}

			// clear current migration information from remote
			if err := hasuraClient.ClearMigration(); err != nil {
				log.Debug(err)
				log.Fatal("Failed to clear migrations from remote")
			}

			// create migrations from remote
			_, err := pullMigration(hasuraClient, "init", commonOptions)
			if err != nil {
				log.Debug(err)
				log.Fatal("Failed to pull migrations from remote")
			}

			// write ENV variables to .env.development
			var envArray []string
			for _, row := range selectedProject.EnvVars {
				envArray = append(envArray, fmt.Sprintf(`%s=%s`, row.Name, row.Value))
			}

			envData := strings.Join(envArray, "\n")
			if err = writeToFile(nhost.ENV_FILE, envData, "end"); err != nil {
				log.Debug(err)
				log.Errorf("Failed to write app environment variables to %s file", util.Rel(nhost.ENV_FILE))
			}
		}
	},
	PostRun: func(cmd *cobra.Command, args []string) {
		log.Info("Successful! Start your app with `nhost dev`")
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

	// Remove the first row/head and filter providers from following rows
	// Following is a sample result:
	// [github facebook twitter google apple linkedin windowslive]
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

	// Remove the first row/head and filter roles from following rows
	// Following is a sample result:
	// [user me anonymous]
	result := responseData["result"].([]interface{})[1:]

	for _, value := range result {
		roles = append(roles, value.([]interface{})[0].(string))
	}

	return roles, nil
}

func getEnumTablesFromMetadata(filePath string) ([]string, error) {

	log.Debug("Fetching enum tables from metadata")

	// initalize empty list of tables from which seeds will be created
	var fromTables []string

	// if tables metadata file doesn't exists, return error
	if !pathExists(filePath) {
		return fromTables, errors.New("metadata file doesn't exist")
	}

	// open and read the contents of the file
	f, _ := ioutil.ReadFile(filePath)

	var tables []Table
	yaml.Unmarshal(f, &tables)

	for _, table := range tables {

		// check if the table "is_enum: true"
		if table.IsEnum {

			// append to seed tables if true
			fromTables = append(fromTables, "--from-table")
			fromTables = append(fromTables, fmt.Sprintf(
				`%s.%s`,
				table.Data.Schema,
				table.Data.Name,
			))
		}
	}

	return fromTables, nil
}
*/

func filterEnumTables(tables []hasura.TableEntry) []hasura.TableEntry {

	var fromTables []hasura.TableEntry

	for _, table := range tables {
		if table.IsEnum != nil {
			fromTables = append(fromTables, table)
		}
	}

	return fromTables
}

/*
func getMetadata(endpoint, secret string) (hasura.HasuraMetadataV2, error) {

	log.Debug("Fetching metadata from remote")

	var response hasura.HasuraMetadataV2

	//Encode the data
	postBody, _ := json.Marshal(map[string]interface{}{
		"type": "export_metadata",
		"args": map[string]string{},
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
		return response, err
	}

	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)

	response, err = hasura.UnmarshalHasuraMetadataV2(body)
	return response, err
}

func clearMigration(endpoint, secret string) error {

	log.Debug("Clearing migration information from remote")

	//Encode the data
	postBody, _ := json.Marshal(map[string]interface{}{
		"type": "run_sql",
		"args": map[string]string{
			"sql": "TRUNCATE hdb_catalog.schema_migrations;",
		},
	})

	req, _ := http.NewRequest(
		http.MethodPost,
		endpoint+"/v1/query",
		bytes.NewBuffer(postBody),
	)

	req.Header.Set("x-hasura-admin-secret", secret)
	req.Header.Set("Content-Type", "application/json")

	client := http.Client{}

	//Leverage Go's HTTP Post function to make request
	_, err := client.Do(req)
	return err
}
*/

func init() {
	rootCmd.AddCommand(initCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	// initCmd.PersistentFlags().String("foo", "", "A help for foo")
	initCmd.Flags().StringVarP(&project, "remote", "r", "", "Name of a remote app")
	initCmd.Flags().BoolVarP(&approve, "yes", "y", false, "Approve & bypass app initialization prompt")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	// initCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}
