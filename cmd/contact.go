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
	"runtime"

	"github.com/manifoldco/promptui"
	"github.com/mrinalwahal/cli/nhost"
	"github.com/spf13/cobra"
)

var (

	// initialize flags for every choice
	issue   bool
	chat    bool
	discuss bool
	wiki    bool

	noBrowser bool
)

// reportCmd represents the report command
var reportCmd = &cobra.Command{
	Use:   "support",
	Short: "Reach out to us",
	Long: `Launches URL in browser to allow
you to open issues and submit bug reports
in case you encounter something broken with this CLI.

Or even chat with our team and start a new discussion.`,
	Run: func(cmd *cobra.Command, args []string) {

		options := []map[string]interface{}{
			{
				"text":  "Report bugs & open feature requests",
				"value": fmt.Sprintf("https://github.com/%v/issues", nhost.REPOSITORY),
				"flag":  issue,
			},
			{
				"text":  "Chat with our team",
				"value": "https://discord.com/invite/9V7Qb2U",
				"flag":  chat,
			},
			{
				"text":  "Start a new discussion",
				"value": fmt.Sprintf("https://github.com/%v/discussions/new", nhost.REPOSITORY),
				"flag":  discuss,
			},
			{
				"text":  "Advanced usage, deployment help, example apps & more",
				"value": fmt.Sprintf("https://github.com/%v/wiki", nhost.REPOSITORY),
				"flag":  wiki,
			},
		}

		// if the user has passed the flag for any option,
		// launch those directly
		// bypassing selection prompt

		ok := false
		for _, item := range options {

			if item["flag"].(bool) {

				ok = true
				if noBrowser {
					log.Info(item["text"], " @ ", Bold, item["value"], Reset)
				} else if err := openbrowser(item["value"].(string)); err != nil {
					log.Debug(err)
					log.Error("Failed to launch browser")
					log.Info(item["text"], " @ ", item["value"])
				}
			}
		}

		if ok {
			os.Exit(0)
		}

		// configure interactive prompt template
		templates := promptui.SelectTemplates{
			Active:   `{{ "✔" | green | bold }} {{ .text | cyan | bold }} {{ .value | faint }}`,
			Inactive: `   {{ .text | cyan | bold }} `,
			Selected: `{{ "✔" | green | bold }} {{ "Selected" | bold }}: {{ .text | cyan | bold }}`,
		}

		// configure interative prompt
		prompt := promptui.Select{
			Label:     "Select Option",
			Items:     options,
			Templates: &templates,
		}

		index, _, err := prompt.Run()
		if err != nil {
			log.Fatal("Aborted")
		}

		selected := options[index]

		if noBrowser {
			log.Info(selected["text"], " @ ", Bold, selected["value"], Reset)
		} else {
			// launch browser
			if err := openbrowser(selected["value"].(string)); err != nil {
				log.Debug(err)
				log.Error("Failed to launch browser")
				log.Info(selected["text"], " @ ", selected["value"])
			}
		}
	},
}

func openbrowser(url string) error {

	var err error

	switch runtime.GOOS {
	case "linux":
		err = exec.Command("xdg-open", url).Start()
	case "windows":
		err = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		err = exec.Command("open", url).Start()
	default:
		err = fmt.Errorf("unsupported platform")
	}

	return err
}

func init() {
	rootCmd.AddCommand(reportCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	// reportCmd.PersistentFlags().String("foo", "", "A help for foo")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	reportCmd.Flags().BoolVar(&noBrowser, "no-browser", false, "Don't open in browser")
	reportCmd.Flags().BoolVar(&issue, "issue", false, "Open Issue on GitHub")
	reportCmd.Flags().BoolVar(&chat, "chat", false, "Launch Nhost Discord Server")
	reportCmd.Flags().BoolVar(&discuss, "discuss", false, "Launch GitHub Discussions")
	reportCmd.Flags().BoolVar(&wiki, "wiki", false, "Launch wiki in browser")
}
