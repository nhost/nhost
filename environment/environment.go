package environment

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

	client "github.com/docker/docker/client"
	"github.com/nhost/cli-go/logger"
	"github.com/nhost/cli-go/nhost"
	"github.com/nhost/cli-go/util"
	"github.com/nhost/cli-go/watcher"
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
	e.State = state
	e.Unlock()
}

func (e *Environment) Init() error {

	var err error

	log.WithField("component", e.Name).Debug("Initializing environment")

	// Update environment state
	e.UpdateState(Initializing)

	// connect to docker client
	e.Context, e.Cancel = context.WithCancel(context.Background())
	e.Docker, err = client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		log.Error(util.ErrDockerNotFound)
		return err
	}
	defer e.Docker.Close()

	// break execution if docker deamon is not running
	_, err = e.Docker.Info(e.Context)
	if err != nil {
		log.Error(util.ErrDockerNotFound)
		log.Info(util.InfoDockerDownload)
		return err
	}

	// get running containers with prefix "nhost_"
	containers, err := e.GetContainers()
	if err != nil {
		log.Error(util.ErrServicesNotFound)
		return err
	}

	// wrap the fetched containers inside the environment
	_ = e.WrapContainersAsServices(containers)

	//	Initialize a new watcher for the environment
	e.Watcher = watcher.New(e.Context)

	// If there is a local git repository,
	// in the project root directory,
	// then initialize watchers for keeping track
	// of HEAD changes on git checkout/pull/merge/fetch

	if util.PathExists(nhost.GIT_DIR) {

		// Initialize watcher for post-checkout branch changes
		e.Watcher.Register(filepath.Join(nhost.GIT_DIR, "HEAD"), e.restartAfterCheckout)

		// Initialize watcher for post-merge commit changes
		head := getBranchHEAD(filepath.Join(nhost.GIT_DIR, "refs", "remotes", nhost.REMOTE))
		if head != "" {
			e.Watcher.Register(head, e.restartMigrations)
		}
	}

	// Update environment state
	e.UpdateState(Intialized)

	return nil
}

//
// Performs default migrations and metadata operations
//

func (e *Environment) Prepare() error {

	var commandOptions = []string{
		"--endpoint",
		e.Hasura.Endpoint,
		"--admin-secret",
		e.Hasura.AdminSecret,
		"--skip-update-check",
	}

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

		execute := exec.CommandContext(e.ExecutionContext, e.Hasura.CLI)
		execute.Dir = nhost.NHOST_DIR

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
		execute := exec.CommandContext(e.ExecutionContext, e.Hasura.CLI)
		execute.Dir = nhost.NHOST_DIR

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
	execute := exec.CommandContext(e.ExecutionContext, e.Hasura.CLI)
	execute.Dir = nhost.NHOST_DIR

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

// Runs concurrent healthchecks on all Nhost services,
// which have a health check endpoint.
//
// Also, supports process cancellation from contexts.
func (e *Environment) HealthCheck(ctx context.Context) error {

	const banner = "Running a quick health check on services"
	log.Info(banner)

	var i int
	var l int
	var err error
	var health_waiter sync.WaitGroup
	for _, service := range e.Config.Services {
		if service.HealthEndpoint != "" {
			l += 1
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
							if !logger.DEBUG {
								i += 1
								fmt.Printf("\rComplete: (%d/%d)", i, l)
							}
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
				err = errors.New("health check of at least 1 service has failed")

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
	if !logger.DEBUG {
		fmt.Printf("\r")
	}
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

func (e *Environment) Cleanup() {

	// Gracefully shut down all registered servers of the environment
	for _, server := range e.Servers {
		server.Shutdown(e.Context)
	}

	//	Close the watcher
	e.Watcher.Close()

	if e.State >= Executing {
		log.Warn("Please wait while we cleanup")

		//	Pass the parent context of the environment,
		//	because this is the final cleanup procedure
		//	and we are going to cancel this context shortly after
		if err := e.Shutdown(false, e.Context); err != nil {
			log.Debug(err)
			log.Fatal("Failed to stop running services")
		}

		log.Info("Cleanup complete. See you later, grasshopper!")
	}

	// Don't cancel the contexts before shutting down the containers
	e.Cancel()
}

func printProgressBar(iteration, total int, prefix, suffix string, length int, fill string) {
	percent := float64(iteration) / float64(total)
	filledLength := int(length * iteration / total)
	end := ">"

	if iteration == total {
		end = "="
	}
	bar := strings.Repeat(fill, filledLength) + end + strings.Repeat("-", (length-filledLength))
	fmt.Printf("\r%s [%s] %f%% %s", prefix, bar, percent, suffix)
	if iteration == total {
		fmt.Println()
	}
}
