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
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"text/tabwriter"

	"github.com/docker/docker/api/types"
	client "github.com/docker/docker/client"
	"github.com/mrinalwahal/cli/hasura"
	"github.com/mrinalwahal/cli/nhost"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

var (
	port string

	// proxy mux
	mux = http.NewServeMux()

	// reverse proxy server
	proxy *http.Server

	// signal interruption channel
	stop   = make(chan os.Signal)
	cancel context.CancelFunc
)

// devCmd represents the dev command
var devCmd = &cobra.Command{
	Use:     "dev [-p port]",
	Aliases: []string{"d", "start", "up"},
	Short:   "Start local development environment",
	Long:    `Initialize a local Nhost environment for development and testing.`,
	Run: func(cmd *cobra.Command, args []string) {

		log.Info("Initializing environment")

		// initialize the proxy server
		proxy = &http.Server{Addr: ":" + port, Handler: mux}

		// check if /nhost exists
		if !pathExists(nhost.NHOST_DIR) {
			log.Info("Initialize a project by running 'nhost'")
			log.Fatal("Project not found in this directory")
		}

		// create /.nhost if it doesn't exist
		if err := os.MkdirAll(nhost.DOT_NHOST, os.ModePerm); err != nil {
			log.Debug(err)
			log.Fatal("Failed to initialize nhost data directory")
		}

		// update the environment
		environment.Name = "development"
		environment.Context, cancel = context.WithCancel(context.Background())

		// initialize a common http client
		environment.HTTP = &http.Client{}

		var end_waiter sync.WaitGroup
		end_waiter.Add(1)

		// add cleanup action in case of signal interruption
		signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
		go func() {
			<-stop
			cleanup(cmd)
		}()

		// being the execution
		execute(cmd, args)

		// wait for Ctrl+C
		end_waiter.Wait()
	},
}

func cleanup(cmd *cobra.Command) {
	proxy.Shutdown(environment.Context)

	if environment.Active {
		log.Warn("Please wait while we cleanup")
		if err := environment.Shutdown(false); err != nil {
			log.Debug(err)
			log.Fatal("Failed to stop running services")
		}
		log.Info("Cleanup complete. See you later, grasshopper!")
	}

	close(stop)
	cancel()
	os.Exit(0)
}

func execute(cmd *cobra.Command, args []string) {

	var err error

	// connect to docker client
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

	/*

		---------------------------------
		`nhost dev` Operational Strategy
		---------------------------------

		1.	Initialize your running environment.
		2.	Fetch the list of running containers.
		3.	Wrap those existing containers as services inside the runtime environment.
			This will save the container ID in the service structure, so that it can be used to simply
			restart the container later, instead of creating it from scratch.
		4.	Parse the Nhost project configuration from config.yaml,
			and wrap it on existing services configurations.
			This will update all the fields of the service, which until now, only contained the container ID.
			This also includes initializing the service config and host config.
		5. 	Run the services.
			5.1	If the service ID exists --> start the same container
				else {
				--> create the container from configuration, and attach it to the network.
				--> now start the newly created container.
			}
			5.2	Once the container has been started, save the new container ID and assigned Port.
				This will ensure that the new port is used for attaching a reverse proxy to this service, if required.
	*/

	// Fetch list of existing containers
	containers, err := environment.GetContainers()
	if err != nil {
		log.Debug(err)
		log.Fatal("Failed to shut down Nhost services")
	}

	// Wrap fetched containers as services in the environment
	_ = environment.WrapContainersAsServices(containers)

	// Parse the nhost/config.yaml
	if err = environment.Config.Wrap(); err != nil {
		log.Debug(err)
		log.Fatal("Failed to read Nhost config")
	}

	// check if this is the first time dev env is running
	firstRun := !pathExists(filepath.Join(nhost.DOT_NHOST, "db_data"))
	if firstRun {
		log.Info("First run takes longer, please be patient")
	}

	// if functions exist,
	// start then and register as a service
	if pathExists(nhost.API_DIR) {

		// run the functions command
		go ServeFuncs(cmd, []string{"do_not_inform"})
		port, _ := strconv.Atoi(funcPort)
		environment.Config.Services["functions"] = &nhost.Service{
			Name:    "functions",
			Address: fmt.Sprintf("http://localhost:%v", funcPort),
			Handle:  "/v1/functions/",
			Proxy:   true,
			Port:    port,
		}
	}

	// prepare environment
	// check for available docker images
	// and update any env vars required
	if err := environment.Prepare(); err != nil {
		log.Debug(err)
		log.Fatal("Failed to prepare environment")
	}

	// generate configuration for every service
	// this generates all env vars, mount points and commands
	if err := environment.Config.Init(); err != nil {
		log.Debug(err)
		log.Fatal("Failed to generate configuration")
	}

	// create the Nhost network if it doesn't exist
	if err := environment.PrepareNetwork(); err != nil {
		log.Debug(err)
		log.WithFields(logrus.Fields{
			"type":    "network",
			"network": nhost.PREFIX,
		}).Fatal("Failed to prepare network")
	}

	// create and start the conatiners
	for _, item := range environment.Config.Services {

		// Only those services which have a container configuration
		// This is being done to exclude FUNCTIONS
		if item.Config != nil {
			if err := item.Run(environment.Docker, environment.Context, environment.Network); err != nil {
				log.WithFields(logrus.Fields{
					"container": item.Name,
					"type":      "container",
				}).Debug(err)
				log.WithFields(logrus.Fields{
					"container": item.Name,
					"type":      "container",
				}).Error("Failed to run container")
				cleanup(cmd)
			}

			// activate the environment to let it be cleaned on shutdown
			environment.Active = true
		}
	}

	//
	// Update the ports and IDs of services against the running ones
	//
	// Fetch list of existing containers
	containers, err = environment.GetContainers()
	if err != nil {
		log.Debug(err)
		log.Fatal("Failed to shut down Nhost services")
	}

	// Wrap fetched containers as services in the environment
	_ = environment.WrapContainersAsServices(containers)

	log.Info("Running a quick health check on services")
	var health_waiter sync.WaitGroup
	for _, service := range environment.Config.Services {
		if service.HealthEndpoint != "" {
			health_waiter.Add(1)
			go func(service *nhost.Service) {
				if healthy := service.Healthz(); !healthy {
					log.WithFields(logrus.Fields{
						"type":      "service",
						"container": service.Name,
					}).Error("Health check failed")
					cleanup(cmd)
				}
				log.WithFields(logrus.Fields{
					"type":      "service",
					"container": service.Name,
				}).Debug("Health check successful")
				health_waiter.Done()
			}(service)
		}
	}

	// wait for all healthchecks to pass
	health_waiter.Wait()

	// prepare and load required binaries
	hasuraCLI, _ := hasura.Binary()

	environment.Hasura = &hasura.Client{
		Endpoint:    fmt.Sprintf(`http://localhost:%v`, environment.Config.Services["hasura"].Port),
		AdminSecret: fmt.Sprint(environment.Config.Services["hasura"].AdminSecret),
		Client:      &http.Client{},
		CLI:         hasuraCLI,
	}

	// apply migrations and metadata
	if err = environment.Hasura.Prepare(); err != nil {
		log.Debug(err)
		cleanup(cmd)
	}

	// apply seeds on the first run
	if firstRun {
		if err = environment.Seed(); err != nil {
			log.Debug(err)
			cleanup(cmd)
		}
	}

	// print the proxy routes
	w := tabwriter.NewWriter(os.Stdout, 1, 1, 1, ' ', 0)
	fmt.Println()
	fmt.Fprintln(w, "---\t\t-----")

	for name, item := range environment.Config.Services {

		// Only issue a proxy to those,
		// which have proxy enabled
		if item.Proxy {

			if err := item.IssueProxy(mux); err != nil {
				log.WithField("component", "server").Debug(err)
				log.WithField("component", "server").Error("Failed to proxy", name)
				cleanup(cmd)
			}

			// print the name and handle
			fmt.Fprintf(w, "%v\t\t%v", strings.Title(strings.ToLower(name)), fmt.Sprintf("%shttp://localhost:%v%s%s", Gray, port, Reset, filepath.Clean(item.Handle)))
			fmt.Fprintln(w)

		}
	}

	fmt.Fprintln(w, "---\t\t-----")
	w.Flush()
	fmt.Println()

	// give example of using Functions inside Hasura
	if pathExists(nhost.API_DIR) {
		log.Info("ProTip: You can call Functions inside Hasura!")
		fmt.Println()
		fmt.Fprintln(w, "--\t\t----")
		fmt.Fprintf(w, "%v\t\t%v", "URL", fmt.Sprintf("%s{{NHOST_FUNCTIONS}}%s/hello", Gray, Reset))
		fmt.Fprintln(w)
		fmt.Fprintln(w, "--\t\t----")
		w.Flush()
		fmt.Println()
	}

	//spawn hasura console
	hasuraConsoleSpawnCmd := exec.Cmd{
		Path: hasuraCLI,
		Args: []string{hasuraCLI,
			"console",
			"--endpoint",
			environment.Hasura.Endpoint,
			"--admin-secret",
			environment.Hasura.AdminSecret,
			"--console-port",
			fmt.Sprint(nhost.GetPort(9301, 9400)),
		},
		Dir: nhost.NHOST_DIR,
	}

	go hasuraConsoleSpawnCmd.Run()

	// launch mailhog UI
	go openbrowser(environment.Config.Services["mailhog"].Address)

	log.Warn("Use Ctrl + C to stop running evironment")

	// launch proxy
	go func() {
		if err := proxy.ListenAndServe(); err != nil {
			log.WithField("component", "proxy").Debug(err)
		}
	}()

	// launch sessions
	for key, item := range environment.Config.Sessions {

		log.WithFields(logrus.Fields{
			"type":  "session",
			"value": key,
		}).Debug("Spawning")

		item.Spawn()
	}
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

func (e *Environment) Seed() error {

	/* 	// intialize common options
	   	hasuraEndpoint := fmt.Sprintf(`http://localhost:%v`, configuration.Services["hasura"].Port)
	   	adminSecret := fmt.Sprint(configuration.Services["hasura"].AdminSecret)

	   	// create new hasura client
	   	client := hasura.Client{
	   		Endpoint:    hasuraEndpoint,
	   		AdminSecret: adminSecret,
	   		Client:      &Client,
	   	}
	*/
	seed_files, err := ioutil.ReadDir(nhost.SEEDS_DIR)
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
		data, err := ioutil.ReadFile(filepath.Join(nhost.SEEDS_DIR, item.Name()))
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

func init() {
	rootCmd.AddCommand(devCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	devCmd.PersistentFlags().StringVarP(&port, "port", "p", "1337", "Port for dev proxy")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	//devCmd.Flags().BoolVarP(&background, "background", "b", false, "Run dev services in background")
}
