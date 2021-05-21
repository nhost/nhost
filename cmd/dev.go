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
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io/ioutil"
	"net"
	"os"
	"os/exec"
	"os/signal"
	"path"
	"strings"
	"syscall"
	"time"

	"github.com/spf13/cobra"
	"gopkg.in/yaml.v2"
)

var (

	//flag if startup has finished
	startFinished = false

	hasuraConsoleSpawn *os.Process
)

// devCmd represents the dev command
var devCmd = &cobra.Command{
	Use:   "dev",
	Short: "Start local development environment",
	Long:  `Initialize a local Nhost environment for development and testing.`,
	Run: func(cmd *cobra.Command, args []string) {

		if verbose {
			printMessage("Initializing dev environment...", "info")
		}

		// check if project is already initialized
		if !pathExists(nhostDir) {
			throwError(nil, "initialize your project before with \"nhost init\" or make sure to run commands at your project root", true)
		}

		// check if .nhost exists
		if !pathExists(dotNhost) {
			if err := os.MkdirAll(dotNhost, os.ModePerm); err != nil {
				throwError(err, "couldn't initialize nhost specific directory", true)
			}
		}

		// check if hasura is installed
		if !verifyUtility("docker-compose") {
			throwError(nil, "docker-compose not installed: follow instructions here - https://docs.docker.com/compose/install/", true)
		}

		// check if this is the first time dev env is running
		firstRun := !pathExists(path.Join(dotNhost, "db_data"))
		printMessage("Nhost is starting...", "info")
		if firstRun {
			printMessage("first run takes longer, please be patient...", "warn")
		}

		// add cleanup action in case of signal interruption
		c := make(chan os.Signal)
		signal.Notify(c, os.Interrupt, syscall.SIGTERM)
		go func() {
			<-c
			cleanup(dotNhost, "interrupted by signal")
			os.Exit(1)
		}()

		nhostConfig, err := readYaml(path.Join(nhostDir, "config.yaml"))
		if err != nil {
			throwError(err, "couldn't read Nhost config", true)
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
			throwError(
				errors.New("required ports already in use, hence abort required"),
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
			throwError(err, "failed to create docker-compose config", false)
		}

		// write nhost backend configuration to docker-compose.yaml to auth file
		config, _ := yaml.Marshal(nhostBackendYaml)

		err = writeToFile(nhostBackendYamlFilePath, string(config), "end")
		if err != nil {
			throwError(err, "failed to write backend docker-compose config", true)
		}

		// write docker api file
		_, err = os.Create(path.Join(dotNhost, "Dockerfile-api"))
		if err != nil {
			throwError(err, "failed to create docker api config", false)
		}

		err = writeToFile(path.Join(dotNhost, "Dockerfile-api"), getDockerApiTemplate(), "start")
		if err != nil {
			throwError(err, "failed to write backend docker-compose config", true)
		}

		// validate compose file
		execute := exec.Command("docker-compose", "-f", nhostBackendYamlFilePath, "config")
		if err = execute.Run(); err != nil {
			throwError(err, "couldn't validate docker-compose config", true)
		}

		// run docker-compose up
		execute = exec.Command("docker-compose", "-f", path.Join(dotNhost, "docker-compose.yaml"), "up", "-d", "--build")
		if err = execute.Run(); err != nil {
			cleanup(dotNhost, "failed to start docker-compose: "+err.Error())
		}

		// check whether GraphQL engine is up & running
		if !waitForGraphqlEngine(nhostConfig["hasura_graphql_port"]) {
			cleanup(dotNhost, "failed to start GraphQL Engine: "+err.Error())
		}

		// configure hasura cli command

		/*
			// first load the hasura binary if it isn't installed
			err = loadBinaries("hasura", hasura)
			if err != nil {
				cleanup(dotNhost, "failed to load the hasura CLI, please install it manually from here: https://hasura.io/docs/latest/graphql/core/hasura-cli/install-hasura-cli.html#install-hasura-cli")
			}
		*/

		// finally search for Hasura's installed binary path
		//hasuraCLI, _ := exec.LookPath("hasura")

		hasuraCLI, _ := loadBinary("hasura", hasura)

		commandOptions := []string{
			"--endpoint",
			fmt.Sprintf(`http://localhost:%v`, nhostConfig["hasura_graphql_port"]),
			"--admin-secret",
			nhostConfig["hasura_graphql_admin_secret"].(string),
			"--skip-update-check",
		}

		// create migrations from remote
		cmdArgs := []string{hasuraCLI, "migrate", "apply"}
		cmdArgs = append(cmdArgs, commandOptions...)

		hasuraConfigureCmd := exec.Cmd{
			Path:   hasuraCLI,
			Args:   cmdArgs,
			Stdout: os.Stdout,
			Stderr: os.Stderr,
			Dir:    nhostDir,
		}

		if err = hasuraConfigureCmd.Run(); err != nil {
			cleanup(dotNhost, "couldn't apply fresh hasura migrations: "+err.Error())
		}

		files, err := ioutil.ReadDir(path.Join(nhostDir, "seeds"))
		if err != nil {
			cleanup(dotNhost, "couldn't read migrations directory: "+err.Error())
		}

		if firstRun && len(files) > 0 {

			// apply seed data
			cmdArgs = []string{hasuraCLI, "seeds", "apply"}
			cmdArgs = append(cmdArgs, commandOptions...)

			hasuraConfigureCmd = exec.Cmd{
				Path:   hasuraCLI,
				Args:   cmdArgs,
				Stdout: os.Stdout,
				Stderr: os.Stderr,
				Dir:    nhostDir,
			}

			if err = hasuraConfigureCmd.Run(); err != nil {
				cleanup(dotNhost, "couldn't apply seed data: "+err.Error())
			}
		}

		// create migrations from remote
		cmdArgs = []string{hasuraCLI, "metadata", "apply"}
		cmdArgs = append(cmdArgs, commandOptions...)

		hasuraConfigureCmd = exec.Cmd{
			Path:   hasuraCLI,
			Args:   cmdArgs,
			Stdout: os.Stdout,
			Stderr: os.Stderr,
			Dir:    nhostDir,
		}

		if err = hasuraConfigureCmd.Run(); err != nil {
			cleanup(dotNhost, "couldn't apply fresh metadata: "+err.Error())
		}

		printMessage("starting Hasura console", "info")

		//spawn hasura console in parallel terminal session
		hasuraConsoleSpawnCmd := exec.Cmd{
			Path: hasuraCLI,
			Args: []string{hasuraCLI,
				fmt.Sprintf(`--endpoint=http://localhost:%v`, nhostConfig["hasura_graphql_port"]),
				fmt.Sprintf(`--admin-secret=%v`, nhostConfig["hasura_graphql_admin_secret"]),
				"--console-port=9695",
			},
			Stdout: os.Stdout,
			Dir:    nhostDir,
		}

		// update hasura spawned session pid for cleanup ops
		hasuraConsoleSpawn = hasuraConsoleSpawnCmd.Process
		if err = hasuraConfigureCmd.Run(); err != nil {
			throwError(err, "couldn't apply fresh hasura migrations", true)
		}

		// dev environment initiated
		printMessage("Local Nhost backend is up!", "success")
		printMessage(fmt.Sprintf("GraphQL API: `http://localhost:%v/v1/graphql`", nhostConfig["hasura_graphql_port"]), "info")
		printMessage("Hasura Console: `http://localhost:9695`", "info")
		printMessage(fmt.Sprintf("Auth & Storage: `http://localhost:%v/v1/graphql`", nhostConfig["hasura_backend_plus_port"]), "info")
		printMessage(fmt.Sprintf("Custom API: `http://localhost:%v/v1/graphql`", nhostConfig["api_port"]), "info")
	},
}

// run cleanup
func cleanup(location, errorMessage string) {

	if !startFinished {
		printMessage(fmt.Sprintf("\nWriting logs to %s/nhost.log\n", location), "info")
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
		path.Join(location, "nhost.log"),
	}

	executeCmd := exec.Command(strings.Join(cmdArgs, " "))
	fmt.Println(executeCmd.String())

	if err = executeCmd.Run(); err != nil {
		throwError(err, "failed to write log files", true)
	}

	if err = hasuraConsoleSpawn.Kill(); err != nil {
		throwError(err, "failed to kill hasura process", true)
	}

	cmdArgs = []string{
		dockerComposeCLI,
		"-f",
		path.Join(location, "docker-compose.yaml"),
		"down",
	}

	executeCmd = exec.Command(strings.Join(cmdArgs, " "))
	if err = executeCmd.Run(); err != nil {
		throwError(err, "failed to deactive docker services", true)
	}

	// close hasura console docker container
	executeCmd = exec.Command("docker", "rm -f nhost_hasura-console")
	if err = executeCmd.Run(); err != nil {
		throwError(err, "failed to shut down hasura console docker container", true)
	}

	// delete prepared config files
	deletePath(path.Join(location, "docker-compose.yaml"))
	deletePath(path.Join(location, "Dockerfile-api"))

	if startFinished {
		printMessage("See you later, grasshopper!", "success")
	} else {
		throwError(nil, errorMessage, true)
	}

	os.Exit(0)
}

func waitForGraphqlEngine(port interface{}) bool {

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
		//fmt.Println("Output:", buf.String())
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

func generateNhostBackendYaml(options map[string]interface{}) (map[string]interface{}, error) {

	hasuraGraphQLEngine := "hasura/graphql-engine"

	if options["hasura_graphql_engine"] != nil {
		hasuraGraphQLEngine = options["hasura_graphql_engine"].(string)
	}

	project := map[string]interface{}{
		"version": "3.6",
		"services": map[string]interface{}{

			// add nhost postgres service
			"nhost-postgres": map[string]interface{}{
				"container_name": "nhost_postgres",
				"image":          fmt.Sprintf(`postgres:%v`, options["postgres_version"]),
				"ports":          []string{fmt.Sprintf(`%v:5432`, options["postgres_port"])},
				"restart":        "always",
				"environment": map[string]string{
					"POSTGRES_USER":     "postgres_user",
					"POSTGRES_PASSWORD": "postgres_password",
				},

				// not sure whether this volume would work on windows as well
				"volumes": []string{"./db_data:/var/lib/postgresql/data"},
			},

			// add nhost graphql engine service
			"nhost-graphql-engine": map[string]interface{}{
				"container_name": "nhost_hasura",
				"image":          fmt.Sprintf(`%s:%v`, hasuraGraphQLEngine, options["hasura_graphql_version"]),
				"ports":          []string{fmt.Sprintf(`%v:%v`, options["hasura_graphql_port"], options["hasura_graphql_port"])},
				"depends_on":     []string{"nhost-postgres"},
				"restart":        "always",
				"environment": map[string]interface{}{
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
				"env_file": []string{options["env_file"].(string)},
				"command":  []string{"graphql-engine", "serve"},

				// not sure whether this volume would work on windows as well
				"volumes": []string{"../nhost/migrations:/hasura-migrations"},
			},

			// add nhost hasura backend plus service
			"nhost-hasura-backend-plus": map[string]interface{}{
				"container_name": "nhost_hbp",
				"image":          fmt.Sprintf(`nhost/hasura-backend-plus:%v`, options["hasura_backend_plus_version"]),
				"ports":          []string{fmt.Sprintf(`%v:%v`, options["hasura_backend_plus_port"], options["hasura_backend_plus_port"])},
				"depends_on":     []string{"nhost-graphql-engine"},
				"restart":        "always",
				"environment": map[string]interface{}{
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
				"env_file": []string{options["env_file"].(string)},
				"command":  []string{"graphql-engine", "serve"},

				// not sure whether this volume would work on windows as well
				"volumes": []string{"../nhost/custom:/app/custom"},
			},

			// add minio service
			"minio": map[string]interface{}{
				"container_name": "nhost_minio",
				"image":          "minio/minio",
				"user":           "999:1001",
				"ports":          []string{fmt.Sprintf(`%v:%v`, options["minio_port"], options["minio_port"])},
				"restart":        "always",
				"environment": map[string]interface{}{
					"MINIO_ACCESS_KEY": "minioaccesskey123123",
					"MINIO_SECRET_KEY": "minioaccesskey123123",
				},
				"entrypoint": "sh",
				"command":    fmt.Sprintf(`-c 'mkdir -p /data/nhost && /usr/bin/minio server --address :%v /data'`, options["minio_port"]),

				// not sure whether this volume would work on windows as well
				"volumes": []string{"./minio/data:/data", "./minio/config:/.minio"},
			},
		},
	}

	if options["startAPI"].(bool) {
		project["services"].(map[string]interface{})["nhost-api"] = map[string]interface{}{

			"container_name": "nhost_api",

			// not sure whether the following build command would work in windows or not
			"build": map[string]string{
				"context":    "../",
				"dockerfile": "./.nhost/Dockerfile-api",
			},

			"ports":   []string{fmt.Sprintf(`%v:%v`, options["api_port"], options["api_port"])},
			"restart": "always",
			"environment": map[string]interface{}{
				"PORT":                      options["api_port"],
				"NHOST_JWT_ALGORITHM":       "HS256",
				"NHOST_JWT_KEY":             options["graphql_jwt_key"],
				"NHOST_HASURA_URL":          fmt.Sprintf(`http://nhost_hasura:%v/v1/graphql`, options["hasura_graphql_port"]),
				"NHOST_HASURA_ADMIN_SECRET": options["hasura_graphql_admin_secret"],
				"NHOST_WEBHOOK_SECRET":      "devnhostwebhooksecret",
				"NHOST_HBP_URL":             fmt.Sprintf(`http://nhost_hbp:%v`, options["hasura_backend_plus_port"]),
				"NHOST_CUSTOM_API_URL":      fmt.Sprintf(`http://nhost_api:%v`, options["api_port"]),
			},
			"env_file": []string{options["env_file"].(string)},

			// not sure whether this volume would work on windows as well
			"volumes": []string{"../api:/usr/src/app/api"},
		}
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
