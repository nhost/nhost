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
	"os"
	"strings"

	"github.com/manifoldco/promptui"
	"github.com/nhost/cli-go/nhost"
	"github.com/spf13/cobra"
)

// logsCmd prints the logs from containers and HBP_Catalog
var logsCmd = &cobra.Command{
	Use:     "logs",
	Aliases: []string{"log"},
	Short:   "Read container logs of any service",
	Run: func(cmd *cobra.Command, args []string) {

		// Initialize the runtime environment
		if err := env.Init(); err != nil {
			log.Debug(err)
			log.Fatal("Failed to initialize the environment")
		}

		// if no containers found - abort the execution
		if len(env.Config.Services) == 0 {
			log.Fatal("Make sure your Nhost environment is running with `nhost dev`")
		}

		var selected *nhost.Service

		if service == "" {

			// load the saved Nhost configuration
			type Option struct {
				Key   string
				Value string
			}

			var services []Option
			for name := range env.Config.Services {
				services = append(services, Option{
					Key:   strings.Title(strings.ToLower(name)),
					Value: name,
				})
			}

			// configure interactive prompt template
			templates := promptui.SelectTemplates{
				Active:   `{{ "✔" | green | bold }} {{ .Key | cyan | bold }}`,
				Inactive: `   {{ .Key | cyan }}`,
				Selected: `{{ "✔" | green | bold }} {{ "Selected" | bold }}: {{ .Key | cyan }}`,
			}

			// configure interative prompt
			prompt := promptui.Select{
				Label:     "Select Service",
				Items:     services,
				Templates: &templates,
			}

			index, _, err := prompt.Run()
			if err != nil {
				os.Exit(0)
			}

			service = services[index].Value
		}

		for name, item := range env.Config.Services {
			if strings.EqualFold(name, service) {
				selected = item
				break
			}
		}

		if selected == nil {
			log.Fatal("No such service found")
		}

		// fetch the logs of selected container
		logs, err := selected.Logs(env.Docker, env.Context)
		if err != nil {
			log.WithField("component", selected.Name).Debug(err)
			log.WithField("component", selected.Name).Fatal("Failed to fetch service logs")
		}

		//	print the logs for the user
		os.Stdout.Write(logs)
	},
}

func init() {
	rootCmd.AddCommand(logsCmd)
	logsCmd.Flags().StringVarP(&service, "service", "s", "", "Service to fetch the logs for")
}
