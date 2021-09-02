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
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

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

var (
	port string

	// JWT Key for the dev env
	jwtKey string

	// Nhost services configuration
	configuration nhost.Configuration

	// runtime environment variables
	envVars []string

	// proxy mux
	mux = http.NewServeMux()

	// reverse proxy server
	proxy *http.Server

	// signal interruption channel
	stop = make(chan os.Signal)
)

// devCmd represents the dev command
var devCmd = &cobra.Command{
	Use:     "dev [-p port]",
	Aliases: []string{"d"},
	Short:   "Start local development environment",
	Long:    `Initialize a local Nhost environment for development and testing.`,
	Run: func(cmd *cobra.Command, args []string) {

		// initialize the proxy server
		proxy = &http.Server{Addr: ":" + port, Handler: mux}

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
	log.Warn("Please wait while we cleanup")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	proxy.Shutdown(ctx)
	downCmd.Run(cmd, []string{"exit"})
}

func execute(cmd *cobra.Command, args []string) {

	// if environment variables haven't been loaded
	// then load them from .env.development
	if len(envVars) == 0 {
		envVars, _ = nhost.Env()
	}

	// generate fresh JWT key for GraphQL
	if len(jwtKey) == 0 {
		jwtKey = generateRandomKey()
	}

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
	firstRun := !pathExists(filepath.Join(nhost.DOT_NHOST, "db_data"))
	if firstRun {
		log.Info("First run takes longer, please be patient")
	}

	// shut down any existing Nhost containers
	downCmd.Run(cmd, args)

	log.Info("Creating Nhost services")

	nhostConfig, err := nhost.Config()
	if err != nil {
		log.Debug(err)
		log.Fatal("Failed to read Nhost config")
	}

	configuration = nhostConfig

	// generate Nhost service containers' configurations
	nhostServices, err := getContainerConfigs(docker)
	if err != nil {
		log.Debug(err)
		log.Fatal("Failed to generate container configurations")
	}

	// create the Nhost network if it doesn't exist
	networkID, err := prepareNetwork(docker, ctx, nhost.PREFIX)
	if err != nil {
		log.Debug(err)
		log.WithFields(logrus.Fields{
			"type":    "network",
			"network": nhost.PREFIX,
		}).Error("Failed to prepare network")
		cleanup(cmd)
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

		// notify the user
		log.WithFields(logrus.Fields{
			"container": item["name"],
			"type":      "container",
		}).Debug("Created")
	}

	log.Info("Running a quick health check on services")
	if err := Diagnose(configuration, docker, ctx); err != nil {
		log.Debug(err)
		log.WithField("stage", "health").Error("Diagnosis failed")
		cleanup(cmd)
	}

	hasuraEndpoint := fmt.Sprintf(`http://localhost:%v`, configuration.Services["hasura"].Port)

	// prepare and load required binaries
	hasuraCLI, _ := hasura.Binary()

	commandOptions := []string{
		"--endpoint",
		hasuraEndpoint,
		"--admin-secret",
		fmt.Sprint(configuration.Services["hasura"].AdminSecret),
		"--skip-update-check",
	}

	// apply migrations and metadata
	if err = prepareData(hasuraCLI, commandOptions, firstRun); err != nil {
		log.Debug(err)
		cleanup(cmd)
	}

	// prepare services for reverse proxy
	type Service struct {
		Name    string
		Address string
		Handle  string
	}
	services := []Service{
		{
			Name:    "GraphQL",
			Address: fmt.Sprintf("http://localhost:%v/v1/graphql", configuration.Services["hasura"].Port),
			Handle:  "/graphql",
		},
		{
			Name:    "Authentication",
			Address: fmt.Sprintf("http://localhost:%v", configuration.Services["auth"].Port),
			Handle:  "/auth/",
		},
		{
			Name:    "Storage",
			Address: fmt.Sprintf("http://localhost:%v", configuration.Services["storage"].Port),
			Handle:  "/storage/",
		},
	}

	// if functions exist,
	// start and attach a reverse proxy
	if pathExists(nhost.API_DIR) {

		// run the functions command
		go ServeFuncs(cmd, []string{"do_not_inform"})
		services = append(services, Service{
			Name:    "Functions",
			Address: fmt.Sprintf("http://localhost:%v", funcPort),
			Handle:  "/functions/",
		})
	}

	for _, item := range services {
		if err := prepareProxy(item.Address, item.Handle); err != nil {
			log.WithField("component", "server").Debug(err)
			log.WithField("component", "server").Error("Failed to proxy", item.Name)
			cleanup(cmd)
		}
		log.Info(item.Name, ": http://localhost:", port, item.Handle)
	}

	//spawn hasura console
	hasuraConsoleSpawnCmd := exec.Cmd{
		Path: hasuraCLI,
		Args: []string{hasuraCLI,
			"console",
			"--endpoint",
			hasuraEndpoint,
			"--admin-secret",
			fmt.Sprint(configuration.Services["hasura"].AdminSecret),
			"--console-port",
			fmt.Sprint(nhost.GetPort(9301, 9400)),
		},
		Dir: nhost.NHOST_DIR,
	}

	go hasuraConsoleSpawnCmd.Run()

	// launch mailhog UI
	go openbrowser(fmt.Sprintf("http://localhost:%v", configuration.Services["mailhog"].Port))

	log.Warn("Use Ctrl + C to stop running evironment")

	// launch proxy
	go func() {
		if err := proxy.ListenAndServe(); err != nil {
			if err == http.ErrServerClosed {
				log.WithField("component", "proxy").Debug("Shutdown")
			} else {
				log.WithField("component", "proxy").Debug(err)
			}
		}
	}()
}

func prepareProxy(address, handle string) error {

	log.WithField("compnent", "proxy").Debugf("%s --> %s", address, handle)

	origin, err := url.Parse(address)
	if err != nil {
		return err
	}

	proxy := httputil.NewSingleHostReverseProxy(origin)
	mux.HandleFunc(handle, func(w http.ResponseWriter, r *http.Request) {
		r.URL.Path = strings.TrimPrefix(r.URL.Path, handle)
		/*
			ctx, cancel := context.WithCancel(r.Context())
			defer cancel()
		*/
		// r = r.WithContext(context.Background())

		// route the req through proxy
		proxy.ServeHTTP(w, r)
	})

	return nil
}

func prepareData(hasuraCLI string, commandConfiguration []string, firstRun bool) error {

	log.Debug("Prearing migrations and metadata")

	var (
		cmdArgs []string
		execute exec.Cmd
		output  []byte
	)

	// If migrations directory is already mounted to nhost_hasura container,
	// then Hasura must be auto-applying migrations
	// hence, manually applying migrations doesn't make sense

	/*
		// create migrations
		cmdArgs = []string{hasuraCLI, "migrate", "apply"}
		cmdArgs = append(cmdArgs, commandConfiguration...)

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
	*/

	seed_files, err := ioutil.ReadDir(nhost.SEEDS_DIR)
	if err != nil {
		log.Error("Failed to read seeds directory")
		return err
	}

	// if there are more seeds than just enum tables,
	// apply them too
	if firstRun && len(seed_files) > 0 {

		log.Info("Applying seeds on first run")

		// apply seed data
		cmdArgs = []string{hasuraCLI, "seeds", "apply", "--database-name", "default"}
		cmdArgs = append(cmdArgs, commandConfiguration...)

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

		log.Debug("Exporting metadata")

		// export metadata
		cmdArgs = []string{hasuraCLI, "metadata", "export"}
		cmdArgs = append(cmdArgs, commandConfiguration...)

		execute = exec.Cmd{
			Path: hasuraCLI,
			Args: cmdArgs,
			Dir:  nhost.NHOST_DIR,
		}

		output, err = execute.CombinedOutput()
		if err != nil {
			log.Debug(string(output))
			return err
		}
	}

	// If metadata directory is already mounted to nhost_hasura container,
	// then Hasura must be auto-applying metadata
	// hence, manually applying metadata doesn't make sense

	/*
		// apply metadata
		cmdArgs = []string{hasuraCLI, "metadata", "apply"}
		cmdArgs = append(cmdArgs, commandConfiguration...)

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
	*/

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

	if err = client.ContainerStart(ctx, container.ID, types.ContainerStartOptions{}); err != nil {
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

func getContainerConfigs(client *client.Client) ([]map[string]interface{}, error) {

	log.Debug("Preparing Nhost container configurations")

	var containers []map[string]interface{}

	// segregate configurations for different services
	postgresConfig := configuration.Services["postgres"]
	hasuraConfig := configuration.Services["hasura"]
	storageConfig := configuration.Services["storage"]
	authConfig := configuration.Services["auth"]
	minioConfig := configuration.Services["minio"]
	mailhogConfig := configuration.Services["mailhog"]

	// check if a required image already exists
	// if it doesn't which case -> then pull it

	requiredImages := []string{}
	for _, service := range configuration.Services {
		requiredImages = append(requiredImages, fmt.Sprintf("%s:%v", service.Image, service.Version))
	}

	availableImages, err := getInstalledImages(client)
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

	// create mount points if they doesn't exist
	mountPoints := []mount.Mount{
		{
			Type:   mount.TypeBind,
			Source: filepath.Join(nhost.DOT_NHOST, "db_data"),
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
			/*
				Healthcheck: &container.HealthConfig{
					Test: []string{
						"CMD",
						"pg_isready",
						"-h",
						"localhost",
						"-p",
						"postgres",
						"-U",
						"postgres",
						"-d",
						"postgres",
					},
					Interval:    1000000000,
					Timeout:     10000000000,
					Retries:     10,
					StartPeriod: 60000000000,
				},
			*/
			Image: fmt.Sprintf(`%s:%v`, postgresConfig.Image, postgresConfig.Version),
			Env: []string{
				"POSTGRES_USER=postgres",
				"POSTGRES_PASSWORD=postgres",
			},
			ExposedPorts: nat.PortSet{nat.Port(fmt.Sprint(postgresConfig.Port)): struct{}{}},
			Cmd: []string{
				"-p",
				fmt.Sprint(postgresConfig.Port),
			},
		},
		"host_config": &container.HostConfig{
			// AutoRemove:   true,
			PortBindings: map[nat.Port][]nat.PortBinding{nat.Port(fmt.Sprintf("%v", postgresConfig.Port)): {{HostIP: "127.0.0.1", HostPort: fmt.Sprintf("%v", postgresConfig.Port)}}},
			RestartPolicy: container.RestartPolicy{
				Name: "always",
			},
			Mounts: mountPoints,
		},
	}

	// prepare env variables for following container
	containerVariables := []string{
		fmt.Sprintf("HASURA_GRAPHQL_SERVER_PORT=%v", hasuraConfig.Port),
		fmt.Sprintf("HASURA_GRAPHQL_DATABASE_URL=%v", fmt.Sprintf(`postgres://%v:%v@%s:%v/postgres`, "postgres", "postgres", getContainerName("postgres"), postgresConfig.Port)),
		"HASURA_GRAPHQL_ENABLE_CONSOLE=false",
		"HASURA_GRAPHQL_ENABLED_LOG_TYPES=startup, http-log, webhook-log, websocket-log, query-log",
		fmt.Sprintf("HASURA_GRAPHQL_ADMIN_SECRET=%v", hasuraConfig.AdminSecret),
		fmt.Sprintf("HASURA_GRAPHQL_MIGRATIONS_SERVER_TIMEOUT=%d", 20),
		fmt.Sprintf("HASURA_GRAPHQL_NO_OF_RETRIES=%d", 20),
		"HASURA_GRAPHQL_UNAUTHORIZED_ROLE=public",
		fmt.Sprintf("HASURA_GRAPHQL_JWT_SECRET=%v", fmt.Sprintf(`{"type":"HS256", "key": "%v"}`, jwtKey)),
	}
	containerVariables = append(containerVariables, envVars...)

	// append NHOST_FUNCTIONS env var
	if pathExists(nhost.API_DIR) {
		switch runtime.GOOS {
		case "darwin", "windows":
			containerVariables = append(containerVariables, fmt.Sprintf("NHOST_FUNCTIONS=http://host.docker.internal:%v/functions", port))
		case "linux":
			containerVariables = append(containerVariables, fmt.Sprintf("NHOST_FUNCTIONS=http://%v:%v/functions", getOutboundIP(), port))
		}
	}

	// create mount points if they doesn't exist
	mountPoints = []mount.Mount{
		{
			Type:   mount.TypeBind,
			Source: nhost.MIGRATIONS_DIR,
			Target: "/hasura-migrations",
		},
	}

	// parse the metadata directory tree
	meta_files, err := ioutil.ReadDir(nhost.METADATA_DIR)
	if err != nil {
		log.Error("Failed to parse the tree of metadata directory")
		return containers, err
	}

	// mount the metadata directory if meta files exist
	if len(meta_files) > 0 {
		mountPoints = append(mountPoints, mount.Mount{
			Type:   mount.TypeBind,
			Source: nhost.METADATA_DIR,
			Target: "/hasura-metadata",
		})
	}

	for _, mountPoint := range mountPoints {
		if err := os.MkdirAll(mountPoint.Source, os.ModePerm); err != nil {
			return containers, err
		}
	}

	hostConfig := &container.HostConfig{
		RestartPolicy: container.RestartPolicy{
			Name: "always",
		},
		PortBindings: map[nat.Port][]nat.PortBinding{
			nat.Port(strconv.Itoa(hasuraConfig.Port)): {{HostIP: "127.0.0.1", HostPort: strconv.Itoa(hasuraConfig.Port)}},
		},
		Mounts: mountPoints,
	}

	containerConfig := &container.Config{
		Image: fmt.Sprintf(`%s:%v`, hasuraConfig.Image, hasuraConfig.Version),
		Env:   containerVariables,
		ExposedPorts: nat.PortSet{
			nat.Port(strconv.Itoa(hasuraConfig.Port)): struct{}{},
		},
		// running following commands on launch were throwing errors,
		// server is running and responding absolutely fine without these commands
		//Cmd:          []string{"graphql-engine", "serve"},
	}

	/*
		// declare network mode = "host" in case of Linux
		switch runtime.GOOS {
		case "linux":
			hostConfig.NetworkMode = "host"
			containerConfig.Hostname = getContainerName("hasura")
		}
	*/

	hasuraContainer := map[string]interface{}{
		"name":        getContainerName("hasura"),
		"config":      containerConfig,
		"host_config": hostConfig,
	}

	// create mount points if they doesn't exit
	mountPoints = []mount.Mount{
		{
			Type:   mount.TypeBind,
			Source: filepath.Join(nhost.DOT_NHOST, "minio", "data"),
			Target: "/data",
		},
		{
			Type:   mount.TypeBind,
			Source: filepath.Join(nhost.DOT_NHOST, "minio", "config"),
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
			Image: fmt.Sprintf(`%s:%v`, minioConfig.Image, minioConfig.Version),
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
			// AutoRemove: true,
			PortBindings: map[nat.Port][]nat.PortBinding{
				nat.Port(strconv.Itoa(minioConfig.Port)): {{HostIP: "127.0.0.1",
					HostPort: strconv.Itoa(minioConfig.Port)}}},
			RestartPolicy: container.RestartPolicy{
				Name: "always",
			},
			Mounts: mountPoints,
		},
	}

	// prepare env variables for following container
	containerVariables = []string{
		fmt.Sprintf("HASURA_GRAPHQL_ADMIN_SECRET=%v", hasuraConfig.AdminSecret),
		fmt.Sprintf("HASURA_GRAPHQL_DATABASE_URL=%v", fmt.Sprintf(`postgres://%v:%v@%s:%v/postgres`, "postgres", "postgres", getContainerName("postgres"), postgresConfig.Port)),
		fmt.Sprintf("HASURA_GRAPHQL_GRAPHQL_URL=%v", fmt.Sprintf(`http://%s:%v/v1/graphql`, getContainerName("hasura"), hasuraConfig.Port)),
		fmt.Sprintf("HASURA_GRAPHQL_JWT_SECRET=%v", fmt.Sprintf(`{"type":"HS256", "key": "%v"}`, jwtKey)),
		fmt.Sprintf("AUTH_PORT=%v", authConfig.Port),
		fmt.Sprintf("AUTH_SERVER_URL=http://localhost:%v", authConfig.Port),
		fmt.Sprintf("AUTH_CLIENT_URL=http://localhost:%v", "3000"),

		// set the defaults
		"AUTH_LOG_LEVEL=info",
		"AUTH_HOST=0.0.0.0",
	}

	// append social auth credentials and other env vars
	containerVariables = append(containerVariables, appendEnvVars(configuration.Auth, "AUTH")...)

	// create mount point if it doesn't exit
	customMountPoint := filepath.Join(nhost.DOT_NHOST, "custom", "keys")
	if err = os.MkdirAll(customMountPoint, os.ModePerm); err != nil {
		log.Errorf("Failed to create %s directory", customMountPoint)
		return containers, err
	}

	authContainer := map[string]interface{}{
		"name": getContainerName("auth"),
		"config": &container.Config{
			Image:        fmt.Sprintf(`%s:%v`, authConfig.Image, authConfig.Version),
			Env:          containerVariables,
			ExposedPorts: nat.PortSet{nat.Port(strconv.Itoa(authConfig.Port)): struct{}{}},
		},
		"host_config": &container.HostConfig{
			PortBindings: map[nat.Port][]nat.PortBinding{
				nat.Port(strconv.Itoa(authConfig.Port)): {{HostIP: "127.0.0.1",
					HostPort: strconv.Itoa(authConfig.Port)}}},
			RestartPolicy: container.RestartPolicy{
				Name: "always",
			},
			Mounts: []mount.Mount{
				{
					Type:   mount.TypeBind,
					Source: filepath.Join(nhost.DOT_NHOST, "custom"),
					Target: "/app/custom",
				},
				{
					Type:   mount.TypeBind,
					Source: nhost.EMAILS_DIR,
					Target: "/app/email-templates",
				},
			},
		},
	}

	// prepare env variables for following container
	containerVariables = []string{
		fmt.Sprintf("STORAGE_PORT=%v", storageConfig.Port),
		fmt.Sprintf("STORAGE_PUBLIC_URL=http://localhost:%v", storageConfig.Port),
		"HASURA_GRAPHQL_GRAPHQL_URL=" + fmt.Sprintf(`http://%s:%v/v1/graphql`, getContainerName("hasura"), hasuraConfig.Port),
		fmt.Sprintf("HASURA_GRAPHQL_ADMIN_SECRET=%v", hasuraConfig.AdminSecret),
		fmt.Sprintf("HASURA_GRAPHQL_DATABASE_URL=%v", fmt.Sprintf(`postgres://%v:%v@%s:%v/postgres`, "postgres", "postgres", getContainerName("postgres"), postgresConfig.Port)),
		fmt.Sprintf("S3_ENDPOINT=http://%s:%v", getContainerName("minio"), minioConfig.Port),

		// additional default
		"S3_ACCESS_KEY=minioaccesskey123123",
		"S3_SECRET_KEY=minioaccesskey123123",
		"STORAGE_HOST=0.0.0.0",
		"STORAGE_STANDALONE_MODE=false",
		"STORAGE_LOG_LEVEL=info",
		"STORAGE_SWAGGER_ENABLED=false",
		"S3_SSL_ENABLED=false",
		"S3_BUCKET=nhost",
	}

	// append storage env vars
	containerVariables = append(containerVariables, appendEnvVars(configuration.Storage, "STORAGE")...)

	storageContainer := map[string]interface{}{
		"name": getContainerName("storage"),
		"config": &container.Config{
			Image:        fmt.Sprintf(`%s:%v`, storageConfig.Image, storageConfig.Version),
			Env:          containerVariables,
			ExposedPorts: nat.PortSet{nat.Port(strconv.Itoa(storageConfig.Port)): struct{}{}},
		},
		"host_config": &container.HostConfig{
			PortBindings: map[nat.Port][]nat.PortBinding{
				nat.Port(strconv.Itoa(storageConfig.Port)): {{HostIP: "127.0.0.1",
					HostPort: strconv.Itoa(storageConfig.Port)}}},
			RestartPolicy: container.RestartPolicy{
				Name: "always",
			},
		},
	}

	// prepare env variables for following container
	containerVariables = []string{}
	var smtpPort int
	switch t := configuration.Auth["email"].(type) {
	case map[interface{}]interface{}:
		for key, value := range t {
			if value != "" {
				if key.(string) == "smtp_host" {
					containerVariables = append(containerVariables, fmt.Sprintf("%v=%v", strings.ToUpper(fmt.Sprint(key)), getContainerName(value.(string))))
				} else {
					containerVariables = append(containerVariables, fmt.Sprintf("%v=%v", strings.ToUpper(fmt.Sprint(key)), value))
				}
				if key.(string) == "smtp_port" {
					smtpPort = value.(int)
				}
			}
		}
	}

	mailhogContainer := map[string]interface{}{
		"name": getContainerName("mailhog"),
		"config": &container.Config{
			Image: fmt.Sprintf(`%s:%v`, mailhogConfig.Image, mailhogConfig.Version),
			Env:   containerVariables,
			ExposedPorts: nat.PortSet{
				nat.Port(strconv.Itoa(smtpPort)):           struct{}{},
				nat.Port(strconv.Itoa(mailhogConfig.Port)): struct{}{},
			},
		},
		"host_config": &container.HostConfig{
			PortBindings: map[nat.Port][]nat.PortBinding{
				nat.Port(strconv.Itoa(smtpPort)): {{HostIP: "127.0.0.1",
					HostPort: strconv.Itoa(smtpPort)}},
				nat.Port(strconv.Itoa(mailhogConfig.Port)): {{HostIP: "127.0.0.1",
					HostPort: strconv.Itoa(mailhogConfig.Port)}},
			},
			RestartPolicy: container.RestartPolicy{
				Name: "always",
			},
		},
	}

	containers = append(containers, postgresContainer)
	containers = append(containers, minioContainer)

	// add depends_on for following containers
	containers = append(containers, hasuraContainer)
	containers = append(containers, authContainer)
	containers = append(containers, storageContainer)
	containers = append(containers, mailhogContainer)

	return containers, err
}
func getInstalledImages(client *client.Client) ([]types.ImageSummary, error) {
	log.Debug("Fetching available container images")
	images, err := client.ImageList(context.Background(), types.ImageListOptions{All: true})
	return images, err
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

func appendEnvVars(payload map[interface{}]interface{}, prefix string) []string {
	var response []string
	for key, item := range payload {
		switch item := item.(type) {
		/*
			case map[interface{}]interface{}:
				response = append(response, appendEnvVars(item, prefix)...)
		*/
		case map[interface{}]interface{}:
			for key, value := range item {
				switch value := value.(type) {
				case map[interface{}]interface{}:
					for newkey, newvalue := range value {
						if newvalue != "" {
							response = append(response, fmt.Sprintf("%s_%v_%v=%v", prefix, strings.ToUpper(fmt.Sprint(key)), strings.ToUpper(fmt.Sprint(newkey)), newvalue))
						}
					}
				case interface{}, string:
					if value != "" {
						if key.(string) == "smtp_host" {
							response = append(response, fmt.Sprintf("%s_%v=%v", prefix, strings.ToUpper(fmt.Sprint(key)), getContainerName(value.(string))))
						} else {
							response = append(response, fmt.Sprintf("%s_%v=%v", prefix, strings.ToUpper(fmt.Sprint(key)), value))
						}
					}
				}
			}
		case interface{}:
			if item != "" {
				response = append(response, fmt.Sprintf("%s_%v=%v", prefix, strings.ToUpper(fmt.Sprint(key)), item))
			}
		}
	}
	return response
}

// Get preferred outbound ip of this machine
func getOutboundIP() net.IP {
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err != nil {
		return nil
	}
	defer conn.Close()

	localAddr := conn.LocalAddr().(*net.UDPAddr)

	return localAddr.IP
}

func getContainerName(name string) string {
	return strings.Join([]string{nhost.PREFIX, name}, "_")
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
