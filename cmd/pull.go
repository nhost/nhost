/*
Copyright © 2021 NAME HERE <EMAIL ADDRESS>

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
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"

	"github.com/manifoldco/promptui"
	"github.com/mrinalwahal/cli/hasura"
	"github.com/mrinalwahal/cli/nhost"
	"github.com/spf13/cobra"
)

// pullCmd represents the pull command
var pullCmd = &cobra.Command{
	Use:     "pull",
	Aliases: []string{"p"},
	Short:   "Pull migrations from remote",
	Long: `Pull latest migrations and metadata changes from remote
and sync them with your local project.`,
	Run: func(cmd *cobra.Command, args []string) {

		// warn the user of upcoming dangers
		log.Warn("This can potentially break your local changes")
		log.Info("Backup your local changes before proceeding ahead")

		// configure interative prompt
		confirmationPrompt := promptui.Prompt{
			Label:     "Are you sure you want to continue",
			IsConfirm: true,
		}

		_, err := confirmationPrompt.Run()
		if err != nil {
			log.Debug(err)
			log.Fatal("Aborted")
		}

		// validate authentication
		user, err := validateAuth(nhost.AUTH_PATH)
		if err != nil {
			log.Debug(err)
			log.Error("Failed to validate authentication")

			// begin the login procedure
			loginCmd.Run(cmd, args)
		}

		var projects []nhost.Project
		projects = append(projects, user.Projects...)
		for _, item := range user.Teams {
			projects = append(projects, item.Team.Projects...)
		}

		info, err := nhost.Info()
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to read saved Nhost project information")
		}

		var linkedProject nhost.Project

		for _, project := range projects {
			if project.ID == info.ProjectID {
				linkedProject = project
			}
		}

		// load hasura binary
		hasuraCLI, _ := hasura.Binary()

		// intialize common options
		hasuraEndpoint := "https://" + linkedProject.ProjectDomains.Hasura
		adminSecret := linkedProject.HasuraGQEAdminSecret

		commonOptions := []string{"--endpoint", hasuraEndpoint, "--admin-secret", adminSecret, "--skip-update-check"}

		// create migration
		// and notify remote to skip it

		// test new hasura client
		hasuraClient := hasura.Client{
			Endpoint:    hasuraEndpoint,
			AdminSecret: adminSecret,
		}

		_, err = pullMigration(hasuraClient, hasuraCLI, "pulled_from_remote", commonOptions)
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to create migration from remote")
		}

		/*

			sqlFiles, err := ioutil.ReadDir(filepath.Join(nhost.MIGRATIONS_DIR, migration.Name))
			if err != nil {
				log.Debug(err)
				log.Fatal("Failed to traverse migrations directory")
			}

			for _, file := range sqlFiles {

				sqlPath := filepath.Join(nhost.MIGRATIONS_DIR, migration.Name, file.Name())

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
		*/

		log.Info("Migrations pulled from remote")
		log.Info("To apply the new migrations use `nhost dev`")
	},
}

func pullMigration(client hasura.Client, hasuraCLI, name string, commonOptions []string) (hasura.Migration, error) {

	// prepare response
	migration := hasura.Migration{
		Name: name,
	}

	migration = migration.Init()

	metadata, err := client.GetMetadata()
	if err != nil {
		return migration, err
	}

	// Fetch list of all ALLOWED schemas before applying
	schemas, err := client.GetSchemas()
	if err != nil {
		log.Debug("Failed to get list of schemas")
		return migration, err
	}

	migrationTables := getMigrationTables(schemas, metadata.Tables)
	fmt.Println(migrationTables)

	/*
		// fetch migrations
		migrationArgs := []string{hasuraCLI, "migrate", "create", name, "--from-server"}
		migrationArgs = append(migrationArgs, getMigrationTables(schemas, tables)...)
		migrationArgs = append(migrationArgs, commonOptions...)

		execute = exec.Cmd{
			Path: hasuraCLI,
			Args: migrationArgs,
			Dir:  nhost.NHOST_DIR,
		}

		output, err = execute.CombinedOutput()
		if err != nil {
			log.Debug(string(output))
			return migration, err
		}
	*/

	if len(migrationTables) > 0 {

		log.Debug("Creating initial migration")

		migration.Data, err = client.Migration(migrationTables)
		if err != nil {
			log.Debug("Failed to get migration data")
			return migration, err
		}

		// create migration file
		if err := os.MkdirAll(migration.Location, os.ModePerm); err != nil {
			log.Debug("Failed to create migration directory")
			return migration, err
		}

		f, err := os.Create(filepath.Join(migration.Location, "up.sql"))
		if err != nil {
			log.Debug("Failed to create migration file")
			return migration, err
		}

		// add enum seeds
		enumTables := filterEnumTables(metadata.Tables)

		if len(enumTables) > 0 {

			log.Debug("Appending enum table seeds to initial migration")
			seeds, err := client.Seeds(enumTables)
			if err != nil {
				log.Debug("Failed to fetch seeds for enum tables")
				return migration, err
			}

			// append the fetched seed data
			migration.Data = append(migration.Data, seeds...)
		}

		/*
			// format migration data before writing it
			migration.Data = []byte(migration.Format(string(migration.Data)))

			// prepend extensions to migration data
			// add or update extensions to new migration
			// add extensions to init migration
			extensions, err := client.GetExtensions()
			if err != nil {
				log.Debug("Failed to fetch migration extensions")
				return migration, err
			}

			// prepend the fetched extensions
			migration.Data = migration.AddExtensions(extensions)
		*/

		if _, err = f.Write(migration.Data); err != nil {
			log.Debug("Failed to write migration file")
			return migration, err
		}

		f.Sync()
		f.Close()

		/*
			var mig fs.FileInfo

			// search and load created migration
			files, err := ioutil.ReadDir(nhost.MIGRATIONS_DIR)
			if err != nil {
				return migration, err
			}

			for _, file := range files {
				if strings.Contains(file.Name(), name) {
					mig = file
				}
			}

			v := strings.Split(mig.Name(), "_")[0]
		*/

		// If migrations directory is already mounted to nhost_hasura container,
		// then Hasura must be auto-applying migrations
		// hence, manually applying migrations doesn't make sense

		// apply init migration on remote
		// to prevent this init migration being run again
		// in production
		migrationArgs := []string{hasuraCLI, "migrate", "apply", "--version", strconv.FormatInt(migration.Version, 10), "--skip-execution"}
		migrationArgs = append(migrationArgs, commonOptions...)

		execute := exec.Cmd{
			Path: hasuraCLI,
			Args: migrationArgs,
			Dir:  nhost.NHOST_DIR,
		}

		output, err := execute.CombinedOutput()
		if err != nil {
			log.Debug(string(output))
			return migration, err
		}

	}
	/*
		// save metadata
		metadataToBeSaved := []map[string]interface{}{
			{"key": "tables", "value": metadata.Tables},
			{"key": "query_collections", "value": metadata.QueryCollections},
			{"key": "cron_triggers", "value": metadata.CronTriggers},
			{"key": "actions", "value": metadata.Actions},
			{"key": "allow_list", "value": metadata.Allowlist},
			{"key": "remote_schemas", "value": metadata.RemoteSchemas},
			{"key": "version", "value": metadata.Version},
			{"key": "functions", "value": metadata.Functions},
		}

		for _, item := range metadataToBeSaved {

			file, err := os.Create(filepath.Join(nhost.METADATA_DIR, fmt.Sprintf("%s.yaml", item["key"])))
			if err != nil {
				return migration, err
			}

			payload, err := yaml.Marshal(item["value"])
			if err != nil {
				return migration, err
			}
			_, err = file.Write(payload)
			if err != nil {
				return migration, err
			}

			if err = file.Close(); err != nil {
				return migration, err
			}
		}
	*/

	// any enum compatible tables that might exist
	// all enum compatible tables must contain at least one row
	// https://hasura.io/docs/1.0/graphql/core/schema/enums.html#creating-an-enum-compatible-table

	// use the saved tables metadata to check whether this project has enum compatible tables
	// if tables metadata doesn't exit, fetch from API
	// make sure all required tables are being tracked
	/*
		metadata, err := getMetadata(client.Endpoint, client.AdminSecret)
		if err != nil {
			return migration, err
		}
	*/
	// fetch metadata
	metadataArgs := []string{hasuraCLI, "metadata", "export"}
	metadataArgs = append(metadataArgs, commonOptions...)

	execute := exec.Cmd{
		Path: hasuraCLI,
		Args: metadataArgs,
		Dir:  nhost.NHOST_DIR,
	}

	output, err := execute.CombinedOutput()
	if err != nil {
		log.Debug(string(output))
		return migration, err
	}

	/*
		// LEGACY CODE
		// Uses hasura CLI for creating seeds

		// first check if seeds already exist
		// in which case skip seed creation

		seeds, err := os.ReadDir(nhost.SEEDS_DIR)
		if err != nil {
			return migration, err
		}

		// only add seeds if enum tables exist, otherwise skip this step
			for _, table := range tables {

				applied := false

				for _, item := range seeds {
					if strings.Split(item.Name(), "_")[1] == (table.Table.Name + ".sql") {
						applied = true
					}
				}

				if !applied {

					// apply seed for every single table
					seedArgs := []string{hasuraCLI, "seeds", "create", table.Table.Name, "--from-table", table.Table.Schema + "." + table.Table.Name}
					seedArgs = append(seedArgs, commonOptions...)

					execute := exec.Cmd{
						Path: hasuraCLI,
						Args: seedArgs,
						Dir:  nhost.NHOST_DIR,
					}

					output, err := execute.CombinedOutput()
					if err != nil {
						log.Debug(string(output))
						log.Debug(err)
						log.WithField("component", table.Table.Name).Error("Failed to create seeds for enum table")
						log.Warn("Skipping seed creation")
					}

					// append the insert data of new seeds for enum tables
					// to the relevant migration file
					// explain reason...

					if err = copySeedToMigration(table.Table.Name, filepath.Join(migrationFile.Name(), "up.sql")); err != nil {
						log.Debug(err)
						log.WithField("component", table.Table.Name).Errorf("Failed to append table seed data to migration: %v", name)
						log.Warn("Skipping seed creation")
					}
				}
			}
	*/

	return migration, nil
}

/*
func copySeedToMigration(seed, migration string) error {

	// first, search for the newly created seed file
	seedFile, err := searchFile(seed, nhost.SEEDS_DIR)
	if err != nil {
		return err
	}

	// now read it's data
	data, err := os.ReadFile(filepath.Join(nhost.SEEDS_DIR, seedFile.Name()))
	if err != nil {
		return err
	}

	// finally append the seed data to migration file
	if err = writeToFile(filepath.Join(nhost.MIGRATIONS_DIR, migration), string(data), "end"); err != nil {
		return err
	}

	// delete the seed file so that it's not applied again
	if err = deleteAllPaths(filepath.Join(nhost.SEEDS_DIR, seedFile.Name())); err != nil {
		return err
	}

	return nil
}

func searchFile(name, directory string) (fs.DirEntry, error) {

	migrations, err := os.ReadDir(directory)
	if err != nil {
		return nil, err
	}

	for _, item := range migrations {
		if strings.Contains(item.Name(), name) {
			return item, nil
		}
	}

	return nil, errors.New("failed to find file %v in %v")
}


func getFormattedSchemas(list []string) []string {

	var response []string

	for _, item := range list {
		response = append(response, "--schema")
		response = append(response, item)
	}
	return response
}
*/

func getMigrationTables(schemas []string, tables []hasura.TableEntry) []string {

	var response []string

	for _, table := range tables {
		for _, schema := range schemas {
			if table.Table.Schema == schema {
				response = append(response, "--table")
				response = append(response, fmt.Sprintf(
					`%s.%s`,
					schema,
					table.Table.Name,
				))
			}
		}
	}

	/*
		for _, value := range filteredValues {
			if value != "public.users" {
				fromTables = append(fromTables, "--table")
				fromTables = append(fromTables, value)
			}
		}
	*/
	return response
}

/*

func formatMigration(sqlPath string) error {

	var err error

	// search and replace ADD Constraints for all schemas

	// Compile the expression once, usually at init time.
	// Use raw strings to avoid having to quote the backslashes.

	expression := regexp.MustCompile(`ALTER TABLE ONLY (["'\w.]*)([\s]*) ADD CONSTRAINT (["'\w]*) ([\w \(\);]*)`)
	replacement := "SELECT create_constraint_if_not_exists('%v', '%v', '%v');"

	if err = replaceInFileWithRegex(sqlPath, replacement, expression, []int{1, 3, 4}); err != nil {
		log.Debug(err)
		log.Fatal("Failed to replace constraints in init migration")
	}

	// repeat the procedure to replace triggers

	expression = regexp.MustCompile(`CREATE TRIGGER ([\w]*) BEFORE UPDATE ON ([\w.]*) FOR EACH ROW EXECUTE FUNCTION ([\w.\(\);]*)`)
	replacement = `DROP TRIGGER IF EXISTS %v ON %v;
CREATE TRIGGER %v BEFORE UPDATE ON %v FOR EACH ROW EXECUTE FUNCTION %v
`

	if err = replaceInFileWithRegex(sqlPath, replacement, expression, []int{1, 2, 1, 2, 3}); err != nil {
		log.Debug(err)
		log.Fatal("Failed to replace constraints in init migration")
	}

	// before applying migrations
	// replace all existing function calls inside migration
	// from "CREATE FUNCTION" to "CREATE OR REPLACE FUNCTION"
	// explan the reason behind this...

	if err = replaceInFile(sqlPath, "CREATE FUNCTION", "CREATE OR REPLACE FUNCTION"); err != nil {
		log.Debug(err)
		log.Fatal("Failed to replace existing functions in initial migration")
	}

	// repeat the same search and replace
	// for "CREATE TABLE" by appending "IF NOT EXISTS" to it
	// explan the reason behind this...

	if err = replaceInFile(sqlPath, "CREATE TABLE", "CREATE TABLE IF NOT EXISTS"); err != nil {
		log.Debug(err)
		log.Fatal("Failed to replace existing functions in initial migration")
	}

	// repeat the same for SCHEMAS

	if err = replaceInFile(sqlPath, "CREATE SCHEMA", "CREATE SCHEMA IF NOT EXISTS"); err != nil {
		log.Debug(err)
		log.Fatal("Failed to replace existing functions in initial migration")
	}

	// write a custom constraint creation function to SQL
	// explain the reason...
	customConstraintFunc := `CREATE OR REPLACE FUNCTION create_constraint_if_not_exists (t_name text, c_name text, constraint_sql text)
RETURNS void
AS
$BODY$
	BEGIN
	-- Look for our constraint
	IF NOT EXISTS (SELECT constraint_name
					FROM information_schema.constraint_column_usage
					WHERE constraint_name = c_name) THEN
		EXECUTE 'ALTER TABLE ' || t_name || ' ADD CONSTRAINT ' || c_name || ' ' || constraint_sql;
	END IF;
	END;
$BODY$
LANGUAGE plpgsql VOLATILE;

`

	if err = writeToFile(sqlPath, customConstraintFunc, "start"); err != nil {
		return err
	}

	return nil
}
*/

func init() {
	// rootCmd.AddCommand(pullCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	// pullCmd.PersistentFlags().String("foo", "", "A help for foo")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	// pullCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}
