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
	"strconv"
	"strings"
	"syscall"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/client"
	"github.com/docker/go-connections/nat"
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

		// if it doesn't exist, then create it
		if err = os.MkdirAll(path.Join(dotNhost, "db_data"), os.ModePerm); err != nil {
			log.Debug(err)
			log.Fatal("Failed to create db_data directory")
		}

		// shut down any existing Nhost containers
		downCmd.Run(cmd, args)

		nhostConfig, err := readYaml(path.Join(nhostDir, "config.yaml"))
		if err != nil {
			log.Debug(err)
			log.Error("Failed to read Nhost config")
			downCmd.Run(cmd, []string{"exit"})
		}

		ports := []string{
			"hasura_graphql_port",
			"hasura_console_port",
			"hasura_backend_plus_port",
			"postgres_port",
			"minio_port",
			"api_port",
		}

		var mappedPorts []string

		for _, port := range ports {
			mappedPorts = append(mappedPorts, fmt.Sprintf("%v", nhostConfig[port]))
		}

		freePorts := getFreePorts(mappedPorts)

		var occupiedPorts []string
		for _, port := range mappedPorts {
			if !contains(freePorts, port) {
				occupiedPorts = append(occupiedPorts, port)
			}
		}

		if len(occupiedPorts) > 0 {
			log.Errorf("Ports %v are already in use, hence aborting", occupiedPorts)
			log.Fatal("Change nhost/config.yaml or stop the services")
		}

		// generate Nhost service containers' configurations
		nhostServices, err := getContainerConfigs(docker, ctx, nhostConfig, dotNhost)
		if err != nil {
			log.Debug(err)
			downCmd.Run(cmd, args)
			log.Fatal("Failed to generate container configurations")
		}

		for _, container := range nhostServices {
			if err = runContainer(docker, ctx, container); err != nil {
				log.Debug(err)
				log.Errorf("Failed to start %v container", container.ID)
				downCmd.Run(cmd, []string{"exit"})
			}
			log.Debugf("Container %s created", container.ID)
		}

		nhostConfig["startAPI"] = pathExists(path.Join(workingDir, "api"))
		nhostConfig["graphql_jwt_key"] = generateRandomKey()

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

		log.Info("Conducting a quick health check on all freshly created services")
		healthCmd.Run(cmd, args)

		// prepare and load hasura binary
		hasuraCLI, _ := fetchBinary("hasura", fmt.Sprintf("%v", nhostConfig["hasura_cli_version"]))

		//hasuraCLI := path.Join("assets", "hasura")

		commandOptions := []string{
			"--endpoint",
			fmt.Sprintf(`http://localhost:%v`, nhostConfig["hasura_graphql_port"]),
			"--admin-secret",
			fmt.Sprintf(`%v`, nhostConfig["hasura_graphql_admin_secret"]),
			"--skip-update-check",
		}

		// create migrations from remote
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

		// create migrations from remote
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

		log.Infof("GraphQL API: http://localhost:%v/v1/graphql", nhostConfig["hasura_graphql_port"])
		log.Infof("Auth & Storage: http://localhost:%v", nhostConfig["hasura_backend_plus_port"])
		fmt.Println()

		log.WithField("component", "background").Infof("Minio Storage: http://localhost:%v", nhostConfig["minio_port"])
		log.WithField("component", "background").Infof("Postgres: http://localhost:%v", nhostConfig["postgres_port"])
		fmt.Println()

		if nhostConfig["startAPI"].(bool) {
			log.Infof("Custom API: http://localhost:%v", nhostConfig["api_port"])
		}

		log.Infof("Launching Hasura console http://localhost:%v", nhostConfig["hasura_console_port"])
		fmt.Println()

		log.Warn("Use Ctrl + C to stop running evironment")

		//spawn hasura console
		hasuraConsoleSpawnCmd := exec.Cmd{
			Path: hasuraCLI,
			Args: []string{hasuraCLI,
				"console",
				"--endpoint",
				fmt.Sprintf(`http://localhost:%v`, nhostConfig["hasura_graphql_port"]),
				"--admin-secret",
				fmt.Sprintf(`%v`, nhostConfig["hasura_graphql_admin_secret"]),
				"--console-port",
				fmt.Sprintf("%v", nhostConfig["hasura_console_port"]),
			},
			Dir: nhostDir,
		}

		if err = hasuraConsoleSpawnCmd.Run(); err != nil {
			log.Error("Failed to launch hasura console")
		}

		hasuraConsoleSpawnProcess = hasuraConsoleSpawnCmd.Process

		// wait for user input infinitely to keep the utility running
		scanner := bufio.NewScanner(os.Stdin)
		scanner.Scan()
	},
}

// start a fresh container in background
func runContainer(client *client.Client, ctx context.Context, cont container.ContainerCreateCreatedBody) error {

	err := client.ContainerStart(ctx, cont.ID, types.ContainerStartOptions{})

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

func getDockerApiTemplate() string {
	return `
FROM nhost/nodeapi:latest
WORKDIR /usr/src/app
COPY api ./api
RUN ./install.sh
ENTRYPOINT ["./entrypoint-dev.sh"]
`
}

func getContainerConfigs(client *client.Client, ctx context.Context, options map[string]interface{}, cwd string) ([]container.ContainerCreateCreatedBody, error) {

	log.Debug("Preparing Nhost container configurations")

	hasuraGraphQLEngine := "hasura/graphql-engine"

	if options["hasura_graphql_engine"] != nil && options["hasura_graphql_engine"] != "" {
		hasuraGraphQLEngine = fmt.Sprintf(`%v`, options["hasura_graphql_engine"])
	}
	var containers []container.ContainerCreateCreatedBody

	// check if a required image already exists
	// if it doesn't which case -> then pull it

	requiredImages := []string{
		fmt.Sprintf("postgres:%v", options["postgres_version"]),
		fmt.Sprintf("%s:%v", hasuraGraphQLEngine, options["hasura_graphql_version"]),
		fmt.Sprintf("nhost/hasura-backend-plus:%v", options["hasura_backend_plus_version"]),
		"minio/minio:latest",
	}

	availableImages, err := getInstalledImages(client, ctx)
	if err != nil {
		return containers, err
	}

	for _, requiredImage := range requiredImages {
		// check wether the image is available or not
		available := false
		for _, image := range availableImages {
			// if it NOT available, then pull the image
			if contains(image.RepoTags, requiredImage) {
				available = true
			}
		}

		if !available {
			if err = pullImage(client, ctx, requiredImage); err != nil {
				log.Errorf("Failed to pull image %s\nplease pull it manually and re-run `nhost dev`", requiredImage)
			}
		}
	}

	// read env_file
	envFile, err := ioutil.ReadFile(envFile)
	if err != nil {
		log.Warnf("Failed to read %v file", options["env_file"])
		return containers, err
	}

	envData := strings.Split(string(envFile), "\n")
	var envVars []string

	for _, row := range envData {
		if strings.Contains(row, "=") {
			envVars = append(envVars, row)
		}
	}

	/*
		// Define Network config (why isn't PORT in here...?:
		// https://godoc.org/github.com/docker/docker/api/types/network#NetworkingConfig
		networkConfig := &network.NetworkingConfig{
			EndpointsConfig: map[string]*network.EndpointSettings{},
		}
			gatewayConfig := &network.EndpointSettings{
				Gateway: "gatewayname",
			}
			networkConfig.EndpointsConfig["bridge"] = gatewayConfig
	*/

	postgresContainer, err := client.ContainerCreate(
		ctx,
		&container.Config{
			Image: fmt.Sprintf(`postgres:%v`, options["postgres_version"]),
			Env: []string{
				fmt.Sprintf("POSTGRES_USER=%v", options["postgres_user"]),
				fmt.Sprintf("POSTGRES_PASSWORD=%v", options["postgres_password"]),
			},
			ExposedPorts: nat.PortSet{nat.Port(fmt.Sprintf("%v", options["postgres_port"])): struct{}{}},
			Cmd:          []string{"-p", fmt.Sprintf("%v", options["postgres_port"])},
		},
		&container.HostConfig{
			PortBindings: map[nat.Port][]nat.PortBinding{nat.Port(fmt.Sprintf("%v", options["postgres_port"])): {{HostIP: "127.0.0.1", HostPort: fmt.Sprintf("%v", options["postgres_port"])}}},
			RestartPolicy: container.RestartPolicy{
				Name: "always",
			},
			Mounts: []mount.Mount{
				{
					Type:   mount.TypeBind,
					Source: path.Join(cwd, "db_data"),
					Target: "/var/lib/postgresql/data",
				},
			},
		},
		nil,
		nil,
		"nhost_postgres",
	)

	if err != nil {
		log.Debug(err)
		return containers, err
	}

	// prepare env variables for following container
	containerVariables := []string{
		fmt.Sprintf("HASURA_GRAPHQL_SERVER_PORT=%v", options["hasura_graphql_port"]),
		fmt.Sprintf("HASURA_GRAPHQL_DATABASE_URL=%v", fmt.Sprintf(`postgres://%v:%v@nhost-postgres:%v/postgres`, options["postgres_user"], options["postgres_password"], options["postgres_port"])),
		"HASURA_GRAPHQL_ENABLE_CONSOLE=false",
		"HASURA_GRAPHQL_ENABLED_LOG_TYPES=startup, http-log, webhook-log, websocket-log, query-log",
		fmt.Sprintf("HASURA_GRAPHQL_ADMIN_SECRET=%v", options["hasura_graphql_admin_secret"]),
		fmt.Sprintf("HASURA_GRAPHQL_MIGRATIONS_SERVER_TIMEOUT=%d", 20),
		fmt.Sprintf("HASURA_GRAPHQL_NO_OF_RETRIES=%d", 20),
		"HASURA_GRAPHQL_UNAUTHORIZED_ROLE=public",
		fmt.Sprintf("NHOST_HASURA_URL=%v", fmt.Sprintf(`http://nhost_hasura:%v/v1/graphql`, options["hasura_graphql_port"])),
		"NHOST_WEBHOOK_SECRET=devnhostwebhooksecret",
		fmt.Sprintf("NHOST_HBP_URL=%v", fmt.Sprintf(`http://nhost_hbp:%v`, options["hasura_backend_plus_port"])),
		fmt.Sprintf("NHOST_CUSTOM_API_URL=%v", fmt.Sprintf(`http://nhost-api:%v`, options["api_port"])),
	}
	containerVariables = append(containerVariables, envVars...)

	// if user has saved Hasura JWT Key, add that as well
	if options["graphql_jwt_key"] != nil {
		containerVariables = append(containerVariables,
			fmt.Sprintf("HASURA_GRAPHQL_JWT_SECRET=%v", fmt.Sprintf(`{"type":"HS256", "key": "%v"}`, options["graphql_jwt_key"])))
	}

	// if API container has to be loaded,
	// expose it to the links as well

	links := []string{"nhost_postgres:nhost-postgres"}
	if options["startAPI"] != nil && options["startAPI"].(bool) {
		links = append(links, "nhost_api:nhost-api")
	}

	graphqlEngineContainer, err := client.ContainerCreate(
		ctx,
		&container.Config{
			Image: fmt.Sprintf(`%s:%v`, hasuraGraphQLEngine, options["hasura_graphql_version"]),
			Env:   containerVariables,
			ExposedPorts: nat.PortSet{
				nat.Port(strconv.Itoa(options["hasura_graphql_port"].(int))): struct{}{},
			},

			// running following commands on launch were throwing errors,
			// server is running and responding absolutely fine without these commands
			//Cmd:          []string{"graphql-engine", "serve"},
		},
		&container.HostConfig{
			Links: links,
			PortBindings: map[nat.Port][]nat.PortBinding{
				nat.Port(strconv.Itoa(options["hasura_graphql_port"].(int))): {{HostIP: "127.0.0.1",
					HostPort: strconv.Itoa(options["hasura_graphql_port"].(int))}},
			},
			RestartPolicy: container.RestartPolicy{
				Name: "always",
			},
			Mounts: []mount.Mount{
				{
					Type:   mount.TypeBind,
					Source: path.Join(cwd, "db_data"),
					Target: "/var/lib/postgresql/data",
				},
			},
		},
		nil,
		nil,
		"nhost_hasura",
	)

	if err != nil {
		return containers, err
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

	minioContainer, err := client.ContainerCreate(
		ctx,
		&container.Config{
			Image: `minio/minio`,
			//User:  "999:1001",
			Env: []string{
				"MINIO_ACCESS_KEY=minioaccesskey123123",
				"MINIO_SECRET_KEY=minioaccesskey123123",
				//"MINIO_ROOT_USER=AKIAIOSFODNN7EXAMPLE",
				//"MINIO_ROOT_PASSWORD=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
			},
			ExposedPorts: nat.PortSet{nat.Port(strconv.Itoa(options["minio_port"].(int))): struct{}{}},
			Entrypoint:   []string{"sh"},
			Cmd: []string{
				"-c",
				fmt.Sprintf(`mkdir -p /data/nhost && /usr/bin/minio server --address :%v /data`, options["minio_port"]),
			},
		},
		&container.HostConfig{
			PortBindings: map[nat.Port][]nat.PortBinding{
				nat.Port(strconv.Itoa(options["minio_port"].(int))): {{HostIP: "127.0.0.1",
					HostPort: strconv.Itoa(options["minio_port"].(int))}}},
			RestartPolicy: container.RestartPolicy{
				Name: "always",
			},
			Mounts: mountPoints,
		},
		nil,
		nil,
		"nhost_minio",
	)

	if err != nil {
		return containers, err
	}

	// prepare env variables for following container
	containerVariables = []string{
		fmt.Sprintf("PORT=%v", options["hasura_backend_plus_port"]),
		"USER_FIELDS=''",
		"USER_REGISTRATION_AUTO_ACTIVE=true",
		fmt.Sprintf("DATABASE_URL=%v", fmt.Sprintf(`postgres://%v:%v@nhost-postgres:%v/postgres`, options["postgres_user"], options["postgres_password"], options["postgres_port"])),
		fmt.Sprintf("HASURA_GRAPHQL_ENDPOINT=%v", fmt.Sprintf(`http://nhost-graphql-engine:%v/v1/graphql`, options["hasura_graphql_port"])),
		fmt.Sprintf("HASURA_ENDPOINT=%v", fmt.Sprintf(`http://nhost-graphql-engine:%v/v1/graphql`, options["hasura_graphql_port"])),
		fmt.Sprintf("HASURA_GRAPHQL_ADMIN_SECRET=%v", options["hasura_graphql_admin_secret"]),
		"AUTH_ACTIVE=true",
		"AUTH_LOCAL_ACTIVE=true",
		"REFRESH_TOKEN_EXPIRES=43200",
		fmt.Sprintf("S3_ENDPOINT=%v", fmt.Sprintf(`nhost-minio:%v`, options["minio_port"])),
		"S3_SSL_ENABLED=false",
		"S3_BUCKET=nhost",
		"S3_ACCESS_KEY_ID=minioaccesskey123123",
		"S3_SECRET_ACCESS_KEY=miniosecretkey123123",
		"LOST_PASSWORD_ENABLE=true",
		fmt.Sprintf("PROVIDER_SUCCESS_REDIRECT=%v", options["provider_success_redirect"]),
		fmt.Sprintf("PROVIDER_FAILURE_REDIRECT=%v", options["provider_failure_redirect"]),
	}
	containerVariables = append(containerVariables, envVars...)

	// if user has saved Hasura JWT Key, add that as well
	if options["graphql_jwt_key"] != nil {
		containerVariables = append(containerVariables,
			fmt.Sprintf("JWT_KEY=%v", options["graphql_jwt_key"]),
		)
		containerVariables = append(containerVariables,
			"JWT_ALGORITHM=HS256",
		)
		containerVariables = append(containerVariables,
			"JWT_TOKEN_EXPIRES=15",
		)
	}

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
		if options[strings.ToLower(credential)] != nil {
			containerVariables = append(containerVariables, fmt.Sprintf("%s=%v", credential, options[strings.ToLower(credential)]))
		}
	}

	// create mount point if it doesn't exit
	customMountPoint := path.Join(cwd, "custom", "keys")
	if err = os.MkdirAll(customMountPoint, os.ModePerm); err != nil {
		log.Errorf("Failed to create %s directory", customMountPoint)
		return containers, err
	}

	hasuraBackendPlusContainer, err := client.ContainerCreate(
		ctx,
		&container.Config{
			Image:        fmt.Sprintf(`nhost/hasura-backend-plus:%v`, options["hasura_backend_plus_version"]),
			Env:          containerVariables,
			ExposedPorts: nat.PortSet{nat.Port(strconv.Itoa(options["hasura_backend_plus_port"].(int))): struct{}{}},

			// running following commands on launch were throwing errors,
			// server is running and responding absolutely fine without these commands
			//Cmd:          []string{"graphql-engine", "serve"},
		},
		&container.HostConfig{
			Links: []string{"nhost_hasura:nhost-graphql-engine", "nhost_minio:nhost-minio", "nhost_postgres:nhost-postgres"},
			PortBindings: map[nat.Port][]nat.PortBinding{
				nat.Port(strconv.Itoa(options["hasura_backend_plus_port"].(int))): {{HostIP: "127.0.0.1",
					HostPort: strconv.Itoa(options["hasura_backend_plus_port"].(int))}}},
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
		nil,
		nil,
		"nhost_hbp",
	)

	if err != nil {
		return containers, err
	}

	if options["startAPI"] != nil && options["startAPI"].(bool) {

		// prepare env variables for following container
		containerVariables = []string{
			fmt.Sprintf("PORT=%v", options["api_port"]),
			fmt.Sprintf("NHOST_HASURA_URL=%v", fmt.Sprintf(`http://nhost-hasura:%v/v1/graphql`, options["hasura_graphql_port"])),
			fmt.Sprintf("NHOST_HASURA_ADMIN_SECRET=%v", options["hasura_graphql_admin_secret"]),
			"NHOST_WEBHOOK_SECRET=devnhostwebhooksecret",
			fmt.Sprintf("NHOST_HBP_URL=%v", fmt.Sprintf(`http://nhost-hbp:%v`, options["hasura_backend_plus_port"])),
			fmt.Sprintf("NHOST_CUSTOM_API_URL=%v", fmt.Sprintf(`http://localhost:%v`, options["api_port"])),
		}
		containerVariables = append(containerVariables, envVars...)

		// if user has saved Hasura JWT Key, add that as well
		if options["graphql_jwt_key"] != nil {
			containerVariables = append(containerVariables,
				fmt.Sprintf("NHOST_JWT_KEY=%v", options["graphql_jwt_key"]),
			)
			containerVariables = append(containerVariables,
				"NHOST_JWT_ALGORITHM=HS256",
			)
		}

		// create mount point if it doesn't exit
		customMountPoint = path.Join(cwd, "api")
		if err = os.MkdirAll(customMountPoint, os.ModePerm); err != nil {
			log.Errorf("Failed to create %s directory", customMountPoint)
			return containers, err
		}

		APIContainer, err := client.ContainerCreate(
			ctx,
			&container.Config{
				Env:          containerVariables,
				ExposedPorts: nat.PortSet{nat.Port(strconv.Itoa(options["api_port"].(int))): struct{}{}},
				OnBuild: []string{
					"context:../",
					"dockerfile:./.nhost/Dockerfile-api",
				},
			},
			&container.HostConfig{
				Links: []string{"nhost_hasura:nhost-hasura", "nhost_hbp:nhost-hbp", "nhost_minio:nhost-minio"},
				PortBindings: map[nat.Port][]nat.PortBinding{
					nat.Port(strconv.Itoa(options["api_port"].(int))): {{HostIP: "127.0.0.1",
						HostPort: strconv.Itoa(options["api_port"].(int))}}},
				RestartPolicy: container.RestartPolicy{
					Name: "always",
				},
				Mounts: []mount.Mount{
					{
						Type:   mount.TypeBind,
						Source: customMountPoint,
						Target: "/usr/src/app/api",
					},
				},
			},
			nil,
			nil,
			"nhost_api",
		)

		if err != nil {
			return containers, err
		}

		containers = append(containers, APIContainer)
	}

	containers = append(containers, postgresContainer)
	containers = append(containers, minioContainer)

	// add depends_on for following containers
	containers = append(containers, graphqlEngineContainer)
	containers = append(containers, hasuraBackendPlusContainer)
	return containers, err
}

func getInstalledImages(cli *client.Client, ctx context.Context) ([]types.ImageSummary, error) {
	log.Debug("Fetching available/installed container images")
	images, err := cli.ImageList(ctx, types.ImageListOptions{All: true})
	return images, err
}

func pullImage(cli *client.Client, ctx context.Context, tag string) error {
	log.Debugf("Pulling container image: %s", tag)
	out, err := cli.ImagePull(ctx, tag, types.ImagePullOptions{})
	out.Close()
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
