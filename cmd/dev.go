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
	"bufio"
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
	"path/filepath"
	"strconv"
	"strings"
	"syscall"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/client"
	"github.com/docker/go-connections/nat"
	"github.com/fsnotify/fsnotify"
	"github.com/spf13/cobra"
	"gopkg.in/yaml.v2"
)

// store Hasura console session command,
// to kill it later while shutting down dev environment
var hasuraConsoleSpawnProcess *os.Process

// devCmd represents the dev command
var devCmd = &cobra.Command{
	Use:   "dev",
	Short: "Start local development environment",
	Long:  `Initialize a local Nhost environment for development and testing.`,
	Run: func(cmd *cobra.Command, args []string) {

		// complex, _ := time.ParseDuration("1h10m10s")
		// func (cli *Client) ContainerRestart(ctx context.Context, containerID string, timeout *time.Duration) error

		// add cleanup action in case of signal interruption
		c := make(chan os.Signal)
		signal.Notify(c, os.Interrupt, syscall.SIGTERM)
		go func() {
			<-c
			log.Error("Interrupted by signal")
			hasuraConsoleSpawnProcess.Kill()
			downCmd.Run(cmd, []string{"exit"})
			os.Exit(1)
		}()

		log.Info("Initializing dev environment")

		// check if /nhost exists
		if !pathExists(nhostDir) {
			log.Error("Initialize a project by running 'nhost' or 'nhost init'")
			log.Fatal("Project not found in this directory")
		}

		// create /.nhost if it doesn't exist
		if err := os.MkdirAll(dotNhost, os.ModePerm); err != nil {
			log.Debug(err)
			log.Fatal("Failed to initialize nhost specific directory")
		}

		// connect to docker client
		ctx := context.Background()
		docker, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to connect to docker client")
		}
		defer docker.Close()

		// check if this is the first time dev env is running
		firstRun := !pathExists(path.Join(dotNhost, "db_data"))
		if firstRun {
			log.Warn("First run takes longer, please be patient")
		}

		/*
			// if it doesn't exist, then create it
			if err = os.MkdirAll(path.Join(dotNhost, "db_data"), os.ModePerm); err != nil {
				log.Debug(err)
				log.Fatal("Failed to create db_data directory")
			}
		*/

		// shut down any existing Nhost containers
		downCmd.Run(cmd, args)

		nhostConfig, err := readYaml(path.Join(nhostDir, "config.yaml"))
		if err != nil {
			log.Debug(err)
			log.Error("Failed to read Nhost config")
			downCmd.Run(cmd, []string{"exit"})
		}

		ports := []string{
			fmt.Sprint(nhostConfig["services"].(map[interface{}]interface{})["hasura"].(map[interface{}]interface{})["port"]),
			fmt.Sprint(nhostConfig["services"].(map[interface{}]interface{})["hasura"].(map[interface{}]interface{})["console_port"]),
			fmt.Sprint(nhostConfig["services"].(map[interface{}]interface{})["hasura_backend_plus"].(map[interface{}]interface{})["port"]),
			fmt.Sprint(nhostConfig["services"].(map[interface{}]interface{})["minio"].(map[interface{}]interface{})["port"]),
			fmt.Sprint(nhostConfig["services"].(map[interface{}]interface{})["postgres"].(map[interface{}]interface{})["port"]),
			fmt.Sprint(nhostConfig["services"].(map[interface{}]interface{})["api"].(map[interface{}]interface{})["port"]),
		}

		freePorts := getFreePorts(ports)

		var occupiedPorts []string
		for _, port := range ports {
			if !contains(freePorts, port) {
				occupiedPorts = append(occupiedPorts, port)
			}
		}

		if len(occupiedPorts) > 0 {
			log.Errorf("Ports %v are already in use, hence aborting", occupiedPorts)
			log.Fatal("Change nhost/config.yaml or stop the services")
		}

		nhostConfig["startAPI"] = pathExists(path.Join(workingDir, "api"))

		if nhostConfig["graphql_jwt_key"] == "" || nhostConfig["graphql_jwt_key"] == nil {
			nhostConfig["graphql_jwt_key"] = generateRandomKey()
		}

		/*
			if nhostConfig["startAPI"].(bool) {

				// write docker api file
				_, err = os.Create(path.Join(dotNhost, "Dockerfile-api"))
				if err != nil {
					log.Debug(err)
					log.Error("Failed to create docker api config")
					downCmd.Run(cmd, []string{"exit"})
				}

				err = writeToFile(path.Join(dotNhost, "Dockerfile-api"), getDockerApiTemplate(), "start")
				if err != nil {
					log.Debug(err)
					log.Error("Failed to write backend docker-compose config")
					downCmd.Run(cmd, []string{"exit"})
				}
			}
		*/

		// generate Nhost service containers' configurations
		nhostServices, err := getContainerConfigs(docker, nhostConfig, dotNhost)
		if err != nil {
			log.Debug(err)
			log.Error("Failed to generate container configurations")
			downCmd.Run(cmd, args)
		}

		// create the Nhost network if it doesn't exist
		network, _ := createNetwork(docker, "nhost")

		// create and start the conatiners
		for _, item := range nhostServices {
			if err = runContainer(docker, ctx, item["config"].(*container.Config), item["host_config"].(*container.HostConfig), item["name"].(string), network); err != nil {
				log.Debug(err)
				log.WithField("component", item["name"]).Error("Failed to start container")
				downCmd.Run(cmd, []string{"exit"})
			}
			log.WithField("component", item["name"]).Debug("Container created")
		}

		// log.Info("Conducting a quick health check on all freshly created services")
		// healthCmd.Run(cmd, args)

		// wait for graphQL engine to become healthy
		if ok := checkServiceHealth("hasura", fmt.Sprintf("http://127.0.0.1:%v/healthz", nhostConfig["services"].(map[interface{}]interface{})["hasura"].(map[interface{}]interface{})["port"])); !ok {
			log.WithField("component", "hasura").Error("GraphQL engine health check failed")
			downCmd.Run(cmd, []string{"exit"})
		}

		// prepare and load hasura binary
		hasuraCLI, _ := fetchBinary("hasura", fmt.Sprint(nhostConfig["environment"].(map[interface{}]interface{})["hasura_cli_version"]))

		//hasuraCLI := path.Join("assets", "hasura")

		commandOptions := []string{
			"--endpoint",
			fmt.Sprintf(`http://localhost:%v`, nhostConfig["services"].(map[interface{}]interface{})["hasura"].(map[interface{}]interface{})["port"]),
			"--admin-secret",
			fmt.Sprint(nhostConfig["services"].(map[interface{}]interface{})["hasura"].(map[interface{}]interface{})["admin_secret"]),
			"--skip-update-check",
		}

		// create migrations
		cmdArgs := []string{hasuraCLI, "migrate", "apply"}
		cmdArgs = append(cmdArgs, commandOptions...)

		execute := exec.Cmd{
			Path: hasuraCLI,
			Args: cmdArgs,
			Dir:  nhostDir,
		}

		output, err := execute.CombinedOutput()
		if err != nil {
			log.Debug(err)
			log.Debug(string(output))
			log.Error("Failed to apply fresh hasura migrations")
			downCmd.Run(cmd, []string{"exit"})
		}

		files, err := ioutil.ReadDir(path.Join(nhostDir, "seeds"))
		if err != nil {
			log.Debug(err)
			log.Debug(string(output))
			log.Error("Failed to read migrations directory")
			downCmd.Run(cmd, []string{"exit"})
		}

		if firstRun && len(files) > 0 {

			log.Debug("Applying seeds since it's your first run")

			// apply seed data
			cmdArgs = []string{hasuraCLI, "seeds", "apply"}
			cmdArgs = append(cmdArgs, commandOptions...)

			execute = exec.Cmd{
				Path: hasuraCLI,
				Args: cmdArgs,
				Dir:  nhostDir,
			}

			output, err = execute.CombinedOutput()
			if err != nil {
				log.Debug(err)
				log.Debug(string(output))
				log.Error("Failed to apply seed data")
				downCmd.Run(cmd, []string{"exit"})
			}
		}

		// export metadata
		cmdArgs = []string{hasuraCLI, "metadata", "export"}
		cmdArgs = append(cmdArgs, commandOptions...)

		execute = exec.Cmd{
			Path: hasuraCLI,
			Args: cmdArgs,
			Dir:  nhostDir,
		}

		output, err = execute.CombinedOutput()
		if err != nil {
			log.Debug(string(output))
			log.Debug(err)
			log.Error("Failed to apply fresh metadata")
			downCmd.Run(cmd, []string{"exit"})
		}

		// apply metadata
		cmdArgs = []string{hasuraCLI, "metadata", "apply"}
		cmdArgs = append(cmdArgs, commandOptions...)

		execute = exec.Cmd{
			Path: hasuraCLI,
			Args: cmdArgs,
			Dir:  nhostDir,
		}

		output, err = execute.CombinedOutput()
		if err != nil {
			log.Debug(string(output))
			log.Debug(err)
			log.Error("Failed to apply fresh metadata")
			downCmd.Run(cmd, []string{"exit"})
		}

		log.Info("Local Nhost development environment is now active")
		fmt.Println()

		log.Infof("GraphQL API: http://localhost:%v/v1/graphql", nhostConfig["services"].(map[interface{}]interface{})["hasura"].(map[interface{}]interface{})["port"])
		log.Infof("Auth & Storage: http://localhost:%v", nhostConfig["services"].(map[interface{}]interface{})["hasura_backend_plus"].(map[interface{}]interface{})["port"])
		fmt.Println()

		log.WithField("component", "background").Infof("Minio Storage: http://localhost:%v", nhostConfig["services"].(map[interface{}]interface{})["minio"].(map[interface{}]interface{})["port"])
		log.WithField("component", "background").Infof("Postgres: http://localhost:%v", nhostConfig["services"].(map[interface{}]interface{})["postgres"].(map[interface{}]interface{})["port"])
		fmt.Println()

		if nhostConfig["startAPI"].(bool) {
			log.Infof("Custom API: http://localhost:%v", nhostConfig["services"].(map[interface{}]interface{})["api"].(map[interface{}]interface{})["port"])
		}

		log.Infof("Launching Hasura console http://localhost:%v", nhostConfig["services"].(map[interface{}]interface{})["hasura"].(map[interface{}]interface{})["console_port"])
		fmt.Println()

		log.Warn("Use Ctrl + C to stop running evironment")

		//spawn hasura console
		hasuraConsoleSpawnCmd := exec.Cmd{
			Path: hasuraCLI,
			Args: []string{hasuraCLI,
				"console",
				"--endpoint",
				fmt.Sprintf(`http://localhost:%v`, nhostConfig["services"].(map[interface{}]interface{})["hasura"].(map[interface{}]interface{})["port"]),
				"--admin-secret",
				fmt.Sprint(nhostConfig["services"].(map[interface{}]interface{})["hasura"].(map[interface{}]interface{})["admin_secret"]),
				"--console-port",
				fmt.Sprint(nhostConfig["services"].(map[interface{}]interface{})["hasura"].(map[interface{}]interface{})["console_port"]),
			},
			Dir: nhostDir,
		}

		if err = hasuraConsoleSpawnCmd.Run(); err != nil {
			log.Error("Failed to launch hasura console")
		}

		hasuraConsoleSpawnProcess = hasuraConsoleSpawnCmd.Process

		// attach a watcher to the API conatiner's package.json
		// to provide live reload functionality

		if nhostConfig["startAPI"].(bool) {

			watcher, err := fsnotify.NewWatcher()
			if err != nil {
				log.Debug(err)
				log.WithField("component", "watcher").Error("Failed to initialize live reload watcher")
			}
			defer watcher.Close()

			done := make(chan bool)
			go func() {
				for {
					select {
					case event, ok := <-watcher.Events:
						if !ok {
							log.Error("Watcher not okay")
							return
						}
						log.Infoln("event:", event)
						if event.Op&fsnotify.Write == fsnotify.Write {
							log.Infoln("modified file: ", event.Name)

							APIContainerName := "nhost_api"

							// fetch list of all running containers
							containers, err := getContainers(docker, ctx, APIContainerName)
							if err != nil {
								log.WithField("component", APIContainerName).Debug(err)
								log.WithField("component", APIContainerName).Error("Failed to fetch container")
							}

							if err = restartContainer(docker, ctx, containers[0]); err != nil {
								log.WithField("component", APIContainerName).Debug(err)
								log.WithField("component", APIContainerName).Error("Failed to restart container")
							}
						}
					case err, ok := <-watcher.Errors:
						if !ok {
							return
						}
						log.Error(err)
					}
				}
			}()

			err = watcher.Add(path.Join(workingDir, "api", "package.json"))
			if err != nil {
				log.Debug(err)
				log.WithField("component", "package.json").Error("Failed to add to live reload watcher")
			}
			<-done
		}

		// wait for user input infinitely to keep the utility running
		var input []byte
		reader := bufio.NewReader(os.Stdin)
		// disables input buffering
		for {
			b, err := reader.ReadByte()
			if err != nil {
				log.Error(err)
			}
			_ = append(input, b)
		}
		//scanner.Scan()
	},
}

func createNetwork(client *client.Client, name string) (string, error) {

	// https://godoc.org/github.com/docker/docker/api/types/network#NetworkingConfig

	response, err := client.NetworkCreate(context.Background(), name, types.NetworkCreate{})
	if err != nil {
		return "", err
	}

	return response.ID, nil
}

// start a fresh container in background
func runContainer(client *client.Client, ctx context.Context, containerConfig *container.Config, hostConfig *container.HostConfig, name, network string) error {

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

	// attach the container to the network
	err = client.NetworkConnect(ctx, network, container.ID, nil)

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
	return err
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

// read YAML files
func readYaml(path string) (map[string]interface{}, error) {

	f, err := ioutil.ReadFile(path)

	var data map[string]interface{}
	yaml.Unmarshal(f, &data)

	return data, err
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

/*
func getDockerApiTemplate() string {
	return `
FROM nhost/nodeapi:latest
WORKDIR /usr/src/app
COPY api ./api
RUN ./install.sh
ENTRYPOINT ["./entrypoint-dev.sh"]
`
}
*/
func getContainerConfigs(client *client.Client, options map[string]interface{}, cwd string) ([]map[string]interface{}, error) {

	log.Debug("Preparing Nhost container configurations")

	var containers []map[string]interface{}

	// segregate configurations for different services

	postgresConfig := options["services"].(map[interface{}]interface{})["postgres"].(map[interface{}]interface{})
	hasuraConfig := options["services"].(map[interface{}]interface{})["hasura"].(map[interface{}]interface{})
	hbpConfig := options["services"].(map[interface{}]interface{})["hasura_backend_plus"].(map[interface{}]interface{})
	minioConfig := options["services"].(map[interface{}]interface{})["minio"].(map[interface{}]interface{})
	apiConfig := options["services"].(map[interface{}]interface{})["api"].(map[interface{}]interface{})

	envConfig := options["environment"].(map[interface{}]interface{})

	authenticationEndpoints := options["authentication"].(map[interface{}]interface{})["endpoints"].(map[interface{}]interface{})
	authenticationProviders := options["authentication"].(map[interface{}]interface{})["providers"].(map[interface{}]interface{})

	// check if a required image already exists
	// if it doesn't which case -> then pull it

	requiredImages := []string{
		fmt.Sprintf("postgres:%v", postgresConfig["version"]),
		fmt.Sprintf("%s:%v", hasuraConfig["image"], hasuraConfig["version"]),
		fmt.Sprintf("nhost/hasura-backend-plus:%v", hbpConfig["version"]),
		fmt.Sprintf("minio/minio:%v", minioConfig["version"]),
	}

	// if API container is going to be launched,
	// validate it's image too
	if options["startAPI"].(bool) {
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
			if err = pullImage(requiredImage); err != nil {
				log.Errorf("Failed to pull image %s\nplease pull it manually and re-run `nhost dev`", requiredImage)
			}
		}
	}

	// read env_file
	envFile, err := ioutil.ReadFile(envConfig["env_file"].(string))
	if err != nil {
		log.Warnf("Failed to read %v file", path.Base(envConfig["env_file"].(string)))
		return containers, err
	}

	envData := strings.Split(string(envFile), "\n")
	var envVars []string

	for _, row := range envData {
		if strings.Contains(row, "=") {
			envVars = append(envVars, row)
		}
	}

	mounts := []mount.Mount{}

	// if db_data already exists, then mount it
	if pathExists(path.Join(cwd, "db_data")) {
		mounts = append(mounts, mount.Mount{
			Type:   mount.TypeBind,
			Source: path.Join(cwd, "db_data"),
			Target: "/var/lib/postgresql/data",
		})
	}

	postgresContainer := map[string]interface{}{
		"name": "nhost_postgres",
		"config": &container.Config{
			Healthcheck: &container.HealthConfig{
				Test: []string{
					"CMD-SHELL",
					"pg_isready",
					"-h",
					"localhost",
					"-p",
					fmt.Sprint(postgresConfig["port"]),
					"-U",
					fmt.Sprint(postgresConfig["user"]),
				},
				Interval:    1000000000,
				Timeout:     10000000000,
				Retries:     10,
				StartPeriod: 60000000000,
			},
			//Image: fmt.Sprintf(`postgres:%v`, postgresConfig["version"]),
			Image: "nhost_postgres",
			Env: []string{
				fmt.Sprintf("POSTGRES_USER=%v", postgresConfig["user"]),
				fmt.Sprintf("POSTGRES_PASSWORD=%v", postgresConfig["password"]),
			},
			ExposedPorts: nat.PortSet{nat.Port(fmt.Sprintf("%v", postgresConfig["port"])): struct{}{}},
			Cmd: []string{
				"-p",
				fmt.Sprint(postgresConfig["port"]),
			},
		},
		"host_config": &container.HostConfig{
			// AutoRemove:   true,
			PortBindings: map[nat.Port][]nat.PortBinding{nat.Port(fmt.Sprintf("%v", postgresConfig["port"])): {{HostIP: "127.0.0.1", HostPort: fmt.Sprintf("%v", postgresConfig["port"])}}},
			RestartPolicy: container.RestartPolicy{
				Name: "always",
			},
			Mounts: mounts,
		},
	}

	// prepare env variables for following container
	containerVariables := []string{
		fmt.Sprintf("HASURA_GRAPHQL_SERVER_PORT=%v", hasuraConfig["port"]),
		fmt.Sprintf("HASURA_GRAPHQL_DATABASE_URL=%v", fmt.Sprintf(`postgres://%v:%v@nhost_postgres:%v/postgres`, postgresConfig["user"], postgresConfig["password"], postgresConfig["port"])),
		"HASURA_GRAPHQL_ENABLE_CONSOLE=false",
		"HASURA_GRAPHQL_ENABLED_LOG_TYPES=startup, http-log, webhook-log, websocket-log, query-log",
		fmt.Sprintf("HASURA_GRAPHQL_ADMIN_SECRET=%v", hasuraConfig["admin_secret"]),
		fmt.Sprintf("HASURA_GRAPHQL_MIGRATIONS_SERVER_TIMEOUT=%d", 20),
		fmt.Sprintf("HASURA_GRAPHQL_NO_OF_RETRIES=%d", 20),
		"HASURA_GRAPHQL_UNAUTHORIZED_ROLE=public",
		fmt.Sprintf("NHOST_HASURA_URL=%v", fmt.Sprintf(`http://nhost_hasura:%v/v1/graphql`, hasuraConfig["port"])),
		"NHOST_WEBHOOK_SECRET=devnhostwebhooksecret",
		fmt.Sprintf("NHOST_HBP_URL=%v", fmt.Sprintf(`http://nhost_hbp:%v`, hbpConfig["port"])),
		fmt.Sprintf("NHOST_CUSTOM_API_URL=%v", fmt.Sprintf(`http://nhost_api:%v`, apiConfig["port"])),
	}
	containerVariables = append(containerVariables, envVars...)

	containerVariables = append(containerVariables,
		fmt.Sprintf("HASURA_GRAPHQL_JWT_SECRET=%v", fmt.Sprintf(`{"type":"HS256", "key": "%v"}`, options["graphql_jwt_key"])))

	// if API container has to be loaded,
	// expose it to the links as well

	/*
		links := []string{"nhost_postgres:nhost-postgres"}
			if options["startAPI"].(bool) {
				links = append(links, "nhost_api:nhost-api")
			}
	*/

	hasuraContainer := map[string]interface{}{
		"name": "nhost_hasura",
		"config": &container.Config{
			Healthcheck: &container.HealthConfig{
				Test: []string{
					"CMD-SHELL",
					"curl",
					fmt.Sprintf("http://127.0.0.1:%v/healthz", hasuraConfig["port"]),
				},
				Interval:    1000000000,
				Timeout:     10000000000,
				Retries:     10,
				StartPeriod: 60000000000,
			},
			Image: fmt.Sprintf(`%s:%v`, hasuraConfig["image"], hasuraConfig["version"]),
			Env:   containerVariables,
			ExposedPorts: nat.PortSet{
				nat.Port(strconv.Itoa(hasuraConfig["port"].(int))): struct{}{},
			},

			// running following commands on launch were throwing errors,
			// server is running and responding absolutely fine without these commands
			//Cmd:          []string{"graphql-engine", "serve"},
		},

		"host_config": &container.HostConfig{
			// AutoRemove: true,
			//Links: links,
			PortBindings: map[nat.Port][]nat.PortBinding{
				nat.Port(strconv.Itoa(hasuraConfig["port"].(int))): {{HostIP: "127.0.0.1",
					HostPort: strconv.Itoa(hasuraConfig["port"].(int))}},
			},
			Mounts: mounts,
		},
	}

	// create mount points if they doesn't exit
	mountPoints := []mount.Mount{
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
		"name": "nhost_minio",
		"config": &container.Config{
			Healthcheck: &container.HealthConfig{
				Test: []string{
					"CMD-SHELL",
					"curl",
					fmt.Sprintf("http://127.0.0.1:%v/minio/health/live", minioConfig["port"]),
				},
				Interval:    1000000000,
				Timeout:     10000000000,
				Retries:     10,
				StartPeriod: 60000000000,
			},
			Image: fmt.Sprintf(`minio/minio:%v`, minioConfig["version"]),
			//User:  "999:1001",
			Env: []string{
				"MINIO_ACCESS_KEY=minioaccesskey123123",
				"MINIO_SECRET_KEY=minioaccesskey123123",
				//"MINIO_ROOT_USER=AKIAIOSFODNN7EXAMPLE",
				//"MINIO_ROOT_PASSWORD=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
			},
			ExposedPorts: nat.PortSet{nat.Port(strconv.Itoa(minioConfig["port"].(int))): struct{}{}},
			Entrypoint:   []string{"sh"},
			Cmd: []string{
				"-c",
				fmt.Sprintf(`mkdir -p /data/nhost && /usr/bin/minio server --address :%v /data`, minioConfig["port"]),
			},
		},

		"host_config": &container.HostConfig{
			// AutoRemove: true,
			PortBindings: map[nat.Port][]nat.PortBinding{
				nat.Port(strconv.Itoa(minioConfig["port"].(int))): {{HostIP: "127.0.0.1",
					HostPort: strconv.Itoa(minioConfig["port"].(int))}}},
			RestartPolicy: container.RestartPolicy{
				Name: "always",
			},
			Mounts: mountPoints,
		},
	}

	// prepare env variables for following container
	containerVariables = []string{
		fmt.Sprintf("PORT=%v", hbpConfig["port"]),
		"USER_FIELDS=''",
		"USER_REGISTRATION_AUTO_ACTIVE=true",
		"PG_OPTIONS='-c search_path=auth'",
		fmt.Sprintf("DATABASE_URL=%v", fmt.Sprintf(`postgres://%v:%v@nhost_postgres:%v/postgres`, postgresConfig["user"], postgresConfig["password"], postgresConfig["port"])),
		fmt.Sprintf("HASURA_GRAPHQL_ENDPOINT=%v", fmt.Sprintf(`http://nhost_hasura:%v/v1/graphql`, hasuraConfig["port"])),
		fmt.Sprintf("HASURA_ENDPOINT=%v", fmt.Sprintf(`http://nhost_hasura:%v/v1/graphql`, hasuraConfig["port"])),
		fmt.Sprintf("HASURA_GRAPHQL_ADMIN_SECRET=%v", hasuraConfig["admin_secret"]),
		"AUTH_ACTIVE=true",
		"AUTH_LOCAL_ACTIVE=true",
		"REFRESH_TOKEN_EXPIRES=43200",
		fmt.Sprintf("S3_ENDPOINT=%v", fmt.Sprintf(`nhost-minio:%v`, minioConfig["port"])),
		"S3_SSL_ENABLED=false",
		"S3_BUCKET=nhost",
		"S3_ACCESS_KEY_ID=minioaccesskey123123",
		"S3_SECRET_ACCESS_KEY=miniosecretkey123123",
		"LOST_PASSWORD_ENABLE=true",
		"JWT_ALGORITHM=HS256",
		"JWT_TOKEN_EXPIRES=15",
		fmt.Sprintf("PROVIDER_SUCCESS_REDIRECT=%v", authenticationEndpoints["provider_success_redirect"]),
		fmt.Sprintf("PROVIDER_FAILURE_REDIRECT=%v", authenticationEndpoints["provider_failure_redirect"]),
	}
	containerVariables = append(containerVariables, envVars...)

	containerVariables = append(containerVariables,
		fmt.Sprintf("JWT_KEY=%v", options["graphql_jwt_key"]),
	)

	// prepare social auth credentials for hasura backend plus container
	socialAuthPlatforms := []string{"GOOGLE", "FACEBOOK", "GITHUB", "LINKEDIN"}

	var credentials []string
	for _, value := range socialAuthPlatforms {
		dominations := []string{"ENABLE", "CLIENT_ID", "CLIENT_SECRET"}
		for _, variable := range dominations {
			credentials = append(credentials, fmt.Sprintf("%s_%s", value, variable))
		}
	}

	for _, credential := range credentials {
		if authenticationProviders[strings.ToLower(credential)] != nil {
			containerVariables = append(containerVariables, fmt.Sprintf("%s=%v", credential, authenticationProviders[strings.ToLower(credential)]))
		}
	}

	// create mount point if it doesn't exit
	customMountPoint := path.Join(cwd, "custom", "keys")
	if err = os.MkdirAll(customMountPoint, os.ModePerm); err != nil {
		log.Errorf("Failed to create %s directory", customMountPoint)
		return containers, err
	}

	hasuraBackendPlusContainer := map[string]interface{}{
		"name": "nhost_hbp",
		"config": &container.Config{
			Healthcheck: &container.HealthConfig{
				Test: []string{
					"CMD-SHELL",
					"curl",
					fmt.Sprintf("http://127.0.0.1:%v/healthz", hbpConfig["port"]),
				},
				Interval:    1000000000,
				Timeout:     10000000000,
				Retries:     10,
				StartPeriod: 60000000000,
			},
			Image:        fmt.Sprintf(`nhost/hasura-backend-plus:%v`, hbpConfig["version"]),
			Env:          containerVariables,
			ExposedPorts: nat.PortSet{nat.Port(strconv.Itoa(hbpConfig["port"].(int))): struct{}{}},

			// running following commands on launch were throwing errors,
			// server is running and responding absolutely fine without these commands
			//Cmd:          []string{"graphql-engine", "serve"},
		},
		"host_config": &container.HostConfig{
			// AutoRemove: true,
			//Links: []string{"nhost_hasura:nhost_hasura", "nhost_minio:nhost-minio", "nhost_postgres:nhost-postgres"},
			PortBindings: map[nat.Port][]nat.PortBinding{
				nat.Port(strconv.Itoa(hbpConfig["port"].(int))): {{HostIP: "127.0.0.1",
					HostPort: strconv.Itoa(hbpConfig["port"].(int))}}},
			RestartPolicy: container.RestartPolicy{
				Name: "always",
			},
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
	containers = append(containers, hasuraContainer)
	containers = append(containers, hasuraBackendPlusContainer)

	// if API directory is generated,
	// generate it's container configuration too
	if options["startAPI"].(bool) {

		APIContainer, err := getAPIContainerConfig(apiConfig, hbpConfig, hasuraConfig, envVars, options["graphql_jwt_key"].(string))
		if err != nil {
			log.Errorf("Failed to create %s conatiner", "API")
			return containers, err
		}
		containers = append(containers, APIContainer)
	}

	return containers, err
}

func getAPIContainerConfig(
	apiConfig map[interface{}]interface{},
	hbpConfig map[interface{}]interface{},
	hasuraConfig map[interface{}]interface{},
	envVars []string,
	graphql_jwt_key string,
) (map[string]interface{}, error) {

	// prepare env variables for following container
	containerVariables := []string{
		fmt.Sprintf("PORT=%v", apiConfig["port"]),
		fmt.Sprintf("NHOST_HASURA_URL=%v", fmt.Sprintf(`http://nhost_hasura:%v/v1/graphql`, hasuraConfig["port"])),
		fmt.Sprintf("NHOST_HASURA_ADMIN_SECRET=%v", hasuraConfig["admin_secret"]),
		"NHOST_WEBHOOK_SECRET=devnhostwebhooksecret",
		fmt.Sprintf("NHOST_HBP_URL=%v", fmt.Sprintf(`http://nhost_hbp:%v`, hbpConfig["port"])),
		fmt.Sprintf("NHOST_CUSTOM_API_URL=%v", fmt.Sprintf(`http://localhost:%v`, apiConfig["port"])),
		"NHOST_JWT_ALGORITHM=HS256",
		fmt.Sprintf("NHOST_JWT_KEY=%v", graphql_jwt_key),
	}
	containerVariables = append(containerVariables, envVars...)

	// change directory and file access permissions
	err := filepath.Walk(path.Join(workingDir, "api"), func(path string, info os.FileInfo, err error) error {
		err = os.Chmod(path, 0777)
		if err != nil {
			log.Error(err)
		}
		return nil
	})
	if err != nil {
		log.Error(err)
	}
	/*
				// create the docker image for API container
				imageName := "nhost_api"
				tarHeader := &tar.Header{
					Name: "Dockerfile-Api",
					Size: int64(len([]byte(getDockerApiTemplate()))),
				}

				buf := new(bytes.Buffer)
				tw := tar.NewWriter(buf)
				defer tw.Close()

				err = tw.WriteHeader(tarHeader)
				if err != nil {
					return containers, err
				}
				_, err = tw.Write([]byte(getDockerApiTemplate()))
				if err != nil {
					return containers, err
				}
				dockerFileTarReader := bytes.NewReader(buf.Bytes())

				_, err := client.ImageBuild(
					context.Background(),
					dockerFileTarReader,
					types.ImageBuildOptions{
						Context:    dockerFileTarReader,
						Dockerfile: "Dockerfile-Api",
						Tags:       []string{imageName, "latest"},
						Remove:     true})
				if err != nil {
					log.Errorf("Failed to build docker image %s", imageName)
					return containers, err
				}

				FROM nhost/nodeapi:latest
		WORKDIR /usr/src/app
		COPY api ./api
		RUN ./install.sh
		ENTRYPOINT ["./entrypoint-dev.sh"]
	*/

	APIContainer := map[string]interface{}{
		"name": "nhost_api",
		"config": &container.Config{
			WorkingDir: "/usr/src/app",
			Healthcheck: &container.HealthConfig{
				Test: []string{
					"CMD-SHELL",
					"curl",
					fmt.Sprintf("http://127.0.0.1:%v/healthz", apiConfig["port"]),
				},
				Interval:    1000000000,
				Timeout:     10000000000,
				Retries:     10,
				StartPeriod: 60000000000,
			},
			Env:          containerVariables,
			ExposedPorts: nat.PortSet{nat.Port(strconv.Itoa(apiConfig["port"].(int))): struct{}{}},
			Image:        "nhost/nodeapi:latest",
			Entrypoint:   []string{"sh", "-c", "./entrypoint-dev.sh"},
			Cmd:          []string{"./install.sh"},
		},
		"host_config": &container.HostConfig{
			Binds: []string{path.Join(workingDir, "api")},
			// AutoRemove: true,
			//Links: []string{"nhost_hasura:nhost-hasura", "nhost_hbp:nhost-hbp", "nhost_minio:nhost-minio"},
			PortBindings: map[nat.Port][]nat.PortBinding{
				nat.Port(strconv.Itoa(apiConfig["port"].(int))): {{HostIP: "127.0.0.1",
					HostPort: strconv.Itoa(apiConfig["port"].(int))}}},
			RestartPolicy: container.RestartPolicy{
				Name: "always",
			},
			Mounts: []mount.Mount{
				{
					Type:   mount.TypeBind,
					Source: path.Join(workingDir, "api"),
					Target: "/usr/src/app",
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

func pullImage(tag string) error {

	log.Debugf("Pulling container image: %s", tag)

	/*
		out, err := cli.ImagePull(ctx, tag, types.ImagePullOptions{})
		out.Close()
	*/

	dockerCLI, _ := exec.LookPath("docker")
	err := exec.Command(dockerCLI, "image", "pull", tag).Run()
	return err
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
