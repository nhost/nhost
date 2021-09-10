package cmd

import (
	"context"
	"fmt"
	"io/ioutil"
	"path/filepath"
	"strings"
	"sync"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/filters"
	client "github.com/docker/docker/client"
	"github.com/mrinalwahal/cli/nhost"
	"github.com/sirupsen/logrus"
)

// Reset the services and network,
// to re-use the same environment
func (e *Environment) Reset() error {

	e.Config = nhost.Configuration{}
	e.Network = ""

	return nil
}

func (e *Environment) Init() error {

	var err error

	// connect to docker client
	e.Context, e.Cancel = context.WithCancel(context.Background())
	e.Docker, err = client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		log.Debug(err)
		log.Fatal("Failed to connect to docker client")
	}
	defer e.Docker.Close()

	// break execution if docker deamon is not running
	_, err = e.Docker.Info(e.Context)
	if err != nil {
		log.Fatal(err)
	}

	// get running containers with prefix "nhost_"
	containers, err := e.GetContainers()
	if err != nil {
		log.Debug(err)
		log.Error("Failed to get running Nhost services")
	}

	// wrap the fetched containers inside the environment
	_ = environment.WrapContainersAsServices(containers)

	// load the local git repository in project root directory
	e.Repository, err = loadRepository()
	if err != nil {
		log.Debug(err)
		log.Debug("Either a local git repository doesn't exist or it's broken")
	} else {

		// watch for changes in repo's head
		go e.watchHead()
	}
	return nil
}

func (e *Environment) watchHead() {

	// get the current head of git repo
	head := getCurrentBranch(e.Repository)

	for {

		// get the current head of git repo
		new := getCurrentBranch(e.Repository)

		if new != "" && new != head {

			// update the head value
			head = new

			log.WithField("branch", head).Debug("Detected git branch change")

			// update branch change channel
			branchSwitch <- head
		}
	}
}

// Wraps a list of docker containers as *nhost.Services for respective environment.
func (e *Environment) WrapContainersAsServices(containers []types.Container) error {

	log.Debug("Wrapping containers into environment")

	if environment.Config.Services == nil {
		environment.Config.Services = make(map[string]*nhost.Service)
	}
	for _, container := range containers {
		nameWithPrefix := strings.Split(container.Names[0], "/")[1]
		name := strings.TrimPrefix(nameWithPrefix, nhost.PREFIX+"_")
		if e.Config.Services[name] == nil {
			e.Config.Services[name] = &nhost.Service{}
		}
		e.Config.Services[name].ID = container.ID

		if e.Config.Services[name].Name == "" {
			e.Config.Services[name].Name = nameWithPrefix
		}

		if len(container.Ports) > 0 {
			if name == "mailhog" {
				e.Config.Services[name].Port = 8025
				return nil
			}

			// Update the ports, if available
			for _, port := range container.Ports {
				if port.IP != "" && int(port.PublicPort) != 0 {
					e.Config.Services[name].Port = int(port.PublicPort)
				}
			}
		}
	}
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
					if !strings.Contains(strings.ToLower(err.Error()), "no such container") {
						log.WithFields(logrus.Fields{
							"container": container.Name,
							"type":      "container",
						}).Error("Failed to stop")
					}
				} else if purge {
					if err := container.Remove(e.Docker, e.Context); err != nil {
						log.Debug(err)
						log.WithFields(logrus.Fields{
							"container": container.Name,
							"type":      "container",
						}).Error("Failed to remove")
					}
				}
				end_waiter.Done()
			}(container)
		}
	}

	end_waiter.Wait()

	// if purge, delete the network too
	if purge {
		if environment.Network == "" {
			e.Network, _ = e.GetNetwork()
		}
		e.RemoveNetwork()
	}

	// reset the loaded environments,
	// to cater for re-use
	e.Reset()

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
// and downloads any one which doesn't
//

func (e *Environment) Prepare() error {

	log.Debug("Preparing environment")

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
			if contains(image.RepoTags, requiredImage) {
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

func (e *Environment) Seed() error {

	base := filepath.Join(nhost.SEEDS_DIR, nhost.DATABASE)
	seed_files, err := ioutil.ReadDir(base)
	if err != nil {
		return err
	}

	if len(seed_files) > 0 {
		log.Debug("Applying seeds")
	}

	// if there are more seeds than just enum tables,
	// apply them too
	for _, item := range seed_files {

		// read seed file
		data, err := ioutil.ReadFile(filepath.Join(base, item.Name()))
		if err != nil {
			log.WithField("component", "seeds").Errorln("Failed to open:", item.Name())
			return err
		}

		// apply seed data
		if err := e.Hasura.Seed(string(data)); err != nil {
			log.WithField("component", "seeds").Errorln("Failed to apply:", item.Name())
			return err
		}
		/*
			cmdArgs = []string{hasuraCLI, "seed", "apply", "--database-name", "default"}
			cmdArgs = append(cmdArgs, commandConfiguration...)
			execute.Args = cmdArgs

			if err = execute.Run(); err != nil {
				log.Error("Failed to apply seeds")
				return err
			}
		*/
	}
	return nil

	/*
		// fetch metadata
		metadata, err := client.GetMetadata()
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to get metadata")
		}

		// if there are enum tables, add seeds for them
		enumTables := filterEnumTables(metadata.Tables)

		// read the migrations directory
		migrations, err := ioutil.ReadDir(nhost.MIGRATIONS_DIR)
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to traverse migrations directory")
		}

		for _, file := range migrations {

			for _, item := range enumTables {

				migrationName := strings.Join(strings.Split(file.Name(), "_")[1:], "_")
				expectedName := strings.Join([]string{"create", "table", item.Table.Schema, item.Table.Name}, "_")
				if migrationName == expectedName {

					// get the seed data for this table
					seedData, err := client.ApplySeeds([]hasura.TableEntry{item})
					if err != nil {
						log.Debug(err)
						log.WithField("component", item.Table.Name).Error("Failed to get seeds for enum table")
					}

					// first check whether the migration already contains the seed data or not
					// if yes, then skip writing to file

					SQLPath := filepath.Join(nhost.MIGRATIONS_DIR, file.Name(), "up.sql")
					migrationData, err := os.ReadFile(SQLPath)
					if err != nil {
						log.Debug(err)
						log.WithField("component", item.Table.Name).Error("Failed to read migration file")
					}

					if !strings.Contains(string(migrationData), string(seedData)) {

						// append the seeds to migration
						if err = writeToFile(SQLPath, string(seedData), "end"); err != nil {
							log.Debug(err)
							log.WithField("component", item.Table.Name).Error("Failed to append seed data for enum table")
						}

						log.WithField("component", item.Table.Name).Info("Migration appended with seeds for this enum table")
					} else {
						log.WithField("component", item.Table.Name).Debug("Migration already contains seeds for this enum table")
					}

				}
			}
		}
	*/
}
