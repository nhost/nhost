/*
Copyright © 2021 Mrinal Wahal mrinalwahal@gmail.com

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
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
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

// initCmd represents the init command
var initCmd = &cobra.Command{
	Use:   "init",
	Short: "Initialize current directory as Nhost project",
	Long:  `Initialize current working directory as an Nhost project.`,
	Run: func(cmd *cobra.Command, args []string) {

		if verbose {
			printMessage("Initializing a new Nhost project...", "info")
		}

		// check if project is already initialized
		if pathExists(nhostDir) {
			throwError(nil, "this directory already has a project configured at ./nhost, skipping...", true)
		}

		// check if hasura is installed
		if !verifyUtility("hasura") {
			throwError(nil, "Hasura CLI missing: follow instructions here - https://hasura.io/docs/1.0/graphql/manual/hasura-cli/install-hasura-cli.html", true)
		}

		// check if auth file exists
		if !pathExists(authPath) {
			throwError(nil, "credentials not found: please login first with `nhost login`", true)
		}

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
			throwError(err, "prompt failed"+err.Error(), true)
		}

		// create root nhost folder
		if err = os.MkdirAll(nhostDir, os.ModePerm); err != nil {
			throwError(err, "couldn't initialize root nhost directory.", true)
		}

		// Create .nhost dir which is used for nhost specific configuration
		if err = os.MkdirAll(dotNhost, os.ModePerm); err != nil {
			throwError(err, "couldn't initialize nhost specific directory", true)
		}

		f, err := os.Create(path.Join(dotNhost, "nhost.yaml"))
		if err != nil {
			throwError(err, "failed to write nHost configuration", true)
		}

		defer f.Close()
		if _, err = f.WriteString("project_id: " + selectedProject.ID); err != nil {
			throwError(err, "couldn't write to /nhost.yaml", true)
		}
		f.Sync()

		// create /config.yaml file which holds configuration for
		// GraphQL engine, PostgreSQL and HBP it is also a requirement for hasura to work
		f, err = os.Create(path.Join(nhostDir, "config.yaml"))
		if err != nil {
			throwError(err, "failed to write Nhost configuration", true)
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
				throwError(err, "failed to add following to config - "+key+": "+v, true)
			}
		}

		f.Sync()

		// check if migrations directory already exists
		if !pathExists(migrationsDir) {

			// if it doesn't exist, then create it
			if err = os.MkdirAll(migrationsDir, os.ModePerm); err != nil {
				throwError(err, "couldn't create migrations directory", true)
			}
		}

		// check if metadata directory already exists
		if !pathExists(metadataDir) {

			// if it doesn't exist, then create it
			if err = os.MkdirAll(metadataDir, os.ModePerm); err != nil {
				throwError(err, "couldn't create metadata directory", true)
			}
		}

		// create or append to .gitignore
		ignoreFile := path.Join(workingDir, ".gitignore")

		f, err = os.Create(ignoreFile)
		if err != nil {
			throwError(err, "failed to create .gitignore file", false)
		}

		defer f.Close()
		if _, err = f.WriteString(".nhost\napi/node_modules"); err != nil {
			throwError(err, "couldn't write to .gitignore file", false)
		}
		f.Sync()

		// check if .env.development exists, otherwise create it
		if !pathExists(envFile) {
			f, err = os.Create(envFile)
			if err != nil {
				throwError(err, "failed to create .gitignore file", true)
			}

			defer f.Close()
			if _, err = f.WriteString("# env vars from Nhost\n"); err != nil {
				throwError(err, "couldn't write to .env.developement file", true)
			}
			f.Sync()
		}

		hasuraEndpoint := "https://" + selectedProject.ProjectDomains.Hasura
		adminSecret := selectedProject.HasuraGQEAdminSecret

		// const remoteHasuraVersion = project.hasura_gqe_version
		// const dockerImage = `nhost/hasura-cli-docker:${remoteHasuraVersion}`

		// clear current migration information from remote
		if err := clearMigration(hasuraEndpoint, adminSecret); err != nil {
			throwError(err, "couldn't clear migrations from remote.", true)
		}

		//s.Suffix = "Creating migrations from remote..."

		hasuraCLI, _ := exec.LookPath("hasura")

		commonOptions := []string{"--endpoint", hasuraEndpoint, "--admin-secret", adminSecret, "--skip-update-check"}

		// create migrations from remote
		migrationArgs := []string{hasuraCLI, "migrate", "create", "init", "--schema", "public,auth", "--from-server"}
		migrationArgs = append(migrationArgs, commonOptions...)

		execute := exec.Cmd{
			Path:   hasuraCLI,
			Args:   migrationArgs,
			Stdout: os.Stdout,
			Stderr: os.Stderr,
			Dir:    nhostDir,
		}

		if err = execute.Run(); err != nil {
			throwError(err, "couldn't create migrations from remote", true)
		}

		// // mark this migration as applied (--skip-execution) on the remote server
		// // so that it doesn't get run again when promoting local
		// // changes to that environment
		files, err := ioutil.ReadDir(migrationsDir)
		if err != nil {
			throwError(err, "couldn't read migrations directory", true)
		}

		initMigration := files[0]
		version := strings.Split(initMigration.Name(), "_")[0]

		// apply migrations
		migrationArgs = []string{hasuraCLI, "migrate", "apply", "--version", version, "--skip-execution"}
		migrationArgs = append(migrationArgs, commonOptions...)

		execute = exec.Cmd{
			Path:   hasuraCLI,
			Args:   migrationArgs,
			Stdout: os.Stdout,
			Stderr: os.Stderr,
			Dir:    nhostDir,
		}

		if err = execute.Run(); err != nil {
			throwError(err, "couldn't apply created migrations.", true)
		}

		// create metadata from remote
		//spinner.text = "Create Hasura metadata";

		metadataArgs := []string{hasuraCLI, "metadata", "export"}
		metadataArgs = append(metadataArgs, commonOptions...)

		execute = exec.Cmd{
			Path:   hasuraCLI,
			Args:   metadataArgs,
			Stdout: os.Stdout,
			Stderr: os.Stderr,
			Dir:    nhostDir,
		}

		if err = execute.Run(); err != nil {
			throwError(err, "couldn't export metadata.", true)
		}

		// [BROKEN CODE] - Enum Table seed creation is not yet working.

		// auth.roles and auth.providers plus any enum compatible tables that might exist
		// all enum compatible tables must contain at least one row
		// https://hasura.io/docs/1.0/graphql/core/schema/enums.html#creating-an-enum-compatible-table

		// use the API to check whether this project has enum compatible tables
		//spinner.text = "Adding enum tables"

		fromTables, err := getEnumTablesFromMetadata(path.Join(nhostDir, "metadata", "tables.yaml"))
		if err != nil {

			// if tables metadata doesn't exit, fetch from API
			fromTables, err = getEnumTablesFromAPI(hasuraEndpoint, adminSecret)
			if err != nil {
				throwError(err, "couldn't fetch for enum tables from Hasura server.", true)
			}
		}

		// only add seeds if enum tables exist, otherwise skip this step
		if len(fromTables) > 0 {
			seedArgs := []string{hasuraCLI, "seeds", "create", "roles_and_providers", fromTables}
			seedArgs = append(seedArgs, commonOptions...)

			//fmt.Println(seedArgs)

			execute = exec.Cmd{
				Path: hasuraCLI,
				Args: seedArgs,
				Dir:  nhostDir,
			}

			if err := execute.Run(); err != nil {
				throwError(err, "couldn't create seeds", false)
				printMessage("skipping seed creation...", "warn")
			}
		}

		// add extensions to init migration
		//spinner.text = "Add Postgres extensions to init migration";

		extensions, err := getExtensions(hasuraEndpoint, adminSecret)
		if err != nil {
			throwError(err, "couldn't check for enum tables.", true)
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
			throwError(err, "couldn't write extensions to SQL file", true)
		}

		// add auth.roles to init migration
		//spinner.text = "Add auth roles to init migration";

		roles, err := getRoles(hasuraEndpoint, adminSecret)
		if err != nil {
			throwError(err, "couldn't get hasura roles.", true)
		}

		rolesSQL := "\nINSERT INTO auth.roles (role)\n    VALUES "

		var rolesMap []string
		for _, role := range roles {
			rolesMap = append(rolesMap, fmt.Sprintf(`('%s')`, role))
		}
		rolesSQL += fmt.Sprintf("%s;\n\n", strings.Join(rolesMap, ", "))

		// write roles to end of SQL file of init migration
		if err = writeToFile(sqlPath, rolesSQL, "end"); err != nil {
			throwError(err, "couldn't write roles to SQL file", true)
		}

		// add auth.providers to init migration
		//spinner.text = "Add auth providers to init migration";

		providers, err := getProviders(hasuraEndpoint, adminSecret)
		if err != nil {
			throwError(err, "couldn't get hasura providers.", true)
		}

		providersSQL := "\nINSERT INTO auth.providers (provider)\n    VALUES "

		var providersMap []string
		for _, provider := range providers {
			providersMap = append(providersMap, fmt.Sprintf(`('%s')`, provider))
		}
		providersSQL += fmt.Sprintf("%s;\n\n", strings.Join(providersMap, ", "))

		// write providers to end of SQL file of init migration
		if err = writeToFile(sqlPath, providersSQL, "end"); err != nil {
			throwError(err, "couldn't write providers to SQL file", true)
		}

		// write ENV variables to .env.development
		//spinner.text = "Adding env vars to .env.development"

		var envArray []string
		for key, value := range selectedProject.ProjectEnvVars {
			envArray = append(envArray, fmt.Sprintf(`%s=%s`, key, value))
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
			throwError(err, "couldn't write project environment variables to .env.development file", false)
		}

		printMessage("Nhost project succesfully initialized.", "success")
	},
}

func getExtensions(endpoint, secret string) ([]string, error) {

	if verbose {
		printMessage("fetching extensions...", "info")
	}

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

	if verbose {
		printMessage("fetching providers from remote...", "info")
	}

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

	if verbose {
		printMessage("fetching roles from remote...", "info")
	}

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

func getEnumTablesFromMetadata(filePath string) (string, error) {

	if verbose {
		printMessage("fetching enum tables from metadata...", "info")
	}

	var fromTables string

	// if tables metadata file doesn't exists, return error
	if !pathExists(filePath) {
		return fromTables, errors.New("metadata file doesn't exist")
	}

	// open and read the contents of the file
	f, _ := ioutil.ReadFile(filePath)

	var tables []Table
	yaml.Unmarshal(f, &tables)

	// initalize empty list of tables from which seeds will be created
	var seedTables []string

	for _, table := range tables {

		// check if the table "is_enum: true"
		if table.IsEnum {

			// append to seed tables if true
			seedTables = append(seedTables, fmt.Sprintf(
				`%s.%s`,
				table.Data.Schema,
				table.Data.Name,
			))
		}
	}

	for _, value := range seedTables {
		fromTables = fromTables + " --from-table " + value
	}

	return fromTables, nil
}

func getEnumTablesFromAPI(endpoint, secret string) (string, error) {

	if verbose {
		printMessage("fetching enumerable tables from remote...", "info")
	}

	var fromTables string

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

	var seedTables []string
	var tables map[string]interface{}
	json.Unmarshal(body, &tables)

	enumerable_tables := tables["tables"].([]interface{})

	for _, table := range enumerable_tables {

		parsedTable := table.(map[string]interface{})
		parsedTableEnumFlag := parsedTable["is_enum"]

		if parsedTableEnumFlag != nil && parsedTableEnumFlag.(bool) {
			seedTables = append(seedTables, fmt.Sprintf(
				`%s.%s`,
				parsedTable["table"].(map[string]interface{})["schema"],
				parsedTable["table"].(map[string]interface{})["name"],
			))
		}
	}

	for _, value := range seedTables {
		fromTables = fromTables + " --from-table " + value
	}

	return fromTables, nil
}

func clearMigration(endpoint, secret string) error {

	if verbose {
		printMessage("clearing migration information from remote...", "info")
	}

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

	if verbose {
		printMessage("generating Nhost configuration...", "info")
	}

	return map[string]interface{}{
		"version":                     2,
		"metadata_directory":          "metadata",
		"hasura_graphql_version":      options.HasuraGQEVersion,
		"hasura_graphql_port":         8080,
		"hasura_graphql_admin_secret": 123456,
		"hasura_backend_plus_version": options.BackendVersion,
		"hasura_backend_plus_port":    9001,
		"postgres_version":            options.PostgresVersion,
		"postgres_port":               5432,
		"postgres_user":               "postgres",
		"postgres_password":           "postgres",
		"minio_port":                  9000,
		"api_port":                    4000,
		"env_file":                    "../.env.development",
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

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	// initCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}
