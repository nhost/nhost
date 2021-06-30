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
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/manifoldco/promptui"
	"github.com/mrinalwahal/cli/nhost"
	"github.com/spf13/cobra"
)

// reverseCmd represents the reverse command
var reverseCmd = &cobra.Command{
	Use:     "reverse",
	Aliases: []string{"rv"},
	Short:   "Go back to a previous migration",
	Long: `Presents you with a list of all locally saved
migrations and will separate and move all migrations
that came AFTER the one you have chosen, but NOT the one that you chose.
Basically rendering your selected migration as the latest one.

Don't worry, the deleted migrations can be retrieved back.

Note: Only the migrations removed using this command can be reversed
back with 'nhost reverse' command.

Not the ones manually deleted form GraphQL engine.`,
	Run: func(cmd *cobra.Command, args []string) {

		// make sure no local environments are running

		migrations, err := os.ReadDir(nhost.MIGRATIONS_DIR)
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to traverse migrations directory")
		}

		migrations_payload := []map[string]string{}

		for _, item := range migrations {
			version := strings.Split(item.Name(), "_")[0]
			name := strings.Split(item.Name(), "_")[1:]
			i, _ := strconv.ParseInt(version, 10, 64)
			migrations_payload = append(migrations_payload, map[string]string{
				"version": version,
				"name":    strings.Join(name, " "),
				"time":    time.Unix(i, 0).Local().Format("Mon Jan 2 15:04:05"),
			})
		}

		// configure interactive prompt template
		templates := promptui.SelectTemplates{
			Active:   `{{ "✔" | green | bold }} {{ .time | cyan | bold }}: {{ .name | cyan | bold }}`,
			Inactive: `  {{ .time | cyan | bold }}: {{ .name | cyan }}`,
			Selected: `{{ "✔" | green | bold }} {{ "Selected" | bold }}: [{{ .time | cyan | bold }}] {{ .name | cyan }}`,
		}

		// configure interative prompt
		prompt := promptui.Select{
			Label:     "Select migration",
			Items:     migrations_payload,
			Templates: &templates,
		}

		index, _, err := prompt.Run()
		if err != nil {
			log.Debug(err)
			log.Fatal("Aborted")
		}

		migration := migrations[index]

		// warn the user of upcoming dangers
		log.Warning("This will temporarily remove all migrations that came AFTER the one you have chosen, but NOT the one you have chosen")
		log.Info("Basically rendering your chosen migration as the latest one")
		log.Info("Removed migrations can be recovered using `nhost recover`")

		// configure interative prompt
		confirmationPrompt := promptui.Prompt{
			Label:     "Are you sure you want to continue",
			IsConfirm: true,
		}

		_, err = confirmationPrompt.Run()
		if err != nil {
			log.Debug(err)
			log.Fatal("Aborted")
		}

		// initialize the snapshot directory
		snapshot := filepath.Join(nhost.LEGACY_DIR, strconv.FormatInt(getTime(), 10))

		for _, item := range migrations {

			i, _ := strconv.ParseInt(strings.Split(item.Name(), "_")[0], 10, 64)
			current_time := time.Unix(i, 0)
			i, _ = strconv.ParseInt(strings.Split(migration.Name(), "_")[0], 10, 64)
			selected_time := time.Unix(i, 0)

			if current_time.After(selected_time) {

				src := filepath.Join(nhost.MIGRATIONS_DIR, item.Name())
				dest := filepath.Join(snapshot, item.Name())

				// transfer migrations to legacy directory
				if err = movePath(src, dest); err != nil {
					log.Debug(err)
					log.WithField("component", item.Name()).Error("Failed to remove")
				}
			}
		}
	},
}

func getTime() int64 {
	startTime := time.Now()
	return startTime.UnixNano() / int64(time.Millisecond)
}

func init() {
	// rootCmd.AddCommand(reverseCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	// reverseCmd.PersistentFlags().String("foo", "", "A help for foo")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	// reverseCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}
