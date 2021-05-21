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
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io/ioutil"
	"log"
	"net"
	"os"
	"os/exec"
	"os/signal"
	"path"
	"strings"
	"syscall"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/api/types/strslice"
	"github.com/docker/docker/client"
	"github.com/docker/go-connections/nat"
	"github.com/spf13/cobra"
	"gopkg.in/yaml.v2"
)

var (

	//flag if startup has finished
	startFinished = false

	hasuraConsoleSpawn *os.Process
)

type (

	// Container service
	Container struct {
		Image       string                 "image"
		Name        string                 "container_name"
		Command     []string               "command"
		Entrypoint  string                 "entrypoint"
		Environment map[string]interface{} "environment"
		Ports       []string               "ports"
		Restart     string                 "restart"
		User        string                 "user"
		Volumes     []string               "volumes"
		DependsOn   []string               `yaml:",omitempty"`
		EnvFile     []string               "env_file"
		Build       map[string]string      "build"
	}

	// Container services
	Services struct {
		Containers map[string]Container "services"
		Version    string               "version"
	}
)

// devCmd represents the dev command
var devCmd = &cobra.Command{
	Use:   "dev",
	Short: "Start local development environment",
	Long:  `Initialize a local Nhost environment for development and testing.`,
	Run: func(cmd *cobra.Command, args []string) {

		Print("Initializing dev environment...", "info")

		// check if project is already initialized
		if !pathExists(nhostDir) {
			Error(nil, "initialize your project before with \"nhost init\" or make sure to run commands at your project root", true)
		}

		// check if .nhost exists
		if !pathExists(dotNhost) {
			if err := os.MkdirAll(dotNhost, os.ModePerm); err != nil {
				Error(err, "couldn't initialize nhost specific directory", true)
			}
		}

		/*
			// check if docker-compose is installed
			if !verifyUtility("docker-compose") {
				Error(nil, "docker-compose not installed: follow instructions here - https://docs.docker.com/compose/install/", true)
			}
		*/

		// check if this is the first time dev env is running
		firstRun := !pathExists(path.Join(dotNhost, "db_data"))
		if firstRun {
			Print("first run takes longer, please be patient...", "warn")
		}

		// add cleanup action in case of signal interruption
		c := make(chan os.Signal)
		signal.Notify(c, os.Interrupt, syscall.SIGTERM)
		go func() {
			<-c
			cleanup(dotNhost, "interrupted by signal")
			os.Exit(1)
		}()

		/*
			// connect to docker client
			ctx := context.Background()
			docker, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
			if err != nil {
				panic(err)
			}

			// stop all running containers
			nhostServices := map[string]string{
				"minio":                     "nhost_minio",
				"nhost-graphql-engine":      "nhost_hasura",
				"nhost-hasura-backend-plus": "nhost_hbp",
				"nhost-postgres":            "nhost_postgres",
				"nhost-api":                 "nhost_api",
			}

			for _, container := range nhostServices {
				if err = stopContainer(docker, ctx, container); err != nil {
					Error(err, fmt.Sprintf("failed to stop %s container", container), true)
				}
			}

				// read pre-written docker-compose yaml
				preWrittenConfigFile, _ := ioutil.ReadFile(path.Join(dotNhost, "docker-compose.yaml"))
				var preWrittenConfig Services
				yaml.Unmarshal(preWrittenConfigFile, &preWrittenConfig)

				// start containers from Nhost Backend Yaml
				for _, service := range preWrittenConfig.Containers {
					for serviceName, _ := range nhostServices {
						fmt.Println(serviceName, " : ", service[serviceName])
					}
				}
		*/
		// run test postgres server
		/*
				postgresContainer := Container{
					Name:    "nhost_postgres",
					Image:   fmt.Sprintf(`postgres:%v`, options["postgres_version"]),
					Ports:   []string{fmt.Sprintf(`%v:5432`, options["postgres_port"])},
					Restart: "always",
					Environment: map[string]interface{}{
						"POSTGRES_USER":     "postgres_user",
						"POSTGRES_PASSWORD": "postgres_password",
					},
					// not sure whether this volume would work on windows as well
					Volumes: []string{"./db_data:/var/lib/postgresql/data"},
				}

			if err = runContainer(
				docker,
				fmt.Sprintf(`postgres:%v`, 12),
				"nhost_postgres",
				"5432",
				[]string{"POSTGRES_USER=postgres_user", "POSTGRES_PASSWORD=postgres_password"},
				nil,
				[]string{"./db_data:/var/lib/postgresql/data"},
				"",
				nil,
				nil,
			); err != nil {
				Error(err, fmt.Sprintf("failed to run %s container", "nhost_postgres"), true)
			}

			os.Exit(0)
		*/

		nhostConfig, err := readYaml(path.Join(nhostDir, "config.yaml"))
		if err != nil {
			Error(err, "couldn't read Nhost config", true)
		}

		ports := []string{
			"hasura_graphql_port",
			"hasura_backend_plus_port",
			"postgres_port",
			"minio_port",
			"api_port",
		}

		var mappedPorts []string

		for _, port := range ports {
			mappedPorts = append(mappedPorts, fmt.Sprintf("%v", nhostConfig[port]))
		}

		mappedPorts = append(mappedPorts, "9695")

		freePorts := getFreePorts(mappedPorts)

		var occupiedPorts []string
		for _, port := range mappedPorts {
			if !contains(freePorts, port) {
				occupiedPorts = append(occupiedPorts, port)
			}
		}

		if len(occupiedPorts) > 0 {
			Error(
				errors.New("required ports already in use, hence aborting"),
				fmt.Sprintf("following ports are already in use: %v \nchange nhost/config.yaml or stop the services", occupiedPorts),
				true,
			)
		}

		nhostConfig["startAPI"] = pathExists(path.Join(workingDir, "api"))
		nhostConfig["graphql_jwt_key"] = generateRandomKey()

		nhostBackendYaml, _ := generateNhostBackendYaml(nhostConfig)

		// create docker-compose.yaml
		nhostBackendYamlFilePath := path.Join(dotNhost, "docker-compose.yaml")
		_, err = os.Create(nhostBackendYamlFilePath)
		if err != nil {
			Error(err, "failed to create docker-compose config", false)
		}

		// write nhost backend configuration to docker-compose.yaml to auth file
		config, _ := yaml.Marshal(nhostBackendYaml)

		err = writeToFile(nhostBackendYamlFilePath, string(config), "end")
		if err != nil {
			Error(err, "failed to write backend docker-compose config", true)
		}

		// write docker api file
		_, err = os.Create(path.Join(dotNhost, "Dockerfile-api"))
		if err != nil {
			Error(err, "failed to create docker api config", false)
		}

		err = writeToFile(path.Join(dotNhost, "Dockerfile-api"), getDockerApiTemplate(), "start")
		if err != nil {
			Error(err, "failed to write backend docker-compose config", true)
		}

		// get docker-compose path
		dockerComposeCLI, _ := exec.LookPath("docker-compose")

		// validate compose file
		execute := exec.Cmd{
			Path: dockerComposeCLI,
			Args: []string{dockerComposeCLI, "-f", nhostBackendYamlFilePath, "config"},
		}

		output, err := execute.CombinedOutput()
		if err != nil {
			Error(err, "failed to validate docker-compose config", false)
			cleanup(dotNhost, string(output))
		}

		// run docker-compose up
		execute = exec.Cmd{
			Path: dockerComposeCLI,
			Args: []string{dockerComposeCLI, "-f", path.Join(dotNhost, "docker-compose.yaml"), "up", "-d", "--build"},
		}

		output, err = execute.CombinedOutput()
		if err != nil {
			Error(err, "failed to start docker-compose", false)
			cleanup(dotNhost, string(output))
		}

		// check whether GraphQL engine is up & running
		if !waitForGraphqlEngine(nhostConfig["hasura_graphql_port"]) {
			Error(err, "failed to start GraphQL Engine", false)
			cleanup(dotNhost, string(output))
		}

		// prepare and load hasura binary
		hasuraCLI, _ := loadBinary("hasura", hasura)

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

		execute = exec.Cmd{
			Path: hasuraCLI,
			Args: cmdArgs,
			Dir:  nhostDir,
		}

		output, err = execute.CombinedOutput()
		if err != nil {
			Error(errors.New(string(output)), "", false)
			cleanup(dotNhost, "failed to apply fresh hasura migrations")
		}

		files, err := ioutil.ReadDir(path.Join(nhostDir, "seeds"))
		if err != nil {
			Error(errors.New(string(output)), "", false)
			cleanup(dotNhost, "failed to read migrations directory")
		}

		if firstRun && len(files) > 0 {

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
				Error(err, "failed to apply seed data", false)
				cleanup(dotNhost, string(output))
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
			Error(err, "failed to aapply fresh metadata", false)
			cleanup(dotNhost, string(output))
		}

		Print("starting Hasura console", "info")
		/*

			switch runtime.GOOS {
			case "linux":
				err = exec.Command("xdg-open", url).Start()
			case "windows":
				err = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
			case "darwin":
				err = exec.Command("open", url).Start()
			default:
				err = fmt.Errorf("unsupported platform")
			}
			if err != nil {
				log.Fatal(err)
			}
		*/

		/*
			//spawn hasura console in parallel terminal session
			hasuraConsoleSpawnCmd := exec.Cmd{
				Path: hasuraCLI,
				Args: []string{hasuraCLI,
					"console",
					"--endpoint",
					fmt.Sprintf(`http://localhost:%v`, nhostConfig["hasura_graphql_port"]),
					"--admin-secret",
					fmt.Sprintf(`%v`, nhostConfig["hasura_graphql_admin_secret"]),
					"--console-port",
					"9695",
				},
				Stdout: os.Stdout,
				Dir:    nhostDir,
			}

			output, err = hasuraConsoleSpawnCmd.CombinedOutput()

			// update hasura spawned session pid for cleanup ops
			hasuraConsoleSpawn = hasuraConsoleSpawnCmd.Process
			if err != nil {
				Error(errors.New(string(output)), "failed to open hasura console", true)
			}
		*/

		// dev environment initiated
		Print("Local Nhost backend is up!", "success")
		Print(fmt.Sprintf("GraphQL API: `http://localhost:%v/v1/graphql`", nhostConfig["hasura_graphql_port"]), "info")
		Print("Hasura Console: `http://localhost:9695`", "info")
		Print(fmt.Sprintf("Auth & Storage: `http://localhost:%v/v1/graphql`", nhostConfig["hasura_backend_plus_port"]), "info")
		Print(fmt.Sprintf("Custom API: `http://localhost:%v/v1/graphql`", nhostConfig["api_port"]), "info")
	},
}

// start a container in background
func runContainer(
	client *client.Client,
	imagename string,
	containername string,
	port string,
	inputEnv []string,
	build []string,
	volumes []string,
	user string,
	entrypoint strslice.StrSlice,
	command strslice.StrSlice,
) error {
	// Define a PORT opening
	newport, err := nat.NewPort("tcp", port)
	if err != nil {
		fmt.Println("Unable to create docker port")
		return err
	}

	// Configured hostConfig:
	// https://godoc.org/github.com/docker/docker/api/types/container#HostConfig
	hostConfig := &container.HostConfig{
		PortBindings: nat.PortMap{
			newport: []nat.PortBinding{
				{
					HostIP:   "0.0.0.0",
					HostPort: port,
				},
			},
		},
		RestartPolicy: container.RestartPolicy{
			Name: "always",
		},
		LogConfig: container.LogConfig{
			Type:   "json-file",
			Config: map[string]string{},
		},
		Binds: volumes,
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

	// Define ports to be exposed (has to be same as hostconfig.portbindings.newport)
	exposedPorts := map[nat.Port]struct{}{
		newport: struct{}{},
	}

	// Configuration
	// https://godoc.org/github.com/docker/docker/api/types/container#Config
	config := &container.Config{
		Image:        imagename,
		Env:          inputEnv,
		ExposedPorts: exposedPorts,
		User:         user,
		//Hostname:     fmt.Sprintf("%s-hostnameexample", imagename),
		OnBuild:    build,
		Entrypoint: entrypoint,
		Cmd:        command,
	}

	// Creating the actual container. This is "nil,nil,nil" in every example.
	cont, err := client.ContainerCreate(
		context.Background(),
		config,
		hostConfig,
		&network.NetworkingConfig{},
		nil,
		containername,
	)

	if err != nil {
		log.Println(err)
		return err
	}

	// Run the actual container
	client.ContainerStart(context.Background(), cont.ID, types.ContainerStartOptions{})
	Print("container %s is created", containername)

	return nil
}

// stops given containers
func stopContainer(cli *client.Client, ctx context.Context, name string) error {

	containers, err := cli.ContainerList(ctx, types.ContainerListOptions{})
	if err != nil {
		return err
	}

	for _, container := range containers {
		if contains(container.Names, name) {
			Print(fmt.Sprint("stopping container ", container.Names[0], "... "), "info")
			if err := cli.ContainerStop(ctx, container.ID, nil); err != nil {
				return err
			}
		}
	}

	return nil
}

// run cleanup
func cleanup(location, errorMessage string) {

	Error(errors.New(errorMessage), "cleanup/rollback process initiated", false)

	if !startFinished {
		Print(fmt.Sprintf("writing logs to %s/nhost.log", location), "info")
	}

	logPath := path.Join(location, "nhost.log")

	// if log files don't exit, create them
	if !pathExists(logPath) {
		f, err := os.Create(logPath)
		if err != nil {
			Error(err, fmt.Sprintf("failed to instantiate log path at %s", logPath), true)
		}

		defer f.Close()
	}

	var dockerComposeCLI string

	dockerComposeCLI, err := exec.LookPath("docker-compose")
	if err != nil {
		dockerComposeCLI = "docker-compose"
	}

	cmdArgs := []string{
		dockerComposeCLI,
		"-f",
		path.Join(location, "docker-compose.yaml"),
		"logs",
		"--no-color",
		"-t",
		">",
		logPath,
	}

	executeCmd := exec.Command(strings.Join(cmdArgs, " "))
	executeCmd.Path = dockerComposeCLI
	if err = executeCmd.Run(); err != nil {
		if err = writeToFile(logPath, err.Error(), "end"); err != nil {
			Error(err, "failed to write log files", false)
		}
		Error(err, "failed to trace docker-compose output", false)
	}

	/*
		// if hasura console session is active, kill it
		p, _ := os.FindProcess(hasuraConsoleSpawn.Pid)
		if err = p.Signal(syscall.Signal(0)); err != nil {
			p.Kill()
		}
	*/

	// deactivate docker services
	cmdArgs = []string{
		dockerComposeCLI,
		"-f",
		path.Join(location, "docker-compose.yaml"),
		"down",
	}

	executeCmd = exec.Command(strings.Join(cmdArgs, " "))
	executeCmd.Path = dockerComposeCLI
	if err = executeCmd.Run(); err != nil {
		Error(err, "failed to stop docker services", false)
	}

	dockerCLI, _ := exec.LookPath("docker")

	// deactivate docker services
	cmdArgs = []string{
		dockerCLI,
		"rm",
		"-f",
		"nhost_hasura-console",
	}

	// close hasura console docker container
	executeCmd = exec.Command(strings.Join(cmdArgs, " "))
	executeCmd.Path = dockerCLI
	if err = executeCmd.Run(); err != nil {
		Error(err, "failed to rm docker services", false)
	}

	// delete prepared config files
	deletePath(path.Join(location, "docker-compose.yaml"))
	deletePath(path.Join(location, "Dockerfile-api"))

	Print("cleanup complete", "info")
	Print("See you later, grasshopper!", "success")

	os.Exit(0)
}

func waitForGraphqlEngine(port interface{}) bool {

	Print("waiting for GraphQL engine to go up...", "info")

	cmd := exec.Command("curl", fmt.Sprintf(`http://localhost:%v/healthz`, port), ">", "/dev/null", "2>&1")

	// Use a bytes.Buffer to get the output
	var buf bytes.Buffer
	cmd.Stdout = &buf

	cmd.Start()

	// Use a channel to signal completion so we can use a select statement
	done := make(chan error)
	go func() { done <- cmd.Wait() }()

	// Start a timer
	timeout := time.After(3 * time.Second)

	// The select statement allows us to execute based on which channel
	// we get a message from first.
	select {
	case <-timeout:
		// Timeout happened first, kill the process and print a message.
		cmd.Process.Kill()
		//fmt.Println("Command timed out")
		return false
	case <-done:
		// Command completed before timeout. Print output and error if it exists.
		fmt.Println("Output:", buf.String())
		return true
	}
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
FROM nhost/nodeapi:v0.2.7
WORKDIR /usr/src/app
COPY api ./api
RUN ./install.sh
ENTRYPOINT ["./entrypoint-dev.sh"]
`
}

func generateNhostBackendYaml(options map[string]interface{}) (Services, error) {

	hasuraGraphQLEngine := "hasura/graphql-engine"

	if options["hasura_graphql_engine"] != nil {
		hasuraGraphQLEngine = options["hasura_graphql_engine"].(string)
	}

	var services Services

	postgresContainer := Container{
		Name:    "nhost_postgres",
		Image:   fmt.Sprintf(`postgres:%v`, options["postgres_version"]),
		Ports:   []string{fmt.Sprintf(`%v:5432`, options["postgres_port"])},
		Restart: "always",
		Environment: map[string]interface{}{
			"POSTGRES_USER":     "postgres_user",
			"POSTGRES_PASSWORD": "postgres_password",
		},
		// not sure whether this volume would work on windows as well
		Volumes: []string{"./db_data:/var/lib/postgresql/data"},
	}

	graphqlEngineContainer := Container{
		Name:      "nhost_hasura",
		Image:     fmt.Sprintf(`%s:%v`, hasuraGraphQLEngine, options["hasura_graphql_version"]),
		Ports:     []string{fmt.Sprintf(`%v:%v`, options["hasura_graphql_port"], options["hasura_graphql_port"])},
		Restart:   "always",
		DependsOn: []string{"nhost-postgres"},
		Environment: map[string]interface{}{
			"HASURA_GRAPHQL_SERVER_PORT":               options["hasura_graphql_port"],
			"HASURA_GRAPHQL_DATABASE_URL":              fmt.Sprintf(`postgres://%v:%v@nhost-postgres:5432/postgres`, options["postgres_user"], options["postgres_password"]),
			"HASURA_GRAPHQL_ENABLE_CONSOLE":            "false",
			"HASURA_GRAPHQL_ENABLED_LOG_TYPES":         "startup, http-log, webhook-log, websocket-log, query-log",
			"HASURA_GRAPHQL_ADMIN_SECRET":              options["hasura_graphql_admin_secret"],
			"HASURA_GRAPHQL_JWT_SECRET":                fmt.Sprintf(`{"type":"HS256", "key": "%v"}`, options["graphql_jwt_key"]),
			"HASURA_GRAPHQL_MIGRATIONS_SERVER_TIMEOUT": 20,
			"HASURA_GRAPHQL_NO_OF_RETRIES":             20,
			"HASURA_GRAPHQL_UNAUTHORIZED_ROLE":         "public",
			"NHOST_HASURA_URL":                         fmt.Sprintf(`http://nhost_hasura:%v/v1/graphql`, options["hasura_graphql_port"]),
			"NHOST_WEBHOOK_SECRET":                     "devnhostwebhooksecret",
			"NHOST_HBP_URL":                            fmt.Sprintf(`http://nhost_hbp:%v`, options["hasura_backend_plus_port"]),
			"NHOST_CUSTOM_API_URL":                     fmt.Sprintf(`http://nhost_api:%v`, options["api_port"]),
		},

		EnvFile: []string{options["env_file"].(string)},
		Command: []string{"graphql-engine", "serve"},
		// not sure whether this volume would work on windows as well
		Volumes: []string{"./db_data:/var/lib/postgresql/data"},
	}

	hasuraBackendPlusContainer := Container{
		Name:      "nhost_hbp",
		Image:     fmt.Sprintf(`nhost/hasura-backend-plus:%v`, options["hasura_backend_plus_version"]),
		Ports:     []string{fmt.Sprintf(`%v:%v`, options["hasura_backend_plus_port"], options["hasura_backend_plus_port"])},
		Restart:   "always",
		DependsOn: []string{"nhost-graphql-engine"},
		Environment: map[string]interface{}{
			"PORT":                          options["hasura_backend_plus_port"],
			"USER_FIELDS":                   "",
			"USER_REGISTRATION_AUTO_ACTIVE": "true",
			"HASURA_GRAPHQL_ENDPOINT":       fmt.Sprintf(`http://nhost-graphql-engine:%v/v1/graphql`, options["hasura_graphql_port"]),
			"HASURA_ENDPOINT":               fmt.Sprintf(`http://nhost-graphql-engine:%v/v1/graphql`, options["hasura_graphql_port"]),
			"HASURA_GRAPHQL_ADMIN_SECRET":   options["hasura_graphql_admin_secret"],
			"JWT_ALGORITHM":                 "HS256",
			"JWT_KEY":                       options["graphql_jwt_key"],
			"AUTH_ACTIVE":                   "true",
			"AUTH_LOCAL_ACTIVE":             "true",
			"REFRESH_TOKEN_EXPIRES":         43200,
			"JWT_TOKEN_EXPIRES":             15,
			"S3_ENDPOINT":                   fmt.Sprintf(`nhost_minio:%v`, options["minio_port"]),
			"S3_SSL_ENABLED":                "false",
			"S3_BUCKET":                     "nhost",
			"S3_ACCESS_KEY_ID":              "minioaccesskey123123",
			"S3_SECRET_ACCESS_KEY":          "miniosecretkey123123",
			"LOST_PASSWORD_ENABLE":          "true",
			"PROVIDER_SUCCESS_REDIRECT":     options["provider_success_redirect"],
			"PROVIDER_FAILURE_REDIRECT":     options["provider_failure_redirect"],

			// Google vars
			"GOOGLE_ENABLE":        options["google_enable"],
			"GOOGLE_CLIENT_ID":     options["google_client_id"],
			"GOOGLE_CLIENT_SECRET": options["google_client_secret"],

			// Github vars
			"GITHUB_ENABLE":        options["github_enable"],
			"GITHUB_CLIENT_ID":     options["github_client_id"],
			"GITHUB_CLIENT_SECRET": options["github_client_secret"],

			// Facebook vars
			"FACEBOOK_ENABLE":        options["facebook_enable"],
			"FACEBOOK_CLIENT_ID":     options["facebook_client_id"],
			"FACEBOOK_CLIENT_SECRET": options["facebook_client_secret"],

			// LinkedIn vars
			"LINKEDIN_ENABLE":        options["linkedin_enable"],
			"LINKEDIN_CLIENT_ID":     options["linkedin_client_id"],
			"LINKEDIN_CLIENT_SECRET": options["linkedin_client_secret"],
		},

		EnvFile: []string{options["env_file"].(string)},
		Command: []string{"graphql-engine", "serve"},

		// not sure whether this volume would work on windows as well
		Volumes: []string{"../nhost/custom:/app/custom"},
	}

	minioContainer := Container{
		Name:    "nhost_minio",
		Image:   "minio/minio",
		User:    "999:1001",
		Ports:   []string{fmt.Sprintf(`%v:%v`, options["minio_port"], options["minio_port"])},
		Restart: "always",
		Environment: map[string]interface{}{
			"MINIO_ACCESS_KEY": "minioaccesskey123123",
			"MINIO_SECRET_KEY": "minioaccesskey123123",
		},
		Entrypoint: "sh",
		Command:    []string{fmt.Sprintf(`-c "mkdir -p /data/nhost && /usr/bin/minio server --address :%v /data"`, options["minio_port"])},

		// not sure whether this volume would work on windows as well
		Volumes: []string{"./minio/data:/data", "./minio/config:/.minio"},
	}

	services.Containers["nhost-postgres"] = postgresContainer
	services.Containers["nhost-graphql-engine"] = graphqlEngineContainer
	services.Containers["nhost-hasura-backend-plus"] = hasuraBackendPlusContainer
	services.Containers["minio"] = minioContainer

	project := Services{
		Version:    "3.6",
		Containers: services.Containers,
	}

	if options["startAPI"].(bool) {

		APIContainer := Container{
			Name: "nhost_api",

			// not sure whether the following build command would work in windows or not
			Build: map[string]string{
				"context":    "../",
				"dockerfile": "./.nhost/Dockerfile-api",
			},

			Ports:   []string{fmt.Sprintf(`%v:%v`, options["api_port"], options["api_port"])},
			Restart: "always",
			Environment: map[string]interface{}{
				"PORT":                      options["api_port"],
				"NHOST_JWT_ALGORITHM":       "HS256",
				"NHOST_JWT_KEY":             options["graphql_jwt_key"],
				"NHOST_HASURA_URL":          fmt.Sprintf(`http://nhost_hasura:%v/v1/graphql`, options["hasura_graphql_port"]),
				"NHOST_HASURA_ADMIN_SECRET": options["hasura_graphql_admin_secret"],
				"NHOST_WEBHOOK_SECRET":      "devnhostwebhooksecret",
				"NHOST_HBP_URL":             fmt.Sprintf(`http://nhost_hbp:%v`, options["hasura_backend_plus_port"]),
				"NHOST_CUSTOM_API_URL":      fmt.Sprintf(`http://nhost_api:%v`, options["api_port"]),
			},
			EnvFile: []string{options["env_file"].(string)},

			// not sure whether this volume would work on windows as well
			Volumes: []string{"../api:/usr/src/app/api"},
		}
		services.Containers["nhost-api"] = APIContainer
	}

	return project, nil
}

func init() {
	rootCmd.AddCommand(devCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	// devCmd.PersistentFlags().String("foo", "", "A help for foo")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	// devCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}
