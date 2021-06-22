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
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/client"
	"github.com/manifoldco/promptui"
	"github.com/mrinalwahal/cli/nhost"
	"github.com/spf13/cobra"
)

var (

	// initialize flags
	command string
	service string
)

// executeCmd represents the execute command
var executeCmd = &cobra.Command{
	Use:   "execute",
	Short: "Execute commands inside your Nhost services",
	Long: `Run shell commands directly inside your 
already running Nhost service containers.`,
	Run: func(cmd *cobra.Command, args []string) {

		if command == "" {
			log.Error("Invalid arguments")
			log.Info("Run `nhost execute --help` to understand how to use this command")
			os.Exit(0)
		}

		// load the saved Nhost configuration
		type Option struct {
			Key   string
			Value string
		}

		services := []Option{
			{Key: "Database", Value: "postgres"},
			{Key: "GraphQL Engine", Value: "hasura"},
			{Key: "Hasura Backend Plus", Value: "hbp"},
			{Key: "Storage", Value: "minio"},
			{Key: "API", Value: "api"},
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

		// fetch list of all running containers
		containers, err := getContainers(docker, ctx, nhost.PROJECT)
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to fetch running containers")
		}

		// if no containers found - abort the execution
		if len(containers) == 0 {
			log.Fatal("Make sure your Nhost environment is running with `nhost dev`")
		}

		log.WithField("docker", docker.ClientVersion()).Debug("Docker client version")

		for _, service := range services {
			for _, container := range containers {
				if strings.Contains(container.Names[0], service.Value) {
					options = append(options, container)
				}
			}
		}

		var selectedContainer types.Container

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
				log.WithField("service", service).Fatal("No such running service")
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

		// create the command execution skeleton
		response, err := Exec(docker, ctx, selectedContainer.ID, strings.Split(command, " "))
		if err != nil {
			log.WithField("service", service).Debug(err)
			log.WithField("service", service).Fatal("Failed to prepare execution shell")
		}

		// execute the command
		// and inspect the response
		result, err := InspectExecResp(docker, ctx, response.ID)
		if err != nil {
			log.WithField("service", service).Debug(err)
			log.WithField("service", service).Error("Failed to execute the command.")

			if len(result.StdErr) > 0 {
				fmt.Println(result.StdErr)

				// if log file is passed - save the output
				if LOG_FILE != "" {
					if err = writeToFile(LOG_FILE, result.StdErr, "end"); err != nil {
						log.WithField("service", service).Error("Failed to save the error logs")
					}
				}
			}
		}

		if len(result.StdOut) > 0 {
			fmt.Println(result.StdOut)

			// if log file is passed - save the output
			if LOG_FILE != "" {
				if err = writeToFile(LOG_FILE, result.StdOut, "end"); err != nil {
					log.WithField("service", service).Error("Failed to save the output logs")
				}
			}
		}
	},
}

func init() {
	rootCmd.AddCommand(executeCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	// executeCmd.PersistentFlags().String("foo", "", "A help for foo")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	executeCmd.Flags().StringVarP(&command, "command", "c", "", "Command to run inside service")
	executeCmd.Flags().StringVarP(&service, "service", "s", "", "Service to run the command inside")
}
