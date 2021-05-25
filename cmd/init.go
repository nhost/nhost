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
	"io/fs"
	"io/ioutil"
	"net/http"
	"os"
	"os/exec"
	"path"
	"strings"

	"github.com/manifoldco/promptui"
	"github.com/spf13/cobra"
	"gopkg.in/yaml.v2"
)

// Hasura table structure
type Table struct {
	Data struct {
		Name   string `yaml:"name"`
		Schema string `yaml:"schema"`
	} `yaml:"table"`
	IsEnum bool `yaml:"is_enum,omitempty"`
}

var (

	// project to initialize
	projectName string
)

// initCmd represents the init command
var initCmd = &cobra.Command{
	Use:   "init",
	Short: "Initialize current directory as Nhost project",
	Long:  `Initialize current working directory as an Nhost project.`,
	Run: func(cmd *cobra.Command, args []string) {

		if pathExists(nhostDir) {
			log.Error("Project already exists in this directory")
			log.Info("To start development environment, run 'nhost' or 'nhost dev'")
			log.Warn("To delete the saved project, run 'nhost reset'")
			os.Exit(0)
		}

		// check if auth file exists
		if !pathExists(authPath) {
			log.Debug("Auth credentials not found at: " + authPath)

			// begin login procedure
			loginCmd.Run(cmd, args)
		}

		// validate authentication
		user, err := validateAuth(authPath)
		if err != nil {
			log.Debug(err)
			log.Error("Failed to validate authentication")

			// begin login procedure
			loginCmd.Run(cmd, args)
		}

		// concatenate personal and team projects
		projects := user.Projects
		if len(projects) == 0 {
			log.Fatal("We Failed to find any projects related to this account, go to https://console.nhost.io/new and create one.")
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

		var selectedProject Project

		// if user has already passed project_name as a flag,
		// then iterate through projects and filter that project,
		// avoiding taking user's choice once again through selection prompt
		if len(projectName) > 0 {

			for _, remoteProject := range projects {
				if remoteProject.Name == projectName {
					selectedProject = remoteProject
				}
			}
		} else {

			if len(projectName) > 0 {
				log.Errorf("No project found with name %s%s%s", Bold, projectName, Reset)
			}

			// if project flagged by user is not found in list of projects
			// fetched from remote, then take user's choice through
			// selection prompt

			// configure interactive prompt template
			templates := promptui.SelectTemplates{
				Active:   `✔ {{ .Name | cyan | bold }}`,
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
			selectedProject = projects[index]

			if err != nil {
				log.Debug(err)
				log.Fatal("Input prompt failed")
			}
		}

		// signify initialization is starting
		log.Info(fmt.Sprintf("Initializing Nhost project %s%s%s in this directory", Bold, selectedProject.Name, Reset))

		// create root nhost folder
		if err = os.MkdirAll(nhostDir, os.ModePerm); err != nil {
			log.Debug(err)
			log.Fatal("Failed to initialize root nhost directory")
		}

		// Create .nhost dir which is used for nhost specific configuration
		if err = os.MkdirAll(dotNhost, os.ModePerm); err != nil {
			log.Debug(err)
			log.Fatal("Failed to initialize nhost specific directory")
		}

		f, err := os.Create(path.Join(dotNhost, "nhost.yaml"))
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to write nHost configuration")
		}

		defer f.Close()
		if _, err = f.WriteString("project_id: " + selectedProject.ID); err != nil {
			log.Debug(err)
			log.Fatal("Failed to write to /nhost.yaml")
		}
		f.Sync()

		// create /config.yaml file which holds configuration for
		// GraphQL engine, PostgreSQL and HBP it is also a requirement for hasura to work
		f, err = os.Create(path.Join(nhostDir, "config.yaml"))
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to write Nhost configuration")
		}

		defer f.Close()

		// generate Nhost config
		nhostConfig := getNhostConfig(selectedProject)

		// iterate over Nhost config and write every line to yaml file
		for key, value := range nhostConfig {

			var v string

			if typeof(value) == "string" {
				v = fmt.Sprint(value.(string))
			} else if typeof(value) == "int" {
				v = fmt.Sprint(value.(int))
			}

			if _, err = f.WriteString(key + ": " + v + "\n"); err != nil {
				log.Debug(err)
				log.Fatal("Failed to add following to config - " + key + ": " + v)
			}
		}

		f.Sync()

		// check if migrations directory already exists
		if !pathExists(migrationsDir) {

			// if it doesn't exist, then create it
			if err = os.MkdirAll(migrationsDir, os.ModePerm); err != nil {
				log.Debug(err)
				log.Fatal("Failed to create migrations directory")
			}
		}

		// check if metadata directory already exists
		if !pathExists(metadataDir) {

			// if it doesn't exist, then create it
			if err = os.MkdirAll(metadataDir, os.ModePerm); err != nil {
				log.Debug(err)
				log.Fatal("Failed to create metadata directory")
			}
		}

		// create or append to .gitignore
		ignoreFile := path.Join(workingDir, ".gitignore")

		f, err = os.Create(ignoreFile)
		if err != nil {
			log.Debug(err)
			log.Error("Failed to create .gitignore file")
		}

		defer f.Close()
		if _, err = f.WriteString(".nhost\napi/node_modules"); err != nil {
			log.Debug(err)
			log.Error("Failed to write to .gitignore file")
		}
		f.Sync()

		hasuraEndpoint := "https://" + selectedProject.ProjectDomains.Hasura
		adminSecret := selectedProject.HasuraGQEAdminSecret

		// const remoteHasuraVersion = project.hasura_gqe_version
		// const dockerImage = `nhost/hasura-cli-docker:${remoteHasuraVersion}`

		// clear current migration information from remote
		if err := clearMigration(hasuraEndpoint, adminSecret); err != nil {
			log.Debug(err)
			log.Fatal("Failed to clear migrations from remote")
		}

		/*
			// Following was a failed and feeble attempt at creating migration manually
			// without requiring Hasura CLI

			resp, err := getHasuraMigrations(hasuraEndpoint, adminSecret, []string{"--schema-only"})
			if err != nil {
				Error(err, "failed to fetch migrations from remote", true)
			}

			// generate initial migration dir
			initMigrationID := xid.New()
			initMigrationDir := path.Join(migrationsDir, fmt.Sprintf(`%s_init`, initMigrationID.String()))
			if err = os.MkdirAll(initMigrationDir, os.ModePerm); err != nil {
				Error(err, "Failed to create migrations directory", true)
			}

			f, err = os.Create(path.Join(initMigrationDir, "up.sql"))
			if err != nil {
				Error(err, "failed to create initial migration", false)
			}

			defer f.Close()
			if _, err = f.WriteString(resp); err != nil {
				Error(err, "failed to create initial migration", false)
			}
			f.Sync()
		*/

		// load hasura binary
		//hasuraCLI, _ := exec.LookPath("hasura")

		hasuraCLI, _ := fetchBinary("hasura")

		commonOptions := []string{"--endpoint", hasuraEndpoint, "--admin-secret", adminSecret, "--skip-update-check"}

		// create migrations from remote
		migrationArgs := []string{hasuraCLI, "migrate", "create", "init", "--schema", "public,auth", "--from-server"}
		migrationArgs = append(migrationArgs, commonOptions...)

		execute := exec.Cmd{
			Path: hasuraCLI,
			Args: migrationArgs,
			Dir:  nhostDir,
		}
		output, err := execute.CombinedOutput()
		if err != nil {
			log.Debug(string(output))
			log.Debug(err)
			log.Fatal("Failed to create migrations from remote")
		}

		// // mark this migration as applied (--skip-execution) on the remote server
		// // so that it doesn't get run again when promoting local
		// // changes to that environment
		files, err := ioutil.ReadDir(migrationsDir)
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to read migrations directory")
		}

		var initMigration fs.FileInfo
		for _, file := range files {
			if strings.Contains(file.Name(), "init") {
				initMigration = file
			}
		}

		version := strings.Split(initMigration.Name(), "_")[0]

		// apply migrations
		migrationArgs = []string{hasuraCLI, "migrate", "apply", "--version", version, "--skip-execution"}
		migrationArgs = append(migrationArgs, commonOptions...)

		execute = exec.Cmd{
			Path: hasuraCLI,
			Args: migrationArgs,
			Dir:  nhostDir,
		}

		output, err = execute.CombinedOutput()
		if err != nil {
			log.Debug(string(output))
			log.Debug(err)
			log.Fatal("Failed to apply created migrations")
		}

		// create metadata from remote
		//spinner.text = "Create Hasura metadata";

		metadataArgs := []string{hasuraCLI, "metadata", "export"}
		metadataArgs = append(metadataArgs, commonOptions...)

		execute = exec.Cmd{
			Path: hasuraCLI,
			Args: metadataArgs,
			Dir:  nhostDir,
		}

		output, err = execute.CombinedOutput()
		if err != nil {
			log.Debug(string(output))
			log.Debug(err)
			log.Fatal("Failed to export Hasura metadata")
		}

		// auth.roles and auth.providers plus any enum compatible tables that might exist
		// all enum compatible tables must contain at least one row
		// https://hasura.io/docs/1.0/graphql/core/schema/enums.html#creating-an-enum-compatible-table

		// use the saved tables metadata to check whether this project has enum compatible tables
		fromTables, err := getEnumTablesFromMetadata(path.Join(nhostDir, "metadata", "tables.yaml"))
		if err != nil {
			log.Debug(err)

			// if tables metadata doesn't exit, fetch from API
			fromTables, err = getEnumTablesFromAPI(hasuraEndpoint, adminSecret)
			if err != nil {
				log.Debug(err)
				log.Fatal("Failed to fetch for enum tables from Hasura server")
			}
		}

		// only add seeds if enum tables exist, otherwise skip this step
		if len(fromTables) > 0 {
			seedArgs := []string{hasuraCLI, "seeds", "create", "roles_and_providers"}
			seedArgs = append(seedArgs, fromTables...)
			seedArgs = append(seedArgs, commonOptions...)

			execute := exec.Cmd{
				Path: hasuraCLI,
				Args: seedArgs,
				Dir:  nhostDir,
			}

			output, err = execute.CombinedOutput()
			if err != nil {
				log.Debug(string(output))
				log.Debug(err)
				log.Error("Failed to create seeds for enum tables")
				log.Warn("Skipping seed creation")
			}
		}

		// add extensions to init migration
		extensions, err := getExtensions(hasuraEndpoint, adminSecret)
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to check for enum tables")
		}

		for index, extension := range extensions {
			extensions[index] = fmt.Sprintf(`CREATE EXTENSION IF NOT EXISTS %s;`, extension)
		}

		extensionsWriteToFile := strings.Join(extensions, "\n")

		// add an additional line break to efficiently shift the buffer
		extensionsWriteToFile += "\n"

		// concat extensions
		// extensionsWriteToFile.concat("\n\n");
		// create or append to .gitignore
		sqlPath := path.Join(migrationsDir, initMigration.Name(), "up.sql")

		// write extensions to beginning of SQL file of init migration
		if err = writeToFile(sqlPath, extensionsWriteToFile, "start"); err != nil {
			log.Debug(err)
			log.Fatal("Failed to write extensions to SQL file")
		}

		// add auth.roles to init migration
		//spinner.text = "Add auth roles to init migration";

		roles, err := getRoles(hasuraEndpoint, adminSecret)
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to get hasura roles")
		}

		rolesSQL := "\nINSERT INTO auth.roles (role)\n    VALUES "

		var rolesMap []string
		for _, role := range roles {
			rolesMap = append(rolesMap, fmt.Sprintf(`('%s')`, role))
		}
		rolesSQL += fmt.Sprintf("%s;\n\n", strings.Join(rolesMap, ", "))

		// write roles to end of SQL file of init migration
		if err = writeToFile(sqlPath, rolesSQL, "end"); err != nil {
			log.Debug(err)
			log.Fatal("Failed to write roles to SQL file")
		}

		// add auth.providers to init migration
		//spinner.text = "Add auth providers to init migration";

		providers, err := getProviders(hasuraEndpoint, adminSecret)
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to get hasura providers")
		}

		providersSQL := "\nINSERT INTO auth.providers (provider)\n    VALUES "

		var providersMap []string
		for _, provider := range providers {
			providersMap = append(providersMap, fmt.Sprintf(`('%s')`, provider))
		}
		providersSQL += fmt.Sprintf("%s;\n\n", strings.Join(providersMap, ", "))

		// write providers to end of SQL file of init migration
		if err = writeToFile(sqlPath, providersSQL, "end"); err != nil {
			log.Debug(err)
			log.Fatal("Failed to write providers to SQL file")
		}

		// write ENV variables to .env.development
		//spinner.text = "Adding env vars to .env.development"

		// check if .env.development exists, otherwise create it
		if !pathExists(envFile) {
			f, err = os.Create(envFile)
			if err != nil {
				log.Debug(err)
				log.Warn("Failed to create .env.developement file")
			}

			defer f.Close()
			/*
				//avoid writing the extra line at top, otherwise it will create problems afterwards
				if _, err = f.WriteString("# env vars from Nhost\n"); err != nil {
					log.Debug(err)
					log.Error("Failed to write to .env.developement file")
				}
				f.Sync()
			*/
		}

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

		if err = writeToFile(envFile, envData, "end"); err != nil {
			log.Debug(err)
			log.Error("Failed to write project environment variables to .env.development file", false)
		}

		log.Info("Nhost backend succesfully initialized")

		log.Info("See you later, grasshopper!")

	},
}

/*
// fetches migrations from remote Hasura server to be applied manually
func getHasuraMigrations(endpoint, secret string, options []string) (string, error) {

	if VERBOSE {
		Print("fetching migrations from remote", "info")
	}

	//Encode the data
	postBody, _ := json.Marshal(map[string]interface{}{
		"opts":         options,
		"clean_output": true,
	})

	req, _ := http.NewRequest(
		http.MethodPost,
		endpoint+"/v1alpha1/pg_dump",
		bytes.NewBuffer(postBody),
	)

	req.Header.Set("X-Hasura-Admin-Secret", secret)
	req.Header.Set("X-Hasura-Role", "admin")

	client := http.Client{}

	//Leverage Go's HTTP Post function to make request
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}

	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)

	return string(body), nil
}
*/
func getExtensions(endpoint, secret string) ([]string, error) {

	log.Debug("Fetching extensions")

	var extensions []string

	//Encode the data
	postBody, _ := json.Marshal(map[string]interface{}{
		"type": "run_sql",
		"args": map[string]interface{}{
			"sql": "SELECT * FROM pg_extension;",
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
		return extensions, err
	}

	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)

	var responseData map[string]interface{}
	json.Unmarshal(body, &responseData)

	// Remove the first row/head and filter extensions from following rows
	// Following is a sample result:
	// [plpgsql pgcrypto citext]
	result := responseData["result"].([]interface{})[1:]

	// convert from []interface{} to []string before returning
	for _, value := range result {
		enumerable_value := value.([]interface{})
		for index, ext := range enumerable_value {
			if index == 1 {
				extensions = append(extensions, fmt.Sprint(ext))
			}
		}
	}

	return extensions, nil
}

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

func getEnumTablesFromAPI(endpoint, secret string) ([]string, error) {

	log.Debug("Fetching enumerable tables from remote")

	var fromTables []string

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
		return fromTables, err
	}

	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)

	var tables map[string]interface{}
	json.Unmarshal(body, &tables)

	enumerable_tables := tables["tables"].([]interface{})

	for _, table := range enumerable_tables {

		parsedTable := table.(map[string]interface{})
		parsedTableEnumFlag := parsedTable["is_enum"]

		if parsedTableEnumFlag != nil && parsedTableEnumFlag.(bool) {
			fromTables = append(fromTables, "--from-table")
			fromTables = append(fromTables, fmt.Sprintf(
				`%s.%s`,
				parsedTable["table"].(map[string]interface{})["schema"],
				parsedTable["table"].(map[string]interface{})["name"],
			))
		}
	}

	return fromTables, nil
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

// generates fresh config.yaml for /nhost dir
func getNhostConfig(options Project) map[string]interface{} {

	log.Debug("Generating Nhost configuration")

	return map[string]interface{}{
		"version":                     2,
		"metadata_directory":          "metadata",
		"hasura_graphql_version":      options.HasuraGQEVersion,
		"hasura_graphql_port":         8080,
		"hasura_console_port":         9695,
		"hasura_graphql_admin_secret": 123456,
		"hasura_backend_plus_version": options.BackendVersion,
		"hasura_backend_plus_port":    9001,
		"postgres_version":            options.PostgresVersion,
		"postgres_port":               5432,
		"postgres_user":               "postgres",
		"postgres_password":           "postgres",
		"minio_port":                  9000,
		"api_port":                    4000,
		"env_file":                    envFile,
		"provider_success_redirect":   "http://localhost:3000",
		"provider_failure_redirect":   "http://localhost:3000/login-fail",
		"google_enable":               false,
		"google_client_id":            "",
		"google_client_secret":        "",
		"github_enable":               false,
		"github_client_id":            "",
		"github_client_secret":        "",
		"facebook_enable":             false,
		"facebook_client_id":          "",
		"facebook_client_secret":      "",
		"linkedin_enable":             false,
		"linkedin_client_id":          "",
		"linkedin_client_secret":      "",
	}
}

func init() {
	rootCmd.AddCommand(initCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	// initCmd.PersistentFlags().String("foo", "", "A help for foo")
	initCmd.PersistentFlags().StringVarP(&projectName, "project", "p", "", "project name")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	// initCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}
