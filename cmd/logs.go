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
	"context"
	"os"
	"strings"

	client "github.com/docker/docker/client"
	"github.com/manifoldco/promptui"
	"github.com/mrinalwahal/cli/nhost"
	"github.com/spf13/cobra"
)

// logsCmd prints the logs from containers and HBP_Catalog
var logsCmd = &cobra.Command{
	Use:     "logs",
	Aliases: []string{"lg"},
	Short:   "List the projects",
	Long: `Fetch the list of personal and team projects
for the logged in user from Nhost console and present them.`,
	Run: func(cmd *cobra.Command, args []string) {

		var err error

		// connect to docker client
		environment.Context = context.Background()
		environment.Docker, err = client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to connect to docker client")
		}
		defer environment.Docker.Close()

		// break execution if docker deamon is not running
		_, err = environment.Docker.Info(environment.Context)
		if err != nil {
			log.Fatal(err)
		}

		// get running containers with prefix "nhost_"
		containers, err := environment.GetContainers()
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to get running Nhost services")
		}

		// if no containers found - abort the execution
		if len(containers) == 0 {
			log.Fatal("Make sure your Nhost environment is running with `nhost dev`")
		}

		// wrap the fetched containers inside the environment
		_ = environment.WrapContainersAsServices(containers)

		var selected *nhost.Service

		if service == "" {

			// load the saved Nhost configuration
			type Option struct {
				Key   string
				Value string
			}

			var services []Option
			for name := range environment.Config.Services {
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

		for name, item := range environment.Config.Services {
			if strings.EqualFold(name, service) {
				selected = item
				break
			}
		}

		if selected == nil {
			log.Fatal("No such service found")
		}

		// fetch the logs of selected container
		logs, err := selected.Logs(environment.Docker, environment.Context)
		if err != nil {
			log.WithField("component", selected.Name).Debug(err)
			log.WithField("component", selected.Name).Fatal("Failed to fetch service logs")
		}

		//	print the logs for the user
		os.Stdout.Write(logs)

		/*
			// create new hasura client
			hasuraClient := hasura.Client{
				Endpoint:    fmt.Sprintf(`http://localhost:%v`, port),
				AdminSecret: "hasura-admin-secret",
				Client:      &Client,
			}

			// testing custom metadata
			metadata, err := hasuraClient.GetMetadata()
			if err != nil {
				log.Debug("Failed to get metadata")
				log.Error(err)
			}
			fmt.Println(metadata.Tables)

			migrationTables := getMigrationTables([]string{"hdb_catalog"}, metadata.Tables)
			fmt.Println(migrationTables)
		*/
	},
}

func init() {
	rootCmd.AddCommand(logsCmd)
	logsCmd.Flags().StringVarP(&service, "service", "s", "", "Service to fetch the logs for")
}
