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

	"github.com/nhost/cli/hasura"
	"github.com/spf13/cobra"
	"gopkg.in/yaml.v2"
)

var (

	// project to initialize
	remoteProject string
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
			log.Info("To delete the saved project, run 'nhost reset'")
			os.Exit(0)
		}

		var selectedProject Project

		// if user has already passed remote_project as a flag,
		// then fetch list of remote projects,
		// iterate through those projects and filter that project
		if len(remoteProject) > 0 {

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
				log.Info("Go to https://console.nhost.io/new and create a new project")
				log.Fatal("Failed to find any projects related to this account")
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

			for _, project := range projects {
				if project.Name == remoteProject {
					selectedProject = project
				}
			}

			if selectedProject.ID == "" {
				log.Errorf("Remote project with name %v not found", remoteProject)

				// reset the created directories
				resetCmd.Run(cmd, []string{"exit"})
			}

		}

		// signify initialization is starting
		log.Info("Initializing Nhost project in this directory")

		// create root nhost folder
		if err := os.MkdirAll(nhostDir, os.ModePerm); err != nil {
			log.Debug(err)
			log.Fatal("Failed to initialize root nhost directory")
		}

		// Create .nhost dir which is used for nhost specific configuration
		if err := os.MkdirAll(dotNhost, os.ModePerm); err != nil {
			log.Debug(err)
			log.Fatal("Failed to initialize nhost specific directory")
		}

		// create nhost/config.yaml file which holds configuration for
		// GraphQL engine, PostgreSQL and HBP it is also a requirement for hasura to work
		f, err := os.Create(path.Join(nhostDir, "config.yaml"))
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to write Nhost configuration")
		}

		defer f.Close()

		nhostConfig := getNhostConfig(selectedProject)

		// convert generated Nhost configuration to YAML
		marshalled, err := yaml.Marshal(nhostConfig)
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to marshal generated Nhost onfiguration")
		}

		// write the marshalled YAML configuration to file
		if _, err = f.Write(marshalled); err != nil {
			log.Debug(err)
			log.Fatal("Failed to write Nhost config")
		}

		f.Sync()

		// check if migrations directory already exists

		requiredDirs := []string{
			migrationsDir,
			metadataDir,
			seedsDir,
		}

		// if required directories don't exist, then create them
		for _, dir := range requiredDirs {
			if err = os.MkdirAll(dir, os.ModePerm); err != nil {
				log.Debug(err)
				log.WithField("component", path.Base(dir)).Fatal("Failed to create directory")
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
		if _, err = f.WriteString(
			fmt.Sprintf("%v\n%v\n%v",
				path.Base(dotNhost),
				path.Join("api", "node_modules"),
				path.Join("web", "node_modules"))); err != nil {
			log.Debug(err)
			log.Error("Failed to write to .gitignore file")
		}
		f.Sync()

		// create .env.development file
		f, err = os.Create(envFile)
		if err != nil {
			log.Debug(err)
			log.Warn("Failed to create .env.developement file")
		}
		f.Close()

		if len(remoteProject) > 0 {

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

			hasuraEndpoint := "https://" + selectedProject.ProjectDomains.Hasura
			adminSecret := selectedProject.HasuraGQEAdminSecret

			// const remoteHasuraVersion = project.hasura_gqe_version
			// const dockerImage = `nhost/hasura-cli-docker:${remoteHasuraVersion}`

			// clear current migration information from remote
			if err := clearMigration(hasuraEndpoint, adminSecret); err != nil {
				log.Debug(err)
				log.Fatal("Failed to clear migrations from remote")
			}

			// load hasura binary
			hasuraCLI, _ := fetchBinary("hasura", fmt.Sprintf("%v", nhostConfig.Environment["hasura_cli_version"]))

			commonOptions := []string{"--endpoint", hasuraEndpoint, "--admin-secret", adminSecret, "--skip-update-check"}

			// create migrations from remote
			migration, err := pullMigration(hasuraCLI, "init", hasuraEndpoint, adminSecret, commonOptions)
			if err != nil {
				log.Debug(err)
				log.Fatal("Failed to create migration from remote")
			}

			sqlFiles, err := ioutil.ReadDir(path.Join(migrationsDir, migration.Name()))
			if err != nil {
				log.Debug(err)
				log.Fatal("Failed to traverse migrations directory")
			}

			for _, file := range sqlFiles {

				sqlPath := path.Join(migrationsDir, migration.Name(), file.Name())

				// format the new migration
				// so that it doesn't conflicts with existing migrations
				if err = formatMigration(sqlPath); err != nil {
					log.Debug(err)
					log.Fatal("Failed to format migration")
				}

				// add or update extensions to new migration
				if err = addExtensionstoMigration(sqlPath, hasuraEndpoint, adminSecret); err != nil {
					log.Debug(err)
					log.Fatal("Failed to format migration")
				}

			}

			/*
					// avoid adding auth and providers to migration
					// since HBP 2.5.0 separated auth and storage schema

					// add auth.roles to init migration
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
				rolesSQL += fmt.Sprintf("%s ON CONFLICT DO NOTHING;\n\n", strings.Join(rolesMap, ", "))

				// write roles to end of SQL file of init migration
				if err = writeToFile(sqlPath, rolesSQL, "end"); err != nil {
					log.Debug(err)
					log.Fatal("Failed to write roles to SQL file")
				}


					// add auth.providers to init migration
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
						providersSQL += fmt.Sprintf("%s ON CONFLICT DO NOTHING;\n\n", strings.Join(providersMap, ", "))

						// write providers to end of SQL file of init migration
						if err = writeToFile(sqlPath, providersSQL, "end"); err != nil {
							log.Debug(err)
							log.Fatal("Failed to write providers to SQL file")
						}

			*/

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

			if err = writeToFile(envFile, envData, "end"); err != nil {
				log.Debug(err)
				log.Error("Failed to write project environment variables to .env.development file", false)

			}
		}

		log.Info("Nhost backend successfully initialized")
	},
}

// fetches migrations from remote Hasura server to be applied manually
func getMigration(endpoint, secret string, options []string) (string, error) {

	log.Info("Fetching migration from remote")

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
	fmt.Println(string(body))
	return string(body), nil
}

func getSchemaList(endpoint, secret string) ([]string, error) {

	log.Debug("Fetching schema list from remote")

	var list []string

	//Encode the data
	postBody, _ := json.Marshal(map[string]interface{}{
		"type": "run_sql",
		"args": map[string]interface{}{
			"sql": "SELECT schema_name FROM information_schema.schemata;",
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
		return list, err
	}

	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)

	var responseData map[string]interface{}
	json.Unmarshal(body, &responseData)

	// Remove the first row/head and filter schemas from following rows
	// Following is a sample result:
	// From the list: [schema_name] [pg_toast] [pg_temp_1] [pg_toast_temp_1] [pg_catalog] [public] [information_schema] [hdb_catalog] [hdb_views] [auth]
	// Only output: [public]
	result := responseData["result"].([]interface{})[1:]

	schemasToBeExcluded := []string{"information_schema", "auth", "storage"}

	for _, value := range result {

		parsedValue := value.([]interface{})[0].(string)

		if !strings.Contains(parsedValue, "pg_") &&
			!strings.Contains(parsedValue, "hdb_") &&
			!contains(schemasToBeExcluded, parsedValue) {
			list = append(list, value.([]interface{})[0].(string))
		}
	}

	return list, nil
}

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

// generates fresh config.yaml for /nhost dir
func getNhostConfig(options Project) Configuration {

	log.Debug("Generating Nhost configuration")

	hasura := Service{
		Version:     "v1.3.3",
		Image:       "hasura/graphql-engine",
		AdminSecret: "hasura-admin-secret",
		Port:        8080,
		ConsolePort: 9695,
	}

	/*
		// if it's a Mac,
		// add a custom Hasura GraphQL Engine image
		// because it doesn't support the official one
		if runtime.GOOS == "darwin" {
			hasura["image"] = "fedormelexin/graphql-engine-arm64"
		}
	*/

	// check if a loaded remote project has been passed
	if options.HasuraGQEVersion != "" {
		hasura.Version = options.HasuraGQEVersion
	}

	postgres := Service{
		Version:  12,
		User:     "postgres",
		Password: "postgres",
		Port:     5432,
	}

	if options.PostgresVersion != "" {
		postgres.Version = options.PostgresVersion
	}

	hbp := Service{
		Version: "v2.5.0",
		Port:    9001,
	}

	if options.BackendVersion != "" {
		hbp.Version = options.BackendVersion
	}

	authentication := map[string]interface{}{
		"endpoints": map[string]interface{}{
			"provider_success_redirect": "http://localhost:3000",
			"provider_failure_redirect": "http://localhost:3000/login-fail",
		},
		"providers": generateProviders(),
	}

	authPayload, _ := yaml.Marshal(authentication)

	var auth Authentication
	yaml.Unmarshal(authPayload, &auth)

	payload := Configuration{
		Version: 2,
		Services: map[string]Service{
			"postgres":            postgres,
			"hasura":              hasura,
			"hasura_backend_plus": hbp,
			"minio": Service{
				Version: "latest",
				Port:    9000,
			},
			"api": Service{
				Port: 4000,
			},
		},
		Environment: map[string]interface{}{
			"env_file":           envFile,
			"hasura_cli_version": "v2.0.0-alpha.11",
		},
		MetadataDirectory: "metadata",
		Authentication:    auth,
	}

	return payload
}

func generateProviders() map[string]interface{} {

	payload := map[string]interface{}{
		"google": map[string]interface{}{
			"enable":        false,
			"client_id":     "",
			"client_secret": "",
			"scope":         "email,profile",
		},
		"facebook": map[string]interface{}{
			"enable":        false,
			"client_id":     "",
			"client_secret": "",
			"scope":         "email,photos,displayName",
		},
		"twitter": map[string]interface{}{
			"enable":          false,
			"consumer_key":    "",
			"consumer_secret": "",
		},
		"linkedin": map[string]interface{}{
			"enable":        false,
			"client_id":     "",
			"client_secret": "",
			"scope":         "r_emailaddress,r_liteprofile",
		},
		"apple": map[string]interface{}{
			"enable":      false,
			"client_id":   "",
			"key_id":      "",
			"private_key": "",
			"team_id":     "",
			"scope":       "name,email",
		},
		"github": map[string]interface{}{
			"enable":           false,
			"client_id":        "",
			"client_secret":    "",
			"token_url":        "",
			"user_profile_url": "",
			"scope":            "user:email",
		},
		"windows_live": map[string]interface{}{
			"enable":        false,
			"client_id":     "",
			"client_secret": "",
			"scope":         "wl.basic,wl.emails,wl.contacts_emails",
		},
		"spotify": map[string]interface{}{
			"enable":        false,
			"client_id":     "",
			"client_secret": "",
			"scope":         "user-read-email,user-read-private",
		},
		"gitlab": map[string]interface{}{
			"enable":        false,
			"client_id":     "",
			"client_secret": "",
			"base_url":      "",
			"scope":         "read_user",
		},
		"bitbucket": map[string]interface{}{
			"enable":        false,
			"client_id":     "",
			"client_secret": "",
		},
	}

	return payload
}

func init() {
	rootCmd.AddCommand(initCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	// initCmd.PersistentFlags().String("foo", "", "A help for foo")
	initCmd.PersistentFlags().StringVarP(&remoteProject, "remote", "r", "", "Project name")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	// initCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}
