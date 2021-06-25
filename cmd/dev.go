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
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io/ioutil"
	"net"
	"os"
	"os/exec"
	"os/signal"
	"path"
	"strconv"
	"strings"
	"sync"
	"syscall"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/mount"
	client "github.com/docker/docker/client"
	"github.com/docker/go-connections/nat"
	"github.com/mrinalwahal/cli/hasura"
	"github.com/mrinalwahal/cli/nhost"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

// devCmd represents the dev command
var devCmd = &cobra.Command{
	Use:     "dev",
	Aliases: []string{"d"},
	Short:   "Start local development environment",
	Long:    `Initialize a local Nhost environment for development and testing.`,
	Run: func(cmd *cobra.Command, args []string) {

		var end_waiter sync.WaitGroup
		end_waiter.Add(1)

		// add cleanup action in case of signal interruption
		c := make(chan os.Signal)
		signal.Notify(c, os.Interrupt, syscall.SIGTERM)
		go func() {
			<-c
			cleanup(cmd)
		}()

		// being the execution
		execute(cmd, args)

		fmt.Println()
		log.Warn("Use Ctrl + C to stop running evironment")

		// wait for Ctrl+C
		end_waiter.Wait()
	},
}

func cleanup(cmd *cobra.Command) {
	log.Warn("Please wait while we cleanup")
	downCmd.Run(cmd, []string{"exit"})
}

func execute(cmd *cobra.Command, args []string) {

	// check if /nhost exists
	if !pathExists(nhost.NHOST_DIR) {
		log.Info("Initialize a project by running 'nhost' or 'nhost init'")
		log.Fatal("Project not found in this directory")
	}

	// create /.nhost if it doesn't exist
	if err := os.MkdirAll(nhost.DOT_NHOST, os.ModePerm); err != nil {
		log.Debug(err)
		log.Fatal("Failed to initialize nhost data directory")
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

	log.WithField("component", "development").Info("Initializing environment")

	// check if this is the first time dev env is running
	firstRun := !pathExists(path.Join(nhost.DOT_NHOST, "db_data"))
	if firstRun {
		log.Info("First run takes longer, please be patient")
	}

	// shut down any existing Nhost containers
	downCmd.Run(cmd, args)

	nhostConfig, err := nhost.Config()
	if err != nil {
		log.Debug(err)
		log.Fatal("Failed to read Nhost config")
	}

	// validate the available of ports
	if err = validatePortAvailability(nhostConfig.Services); err != nil {
		log.Error(err)
		log.Fatal("Change nhost/config.yaml or stop the services")
	}

	if nhostConfig.Environment["graphql_jwt_key"] == "" || nhostConfig.Environment["graphql_jwt_key"] == nil {
		nhostConfig.Environment["graphql_jwt_key"] = generateRandomKey()
	}

	// generate Nhost service containers' configurations
	nhostServices, err := getContainerConfigs(docker, nhostConfig, nhost.DOT_NHOST)
	if err != nil {
		log.Debug(err)
		log.Fatal("Failed to generate container configurations")
	}

	// create the Nhost network if it doesn't exist
	networkID, err := prepareNetwork(docker, ctx, nhost.PROJECT)
	if err != nil {
		log.Debug(err)
		log.WithFields(logrus.Fields{
			"network": nhost.PROJECT,
			"type":    "network",
		}).Debug("Failed to prepare network")
	}

	// create and start the conatiners
	for _, item := range nhostServices {

		if err := runContainer(docker, ctx, item["config"].(*container.Config), item["host_config"].(*container.HostConfig), item["name"].(string), networkID); err != nil {
			log.Debug(err)
			log.WithFields(logrus.Fields{
				"container": item["name"],
				"type":      "container",
			}).Error("Failed to start")
			cleanup(cmd)
		}
		log.WithFields(logrus.Fields{
			"container": item["name"],
			"type":      "container",
		}).Debug("Created")
	}

	log.Info("Running a quick health check on services")
	healthCmd.Run(cmd, args)

	hasuraEndpoint := fmt.Sprintf(`http://localhost:%v`, nhostConfig.Services["hasura"].Port)

	/*
		// wait for graphQL engine to become healthy
		hasuraContainerName := getContainerName("hasura")
		log.WithField("container", hasuraContainerName).Info("Waiting for GraphQL engine to become active")
		if ok := checkServiceHealth(hasuraContainerName, fmt.Sprintf("%v/healthz", hasuraEndpoint)); !ok {
			log.WithField("container", hasuraContainerName).Error("GraphQL engine health check failed")
			downCmd.Run(cmd, []string{"exit"})
		}
	*/

	// prepare and load hasura binary
	hasuraCLI, _ := hasura.Binary()

	commandOptions := []string{
		"--endpoint",
		hasuraEndpoint,
		"--admin-secret",
		fmt.Sprint(nhostConfig.Services["hasura"].AdminSecret),
		"--skip-update-check",
	}

	// arpply migrations and metadata
	if err = prepareData(hasuraCLI, commandOptions, firstRun); err != nil {
		log.Debug(err)
		cleanup(cmd)
	}

	log.WithField("component", "development").Info("Environment is now active")
	fmt.Println()

	log.Infof("GraphQL API: %v/v1/graphql", hasuraEndpoint)
	log.Infof("Hasura Backend Plus: http://localhost:%v", nhostConfig.Services["hasura_backend_plus"].Port)
	log.Infof("Storage: http://localhost:%v", nhostConfig.Services["minio"].Port)
	log.Infof("Postgres: http://localhost:%v", nhostConfig.Services["postgres"].Port)

	if pathExists(nhost.API_DIR) {
		log.Infof("Custom API: http://localhost:%v", nhostConfig.Services["api"].Port)
	}

	log.Infof("Launching Hasura console at: http://localhost:%v", nhostConfig.Services["hasura"].ConsolePort)

	//spawn hasura console
	hasuraConsoleSpawnCmd := exec.Cmd{
		Path: hasuraCLI,
		Args: []string{hasuraCLI,
			"console",
			"--endpoint",
			hasuraEndpoint,
			"--admin-secret",
			fmt.Sprint(nhostConfig.Services["hasura"].AdminSecret),
			"--console-port",
			fmt.Sprint(nhostConfig.Services["hasura"].ConsolePort),
		},
		Dir: nhost.NHOST_DIR,
	}

	go hasuraConsoleSpawnCmd.Run()

	/*

		// attach a watcher to the API conatiner's package.json
		// to provide live reload functionality

		if pathExists(nhost.API_DIR) {

			watcher, err := fsnotify.NewWatcher()
			if err != nil {
				log.Debug(err)
				log.WithField("component", "watcher").Error("Failed to initialize live reload watcher")
			}
			defer watcher.Close()

			// fetch the API container
			APIContainerName := getContainerName("api")
			containers, err := getContainers(docker, ctx, APIContainerName)
			if err != nil {
				log.WithField("container", APIContainerName).Debug(err)
				log.WithField("container", APIContainerName).Error("Failed to fetch container")
			}

			container := containers[0]

			go func() {
				for {
					select {
					case event, ok := <-watcher.Events:
						if !ok {
							return
						}
						if event.Op&fsnotify.Write == fsnotify.Write {
							log.WithField("file", path.Base(event.Name)).Debug("File modifed")
							log.WithField("container", APIContainerName).Info("Restarting container")
							if err = docker.ContainerRestart(ctx, container.ID, nil); err != nil {
								log.WithField("container", APIContainerName).Debug(err)
								log.WithField("container", APIContainerName).Error("Failed to restart container")
							}
						}
					case err, ok := <-watcher.Errors:
						if !ok {
							return
						}
						log.WithField("container", APIContainerName).Error(err)
					}
				}
			}()

			// initialize locations to start watching
			targets := map[string]string{
				"api/package.json": path.Join(nhost.API_DIR, "package.json"),
			}

			for key, value := range targets {
				err = watcher.Add(value)
				if err != nil {
					log.Debug(err)
					log.WithField("target", key).Error("Failed to attach target for live reload")
				}
				log.WithField("target", key).Info("Target being watched for live reload")
			}
		}
	*/
}

func prepareData(hasuraCLI string, commandOptions []string, firstRun bool) error {

	log.Debug("Prearing migrations and metadata")

	var (
		cmdArgs []string
		execute exec.Cmd
		output  []byte
	)

	// If migrations directory is already mounted to nhost_hasura container,
	// then Hasura must be auto-applying migrations
	// hence, manually applying migrations doesn't make sense

	// create migrations
	cmdArgs = []string{hasuraCLI, "migrate", "apply"}
	cmdArgs = append(cmdArgs, commandOptions...)

	execute = exec.Cmd{
		Path: hasuraCLI,
		Args: cmdArgs,
		Dir:  nhost.NHOST_DIR,
	}

	output, err := execute.CombinedOutput()
	if err != nil {
		log.Debug(string(output))
		log.Error("Failed to apply migrations")
		return err
	}

	seed_files, err := ioutil.ReadDir(nhost.SEEDS_DIR)
	if err != nil {
		log.Error("Failed to read seeds directory")
		return err
	}

	// if there are more seeds than just enum tables,
	// apply them too
	if firstRun && len(seed_files) > 0 {

		log.Debug("Applying seeds on first run")

		// apply seed data
		cmdArgs = []string{hasuraCLI, "seeds", "apply"}
		cmdArgs = append(cmdArgs, commandOptions...)

		execute = exec.Cmd{
			Path: hasuraCLI,
			Args: cmdArgs,
			Dir:  nhost.NHOST_DIR,
		}

		output, err = execute.CombinedOutput()
		if err != nil {
			log.Debug(string(output))
			log.Error("Failed to apply seed data")
			return err
		}
	}

	metaFiles, err := os.ReadDir(nhost.METADATA_DIR)
	if err != nil {
		log.Debug(string(output))
		log.Error("Failed to traverse metadata directory")
		return err
	}

	if len(metaFiles) == 0 {

		// export metadata
		cmdArgs = []string{hasuraCLI, "metadata", "export"}
		cmdArgs = append(cmdArgs, commandOptions...)

		execute = exec.Cmd{
			Path: hasuraCLI,
			Args: cmdArgs,
			Dir:  nhost.NHOST_DIR,
		}

		output, err = execute.CombinedOutput()
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
	cmdArgs = []string{hasuraCLI, "metadata", "apply"}
	cmdArgs = append(cmdArgs, commandOptions...)

	execute = exec.Cmd{
		Path: hasuraCLI,
		Args: cmdArgs,
		Dir:  nhost.NHOST_DIR,
	}

	output, err = execute.CombinedOutput()
	if err != nil {
		log.Debug(string(output))
		log.Error("Failed to apply metadata")
		return err
	}

	return nil
}

func validatePortAvailability(services map[string]nhost.Service) error {
	ports := []string{
		fmt.Sprint(services["hasura"].Port),
		fmt.Sprint(services["hasura"].ConsolePort),
		fmt.Sprint(services["hasura_backend_plus"].Port),
		fmt.Sprint(services["minio"].Port),
		fmt.Sprint(services["postgres"].Port),
		fmt.Sprint(services["api"].Port),
	}

	freePorts := getFreePorts(ports)

	var occupiedPorts []string
	for _, port := range ports {
		if !contains(freePorts, port) {
			occupiedPorts = append(occupiedPorts, port)
		}
	}

	if len(occupiedPorts) > 0 {
		return fmt.Errorf("ports %v are already in use, hence aborting", occupiedPorts)
	}
	return nil
}

// start a fresh container in background
func runContainer(client *client.Client, ctx context.Context, containerConfig *container.Config, hostConfig *container.HostConfig, name, networkID string) error {

	container, err := client.ContainerCreate(
		ctx,
		containerConfig,
		hostConfig,
		nil,
		nil,
		name,
	)

	if err != nil {
		return err
	}

	err = client.ContainerStart(ctx, container.ID, types.ContainerStartOptions{})
	if err != nil {
		return err
	}

	return client.NetworkConnect(ctx, networkID, container.ID, nil)

	/*
		// avoid using the code below if you want to run the containers in background

		statusCh, errCh := client.ContainerWait(ctx, cont.ID, container.WaitConditionNotRunning)
		select {
		case err := <-errCh:
			if err != nil {
				return err
			}
		case <-statusCh:
		}
	*/
}

// generate a random 128 byte key
func generateRandomKey() string {
	key := make([]byte, 128)
	rand.Read(key)
	return hex.EncodeToString(key)
}

// check whether source array contains value or not
func contains(s []string, e string) bool {
	for _, a := range s {
		if a == e {
			return true
		}
	}
	return false
}

func getFreePorts(ports []string) []string {

	var freePorts []string

	for _, port := range ports {
		if portAvaiable(port) {
			freePorts = append(freePorts, port)
		}
	}
	return freePorts
}

func portAvaiable(port string) bool {

	ln, err := net.Listen("tcp", ":"+port)

	if err != nil {
		return false
	}

	ln.Close()
	return true
}
func getContainerConfigs(client *client.Client, options nhost.Configuration, cwd string) ([]map[string]interface{}, error) {

	log.Debug("Preparing Nhost container configurations")

	var containers []map[string]interface{}

	// segregate configurations for different services

	postgresConfig := options.Services["postgres"]
	hasuraConfig := options.Services["hasura"]
	hbpConfig := options.Services["hasura_backend_plus"]
	minioConfig := options.Services["minio"]
	apiConfig := options.Services["api"]

	startAPI := pathExists(nhost.API_DIR)

	// check if a required image already exists
	// if it doesn't which case -> then pull it

	requiredImages := []string{
		fmt.Sprintf("nhost/postgres:%v", postgresConfig.Version),
		fmt.Sprintf("%s:%v", hasuraConfig.Image, hasuraConfig.Version),
		fmt.Sprintf("nhost/hasura-backend-plus:%v", hbpConfig.Version),
		fmt.Sprintf("minio/minio:%v", minioConfig.Version),
	}

	// if API container is going to be launched,
	// validate it's image too
	if startAPI {
		requiredImages = append(requiredImages, fmt.Sprintf("nhost/nodeapi:%v", "latest"))
	}

	availableImages, err := getInstalledImages(client, context.Background())
	if err != nil {
		return containers, err
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
			if err = pullImage(client, requiredImage); err != nil {
				log.Debug(err)
				log.WithField("component", requiredImage).Error("Failed to pull image")
				log.WithField("component", requiredImage).Infof("Pull it manually with `docker image pull %v && nhost dev`", requiredImage)
			}
		}
	}

	// read env_file
	envFile, err := ioutil.ReadFile(options.Environment["env_file"].(string))
	if err != nil {
		log.Warnf("Failed to read %v file", path.Base(options.Environment["env_file"].(string)))
		return containers, err
	}

	envData := strings.Split(string(envFile), "\n")
	var envVars []string

	for _, row := range envData {
		if strings.Contains(row, "=") {
			envVars = append(envVars, row)
		}
	}

	// create mount points if they doesn't exist
	mountPoints := []mount.Mount{
		{
			Type:   mount.TypeBind,
			Source: path.Join(cwd, "db_data"),
			Target: "/var/lib/postgresql/data",
		},
	}

	for _, mountPoint := range mountPoints {
		if err := os.MkdirAll(mountPoint.Source, os.ModePerm); err != nil {
			return containers, err
		}
	}

	postgresContainer := map[string]interface{}{
		"name": getContainerName("postgres"),
		"config": &container.Config{
			Healthcheck: &container.HealthConfig{
				Test: []string{
					"CMD",
					"pg_isready",
					"-h",
					"localhost",
					"-p",
					fmt.Sprint(postgresConfig.Port),
					"-U",
					fmt.Sprint(postgresConfig.User),
					"-d",
					"postgres",
				},
				Interval:    1000000000,
				Timeout:     10000000000,
				Retries:     10,
				StartPeriod: 60000000000,
			},
			Image: fmt.Sprintf(`nhost/postgres:%v`, postgresConfig.Version),
			Env: []string{
				fmt.Sprintf("POSTGRES_USER=%v", postgresConfig.User),
				fmt.Sprintf("POSTGRES_PASSWORD=%v", postgresConfig.Password),
			},
			ExposedPorts: nat.PortSet{nat.Port(fmt.Sprintf("%v", postgresConfig.Port)): struct{}{}},
			Cmd: []string{
				"-p",
				fmt.Sprint(postgresConfig.Port),
			},
		},
		"host_config": &container.HostConfig{
			AutoRemove:   true,
			PortBindings: map[nat.Port][]nat.PortBinding{nat.Port(fmt.Sprintf("%v", postgresConfig.Port)): {{HostIP: "127.0.0.1", HostPort: fmt.Sprintf("%v", postgresConfig.Port)}}},
			/*
				RestartPolicy: container.RestartPolicy{
					Name: "always",
				},
			*/
			Mounts: mountPoints,
		},
	}

	// prepare env variables for following container
	containerVariables := []string{
		fmt.Sprintf("HASURA_GRAPHQL_SERVER_PORT=%v", hasuraConfig.Port),
		fmt.Sprintf("HASURA_GRAPHQL_DATABASE_URL=%v", fmt.Sprintf(`postgres://%v:%v@%s:%v/postgres`, postgresConfig.User, postgresConfig.Password, getContainerName("postgres"), postgresConfig.Port)),
		"HASURA_GRAPHQL_ENABLE_CONSOLE=false",
		"HASURA_GRAPHQL_ENABLED_LOG_TYPES=startup, http-log, webhook-log, websocket-log, query-log",
		fmt.Sprintf("HASURA_GRAPHQL_ADMIN_SECRET=%v", hasuraConfig.AdminSecret),
		fmt.Sprintf("HASURA_GRAPHQL_MIGRATIONS_SERVER_TIMEOUT=%d", 20),
		fmt.Sprintf("HASURA_GRAPHQL_NO_OF_RETRIES=%d", 20),
		"HASURA_GRAPHQL_UNAUTHORIZED_ROLE=public",
		fmt.Sprintf("NHOST_HASURA_URL=%v", fmt.Sprintf(`http://%s:%v/v1/graphql`, getContainerName("hasura"), hasuraConfig.Port)),
		"NHOST_WEBHOOK_SECRET=devnhostwebhooksecret",
		fmt.Sprintf("NHOST_HBP_URL=%v", fmt.Sprintf(`http://%s:%v`, getContainerName("hbp"), hbpConfig.Port)),
		fmt.Sprintf("NHOST_CUSTOM_API_URL=%v", fmt.Sprintf(`http://%s:%v`, getContainerName("api"), apiConfig.Port)),
	}
	containerVariables = append(containerVariables, envVars...)

	containerVariables = append(containerVariables,
		fmt.Sprintf("HASURA_GRAPHQL_JWT_SECRET=%v", fmt.Sprintf(`{"type":"HS256", "key": "%v"}`, options.Environment["graphql_jwt_key"])))

	// create mount points if they doesn't exist
	mountPoints = []mount.Mount{
		{
			Type:   mount.TypeBind,
			Source: nhost.MIGRATIONS_DIR,
			Target: "/hasura-migrations",
		},
		{
			Type:   mount.TypeBind,
			Source: nhost.METADATA_DIR,
			Target: "/hasura-metadata",
		},
	}

	for _, mountPoint := range mountPoints {
		if err := os.MkdirAll(mountPoint.Source, os.ModePerm); err != nil {
			return containers, err
		}
	}

	hasuraContainer := map[string]interface{}{
		"name": getContainerName("hasura"),
		"config": &container.Config{
			Healthcheck: &container.HealthConfig{
				Test: []string{
					"CMD-SHELL",
					"curl",
					fmt.Sprintf("http://127.0.0.1:%v/healthz", hasuraConfig.Port),
				},
				Interval:    1000000000,
				Timeout:     10000000000,
				Retries:     10,
				StartPeriod: 60000000000,
			},
			Image: fmt.Sprintf(`%s:%v`, hasuraConfig.Image, hasuraConfig.Version),
			Env:   containerVariables,
			ExposedPorts: nat.PortSet{
				nat.Port(strconv.Itoa(hasuraConfig.Port)): struct{}{},
			},

			// running following commands on launch were throwing errors,
			// server is running and responding absolutely fine without these commands
			//Cmd:          []string{"graphql-engine", "serve"},
		},

		"host_config": &container.HostConfig{
			AutoRemove: true,
			//Links: links,
			// Binds: []string{nhost.METADATA_DIR, nhost.MIGRATIONS_DIR},
			PortBindings: map[nat.Port][]nat.PortBinding{
				nat.Port(strconv.Itoa(hasuraConfig.Port)): {{HostIP: "127.0.0.1",
					HostPort: strconv.Itoa(hasuraConfig.Port)}},
			},
			Mounts: mountPoints,
		},
	}

	// create mount points if they doesn't exit
	mountPoints = []mount.Mount{
		{
			Type:   mount.TypeBind,
			Source: path.Join(cwd, "minio", "data"),
			Target: "/data",
		},
		{
			Type:   mount.TypeBind,
			Source: path.Join(cwd, "minio", "config"),
			Target: "/.minio",
		},
	}

	for _, mountPoint := range mountPoints {
		if err := os.MkdirAll(mountPoint.Source, os.ModePerm); err != nil {
			return containers, err
		}
	}

	minioContainer := map[string]interface{}{
		"name": getContainerName("minio"),
		"config": &container.Config{
			Healthcheck: &container.HealthConfig{
				Test: []string{
					"CMD-SHELL",
					"curl",
					fmt.Sprintf("http://127.0.0.1:%v/minio/health/live", minioConfig.Port),
				},
				Interval:    1000000000,
				Timeout:     10000000000,
				Retries:     10,
				StartPeriod: 60000000000,
			},
			Image: fmt.Sprintf(`minio/minio:%v`, minioConfig.Version),
			//User:  "999:1001",
			Env: []string{
				"MINIO_ROOT_USER=minioaccesskey123123",
				"MINIO_ROOT_PASSWORD=minioaccesskey123123",
			},
			ExposedPorts: nat.PortSet{nat.Port(strconv.Itoa(minioConfig.Port)): struct{}{}},
			Entrypoint:   []string{"sh"},
			Cmd: []string{
				"-c",
				fmt.Sprintf(`mkdir -p /data/nhost && /usr/bin/minio server --address :%v /data`, minioConfig.Port),
			},
		},

		"host_config": &container.HostConfig{
			AutoRemove: true,
			PortBindings: map[nat.Port][]nat.PortBinding{
				nat.Port(strconv.Itoa(minioConfig.Port)): {{HostIP: "127.0.0.1",
					HostPort: strconv.Itoa(minioConfig.Port)}}},
			/*
				RestartPolicy: container.RestartPolicy{
					Name: "always",
				},
			*/
			Mounts: mountPoints,
		},
	}

	// prepare env variables for following container
	containerVariables = []string{
		fmt.Sprintf("PORT=%v", hbpConfig.Port),
		"USER_FIELDS=''",
		"USER_REGISTRATION_AUTO_ACTIVE=true",
		`PGOPTIONS=-c search_path=auth`,
		fmt.Sprintf("DATABASE_URL=%v", fmt.Sprintf(`postgres://%v:%v@%s:%v/postgres`, postgresConfig.User, postgresConfig.Password, getContainerName("postgres"), postgresConfig.Port)),
		fmt.Sprintf("HASURA_GRAPHQL_ENDPOINT=%v", fmt.Sprintf(`http://%s:%v/v1/graphql`, getContainerName("hasura"), hasuraConfig.Port)),
		fmt.Sprintf("HASURA_ENDPOINT=%v", fmt.Sprintf(`http://%s:%v/v1/graphql`, getContainerName("hasura"), hasuraConfig.Port)),
		fmt.Sprintf("HASURA_GRAPHQL_ADMIN_SECRET=%v", hasuraConfig.AdminSecret),
		"AUTH_ACTIVE=true",
		"AUTH_LOCAL_ACTIVE=true",
		"REFRESH_TOKEN_EXPIRES=43200",
		fmt.Sprintf("S3_ENDPOINT=%v", fmt.Sprintf(`%s:%v`, getContainerName("minio"), minioConfig.Port)),
		"S3_SSL_ENABLED=false",
		"S3_BUCKET=nhost",
		"S3_ACCESS_KEY_ID=minioaccesskey123123",
		"S3_SECRET_ACCESS_KEY=miniosecretkey123123",
		"LOST_PASSWORD_ENABLE=true",
		"JWT_ALGORITHM=HS256",
		"JWT_TOKEN_EXPIRES=15",
		fmt.Sprintf("PROVIDER_SUCCESS_REDIRECT=%v", options.Authentication.Endpoints.Success),
		fmt.Sprintf("PROVIDER_FAILURE_REDIRECT=%v", options.Authentication.Endpoints.Failure),
	}
	containerVariables = append(containerVariables, envVars...)

	containerVariables = append(containerVariables,
		fmt.Sprintf("JWT_KEY=%v", options.Environment["graphql_jwt_key"]),
	)

	// prepare social auth credentials for hasura backend plus container
	var credentials []string
	for provider, data := range options.Authentication.Providers {
		for key, value := range data.(map[interface{}]interface{}) {
			if value != "" {
				credentials = append(credentials, fmt.Sprintf("%v_%v=%v", strings.ToUpper(provider), strings.ToUpper(fmt.Sprint(key)), value))
			}
		}
	}

	containerVariables = append(containerVariables, credentials...)

	// create mount point if it doesn't exit
	customMountPoint := path.Join(cwd, "custom", "keys")
	if err = os.MkdirAll(customMountPoint, os.ModePerm); err != nil {
		log.Errorf("Failed to create %s directory", customMountPoint)
		return containers, err
	}

	hasuraBackendPlusContainer := map[string]interface{}{
		"name": getContainerName("hbp"),
		"config": &container.Config{
			Healthcheck: &container.HealthConfig{
				Test: []string{
					"CMD-SHELL",
					"curl",
					fmt.Sprintf("http://127.0.0.1:%v/healthz", hbpConfig.Port),
				},
				Interval:    1000000000,
				Timeout:     10000000000,
				Retries:     10,
				StartPeriod: 60000000000,
			},
			Image:        fmt.Sprintf(`nhost/hasura-backend-plus:%v`, hbpConfig.Version),
			Env:          containerVariables,
			ExposedPorts: nat.PortSet{nat.Port(strconv.Itoa(hbpConfig.Port)): struct{}{}},

			// running following commands on launch were throwing errors,
			// server is running and responding absolutely fine without these commands
			//Cmd:          []string{"graphql-engine", "serve"},
		},
		"host_config": &container.HostConfig{
			AutoRemove: true,
			//Links: []string{"nhost_hasura:nhost_hasura", "nhost_minio:nhost-minio", "nhost_postgres:nhost-postgres"},
			PortBindings: map[nat.Port][]nat.PortBinding{
				nat.Port(strconv.Itoa(hbpConfig.Port)): {{HostIP: "127.0.0.1",
					HostPort: strconv.Itoa(hbpConfig.Port)}}},
			/*
						RestartPolicy: container.RestartPolicy{
					Name: "always",
				},
			*/
			Mounts: []mount.Mount{
				{
					Type:   mount.TypeBind,
					Source: path.Join(cwd, "custom"),
					Target: "/app/custom",
				},
			},
		},
	}

	containers = append(containers, postgresContainer)
	containers = append(containers, minioContainer)

	// add depends_on for following containers
	containers = append(containers, hasuraBackendPlusContainer)
	containers = append(containers, hasuraContainer)

	// if API directory is generated,
	// generate it's container configuration too
	if startAPI {
		log.WithField("container", getContainerName("api")).Warn("Starting the API container will take a little extra time. Hang on!")
		APIContainer, err := getAPIContainerConfig(apiConfig, hbpConfig, hasuraConfig, envVars, options.Environment["graphql_jwt_key"].(string))
		if err != nil {
			log.Errorf("Failed to create %s conatiner", "API")
			return containers, err
		}
		containers = append(containers, APIContainer)
	}

	return containers, err
}

func getAPIContainerConfig(
	apiConfig nhost.Service,
	hbpConfig nhost.Service,
	hasuraConfig nhost.Service,
	envVars []string,
	graphql_jwt_key string,
) (map[string]interface{}, error) {

	// prepare env variables for following container
	containerVariables := []string{
		fmt.Sprintf("PORT=%v", apiConfig.Port),
		fmt.Sprintf("NHOST_HASURA_URL=%v", fmt.Sprintf(`http://%s:%v/v1/graphql`, getContainerName("hasura"), hasuraConfig.Port)),
		fmt.Sprintf("NHOST_HASURA_ADMIN_SECRET=%v", hasuraConfig.AdminSecret),
		"NHOST_WEBHOOK_SECRET=devnhostwebhooksecret",
		fmt.Sprintf("NHOST_HBP_URL=%v", fmt.Sprintf(`http://%s:%v`, getContainerName("hbp"), hbpConfig.Port)),
		fmt.Sprintf("NHOST_CUSTOM_API_URL=%v", fmt.Sprintf(`http://localhost:%v`, apiConfig.Port)),
		"NHOST_JWT_ALGORITHM=HS256",
		fmt.Sprintf("NHOST_JWT_KEY=%v", graphql_jwt_key),
	}
	containerVariables = append(containerVariables, envVars...)

	APIContainer := map[string]interface{}{
		"name": getContainerName("api"),
		"config": &container.Config{
			WorkingDir: "/usr/src/app",
			Healthcheck: &container.HealthConfig{
				Test: []string{
					"CMD-SHELL",
					"curl",
					fmt.Sprintf("http://127.0.0.1:%v/healthz", apiConfig.Port),
				},
				Interval:    1000000000,
				Timeout:     10000000000,
				Retries:     10,
				StartPeriod: 60000000000,
			},
			Env:          containerVariables,
			ExposedPorts: nat.PortSet{nat.Port(strconv.Itoa(apiConfig.Port)): struct{}{}},
			Image:        "nhost_api",
			Cmd:          []string{"sh", "-c", "./install.sh && ./entrypoint-dev.sh"},
		},
		"host_config": &container.HostConfig{
			AutoRemove: true,
			PortBindings: map[nat.Port][]nat.PortBinding{
				nat.Port(strconv.Itoa(apiConfig.Port)): {{HostIP: "127.0.0.1",
					HostPort: strconv.Itoa(apiConfig.Port)}}},
			/*
				RestartPolicy: container.RestartPolicy{
					Name: "always",
				},
			*/
			Mounts: []mount.Mount{
				{
					Type:   mount.TypeBind,
					Source: nhost.API_DIR,
					Target: "/usr/src/app/api",
				},
			},
		},
	}
	return APIContainer, nil
}

func getInstalledImages(cli *client.Client, ctx context.Context) ([]types.ImageSummary, error) {
	log.Debug("Fetching available container images")
	images, err := cli.ImageList(ctx, types.ImageListOptions{All: true})
	return images, err
}

func pullImage(cli *client.Client, tag string) error {

	log.WithField("component", tag).Info("Pulling container image")
	/*
		out, err := cli.ImagePull(context.Background(), tag, types.ImagePullOptions{})
		out.Close()
	*/

	dockerCLI, _ := exec.LookPath("docker")
	return exec.Command(dockerCLI, "image", "pull", tag).Run()
}

func getContainerName(name string) string {
	return strings.Join([]string{nhost.PROJECT, name}, "_")
}

func init() {
	rootCmd.AddCommand(devCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	// devCmd.PersistentFlags().String("foo", "", "A help for foo")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	//devCmd.Flags().BoolVarP(&background, "background", "b", false, "Run dev services in background")
}
