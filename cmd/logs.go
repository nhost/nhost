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
	"io"
	"os"
	"strings"

	"github.com/docker/docker/api/types"
	client "github.com/docker/docker/client"
	"github.com/manifoldco/promptui"
	"github.com/sirupsen/logrus"
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

		// load the saved Nhost configuration
		type Option struct {
			Key   string
			Value string
		}

		services := []Option{
			{Key: "Database", Value: "postgres"},
			{Key: "GraphQL Engine", Value: "hasura"},
			{Key: "Authentication", Value: "auth"},
			{Key: "Storage", Value: "storage"},
			{Key: "Minio", Value: "minio"},
			{Key: "Mailhog", Value: "mailhog"},
		}

		var options []types.Container

		// connect to docker client
		ctx := context.Background()
		docker, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to connect to docker client")
		}
		defer docker.Close()

		// break execution if docker deamon is not running
		_, err = docker.Info(ctx)
		if err != nil {
			log.Fatal(err)
		}

		// fetch list of all running containers
		containers, err := getContainers(docker, ctx, "nhost")
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to fetch running containers")
		}

		// if no containers found - abort the execution
		if len(containers) == 0 {
			log.Fatal("Make sure your Nhost environment is running with `nhost dev`")
		}

		for _, service := range services {
			for _, container := range containers {
				if strings.Contains(container.Names[0], getContainerName(service.Value)) {
					options = append(options, container)
				}
			}
		}

		var selectedContainer types.Container

		// if the user has already supplied the service flag,
		// match it

		if service != "" {
			for _, item := range services {
				if service == item.Value {
					for _, container := range containers {
						if strings.Contains(container.Names[0], item.Value) {
							selectedContainer = container
						}
					}
				}
			}

			if selectedContainer.ID == "" {
				log.WithField("service", service).Fatal("No such running service found")
			}
		} else {

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

			selectedContainer = options[index]

		}

		// fetch the logs of selected container
		logs, err := getContainerLogs(docker, ctx, selectedContainer)
		if err != nil {
			log.Debug(err)
			log.WithField("component", selectedContainer.Names[0]).Error("Failed to fetch service logs")
		}

		//	print the logs for the user
		os.Stdout.Write(logs)
	},
}

// fetches the logs of a specific container
// and writes them to a log file
func getContainerLogs(cli *client.Client, ctx context.Context, container types.Container) ([]byte, error) {

	log.WithFields(logrus.Fields{
		"type":      "container",
		"component": container.Names[0],
	}).Debug("Fetching logs")

	var response []byte

	options := types.ContainerLogsOptions{ShowStdout: true}

	out, err := cli.ContainerLogs(ctx, container.ID, options)
	if err != nil {
		return response, err
	}

	response, err = io.ReadAll(out)
	if err != nil {
		return response, err
	}

	return response, nil
}

func init() {
	rootCmd.AddCommand(logsCmd)
	logsCmd.Flags().StringVarP(&service, "service", "s", "", "Service to fetch the logs for")
}
