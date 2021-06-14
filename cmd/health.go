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
	"bytes"
	"context"
	"fmt"
	"io/ioutil"
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/stdcopy"
	"github.com/mrinalwahal/cli/cmd/nhost"
	"github.com/spf13/cobra"
)

// healthCmd represents the health command
var healthCmd = &cobra.Command{
	Use:   "health",
	Short: "Checks the health of running Nhost services",
	Long: `Scans for any running Nhost services, validates the health of their
respective containers and service-exclusive health endpoints.`,
	Run: func(cmd *cobra.Command, args []string) {

		// load the saved Nhost configuration
		options, err := nhost.Config()
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to read Nhost config")
		}

		postgresConfig := options.Services["postgres"]
		hasuraConfig := options.Services["hasura"]
		hbpConfig := options.Services["hasura_backend_plus"]
		minioConfig := options.Services["minio"]
		apiConfig := options.Services["api"]

		// initialize all Nhost service structures
		// and their respective service specific health check
		// commands and endpoints
		services := []Container{
			{
				Name: "nhost_postgres",
				Command: []string{
					"pg_isready",
					"-h",
					"localhost",
					"-p",
					fmt.Sprintf("%v", postgresConfig.Port),
					"-U",
					fmt.Sprintf("%v", postgresConfig.User),
				},
			},
			{
				Name:                "nhost_hbp",
				HealthCheckEndpoint: fmt.Sprintf("http://127.0.0.1:%v/healthz", hbpConfig.Port),
			},
			{
				Name:                "nhost_hasura",
				HealthCheckEndpoint: fmt.Sprintf("http://127.0.0.1:%v/healthz", hasuraConfig.Port),
			},
			{
				Name:                "nhost_minio",
				HealthCheckEndpoint: fmt.Sprintf("http://127.0.0.1:%v/minio/health/live", minioConfig.Port),
			},
		}

		// Add API container if it's activated in config
		if pathExists(path.Join(nhost.WORKING_DIR, "api")) {
			services = append(services, Container{
				Name:                "nhost_api",
				HealthCheckEndpoint: fmt.Sprintf("http://127.0.0.1:%v/healthz", apiConfig.Port),
			})
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

		// use a flag to determine whether all
		// health checks have been passed or not
		ok := true

		for _, service := range services {

			containerValidated := false
			serviceValidated := false
			for _, container := range containers {

				// first check whether the service container is at least active and responding
				if contains(container.Names, "/"+service.Name) {
					containerValidated = true

					// validate their corresponding health check endpoints
					if service.HealthCheckEndpoint != "" {

						serviceValidated = checkServiceHealth(service.Name, service.HealthCheckEndpoint)

					} else if len(service.Command) > 0 {

						// create the command execution skeleton
						response, err := Exec(docker, ctx, container.ID, service.Command)
						if err != nil {
							log.Debug(err)
							serviceValidated = false
						}

						// execute the command
						// and inspect the health check response
						result, err := InspectExecResp(docker, ctx, response.ID)
						if err != nil {
							log.Debug(err)
						}
						if strings.Contains(result.StdOut, "accepting connections") {
							serviceValidated = true
						}
					}
				}
			}

			// log the output
			if containerValidated {
				log.WithField("component", service.Name).Info("Container is active and responding")
			} else {
				log.WithField("component", service.Name).Error("Container is not responding")
				ok = false
			}
			if serviceValidated {
				log.WithField("component", service.Name).Info("Service specific health check successful")
			} else {
				log.WithField("component", service.Name).Error("Service specific health check failed")
				ok = false
			}
		}

		// if even a single health check has failed,
		// initiate cleanup
		if !ok {
			log.Error("Health checks failed")
			downCmd.Run(cmd, []string{"exit"})
		}
	},
}

func Exec(docker *client.Client, ctx context.Context, containerID string, command []string) (types.IDResponse, error) {

	config := types.ExecConfig{
		AttachStderr: true,
		AttachStdout: true,
		Cmd:          command,
	}

	return docker.ContainerExecCreate(ctx, containerID, config)
}

func InspectExecResp(docker *client.Client, ctx context.Context, id string) (ExecResult, error) {
	var execResult ExecResult

	resp, err := docker.ContainerExecAttach(ctx, id, types.ExecStartCheck{})
	if err != nil {
		return execResult, err
	}
	defer resp.Close()

	// read the output
	var outBuf, errBuf bytes.Buffer
	outputDone := make(chan error)

	go func() {
		// StdCopy demultiplexes the stream into two buffers
		_, err = stdcopy.StdCopy(&outBuf, &errBuf, resp.Reader)
		outputDone <- err
	}()

	select {
	case err := <-outputDone:
		if err != nil {
			return execResult, err
		}
		break

	case <-ctx.Done():
		return execResult, ctx.Err()
	}

	stdout, err := ioutil.ReadAll(&outBuf)
	if err != nil {
		return execResult, err
	}
	stderr, err := ioutil.ReadAll(&errBuf)
	if err != nil {
		return execResult, err
	}

	res, err := docker.ContainerExecInspect(ctx, id)
	if err != nil {
		return execResult, err
	}

	execResult.ExitCode = res.ExitCode
	execResult.StdOut = string(stdout)
	execResult.StdErr = string(stderr)
	return execResult, nil
}

func checkServiceHealth(name, url string) bool {

	for i := 1; i <= 10; i++ {
		if valid := validateEndpointHealth(url); valid {
			log.WithField("component", name).Debugf("Service specific health check attempt #%v successful", i)
			return true
		}
		time.Sleep(2 * time.Second)
		log.WithField("component", name).Debugf("Service specific health check attempt #%v unsuccessful", i)
	}

	log.WithField("component", name).Error("Service specific health check timed out")
	return false
}

func validateEndpointHealth(url string) bool {

	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	resp, err := client.Get(url)
	if err != nil {
		//log.Debug(err)
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
