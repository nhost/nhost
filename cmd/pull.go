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
	"os/exec"
	"path/filepath"
	"strconv"

	"github.com/nhost/cli-go/hasura"
	"github.com/nhost/cli-go/nhost"
	"github.com/spf13/cobra"
)

// pullCmd represents the pull command
var pullCmd = &cobra.Command{
	Use:     "pull",
	Aliases: []string{"p"},
	Short:   "Pull migrations from remote",
	Hidden:  true,
	Long: `Pull latest migrations and metadata changes from remote
and sync them with your local app.`,
	/*
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
				os.Exit(0)
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
				log.Fatal("Failed to read saved Nhost app information")
			}

			var linkedProject nhost.Project

			for _, project := range projects {
				if project.ID == info.ProjectID {
					linkedProject = project
				}
			}

			// intialize common options
			hasuraEndpoint := "https://" + linkedProject.ProjectDomains.Hasura
			adminSecret := linkedProject.HasuraGQEAdminSecret

			commonOptions := []string{"--endpoint", hasuraEndpoint, "--admin-secret", adminSecret, "--skip-update-check"}

			// create migration
			// and notify remote to skip it

			// test new hasura client
			hasuraClient := hasura.Client{}
			hasuraClient.Init(hasuraEndpoint, adminSecret, nil)

			_, err = pullMigration(hasuraClient, "pulled_from_remote", commonOptions)
			if err != nil {
				log.Debug(err)
				log.Fatal("Failed to create migration from remote")
			}


			log.Info("Migrations pulled from remote")
			log.Info("To apply the new migrations use `nhost dev`")
		},
	*/
}

func pullMigration(client hasura.Client, name string, commonOptions []string) (hasura.Migration, error) {

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
			seeds, err := client.ApplySeeds(enumTables)
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
		migrationArgs := []string{client.CLI, "migrate", "apply", "--version", strconv.FormatInt(migration.Version, 10), "--skip-execution"}
		migrationArgs = append(migrationArgs, commonOptions...)

		execute := exec.Cmd{
			Path: client.CLI,
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
	metadataArgs := []string{client.CLI, "metadata", "export"}
	metadataArgs = append(metadataArgs, commonOptions...)

	execute := exec.Cmd{
		Path: client.CLI,
		Args: metadataArgs,
		Dir:  nhost.NHOST_DIR,
	}

	if err := execute.Run(); err != nil {
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
