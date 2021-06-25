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
	"sync"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/client"
	"github.com/mrinalwahal/cli/nhost"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

// intialise variable to remove containers and network
var purge bool

// downCmd represents the down command
var downCmd = &cobra.Command{
	Use:        "down",
	Aliases:    []string{"dn"},
	SuggestFor: []string{"health"},
	Short:      "Stop local Nhost backend started by `nhost dev`",
	Long:       "Stop and remove local Nhost backend started by `nhost dev`.",
	Run: func(cmd *cobra.Command, args []string) {

		// connect to docker client
		ctx := context.Background()
		docker, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to connect to docker client")
		}

		// break execution if docker deamon is not running
		_, err = docker.Info(ctx)
		if err != nil {
			log.Fatal(err)
		}

		if err := shutdownServices(docker, ctx, LOG_FILE); err != nil {
			log.Debug(err)
			log.Error("Failed to shut down Nhost services")
		}

		if contains(args, "exit") {
			log.Info("Cleanup complete. See you later, grasshopper!")
			os.Exit(0)
		}
	},
}

func shutdownServices(cli *client.Client, ctx context.Context, logFile string) error {

	// get running containers with prefix "nhost_"
	containers, err := getContainers(cli, ctx, nhost.PROJECT)
	if err != nil {
		return err
	}

	if len(containers) == 0 {
		return nil
	}

	log.Info("Shutting down running Nhost services")

	var end_waiter sync.WaitGroup

	for _, container := range containers {
		end_waiter.Add(1)

		// prepare container name for better logging
		name := strings.Split(container.Names[0], "/")[1]

		if LOG_FILE != "" {

			// generate container logs and write them to logFile
			_, err = getContainerLogs(cli, ctx, container)
			if err != nil {
				return err
			}
		}

		go func(cli *client.Client, ctx context.Context, container types.Container, wg *sync.WaitGroup) {
			if err := stopContainer(cli, ctx, container); err != nil {
				log.Debug(err)
				log.WithFields(logrus.Fields{
					"container": name,
					"type":      "container",
				}).Error("Failed to stop")
			}
			wg.Done()
		}(cli, ctx, container, &end_waiter)
	}

	end_waiter.Wait()

	// if purge, delete the network too
	if purge {

		network, err := getNetwork(cli, ctx, nhost.PROJECT)
		if err != nil {
			return err
		}

		if network != "" {
			err = removeNetwork(cli, ctx, network)
			return err
		}

	}
	return err
}

// returns the list of running containers whose names have specified prefix
func getContainers(cli *client.Client, ctx context.Context, prefix string) ([]types.Container, error) {

	log.WithField("prefix", prefix).Debug("Fetching containers")

	var response []types.Container
	containers, err := cli.ContainerList(ctx, types.ContainerListOptions{All: true})
	for _, container := range containers {
		if strings.Contains(container.Names[0], prefix) {
			response = append(response, container)
		}
	}

	return response, err
}

// removes a given network by ID
func removeNetwork(cli *client.Client, ctx context.Context, ID string) error {

	log.WithFields(logrus.Fields{
		"network": ID,
		"type":    "network",
	}).Debug("Removing")

	err := cli.NetworkRemove(ctx, ID)
	return err
}

// fetches ID of docker network by name
func prepareNetwork(cli *client.Client, ctx context.Context, name string) (string, error) {

	log.WithFields(logrus.Fields{
		"network": name,
		"type":    "network",
	}).Debug("Preparing")

	response, err := getNetwork(cli, ctx, name)
	if err != nil {
		return "", err
	}
	if response != "" {

		log.WithFields(logrus.Fields{
			"network": name,
			"type":    "network",
		}).Debug("Found")
		return response, nil

	} else {
		log.WithFields(logrus.Fields{
			"network": name,
			"type":    "network",
		}).Debug("Creating")

		// create new network if no network such exists
		net, err := cli.NetworkCreate(ctx, name, types.NetworkCreate{})
		if err != nil {
			return "", err
		}
		return net.ID, nil
	}
}

// fetches ID of docker network by name
func getNetwork(cli *client.Client, ctx context.Context, name string) (string, error) {

	log.WithFields(logrus.Fields{
		"network": name,
		"type":    "network",
	}).Debug("Fetching")

	f := filters.NewArgs(filters.KeyValuePair{
		Key:   "name",
		Value: name,
	})

	response, err := cli.NetworkList(ctx, types.NetworkListOptions{
		Filters: f,
	})
	if len(response) > 0 && err == nil {
		return response[0].ID, err
	}
	return "", err
}

// stops given container
func stopContainer(cli *client.Client, ctx context.Context, container types.Container) error {

	log.WithFields(logrus.Fields{
		"component": container.Names[0],
		"type":      "container",
	}).Debug("Stopping")

	return cli.ContainerStop(ctx, container.ID, nil)
}

// fetches the logs of a specific container
// and writes them to a log file
func getContainerLogs(cli *client.Client, ctx context.Context, container types.Container) ([]byte, error) {

	log.WithFields(logrus.Fields{
		"component": container.Names[0],
		"type":      "container",
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

	if LOG_FILE != "" {
		// write the fetched logs to a file
		if err = writeToFile(LOG_FILE, string(response), "end"); err != nil {
			return response, err
		}
	}

	return response, nil
}

// removes given container
func removeContainer(cli *client.Client, ctx context.Context, container types.Container) error {

	log.WithFields(logrus.Fields{
		"component": container.Names[0],
		"type":      "container",
	}).Debug("Removing")

	removeOptions := types.ContainerRemoveOptions{
		//RemoveVolumes: true,
		Force: true,
	}

	err := cli.ContainerRemove(ctx, container.ID, removeOptions)
	return err
}

func init() {
	rootCmd.AddCommand(downCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	// downCmd.PersistentFlags().String("foo", "", "A help for foo")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	downCmd.Flags().BoolVarP(&purge, "purge", "p", false, "Delete project containers & network")
}
