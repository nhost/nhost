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

	"github.com/docker/docker/client"
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

		if command == "" || service == "" {
			log.Error("Invalid arguments")
			log.Info("Run `nhost execute --help` to understand how to use this command")
			os.Exit(0)
		}

		// connect to docker client
		ctx := context.Background()
		docker, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to connect to docker client")
		}
		defer docker.Close()

		// fetch list of all running containers
		containers, err := getContainers(docker, ctx, "nhost")
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to fetch running containers")
		}

		// initialize execution flag to record
		// whether command has been exuted or not

		serviceFound := false

		for _, container := range containers {
			if contains(container.Names, "/"+service) || contains(container.Names, "/nhost_"+service) {
				serviceFound = true
				log.Debugf("Service %v found. Executing command.", service)
				// create the command execution skeleton
				response, err := Exec(docker, ctx, container.ID, strings.Split(command, " "))
				if err != nil {
					log.Debug(err)
					log.Fatal("Failed to prepare execution shell")
				}

				// execute the command
				// and inspect the response
				result, err := InspectExecResp(docker, ctx, response.ID)
				if err != nil {
					log.Debug(err)
					log.Error("Failed to execute the command.")

					if len(result.StdErr) > 0 {
						log.Warn("Command execution error is as followed:")
						fmt.Println(result.StdErr)
					}
				}

				if len(result.StdOut) > 0 {
					log.Info("Command execution result is as followed:")
					fmt.Println(result.StdOut)
				}
				break
			}
		}

		if !serviceFound {
			log.Errorf("Service %v not found", service)
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
	executeCmd.Flags().StringVarP(&command, "command", "c", "", "Command to run inside container")
}
