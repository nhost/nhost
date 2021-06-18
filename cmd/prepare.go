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
	"io/ioutil"
	"os"
	"path"
	"strings"

	"github.com/mrinalwahal/cli/hasura"
	"github.com/mrinalwahal/cli/nhost"
	"github.com/spf13/cobra"
)

// prepareCmd represents the prepare command
var prepareCmd = &cobra.Command{
	Use:   "prepare",
	Short: "Prepare your project for deployment",
	Long: `Run validation checks on your codebase,
ensure seed data for all enum tables is ready inside migrations,
and just in general run extra checks to prepare your project for deployment.`,
	Run: func(cmd *cobra.Command, args []string) {

		nhostConfig, err := nhost.Config()
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to read Nhost config")
		}

		// intialize common options
		hasuraEndpoint := fmt.Sprintf(`http://localhost:%v`, nhostConfig.Services["hasura"].Port)
		adminSecret := fmt.Sprint(nhostConfig.Services["hasura"].AdminSecret)

		// create new hasura client
		client := hasura.Client{
			Endpoint:    hasuraEndpoint,
			AdminSecret: adminSecret,
			Client:      &Client,
		}

		// fetch metadata
		metadata, err := client.GetMetadata()
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to get metadata")
		}

		// if there are enum tables, add seeds for them
		enumTables := filterEnumTables(metadata.Tables)

		// read the migrations directory
		migrations, err := ioutil.ReadDir(nhost.MIGRATIONS_DIR)
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to traverse migrations directory")
		}

		for _, file := range migrations {

			for _, item := range enumTables {

				migrationName := strings.Join(strings.Split(file.Name(), "_")[1:], "_")
				expectedName := strings.Join([]string{"create", "table", item.Table.Schema, item.Table.Name}, "_")
				if migrationName == expectedName {

					// get the seed data for this table
					seedData, err := client.Seeds([]hasura.TableEntry{item})
					if err != nil {
						log.Debug(err)
						log.WithField("component", item.Table.Name).Error("Failed to get seeds for enum table")
					}

					// first check whether the migration already contains the seed data or not
					// if yes, then skip writing to file

					SQLPath := path.Join(nhost.MIGRATIONS_DIR, file.Name(), "up.sql")
					migrationData, err := os.ReadFile(SQLPath)
					if err != nil {
						log.Debug(err)
						log.WithField("component", item.Table.Name).Error("Failed to read migration file")
					}

					if !strings.Contains(string(migrationData), string(seedData)) {

						// append the seeds to migration
						if err = writeToFile(SQLPath, string(seedData), "end"); err != nil {
							log.Debug(err)
							log.WithField("component", item.Table.Name).Error("Failed to append seed data for enum table")
						}

						log.WithField("component", item.Table.Name).Info("Migration appended with seeds for this enum table")
					} else {
						log.WithField("component", item.Table.Name).Debug("Migration already contains seeds for this enum table")
					}

				}
			}
		}

		log.Info("You are all set to deploy this project! Hurray!")
	},
}

func init() {
	rootCmd.AddCommand(prepareCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	// prepareCmd.PersistentFlags().String("foo", "", "A help for foo")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	// prepareCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}
