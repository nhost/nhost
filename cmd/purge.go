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
	"path/filepath"
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
var purgeData bool

// var purge bool

// downCmd represents the down command
var purgeCmd = &cobra.Command{
	Use:        "purge",
	Aliases:    []string{"pg"},
	SuggestFor: []string{"health", "dev"},
	Short:      "Delete all containers created by `nhost dev`",
	Long: `If you have changed your nhost/config.yaml, 
then use this command to delete all your container.
And re-create them next time you run 'nhost dev'`,
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
			log.Fatal("Failed to shut down Nhost services")
		}

		// wrap the fetched containers inside the environment
		_ = environment.WrapContainersAsServices(containers)

		if err := environment.Shutdown(true); err != nil {
			log.Debug(err)
			log.Error("Failed to shut down Nhost services")
		}

		if purgeData {

			// Delete database and storage as well
			paths := []string{
				nhost.DOT_NHOST,
			}

			for _, item := range paths {
				if err := deleteAllPaths(item); err != nil {
					log.Debug(err)
					log.Warnf("Please delete %s manually", filepath.Base(item))
				} else {
					log.Debugln("Removed", filepath.Base(item))
				}
			}

		}

		if !contains(args, "do_not_inform") {
			log.Info("Purge complete. See you later, grasshopper!")
		}
	},
}

// Wraps a list of docker containers as *nhost.Services for respective environment.
func (e *Environment) WrapContainersAsServices(containers []types.Container) error {

	services := map[string]*nhost.Service{}
	for _, item := range containers {
		services[strings.Split(item.Names[0], "/")[1]] = &nhost.Service{
			Name: strings.Split(item.Names[0], "/")[1],
			ID:   item.ID,
		}
	}
	e.Config.Services = services
	return nil
}

func (e *Environment) Shutdown(purge bool) error {

	log.Debug("Shutting down running services")

	var end_waiter sync.WaitGroup

	for _, container := range e.Config.Services {

		// container will only have an ID if it was started properly
		if container.ID != "" {
			end_waiter.Add(1)
			go func(container *nhost.Service) {
				if err := container.Stop(e.Docker, e.Context); err != nil {
					log.Debug(err)
					log.WithFields(logrus.Fields{
						"container": container.Name,
						"type":      "container",
					}).Error("Failed to stop")
				} else {
					if purge {
						go container.Remove(e.Docker, e.Context)
					}
				}
				end_waiter.Done()
			}(container)
		}
	}

	end_waiter.Wait()

	// if purge, delete the network too
	if purge && environment.Network != "" {
		return e.RemoveNetwork()
	}
	return nil
}

// returns the list of running containers whose names have specified prefix
func (e *Environment) GetContainers() ([]types.Container, error) {

	log.WithFields(logrus.Fields{
		"type":   "prefix",
		"prefix": nhost.PREFIX,
	}).Debug("Fetching containers")

	f := filters.NewArgs(filters.KeyValuePair{
		Key:   "name",
		Value: nhost.PREFIX,
	})

	return e.Docker.ContainerList(e.Context, types.ContainerListOptions{All: true, Filters: f})
}

// removes a given network by ID
func (e *Environment) RemoveNetwork() error {

	log.WithFields(logrus.Fields{
		"type":    "network",
		"network": e.Network,
	}).Debug("Removing")

	err := e.Docker.NetworkRemove(e.Context, e.Network)
	return err
}

// If docker network exists -> fetches it's ID
// If it doesn't exist -> creates a new network
func (e *Environment) PrepareNetwork() error {

	log.WithFields(logrus.Fields{
		"type":    "network",
		"network": nhost.PREFIX,
	}).Debug("Preparing")

	var err error
	e.Network, err = e.GetNetwork()
	if err != nil {
		return err
	}

	if e.Network == "" {

		log.WithFields(logrus.Fields{
			"network": nhost.PREFIX,
			"type":    "network",
		}).Debug("Creating")

		// create new network if no network such exists
		net, err := e.Docker.NetworkCreate(e.Context, nhost.PREFIX, types.NetworkCreate{
			CheckDuplicate: true,
		})
		if err != nil {
			return err
		}
		e.Network = net.ID
	}
	return nil
}

// fetches ID of docker network by name
func (e *Environment) GetNetwork() (string, error) {

	log.WithFields(logrus.Fields{
		"type":    "network",
		"network": nhost.PREFIX,
	}).Debug("Fetching")

	f := filters.NewArgs(filters.KeyValuePair{
		Key:   "name",
		Value: nhost.PREFIX,
	})

	response, err := e.Docker.NetworkList(e.Context, types.NetworkListOptions{
		Filters: f,
	})
	if len(response) > 0 && err == nil {
		return response[0].ID, err
	}
	return "", err
}

func init() {
	rootCmd.AddCommand(purgeCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	// downCmd.PersistentFlags().String("foo", "", "A help for foo")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	purgeCmd.Flags().BoolVar(&purgeData, "data", false, "Delete database and storage")
}
