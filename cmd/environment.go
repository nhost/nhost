package cmd

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
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
	"github.com/spf13/cobra"
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

	// If there is a local git repository,
	// in the project root directory,
	// then initialize watchers for keeping track
	// of HEAD changes on git checkout/pull/merge/fetch

	if pathExists(nhost.GIT_DIR) {

		e.Watchers = make(map[string]WatcherOperation)

		// Initialize watcher for post-checkout branch changes
		e.Watchers[filepath.Join(nhost.GIT_DIR, "HEAD")] = e.restartEnvironmentAfterCheckout

		// Initialize watcher for post-merge commit changes
		head := getBranchHEAD(filepath.Join(nhost.GIT_DIR, "refs", "remotes", "origin"))
		if head != "" {
			e.Watchers[head] = e.restartMigrations
		}
	}
	return nil
}

func getBranchHEAD(root string) string {

	//
	// HEAD Selection Logic
	//
	// 1.If $GIT_DIR/<refname> exists,
	// that is what you mean (this is usually useful only for HEAD,
	// FETCH_HEAD, ORIG_HEAD, MERGE_HEAD and CHERRY_PICK_HEAD);

	// 2.otherwise, refs/<refname> if it exists;
	// 3.otherwise, refs/tags/<refname> if it exists;
	// 4.otherwise, refs/heads/<refname> if it exists;
	// 5.otherwise, refs/remotes/<refname> if it exists;
	// 6.otherwise, refs/remotes/<refname>/HEAD if it exists.

	var response string
	branch := nhost.GetCurrentBranch()

	// The priority order these paths are added in,
	// is extremely IMPORTANT
	tree := []string{
		root,
		filepath.Join(root, "HEAD"),
		filepath.Join(root, branch),
		filepath.Join(root, branch, "HEAD"),
	}

	f := func(path string, dir fs.DirEntry, err error) error {
		for _, file := range tree {
			if file == path && !dir.IsDir() {
				response = path
				return nil
			}
		}
		return nil
	}

	if err := filepath.WalkDir(root, f); err != nil {
		return ""
	}

	return response
}

func (e *Environment) restartMigrations(cmd *cobra.Command, args []string) error {

	// Inform the user of detection
	log.Info("We've detected change in local git commit")
	log.Warn("We're fixing your data accordingly. Give us a moment!")

	// ------------------------------------------
	// Why listen to Hasura's Activation channel?
	// ------------------------------------------
	//
	// Because we may have a potential race condition over here.
	//
	// Consider the following corner case:
	//
	// 1. User does `git checkout` another branch.
	// 2. User immediately does `git pull`, before letting the refreshed environment
	// complete health checks, and even before letting Hasura complete migrations
	// for refreshed environment.
	//
	// --------------------
	// Implemented Solution
	// --------------------
	//
	// Only perform migrations and metadata if Hasura is active,
	// independent of whether it performs these new "post-pull" migrations
	// before OR after the migrations of refreshed environment has been completed.
	//
	// Before applying migrations, Hasura anyway validates whether the migrations
	// already exist or not. If they do, Hasura doesn't even apply them.
	//
	// So, we are good!

	for {
		active, ok := <-*e.Config.Services["hasura"].Active
		if !ok {
			return errors.New("hasura isn't live yet")
		} else {
			if !active {
				log.Info("Waiting for your GraphQL Engine to become active")
			} else {

				// re-do migrations and metadata
				if err := e.Prepare(); err != nil {
					return err
				}

				break
			}
		}
	}

	log.Info("Done! Please continue with your work.")
	return nil
}

func (e *Environment) restartEnvironmentAfterCheckout(cmd *cobra.Command, args []string) error {

	// inform the user of detection
	log.Info("We've detected change in local git branch")
	log.Warn("We're restarting your environment")

	// Stop all execution specific goroutines
	executionContext.Done()
	executionCancel()

	if err := environment.Shutdown(true); err != nil {
		log.Debug(err)
		log.Error("Failed to stop running services")
	}

	// update DOT_NHOST directory
	nhost.DOT_NHOST, _ = nhost.GetDotNhost()

	// register new branch HEAD for the watcher
	head := getBranchHEAD(filepath.Join(nhost.GIT_DIR, "refs", "remotes", "origin"))
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
		watcher.Add(head)
		log.WithField("component", "watcher").Debug("Watching: ", strings.TrimPrefix(head, nhost.WORKING_DIR))
	}

	// now re-create the them
	execute(cmd, args)

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
			e.Config.Services[name] = &nhost.Service{}

			// Initialize the channel to send out [de/]activation
			// signals to whoever needs to listen for these signals
			e.Config.Services[name].Active = new(chan bool)
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
								if value != "" {
									if key.(string) == "smtp_port" {
										smtpPort = value.(int)
										break
									}
								}
							}
						}
						if int(port.PublicPort) == smtpPort {
							continue
						}
					}
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

					// De-activate the service
					container.Deactivate()

				} else if purge {
					if err := container.Remove(e.Docker, e.Context); err != nil {
						log.Debug(err)
						log.WithFields(logrus.Fields{
							"container": container.Name,
							"type":      "container",
						}).Error("Failed to remove")
					}

					// Reset their service ID,
					// to prevent docker from starting these non-existent containers
					container.ID = ""

					// Close the service's activation channel
					if *container.Active != nil {
						close(*container.Active)
					}
				}

				end_waiter.Done()
			}(container)
		}
	}

	end_waiter.Wait()

	// reset the loaded environments,
	// to cater for re-use
	// e.Reset()

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
	e.Config.Services["hasura"].Deactivate()

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

	// Designate Hasura re-activated once migrations are complete
	e.Config.Services["hasura"].Activate()

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
					case <-executionContext.Done():
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
		}
	}

	// wait for all healthchecks to pass
	health_waiter.Wait()

	return err
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
