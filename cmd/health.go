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
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/docker/docker/client"
	"github.com/spf13/cobra"
)

// healthCmd represents the health command
var healthCmd = &cobra.Command{
	Use:   "health",
	Short: "A brief description of your command",
	Long: `A longer description that spans multiple lines and likely contains examples
and usage of using your command. For example:

Cobra is a CLI library for Go that empowers applications.
This application is a tool to generate the needed files
to quickly create a Cobra application.`,
	Run: func(cmd *cobra.Command, args []string) {

		// load the saved Nhost configuration
		nhostConfig, err := readYaml(path.Join(nhostDir, "config.yaml"))
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to read Nhost config")
		}

		// initialize a map of all Nhost containers
		services := map[string]string{
			"nhost_postgres": "",
			"nhost_hbp":      fmt.Sprintf("http://127.0.0.1:%v/healthz", nhostConfig["hasura_backend_plus_port"]),
			"nhost_hasura":   fmt.Sprintf("http://127.0.0.1:%v/healthz", nhostConfig["hasura_graphql_port"]),
			"nhost_minio":    fmt.Sprintf("http://127.0.0.1:%v/minio/health/live", nhostConfig["minio_port"]),
		}

		// connect to docker client
		ctx := context.Background()
		docker, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
		if err != nil {
			log.Fatal("Failed to connect to docker client")
		}

		// fetch list of all running containers
		containers, err := getContainers(docker, ctx, "nhost")
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to fetch running containers")
		}

		for service, endpoint := range services {

			for _, container := range containers {

				// first check whether the service container is at least active and responding
				if strings.Contains(container.Names[0], service) {
					log.WithField("component", service).Info("Active and responding")

					// validate their corresponding health check endpoints
					if endpoint != "" {
						valid := checkServiceHealth(service, endpoint)
						if !valid {
							log.WithField("component", service).Error("Health check failed")
						}
					}
				}

			}

		}

		// add health checks for API container too
	},
}

func checkServiceHealth(name, url string) bool {

	for i := 1; i <= 10; i++ {
		if validateEndpointHealth(url) {
			log.WithField("component", name).Debugf("Health check attempt for #%v successful", i)
			return true
		}
		time.Sleep(2 * time.Second)
		log.WithField("component", name).Debugf("Health check attempt for #%v unsuccessful", i)
	}

	log.WithField("component", name).Error("Health check timed out")
	return false
}

func validateEndpointHealth(url string) bool {

	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	resp, err := client.Get(url)
	if err != nil {
		log.Debug(err)
		return false
	}

	return resp.StatusCode == 200
}

func init() {
	rootCmd.AddCommand(healthCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	// healthCmd.PersistentFlags().String("foo", "", "A help for foo")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	// healthCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}
