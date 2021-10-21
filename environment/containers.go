package environment

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/filters"
	client "github.com/docker/docker/client"
	"github.com/nhost/cli-go/nhost"
	"github.com/nhost/cli-go/util"
	"github.com/sirupsen/logrus"
)

// Wraps a list of docker containers as *nhost.Services for respective environment.
func (e *Environment) WrapContainersAsServices(containers []types.Container) error {

	log.Debug("Wrapping containers into environment")

	if e.Config.Services == nil {
		e.Config.Services = make(map[string]*nhost.Service)
	}

	for _, container := range containers {
		nameWithPrefix := strings.Split(container.Names[0], "/")[1]
		name := strings.TrimPrefix(nameWithPrefix, nhost.PREFIX+"_")
		if e.Config.Services[name] == nil {
			e.Config.Services[name] = &nhost.Service{

				// Initialize the channel to send out [de/]activation
				// signals to whoever needs to listen for these signals
				// Active: make(chan bool, 10),
			}
		}

		// Load the container ID as service ID
		e.Config.Services[name].ID = container.ID

		if e.Config.Services[name].Name == "" {
			e.Config.Services[name].Name = nameWithPrefix
		}

		if len(container.Ports) > 0 {

			// Update the ports, if available
			for _, port := range container.Ports {
				if port.IP != "" && int(port.PublicPort) != 0 {
					if name == "mailhog" {

						// we don't want to save mailhog's smtp port
						// this is done to avoid double port loading issue
						var smtpPort int
						vars := nhost.ParseEnvVarsFromConfig(e.Config.Auth, "SMTP")
						for _, item := range vars {
							payload := strings.Split(item, "=")
							if payload[0] == "AUTH_SMTP_PORT" {
								smtpPort, _ = strconv.Atoi(payload[1])
							}
						}
						if int(port.PublicPort) == smtpPort {
							continue
						}
					}

					if e.Config.Services[name].Port != int(port.PublicPort) {

						e.Config.Services[name].Port = int(port.PublicPort)

						// Update the service address based on the new port
						e.Config.Services[name].Address = e.Config.Services[name].GetAddress()
					}
				}
			}
		}
	}
	return nil
}

//	Stops, and additionally, removes all Nhost containers
func (e *Environment) Shutdown(purge bool, ctx context.Context) error {

	log.Debug("Shutting down running services")

	// Update environment state
	e.UpdateState(ShuttingDown)

	var response error
	var end_waiter sync.WaitGroup

	for _, container := range e.Config.Services {

		//	Container will only have an ID if it was started properly
		if container.ID != "" {
			end_waiter.Add(1)
			go func(container *nhost.Service) {
				response = container.Stop(e.Docker, ctx)

				// De-activate the service
				container.Deactivate()

				if purge {
					response = container.Remove(e.Docker, ctx)

					// Reset their service ID, port and other fields,
					// to prevent docker from starting these non-existent containers
					container.Reset()
				}

				end_waiter.Done()
			}(container)
		}
	}

	// Update environment state
	e.UpdateState(Inactive)

	end_waiter.Wait()
	return response
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

	return e.Docker.NetworkRemove(e.Context, e.Network)
}

// prune unused networks
func (e *Environment) PruneNetworks() error {

	log.WithFields(logrus.Fields{
		"type":  "networks",
		"value": nhost.PREFIX,
	}).Debug("Pruning")

	f := filters.NewArgs(filters.KeyValuePair{
		Key:   "name",
		Value: nhost.PREFIX,
	})

	_, err := e.Docker.NetworksPrune(e.Context, f)

	return err
}

// prune unused containers
func (e *Environment) PruneContainers() error {

	log.WithFields(logrus.Fields{
		"type":  "containers",
		"value": nhost.PREFIX,
	}).Debug("Pruning")

	/*
		f := filters.NewArgs(filters.KeyValuePair{
			Key:   "name",
			Value: nhost.PREFIX,
		})
	*/

	_, err := e.Docker.ContainersPrune(e.Context, filters.Args{})

	return err
}

// If docker network exists -> fetches it's ID
// If it doesn't exist -> creates a new network
func (e *Environment) PrepareNetwork() error {

	// If the same environment is being re-started,
	// then the environment must already have a network ID loaded.
	// To save time during execution,
	// we can simply return the a nil error
	if e.Network != "" {
		return nil
	}

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

//
// Prepare func validates whether all required images exist,
// and downloads any one which doesn't.
//
func (e *Environment) CheckImages() error {

	log.Debug("Checking for required Nhost container images")

	// check if a required image already exists
	// if it doesn't -> then pull it

	requiredImages := []string{}
	for _, service := range e.Config.Services {

		// only those services which actually have an image
		// this check is being added to exclude NHOST_FUNCTIONS
		if service.Image != "" {
			requiredImages = append(requiredImages, fmt.Sprintf("%s:%v", service.Image, service.Version))
		}
	}

	availableImages, err := e.Docker.ImageList(e.Context, types.ImageListOptions{All: true})
	if err != nil {
		return err
	}

	for _, requiredImage := range requiredImages {

		available := false
		for _, image := range availableImages {

			// check wether the image is available or not
			if util.Contains(image.RepoTags, requiredImage) {
				available = true
			}
		}

		// if it NOT available, then pull the image
		if !available {
			if err = pullImage(e.Docker, requiredImage); err != nil {
				log.Debug(err)
				log.WithField("component", requiredImage).Error("Failed to pull image")
				log.WithField("component", requiredImage).Infof("Pull it manually with `docker image pull %v && nhost dev`", requiredImage)
				return err
			}
		}
	}

	return nil
}

func pullImage(cli *client.Client, tag string) error {

	log.WithField("component", tag).Info("Pulling container image")

	/*
		out, err := cli.ImagePull(context.Background(), tag, types.ImagePullConfiguration{})
		out.Close()
	*/

	dockerCLI, _ := exec.LookPath("docker")
	cmd := exec.Cmd{
		Args:   []string{dockerCLI, "image", "pull", tag},
		Path:   dockerCLI,
		Stdout: os.Stdout,
	}
	return cmd.Run()
}
