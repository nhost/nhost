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
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/stdcopy"
	"github.com/mrinalwahal/cli/nhost"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

// healthCmd represents the health command
var healthCmd = &cobra.Command{
	Use:     "health",
	Aliases: []string{"h"},
	Short:   "Checks the health of running Nhost services",
	Long: `Scans for any running Nhost services, validates the health of their
respective containers and service-exclusive health endpoints.`,
	Run: func(cmd *cobra.Command, args []string) {

		// load the saved Nhost configuration
		options, err := nhost.Config()
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to read Nhost config")
		}

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

		// run diagnosis
		if err := Diagnose(options, docker, ctx); err != nil {
			downCmd.Run(cmd, args)
		}
	},
}

func Diagnose(options nhost.Configuration, docker *client.Client, ctx context.Context) error {

	postgresConfig := options.Services["postgres"]
	hasuraConfig := options.Services["hasura"]
	authConfig := options.Services["auth"]
	// minioConfig := options.Services["minio"]
	storageConfig := options.Services["storage"]

	// initialize all Nhost service structures
	// and their respective service specific health check
	// commands and endpoints
	services := []Container{
		{
			Name: getContainerName("postgres"),
			Command: []string{
				"pg_isready",
				"-h",
				"localhost",
				"-p",
				fmt.Sprint(postgresConfig.Port),
				"-U",
				"postgres",
			},
		},
		{
			Name:                getContainerName("auth"),
			HealthCheckEndpoint: fmt.Sprintf("http://127.0.0.1:%v/healthz", authConfig.Port),
		},
		{
			Name:                getContainerName("storage"),
			HealthCheckEndpoint: fmt.Sprintf("http://127.0.0.1:%v/healthz", storageConfig.Port),
		},
		{
			Name:                getContainerName("hasura"),
			HealthCheckEndpoint: fmt.Sprintf("http://127.0.0.1:%v/healthz", hasuraConfig.Port),
		},
		/*
			{
				Name:                getContainerName("minio"),
				HealthCheckEndpoint: fmt.Sprintf("http://127.0.0.1:%v/minio/health/live", minioConfig.Port),
			},
		*/
	}

	// fetch list of all running containers
	containers, err := getContainers(docker, ctx, "nhost")
	if err != nil {
		log.Debug(err)
		log.Fatal("Failed to fetch running containers")
	}

	var targets []Container

	if service != "" {
		for _, item := range services {
			if service == item.Name {
				for _, container := range containers {
					if strings.Contains(container.Names[0], item.Name) {
						targets = append(targets, item)
					}
				}
			}
		}

		if len(targets) == 0 {
			log.WithField("service", service).Fatal("No such running service found")
		}
	} else {
		targets = services
	}

	var wg sync.WaitGroup

	for _, service := range targets {
		wg.Add(1)

		containerValidated := false
		serviceValidated := false
		for _, container := range containers {

			// first check whether the service container is at least active and responding
			go func(container types.Container, service Container, containerValidated *bool, serviceValidated *bool, wg *sync.WaitGroup) {
				if strings.Contains(container.Names[0], service.Name) {
					/*
						log.WithFields(logrus.Fields{
							"container": service.Name,
							"type":      "container",
						}).Info("Active and responding")
					*/

					// validate their corresponding health check endpoints
					if service.HealthCheckEndpoint != "" {

						valid := checkServiceHealth(service.Name, service.HealthCheckEndpoint)
						if valid {
							log.WithFields(logrus.Fields{
								"container": service.Name,
								"type":      "service",
							}).Debug("Health check successful")
						} else {
							log.WithFields(logrus.Fields{
								"container": service.Name,
								"type":      "service",
							}).Error("Health check timed out")
							err = errors.New("health check of at least 1 service timed out")
						}
						wg.Done()

					} else if len(service.Command) > 0 {

						// create the command execution skeleton
						response, err := Exec(docker, ctx, container.ID, service.Command)
						if err != nil {
							log.WithFields(logrus.Fields{
								"type":      "service",
								"container": service.Name,
							}).Error("Health check unsuccessful")
							wg.Done()
						}

						// execute the command
						// and inspect the health check response
						result, err := InspectExecResp(docker, ctx, response.ID)
						if err != nil {
							log.Debug(err)
							log.WithFields(logrus.Fields{
								"type":      "service",
								"container": service.Name,
							}).Error("Health check unsuccessful")
							wg.Done()
						}

						if valid := strings.Contains(result.StdOut, "accepting connections"); valid {
							log.WithFields(logrus.Fields{
								"type":      "service",
								"container": service.Name,
							}).Debug("Health check successful")
						}

						wg.Done()
					}
				}
			}(container, service, &containerValidated, &serviceValidated, &wg)
		}
	}

	wg.Wait()
	return err
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

	for x := 1; x <= 120; x++ {
		if valid := validateEndpointHealth(url); valid {
			return true
		}
		time.Sleep(1 * time.Second)
		log.WithFields(logrus.Fields{
			"type":      "service",
			"container": name,
		}).Debugf("Health check attempt #%v unsuccessful", x)
	}
	return false
}

func validateEndpointHealth(url string) bool {

	resp, err := http.Get(url)
	if err != nil {
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
	healthCmd.Flags().StringVarP(&service, "service", "s", "", "Service to check health of")
}
