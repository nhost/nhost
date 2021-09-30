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

		prompt := promptui.Prompt{
			Label:     "Do you want to initialize a new Nhost app",
			IsConfirm: true,
		}

		response, err := prompt.Run()
		if err != nil || !(strings.ToLower(response) == "y" || strings.ToLower(response) == "yes") {
			os.Exit(0)
		}

		/*
			prompt = promptui.Prompt{
				Label: "Name",
			}

			name, err := prompt.Run()
			if err != nil || len(response) == 0 {
				return
			}

			//	Create the project directory
			appDir := filepath.Join(nhost.WORKING_DIR, name)
			if err := os.MkdirAll(appDir, os.ModePerm); err != nil {
				log.Debug(err)
				log.Fatal("Failed to create application directory")
			}

			//	Update current working directory to newly create app directory
			nhost.WORKING_DIR = appDir
		*/

		var selectedProject nhost.Project

		// if user has already passed remote_project as a flag,
		// then fetch list of remote projects,
		// iterate through those projects and filter that project
		if remote {

			// check if auth file exists
			if !util.PathExists(nhost.AUTH_PATH) {
				log.Debug("Auth credentials not found at: " + nhost.AUTH_PATH)

				// begin login procedure
				loginCmd.Run(cmd, args)
			}

			// validate authentication
			user, err := validateAuth(nhost.AUTH_PATH)
			if err != nil {
				log.Debug(err)
				log.Error("Failed to validate authentication")

				// begin login procedure
				loginCmd.Run(cmd, args)
			}

			// concatenate personal and team projects
			projects := user.Projects
			if len(projects) == 0 {
				log.Info("Go to https://console.nhost.io/new and create a new app")
				log.Fatal("Failed to find any apps related to this account")
			}

			// if user is part of teams which have projects, append them as well
			teams := user.Teams

			for _, team := range teams {

				// check if particular team has projects
				if len(team.Team.Projects) > 0 {
					// append the projects
					projects = append(projects, team.Team.Projects...)
				}
			}

			// if flag is empty, present selection list
			if len(project) > 0 {

				for _, item := range projects {
					if item.Name == project {
						selectedProject = item
					}
				}

				if selectedProject.ID == "" {
					log.Errorf("Remote app with name %v not found", remote)
					os.Exit(0)
				}
			} else {

				// configure interactive prompt template
				templates := promptui.SelectTemplates{
					//Label:    "{{ . }}?",
					Active:   `{{ "✔" | green | bold }} {{ .Name | cyan | bold }} {{ .Team.Name | faint }}`,
					Inactive: `   {{ .Name | cyan }}  {{ .Team.Name | faint }}`,
					Selected: `{{ "✔" | green | bold }} {{ "Selected" | bold }}: {{ .Name | cyan }}  {{ .Team.Name | faint }}`,
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

		// create root nhost folder
		if err := os.MkdirAll(nhost.NHOST_DIR, os.ModePerm); err != nil {
			log.Debug(err)
			log.Fatal("Failed to initialize root nhost directory")
		}

		// Create .nhost dir which is used for nhost specific configuration
		if err := os.MkdirAll(nhost.DOT_NHOST, os.ModePerm); err != nil {
			log.Debug(err)
			log.Fatal("Failed to initialize nhost specific directory")
		}

		// generate Nhost configuration
		// which will contain the information for GraphQL, Minio and other services
		nhostConfig := nhost.GenerateConfig(selectedProject)

		// save the Nhost configuration
		if err := nhostConfig.Save(); err != nil {
			log.Debug(err)
			log.Fatal("Failed to save Nhost configuration")
		}

		requiredDirs := []string{
			nhost.ROOT,
			nhost.MIGRATIONS_DIR,
			nhost.METADATA_DIR,
			nhost.SEEDS_DIR,
			nhost.EMAILS_DIR,
		}

		// if required directories don't exist, then create them
		for _, dir := range requiredDirs {
			if err := os.MkdirAll(dir, os.ModePerm); err != nil {
				log.Debug(err)
				log.WithField("component", filepath.Base(dir)).Fatal("Failed to create directory")
			}
		}

		// save the default templates
		for _, item := range entities {
			if item.Default {

				//download the files
				if err := clone(item.Source, item.Destination); err != nil {
					log.WithField("compnent", "templates").Debug(err)
					log.WithField("compnent", "templates").Error("Failed to clone template")
				}
			}
		}

		// create or append to .gitignore
		ignoreFile := filepath.Join(nhost.WORKING_DIR, ".gitignore")

		f, err := os.Create(ignoreFile)
		if err != nil {
			log.Debug(err)
			log.Error("Failed to create .gitignore file")
		}

		defer f.Close()
		if _, err = f.WriteString(
			fmt.Sprintf("%v\n%v\n%v\n%v",
				nhost.DOT_NHOST,
				filepath.Join(nhost.WEB_DIR, "node_modules"),
				filepath.Join(nhost.WORKING_DIR, "node_modules"),
				filepath.Join(nhost.API_DIR, "node_modules"))); err != nil {
			log.Debug(err)
			log.Error("Failed to write to .gitignore file")
		}
		f.Sync()

		// create .env.development file
		f, err = os.Create(nhost.ENV_FILE)
		if err != nil {
			log.Debug(err)
			log.Warn("Failed to create .env.developement file")
		}
		f.Close()

		if remote {

			f, err := os.Create(filepath.Join(nhost.DOT_NHOST, "nhost.yaml"))
			if err != nil {
				log.Debug(err)
				log.Fatal("Failed to write nHost configuration")
			}

			defer f.Close()
			//	Remove this repetition
			if _, err = f.WriteString("project_id: " + selectedProject.ID); err != nil {
				log.Debug(err)
				log.Fatal("Failed to write to nhost.yaml")
			}
			if _, err = f.WriteString("id: " + selectedProject.ID); err != nil {
				log.Debug(err)
				log.Fatal("Failed to write to nhost.yaml")
			}
			f.Sync()

			hasuraEndpoint := "https://" + selectedProject.ProjectDomains.Hasura
			adminSecret := selectedProject.HasuraGQEAdminSecret

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
			_, err = pullMigration(hasuraClient, "init", commonOptions)
			if err != nil {
				log.Debug(err)
				log.Fatal("Failed to create migration from remote")
			}

			// write ENV variables to .env.development
			var envArray []string
			for _, row := range selectedProject.ProjectEnvVars {
				envArray = append(envArray, fmt.Sprintf(`%s=%s`, row["name"], row["dev_value"]))
			}

			envData := strings.Join(envArray, "\n")

			// add required env vars
			envData += fmt.Sprintf("\nREGISTRATION_CUSTOM_FIELDS=%s\n", selectedProject.HBPRegistrationCustomFields)

			if len(selectedProject.BackendUserFields) > 0 {
				envData += fmt.Sprintf("JWT_CUSTOM_FIELDS=%s\n", selectedProject.BackendUserFields)
			}

			if len(selectedProject.HBPDefaultAllowedUserRoles) > 0 {
				envData += fmt.Sprintf("DEFAULT_ALLOWED_USER_ROLES=%s\n", selectedProject.HBPDefaultAllowedUserRoles)
			}

			if len(selectedProject.HBPAllowedUserRoles) > 0 {
				envData += fmt.Sprintf("ALLOWED_USER_ROLES=%s\n", selectedProject.HBPAllowedUserRoles)
			}

			if err = writeToFile(nhost.ENV_FILE, envData, "end"); err != nil {
				log.Debug(err)
				log.Error("Failed to write app environment variables to .env.development file", false)

			}
		}
	},
	PostRun: func(cmd *cobra.Command, args []string) {
		log.Info("Nhost app successfully initialized")
		log.Info("Start your environment with `nhost dev`")
	},
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

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	// initCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}
