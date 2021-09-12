package cmd

import (
	"context"
	"errors"
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/filters"
	client "github.com/docker/docker/client"
	"github.com/mrinalwahal/cli/nhost"
	"github.com/sirupsen/logrus"
)

// State represents current state of any structure
type State uint32

// State enumeration
const (
	Unknown State = iota
	Initializing
	Intialized
	Executing
	Active
	ShuttingDown
	Inactive // keep it always last
)

func (e *Environment) UpdateState(state State) {
	e.Lock()
	e.state = state
	e.Unlock()
}

func (e *Environment) Init() error {

	var err error

	// Update environment state
	e.UpdateState(Initializing)

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

	// If there is a local git repository,
	// in the project root directory,
	// then initialize watchers for keeping track
	// of HEAD changes on git checkout/pull/merge/fetch

	if pathExists(nhost.GIT_DIR) {

		e.Watchers = make(map[string]WatcherOperation)

		// Initialize watcher for post-checkout branch changes
		e.Watchers[filepath.Join(nhost.GIT_DIR, "HEAD")] = e.restartAfterCheckout

		// Initialize watcher for post-merge commit changes
		head := getBranchHEAD(filepath.Join(nhost.GIT_DIR, "refs", "remotes", nhost.REMOTE))
		if head != "" {
			e.Watchers[head] = e.restartMigrations
		}
	}

	// Update environment state
	e.UpdateState(Intialized)

	return nil
}

func (e *Environment) restartMigrations() error {

	//
	// Only perform operations if is active and available.
	//
	// If the environment is not yet active,
	// when it does become active, and performs migrations,
	// only the new migrations will be applied.

	if e.state == Active {

		// Inform the user of detection
		log.Info("We've detected change in local git commit")
		log.Warn("We're fixing your data accordingly. Give us a moment!")

		// re-do migrations and metadata
		if err := e.Prepare(); err != nil {
			return err
		}

		log.Info("Done! Please continue with your work.")
	}

	return nil
}

func (e *Environment) restartAfterCheckout() error {

	//
	//	The implemented logic below, should take care of following test cases:
	//
	//	Situation 1 [git checkout {branch}]:
	//		- Environment is active
	//		- User performs git checkout
	//		- Restart environment
	//
	//	Situation 2 [git checkout {branch} && git checkout {branch}]:
	//		- Environment restarting, but not yet active
	//		- User performs git checkout
	//		- Stop the restart
	//		- Shutdown whatever minimal environment may be created (delete services)
	//		- Restart environment
	//		- This must be true in an infinite loop fashion

	// Inform the user of detection
	log.Info("We've detected change in local git branch")

	if e.state >= Executing {

		//	If the environment is already shutting down,
		//	then no point in triggering new migrations,
		//	since in the post-shutdown OR next execution,
		//	new migrations will be applied.
		if e.state == ShuttingDown {
			return nil
		}

		//	Change environment before initiating shut-down,
		//	state to prevent dev command from starting cleanup operations
		e.UpdateState(ShuttingDown)

		//	Stop any ongoing execution of our environment
		e.ExecutionCancel()

		// Initialize cancellable context ONLY for this shutdown oepration
		e.ExecutionContext, e.ExecutionCancel = context.WithCancel(e.Context)

		// Shutdown and remove the services
		if err := e.Shutdown(true, e.ExecutionContext); err != nil {

			log.Error(err)

			return err
		}

		// Complete the shutdown
		e.ExecutionCancel()
	}

	log.Warn("We're recreating your environment accordingly. Give us a moment!")

	// update DOT_NHOST directory
	nhost.DOT_NHOST, _ = nhost.GetDotNhost()

	// register new branch HEAD for the watcher
	head := getBranchHEAD(filepath.Join(nhost.GIT_DIR, "refs", "remotes", nhost.REMOTE))
	if head != "" {
		var watcherAlreadyExists bool
		for name := range e.Watchers {
			if name == head {
				watcherAlreadyExists = true
				break
			}
		}

		if !watcherAlreadyExists {
			e.Watchers[head] = e.restartMigrations
		}

		// Add the watcher
		addToWatcher(watcher, head)
	}

	// now re-execute the environment
	if err := e.Execute(); err != nil {

		// cleanup and return an error
		e.cleanup()
		return err
	}

	log.Info("Done! Please continue with your work.")
	return nil
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
						switch t := e.Config.Auth["email"].(type) {
						case map[interface{}]interface{}:
							for key, value := range t {
								if value != "" && key.(string) == "smtp_port" {
									smtpPort = value.(int)
									break
								}
							}
						}
						if int(port.PublicPort) == smtpPort {
							continue
						}
					}

					e.Config.Services[name].Port = int(port.PublicPort)

					// Update the service address based on the new port
					e.Config.Services[name].Address = e.Config.Services[name].GetAddress()
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
// Performs default migrations and metadata operations
//

func (e *Environment) Prepare() error {

	var (
		execute = exec.Cmd{
			Path: e.Hasura.CLI,
			Dir:  nhost.NHOST_DIR,
		}

		commandOptions = []string{
			"--endpoint",
			e.Hasura.Endpoint,
			"--admin-secret",
			e.Hasura.AdminSecret,
			"--skip-update-check",
		}
	)

	// Send out de-activation signal before starting migrations,
	// to inform any other resource which using Hasura
	// e.Config.Services["hasura"].Deactivate()

	// Enable a mutual exclusion lock,
	// to prevent other resources from
	// modifying Hasura's data while
	// we're making changes

	// This will also prevent
	// multiple resources inside our code
	// from concurrently making changes to the Hasura service

	// NOTE: This mutex lock only works
	// for resources talking to Hasura service inside this code
	// It doesn't lock anything for external resources, obviously!
	// e.Config.Services["hasura"].Lock()

	// defer e.Config.Services["hasura"].Activate()
	// defer e.Config.Services["hasura"].Unlock()

	// If migrations directory is already mounted to nhost_hasura container,
	// then Hasura must be auto-applying migrations
	// hence, manually applying migrations doesn't make sense

	// create migrations
	files, _ := os.ReadDir(nhost.MIGRATIONS_DIR)
	if len(files) > 0 {

		log.Debug("Applying migrations")
		cmdArgs := []string{e.Hasura.CLI, "migrate", "apply", "--database-name", nhost.DATABASE}
		cmdArgs = append(cmdArgs, commandOptions...)
		execute.Args = cmdArgs

		output, err := execute.CombinedOutput()
		if err != nil {
			log.Debug(string(output))
			log.Error("Failed to apply migrations")
			return err
		}
	}

	metaFiles, err := os.ReadDir(nhost.METADATA_DIR)
	if err != nil {
		return err
	}

	if len(metaFiles) == 0 {
		execute = exec.Cmd{
			Path: e.Hasura.CLI,
			Dir:  nhost.NHOST_DIR,
		}

		cmdArgs := []string{e.Hasura.CLI, "metadata", "export"}
		cmdArgs = append(cmdArgs, commandOptions...)
		execute.Args = cmdArgs

		output, err := execute.CombinedOutput()
		if err != nil {
			log.Debug(string(output))
			log.Error("Failed to export metadata")
			return err
		}
	}

	// If metadata directory is already mounted to nhost_hasura container,
	// then Hasura must be auto-applying metadata
	// hence, manually applying metadata doesn't make sense

	// apply metadata
	log.Debug("Applying metadata")
	execute = exec.Cmd{
		Path: e.Hasura.CLI,
		Dir:  nhost.NHOST_DIR,
	}
	cmdArgs := []string{e.Hasura.CLI, "metadata", "apply"}
	cmdArgs = append(cmdArgs, commandOptions...)
	execute.Args = cmdArgs

	output, err := execute.CombinedOutput()
	if err != nil {
		log.Debug(string(output))
		log.Error("Failed to apply metadata")
		return err
	}

	return nil
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

// Runs concurrent healthchecks on all Nhost services,
// which have a health check endpoint.
//
// Also, supports process cancellation from contexts.
func (e *Environment) HealthCheck(ctx context.Context) error {

	var err error
	var health_waiter sync.WaitGroup
	for _, service := range environment.Config.Services {
		if service.HealthEndpoint != "" {
			health_waiter.Add(1)
			go func(service *nhost.Service) {

				for counter := 1; counter <= 240; counter++ {
					select {
					case <-ctx.Done():
						log.WithFields(logrus.Fields{
							"type":      "service",
							"container": service.Name,
						}).Debug("Health check cancelled")
						return
					default:
						if healthy := service.Healthz(); healthy {
							log.WithFields(logrus.Fields{
								"type":      "service",
								"container": service.Name,
							}).Debug("Health check successful")

							// Activate the service
							service.Activate()

							health_waiter.Done()

							return
						}
						time.Sleep(1 * time.Second)
						log.WithFields(logrus.Fields{
							"type":      "container",
							"component": service.Name,
						}).Debugf("Health check attempt #%v unsuccessful", counter)
					}
				}

				log.WithFields(logrus.Fields{
					"type":      "service",
					"container": service.Name,
				}).Error("Health check failed")
				err = errors.New("healthcheck of at least 1 service has failed")

			}(service)
		} else {

			//
			//	If any service doesn't have a health check endpoint,
			//	then, by default, declare it active.
			//
			//	This is being done to prevent the enviroment from failing activation checks.
			//	Because we are not performing health checks on postgres and mailhog,
			//	they end up making the entire environment fail activation check.
			service.Active = true
		}
	}

	// wait for all healthchecks to pass
	health_waiter.Wait()

	return err
}

func (e *Environment) Seed(path string) error {

	seed_files, err := ioutil.ReadDir(path)
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
		data, err := ioutil.ReadFile(filepath.Join(path, item.Name()))
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

/*
// Ranges through all registered services of the environment,
// and ONLY if all are designated active, it returns true. Otherwise false.
func (e *Environment) isActive() bool {

	if len(e.Config.Services) == 0 {
		return false
	}

	for _, item := range e.Config.Services {
		if !item.Active {
			return false
		}
	}

	return true
}
*/
