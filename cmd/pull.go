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
	"io/fs"
	"io/ioutil"
	"os"
	"os/exec"
	"path"
	"regexp"
	"strings"

	"github.com/manifoldco/promptui"
	"github.com/mrinalwahal/cli/hasura"
	"github.com/mrinalwahal/cli/nhost"
	"github.com/spf13/cobra"
)

// pullCmd represents the pull command
var pullCmd = &cobra.Command{
	Use:   "pull",
	Short: "Pull migrations from remote",
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

		migration, err := pullMigration(hasuraCLI, "pulled_from_remote", hasuraEndpoint, adminSecret, commonOptions)
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to create migration from remote")
		}

		sqlFiles, err := ioutil.ReadDir(path.Join(nhost.MIGRATIONS_DIR, migration.Name()))
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to traverse migrations directory")
		}

		for _, file := range sqlFiles {

			sqlPath := path.Join(nhost.MIGRATIONS_DIR, migration.Name(), file.Name())

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

		log.Info("Migrations pulled from remote")
		log.Info("To apply the new migrations use `nhost dev`")
	},
}

func pullMigration(hasuraCLI, name, hasuraEndpoint, adminSecret string, commonOptions []string) (fs.FileInfo, error) {

	// prepare response
	var migration fs.FileInfo

	// Fetch list of all ALLOWED schemas before applying
	schemas, err := getSchemaList(hasuraEndpoint, adminSecret)
	if err != nil {
		log.Debug(err)
		return migration, err
	}
	// create migrations from remote
	migrationArgs := []string{hasuraCLI, "migrate", "create", name, "--from-server"}
	migrationArgs = append(migrationArgs, getFormattedSchemas(schemas)...)
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

	/*
		migrationArgs := []string{"-O", "-x", "--schema", strings.Join(schemas, ",")}
		migrationData, err := getMigration(hasuraEndpoint, adminSecret, migrationArgs)
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to get migration")
		}

		// create migration file
		version := strconv.FormatInt(time.Now().Unix(), 10)
		migrationDirName := strings.Join([]string{version, name}, "_")
		dir := path.Join(nhost.MIGRATIONS_DIR, migrationDirName)

		f, err := os.Create(dir)
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to create migration file")
		}

		defer f.Close()

		// write the marshalled YAML configuration to file
		if _, err = f.Write([]byte(migrationData)); err != nil {
			log.Debug(err)
			log.Fatal("Failed to write migration file")
		}

		f.Sync()
	*/

	// search and load created migration

	files, err := ioutil.ReadDir(nhost.MIGRATIONS_DIR)
	if err != nil {
		return migration, err
	}

	for _, file := range files {
		if strings.Contains(file.Name(), name) {
			migration = file
		}
	}

	version := strings.Split(migration.Name(), "_")[0]

	// apply init migration on remote
	// to prevent this init migration being run again
	// in production
	migrationArgs = []string{hasuraCLI, "migrate", "apply", "--version", version, "--skip-execution"}
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

	// create metadata from remote
	metadataArgs := []string{hasuraCLI, "metadata", "export"}
	metadataArgs = append(metadataArgs, commonOptions...)

	execute = exec.Cmd{
		Path: hasuraCLI,
		Args: metadataArgs,
		Dir:  nhost.NHOST_DIR,
	}

	output, err = execute.CombinedOutput()
	if err != nil {
		log.Debug(string(output))
		return migration, err
	}

	// any enum compatible tables that might exist
	// all enum compatible tables must contain at least one row
	// https://hasura.io/docs/1.0/graphql/core/schema/enums.html#creating-an-enum-compatible-table

	// use the saved tables metadata to check whether this project has enum compatible tables
	// if tables metadata doesn't exit, fetch from API
	// make sure all required tables are being tracked
	metadata, err := getMetadata(hasuraEndpoint, adminSecret)
	if err != nil {
		return migration, err
	}

	tables := filterEnumTables(metadata.Tables)

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
				log.Error("Failed to create seeds for enum tables")
				log.Warn("Skipping seed creation")
			}
		}
	}

	return migration, nil
}

func getFormattedSchemas(list []string) []string {

	var response []string

	for _, item := range list {
		response = append(response, "--schema")
		response = append(response, item)
	}
	return response
}

func getSeedTables(tables []hasura.TableEntry) []string {

	var fromTables []string

	for _, table := range tables {

		// append to seed tables if true
		fromTables = append(fromTables, "--from-table")
		fromTables = append(fromTables, fmt.Sprintf(
			`%s.%s`,
			table.Table.Schema,
			table.Table.Name,
		))
	}
	return fromTables
}

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

func addExtensionstoMigration(sqlPath, hasuraEndpoint, adminSecret string) error {

	// add extensions to init migration
	extensions, err := getExtensions(hasuraEndpoint, adminSecret)
	if err != nil {
		return err
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

	// write extensions to beginning of SQL file of init migration
	if err = writeToFile(sqlPath, extensionsWriteToFile, "start"); err != nil {
		return err
	}

	return nil
}

func init() {
	rootCmd.AddCommand(pullCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	// pullCmd.PersistentFlags().String("foo", "", "A help for foo")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	// pullCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}
