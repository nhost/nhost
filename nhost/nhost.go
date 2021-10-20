package nhost

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"

	"strings"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/client"
	"github.com/docker/go-connections/nat"
	"github.com/koding/websocketproxy"
	"github.com/sirupsen/logrus"
	"github.com/subosito/gotenv"

	"gopkg.in/yaml.v2"
)

func (r *Project) MarshalYAML() ([]byte, error) {
	return yaml.Marshal(r)
}

func (r *Project) MarshalJSON() ([]byte, error) {
	return json.Marshal(r)
}

func (r *Configuration) MarshalYAML() ([]byte, error) {
	return yaml.Marshal(r)
}

func (r *Configuration) MarshalJSON() ([]byte, error) {
	return json.Marshal(r)
}

func (config *Configuration) Save() error {

	log.Debug("Saving app configuration")

	// convert generated Nhost configuration to YAML
	marshalled, err := config.MarshalYAML()
	if err != nil {
		return err
	}

	f, err := os.Create(CONFIG_PATH)
	if err != nil {
		return err
	}

	defer f.Close()

	// write the marshalled YAML configuration to file
	if _, err = f.Write(marshalled); err != nil {
		return err
	}

	f.Sync()

	return nil
}

// Get the expected current DotNhost directory as per git branch head
func GetDotNhost() (string, error) {

	// set default branch name
	branch := "main"

	// If the current directory is a git repository,
	// then read the branch name from HEAD
	if pathExists(GIT_DIR) {
		branch = GetCurrentBranch()
	}

	return filepath.Join(WORKING_DIR, ".nhost", branch), nil
}

func Env() ([]string, error) {

	data, err := ioutil.ReadFile(ENV_FILE)
	if err != nil {
		return nil, err
	}

	pairs := gotenv.Parse(strings.NewReader(string(data)))
	envs := []string{}

	// split := strings.Split(string(data), "\n")
	for key, value := range pairs {
		envs = append(envs, fmt.Sprintf("%v=%v", key, value))
	}

	return envs, nil
}

func Exists() bool {
	return pathExists(NHOST_DIR)
}

// validates whether a given folder/file path exists or not
func pathExists(filePath string) bool {
	_, err := os.Stat(filePath)
	return err == nil
}

func Info() (App, error) {

	log.Debug("Fetching app information")

	var response App

	file, err := ioutil.ReadFile(INFO_PATH)
	if err != nil {
		return response, err
	}

	err = yaml.Unmarshal(file, &response)
	return response, err
}

// fetches the required asset from release
// depending on OS and Architecture
// by matching download URL
func (release *Release) Asset() Asset {

	log.Debug("Extracting asset from release")

	payload := []string{"nhost", release.TagName, runtime.GOOS, runtime.GOARCH}

	var response Asset

	for _, asset := range release.Assets {
		if strings.Contains(asset.BrowserDownloadURL, strings.Join(payload, "-")) {
			response = asset
			break
		}
	}

	return response
}

// fetches the details of latest binary release
func LatestRelease(source string) (Release, error) {

	log.Debug("Fetching latest release")

	var response Release

	resp, err := http.Get(fmt.Sprintf("https://api.github.com/repos/%v/releases/latest", source))
	if err != nil {
		return response, err
	}

	// read our opened xmlFile as a byte array.
	body, _ := ioutil.ReadAll(resp.Body)

	defer resp.Body.Close()

	json.Unmarshal(body, &response)

	return response, nil
}

// fetches the list of Nhost production servers
func Servers() ([]Server, error) {

	log.Debug("Fetching server locations")

	var response []Server

	resp, err := http.Get(API + "/custom/cli/get-server-locations")
	if err != nil {
		return response, err
	}

	// read our opened xmlFile as a byte array.
	body, _ := ioutil.ReadAll(resp.Body)

	defer resp.Body.Close()

	var res map[string]interface{}
	// we unmarshal our body byteArray which contains our
	// jsonFile's content into 'server' strcuture
	err = json.Unmarshal(body, &res)
	if err != nil {
		return response, err
	}

	locations, err := json.Marshal(res["server_locations"])
	if err != nil {
		return response, err
	}

	err = json.Unmarshal(locations, &response)
	return response, err
}

func (c *Configuration) Wrap() error {

	log.Debug("Parsing app configuration")

	var parsed Configuration

	data, err := ioutil.ReadFile(CONFIG_PATH)
	if err != nil {
		return err
	}

	if err = yaml.Unmarshal(data, &parsed); err != nil {
		return err
	}

	// Parse additional services against supplied payload
	for _, name := range SERVICES {

		// If no such service exists in the environment configuration,
		// then initialize the structure for it
		if parsed.Services[name] == nil {
			parsed.Services[name] = &Service{}
		}

		if c.Services[name] != nil && c.Services[name].ID != "" {
			parsed.Services[name].ID = c.Services[name].ID
		}

		parsed.Services[name].Name = GetContainerName(name)

		/*
			// Initialize the channel to send out [de/]activation
			// signals to whoever needs to listen for these signals
			if parsed.Services[name].Active == nil {
				parsed.Services[name].Active = make(chan bool, 10)
			}
		*/

		switch name {
		case "minio":

			if parsed.Services[name].Port == 0 {
				parsed.Services[name].Port = GetPort(8200, 8500)
			}

			if parsed.Services[name].Version == nil {
				parsed.Services[name].Version = "RELEASE.2021-09-24T00-24-24Z"
			}

			parsed.Services[name].Image = "minio/minio"
			parsed.Services[name].HealthEndpoint = "/minio/health/live"

		case "mailhog":

			if parsed.Services[name].Port == 0 {
				parsed.Services[name].Port = GetPort(8800, 8900)
			}

			if parsed.Services[name].Version == nil {
				parsed.Services[name].Version = "v1.0.1"
			}

			parsed.Services[name].Image = "mailhog/mailhog"

		case "auth":

			if parsed.Services[name].Port == 0 {
				parsed.Services[name].Port = GetPort(9000, 9100)
			}

			if parsed.Services[name].Version == nil {
				parsed.Services[name].Version = "sha-6ebfe2b"
			}

			parsed.Services[name].Image = "nhost/hasura-auth"
			parsed.Services[name].HealthEndpoint = "/healthz"
			parsed.Services[name].Handles = []Route{
				{Name: "Authentication", Source: "/", Destination: "/v1/auth/", Show: true},
			}
			parsed.Services[name].Proxy = true

		case "storage":

			if parsed.Services[name].Port == 0 {
				parsed.Services[name].Port = GetPort(8501, 8799)
			}

			if parsed.Services[name].Version == nil {
				parsed.Services[name].Version = "sha-e7fc9c9"
			}

			parsed.Services[name].Image = "nhost/hasura-storage"
			parsed.Services[name].HealthEndpoint = "/healthz"
			parsed.Services[name].Handles = []Route{
				{Name: "Storage", Source: "/", Destination: "/v1/storage/", Show: true},
			}
			parsed.Services[name].Proxy = true

		case "postgres":

			if parsed.Services[name].Port == 0 {
				parsed.Services[name].Port = GetPort(5000, 5999)
			}

			parsed.Services[name].Image = "nhost/postgres"
			parsed.Services[name].Version = parsed.Services["postgres"].Version

		case "hasura":

			if parsed.Services[name].Port == 0 {
				parsed.Services[name].Port = GetPort(9200, 9300)
			}

			parsed.Services[name].Image = parsed.Services["hasura"].Image
			// parsed.Services[name].Version = fmt.Sprintf("%v.%s", parsed.Services["hasura"].Version, "cli-migrations-v3")
			parsed.Services[name].Version = parsed.Services["hasura"].Version
			parsed.Services[name].HealthEndpoint = "/healthz"
			parsed.Services[name].Handles = []Route{
				{Name: "GraphQL", Source: "/v1/graphql", Destination: "/v1/graphql", Show: true},
				{Name: "Query", Source: "/v2/query", Destination: "/v2/query"},
				{Name: "Metadata", Source: "/v1/metadata", Destination: "/v1/metadata"},
				{Name: "Config", Source: "/v1/config", Destination: "/v1/config"},
			}
			parsed.Services[name].Proxy = true
		}

		//	Update service address subject to their ports
		parsed.Services[name].Address = parsed.Services[name].GetAddress()

		// Initialize configuration for the service
		parsed.Services[name].InitConfig()
	}

	// update the environment configuration
	*c = parsed
	return nil
}

// Reset the service ID, port, address and any other fields
func (s *Service) Reset() {
	s.Lock()
	s.ID = ""
	s.Active = false
	s.Unlock()
}

// Generate service address based on assigned port
func (s *Service) GetAddress() string {

	switch s.Name {
	case GetContainerName("postgres"):
		return fmt.Sprintf(`postgres://%v:%v@%s:%v/postgres`, "postgres", "postgres", GetContainerName("postgres"), s.Port)
	default:
		return fmt.Sprintf("http://localhost:%v", s.Port)
	}
}

// start a fresh container in background and connect it to specified network
func (s *Service) Run(client *client.Client, ctx context.Context, networkID string) error {

	// first search if the container already exists
	// if it does, use that one
	if s.ID != "" {

		log.WithFields(logrus.Fields{
			"type":      "container",
			"component": s.Name,
		}).Debug("Starting")
		return client.ContainerStart(ctx, s.ID, types.ContainerStartOptions{})

	} else {

		// if the container doesn't already exist,
		// create a new one and attach it to the network

		log.WithFields(logrus.Fields{
			"type":      "container",
			"component": s.Name,
		}).Debug("Creating")

		service, err := client.ContainerCreate(ctx, s.Config, s.HostConfig, nil, nil, s.Name)
		if err != nil {
			return err
		}

		// Save the it's ID for future use
		s.ID = service.ID

		// Connect the newly created container to Nhost docker network
		if err := client.NetworkConnect(ctx, networkID, s.ID, nil); err != nil {
			return err
		}

		// Start the newly created container
		return s.Run(client, ctx, networkID)

	}
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

// Fetches container's configuration, mount points and host configuration,
// and validates them against configuration initialized by Nhost for it's respective service.
func (s *Service) Inspect(client *client.Client, ctx context.Context) error {

	log.WithFields(logrus.Fields{
		"type":      "container",
		"component": s.Name,
	}).Debug("Inspecting")

	data, err := client.ContainerInspect(ctx, s.ID)
	if err != nil {
		return err
	}

	// Validate the fetched configuration against the loaded one
	if data.Config == s.Config && data.HostConfig == s.HostConfig {
		return nil
	}

	return errors.New("invalid configuration")
}

// Checks whether the service's container already exists. Returns container ID string if true.
func (s *Service) Exists(client *client.Client, ctx context.Context) string {

	log.WithFields(logrus.Fields{
		"type":      "container",
		"component": s.Name,
	}).Debug("Searching")

	f := filters.NewArgs(filters.KeyValuePair{
		Key:   "name",
		Value: s.Name,
	})

	response, err := client.ContainerList(ctx, types.ContainerListOptions{
		All:     true,
		Filters: f,
	})
	if len(response) > 0 && err == nil {
		return response[0].ID
	}

	return ""
}

func (s *Service) Healthz() bool {

	resp, err := http.Get(s.Address + s.HealthEndpoint)
	if err != nil {
		return false
	}

	return resp.StatusCode == 200
}

//	Issues an HTTP and WS reverse proxy to the respective service.
//	Supports a custom connection multiplexer,
//	and custom request context.
func (s *Service) IssueProxy(mux *http.ServeMux, ctx context.Context) error {

	//	Loop over all handles to be proxied
	for _, item := range s.Handles {

		httpAddress := s.GetAddress()
		wsAddress := fmt.Sprintf("ws://localhost:%v", s.Port)

		httpOrigin, err := url.Parse(httpAddress)
		if err != nil {
			return err
		}

		if item.Source != "/" {
			httpAddress += item.Source
		}

		wsOrigin, err := url.Parse(wsAddress)
		if err != nil {
			return err
		}

		httpProxy := httputil.NewSingleHostReverseProxy(httpOrigin)
		wsProxy := websocketproxy.NewProxy(wsOrigin)

		log.WithFields(logrus.Fields{
			"value": s.Name,
			"type":  "proxy",
		}).Debugf("%s --> %s", httpAddress, item.Destination)

		mux.HandleFunc(item.Destination, func(w http.ResponseWriter, r *http.Request) {

			//	Log every incoming request
			log.WithFields(logrus.Fields{
				"component": "proxy",
				"method":    r.Method,
			}).Debug(r.URL.Path)

			//	If the supplied context is not nil,
			//	wrap the incoming request over the context
			if ctx != nil {
				r = r.WithContext(ctx)
			}

			//	If the client has passed Web-socket protocol header,
			//	then serve the request through web-socket proxy
			for item := range r.Header {
				if strings.ToLower(item) == "sec-websocket-protocol" {
					wsProxy.ServeHTTP(w, r)
					return
				}
			}

			//	Otherwise, serve it through normal HTTP proxy

			//	Get the original service URL without Nhost specific routes
			r.URL.Path = strings.ReplaceAll(r.URL.Path, item.Destination, item.Source)
			httpProxy.ServeHTTP(w, r)
		})
	}

	return nil
}

func (s *Service) InitConfig() {

	log.WithFields(logrus.Fields{
		"type":    "configuration",
		"service": s.Name,
	}).Debug("Initializing")

	s.Config = &container.Config{
		Image:        fmt.Sprintf(`%s:%v`, s.Image, s.Version),
		ExposedPorts: nat.PortSet{nat.Port(fmt.Sprint(s.Port)): struct{}{}},
	}
	s.HostConfig = &container.HostConfig{
		// AutoRemove:   true,
		PortBindings: map[nat.Port][]nat.PortBinding{nat.Port(fmt.Sprintf("%v", s.Port)): {{HostIP: "127.0.0.1", HostPort: fmt.Sprintf("%v", s.Port)}}},
		RestartPolicy: container.RestartPolicy{
			Name: "always",
		},
		// running following commands on launch were throwing errors,
		// server is running and responding absolutely fine without these commands
		//Cmd:          []string{"graphql-engine", "serve"},
	}
}

// Sends out the activation signal
// to whoever is listening,
// or whichever resource is waiting for this signal
func (s *Service) Activate() {
	s.Lock()
	s.Active = true
	s.Unlock()
}

// Sends out the de-activation signal
// to whoever is listening,
// or whichever resource is waiting for this signal
func (s *Service) Deactivate() {
	s.Lock()
	s.Active = false
	s.Unlock()
}

// Stops given container
func (s *Service) Stop(client *client.Client, ctx context.Context) error {

	log.WithFields(logrus.Fields{
		"type":      "container",
		"component": s.Name,
	}).Debug("Stopping")

	timeout := 2 * time.Second
	return client.ContainerStop(ctx, s.ID, &timeout)
}

// Removes given container
func (s *Service) Remove(client *client.Client, ctx context.Context) error {

	log.WithFields(logrus.Fields{
		"type":      "container",
		"component": s.Name,
	}).Debug("Removing")

	removeOptions := types.ContainerRemoveOptions{
		RemoveVolumes: true,
		// RemoveLinks:   true,
		Force: true,
	}

	return client.ContainerRemove(ctx, s.ID, removeOptions)
}

func (config *Configuration) Init(port string) error {

	//
	// This section initializes any environment variables,
	// commands or mount points required by containers
	//

	log.Debug("Configuring services")

	// segregate configurations for different services
	postgresConfig := config.Services["postgres"]
	hasuraConfig := config.Services["hasura"]
	storageConfig := config.Services["storage"]
	authConfig := config.Services["auth"]
	minioConfig := config.Services["minio"]
	mailhogConfig := config.Services["mailhog"]

	// load .env.development
	envVars, _ := Env()

	// properly log the location from where you are mounting the data
	dataTarget, _ := filepath.Rel(WORKING_DIR, DOT_NHOST)
	log.WithField("service", "data").Debugln("Mounting data from ", dataTarget)

	// create mount points if they doesn't exist
	mountPoints := []mount.Mount{
		{
			Type:   mount.TypeBind,
			Source: filepath.Join(DOT_NHOST, "db_data"),
			Target: "/var/lib/postgresql/data",
		},
	}

	for _, mountPoint := range mountPoints {
		if err := os.MkdirAll(mountPoint.Source, os.ModePerm); err != nil {
			return err
		}
	}

	postgresConfig.Config.Cmd = []string{"-p", fmt.Sprint(config.Services["postgres"].Port)}
	postgresConfig.HostConfig.Mounts = mountPoints
	postgresConfig.Config.Env = []string{
		"POSTGRES_USER=postgres",
		"POSTGRES_PASSWORD=postgres",
	}

	// append service specific environment variables
	for key, value := range postgresConfig.Environment {
		postgresConfig.Config.Env = append(postgresConfig.Config.Env, fmt.Sprintf("%v=%v", strings.ToUpper(key), value))
	}

	// prepare env variables for following container
	containerVariables := []string{
		fmt.Sprintf("HASURA_GRAPHQL_SERVER_PORT=%v", config.Services["hasura"].Port),
		fmt.Sprintf("HASURA_GRAPHQL_DATABASE_URL=%v", config.Services["postgres"].Address),
		"HASURA_GRAPHQL_ENABLE_CONSOLE=false",
		"HASURA_GRAPHQL_ENABLED_LOG_TYPES=startup, http-log, webhook-log, websocket-log, query-log",
		fmt.Sprintf("HASURA_GRAPHQL_ADMIN_SECRET=%v", ADMIN_SECRET),
		fmt.Sprintf("NHOST_ADMIN_SECRET=%v", ADMIN_SECRET),
		fmt.Sprintf("HASURA_GRAPHQL_MIGRATIONS_SERVER_TIMEOUT=%d", 20),
		fmt.Sprintf("HASURA_GRAPHQL_NO_OF_RETRIES=%d", 20),
		"HASURA_GRAPHQL_UNAUTHORIZED_ROLE=public",
		fmt.Sprintf("HASURA_GRAPHQL_JWT_SECRET=%v", fmt.Sprintf(`{"type":"HS256", "key": "%v"}`, JWT_KEY)),
		fmt.Sprintf("NHOST_JWT_SECRET=%v", fmt.Sprintf(`{"type":"HS256", "key": "%v"}`, JWT_KEY)),
		fmt.Sprintf("NHOST_WEBHOOK_SECRET=%v", WEBHOOK_SECRET),
	}
	containerVariables = append(containerVariables, envVars...)

	// append service specific environment variables
	for key, value := range hasuraConfig.Environment {
		containerVariables = append(containerVariables, fmt.Sprintf("%v=%v", strings.ToUpper(key), value))
	}

	// Append NHOST_FUNCTIONS env var to Hasura
	// to allow NHOST_FUNCTIONS to be reachable from Hasura Event Triggers.
	// This is being done over here, because development proxy port is required
	var localhost string
	switch runtime.GOOS {
	case "darwin", "windows":
		localhost = "host.docker.internal"
	default:
		localhost = fmt.Sprint(getOutboundIP())
	}
	containerVariables = append(
		containerVariables,
		fmt.Sprintf("NHOST_FUNCTIONS=http://%s:%v/v1/functions", localhost, port),
		fmt.Sprintf("LOCALHOST=http://%s", localhost),
		fmt.Sprintf("NHOST_BACKEND_URL=http://%s:%v", localhost, port),
	)

	/*
		// create mount points if they doesn't exist
		mountPoints = []mount.Mount{
				{
					Type:   mount.TypeBind,
					Source: MIGRATIONS_DIR,
					Target: "/hasura-migrations",
				},
		}

					// parse the metadata directory tree
					meta_files, err := ioutil.ReadDir(METADATA_DIR)
					if err != nil {
						log.Error("Failed to parse the tree of metadata directory")
						return err
					}

					// mount the metadata directory if meta files exist
					if len(meta_files) > 0 {
						mountPoints = append(mountPoints, mount.Mount{
							Type:   mount.TypeBind,
							Source: METADATA_DIR,
							Target: "/hasura-metadata",
						})
					}

				for _, mountPoint := range mountPoints {
					if err := os.MkdirAll(mountPoint.Source, os.ModePerm); err != nil {
						return err
					}
				}

			//hasuraConfig.HostConfig.Mounts = mountPoints
	*/
	//	hasuraConfig.HostConfig.Binds = []string{ENV_FILE + ":/env_file"}
	//	hasuraConfig.Config.Cmd = append(hasuraConfig.Config.Cmd, "export", "$(grep -v '^#' /env_file | xargs)")
	hasuraConfig.Config.Env = containerVariables

	// create mount points if they doesn't exit
	mountPoints = []mount.Mount{
		{
			Type:   mount.TypeBind,
			Source: filepath.Join(DOT_NHOST, "minio", "data"),
			Target: "/data",
		},
		{
			Type:   mount.TypeBind,
			Source: filepath.Join(DOT_NHOST, "minio", "config"),
			Target: "/.minio",
		},
	}

	for _, mountPoint := range mountPoints {
		if err := os.MkdirAll(mountPoint.Source, os.ModePerm); err != nil {
			return err
		}
	}

	minioConfig.HostConfig.Mounts = mountPoints
	minioConfig.Config.Env = []string{
		"MINIO_ROOT_USER=minioaccesskey123123",
		"MINIO_ROOT_PASSWORD=minioaccesskey123123",
	}

	// append service specific environment variables
	for key, value := range minioConfig.Environment {
		minioConfig.Config.Env = append(minioConfig.Config.Env, fmt.Sprintf("%v=%v", strings.ToUpper(key), value))
	}

	minioConfig.Config.Cmd = []string{
		"-c",
		fmt.Sprintf(`mkdir -p /data/nhost && /opt/bin/minio server --address :%v /data`, config.Services["minio"].Port),
	}
	//User:  "999:1001",
	minioConfig.Config.Entrypoint = []string{"sh"}

	// prepare env variables for following container
	containerVariables = []string{
		fmt.Sprintf("HASURA_GRAPHQL_ADMIN_SECRET=%v", ADMIN_SECRET),
		fmt.Sprintf("HASURA_GRAPHQL_DATABASE_URL=%v", config.Services["postgres"].Address),
		fmt.Sprintf("HASURA_GRAPHQL_GRAPHQL_URL=http://%s:%v/v1/graphql", config.Services["hasura"].Name, config.Services["hasura"].Port),
		fmt.Sprintf("HASURA_GRAPHQL_JWT_SECRET=%v", fmt.Sprintf(`{"type":"HS256", "key": "%v"}`, JWT_KEY)),
		fmt.Sprintf("AUTH_PORT=%v", config.Services["auth"].Port),
		fmt.Sprintf("AUTH_SERVER_URL=http://localhost:%v/v1/auth", port),
		//	fmt.Sprintf("AUTH_CLIENT_URL=http://localhost:%v", "3000"),
		fmt.Sprintf("AUTH_CLIENT_URL=%v", config.Auth["client_url"]),

		// set the defaults
		"AUTH_LOG_LEVEL=info",
		"AUTH_HOST=0.0.0.0",
	}

	// append social auth credentials and other env vars
	containerVariables = append(containerVariables, ParseEnvVarsFromConfig(config.Auth, "AUTH")...)

	// append service specific environment variables
	for key, value := range authConfig.Environment {
		containerVariables = append(containerVariables, fmt.Sprintf("%v=%v", strings.ToUpper(key), value))
	}

	// create mount point if it doesn't exit
	customMountPoint := filepath.Join(DOT_NHOST, "custom", "keys")
	if err := os.MkdirAll(customMountPoint, os.ModePerm); err != nil {
		log.Errorf("Failed to create %s directory", customMountPoint)
		return err
	}

	authVars := containerVariables
	authConfig.Config.Env = containerVariables
	authConfig.HostConfig.Mounts = []mount.Mount{
		{
			Type:   mount.TypeBind,
			Source: filepath.Join(DOT_NHOST, "custom"),
			Target: "/app/custom",
		},
		{
			Type:   mount.TypeBind,
			Source: EMAILS_DIR,
			Target: "/app/email-templates",
		},
	}

	// prepare env variables for following container
	containerVariables = []string{
		fmt.Sprintf("STORAGE_PORT=%v", config.Services["storage"].Port),
		fmt.Sprintf("STORAGE_PUBLIC_URL=%v", config.Services["storage"].Address),
		"HASURA_GRAPHQL_GRAPHQL_URL=" + fmt.Sprintf(`http://%s:%v/v1/graphql`, config.Services["hasura"].Name, config.Services["hasura"].Port),
		fmt.Sprintf("HASURA_GRAPHQL_ADMIN_SECRET=%v", ADMIN_SECRET),
		fmt.Sprintf("HASURA_GRAPHQL_DATABASE_URL=%v", config.Services["postgres"].Address),
		fmt.Sprintf("S3_ENDPOINT=http://%s:%v", config.Services["minio"].Name, config.Services["minio"].Port),

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

	// append service specific environment variables
	for key, value := range storageConfig.Environment {
		containerVariables = append(containerVariables, fmt.Sprintf("%v=%v", strings.ToUpper(key), value))
	}

	// append storage env vars
	containerVariables = append(containerVariables, ParseEnvVarsFromConfig(config.Storage, "STORAGE")...)
	storageConfig.Config.Env = containerVariables

	// prepare env variables for following container
	//	containerVariables = appendEnvVars(config.Auth["smtp"].(map[interface{}]interface{}), "SMTP")
	var smtpPort int
	for _, item := range authVars {
		payload := strings.Split(item, "=")
		if payload[0] == "AUTH_SMTP_PORT" {
			smtpPort, _ = strconv.Atoi(payload[1])
		}
	}

	//	If the SMTP port is busy,
	//	choose a random one
	if !PortAvaiable(strconv.Itoa(smtpPort)) {
		log.WithField("component", "smtp").Errorf("Port %s not available", smtpPort)
		log.WithField("component", "smtp").Info("Change your SMTP port in ./nhost/config.yaml")
		return fmt.Errorf("SMTP port %v not available", smtpPort)
		/*
			smtpPort = GetPort(1000, 1999)
			log.WithField("component", "smtp").Debugf("Running SMTP server on port %s", smtpPort)
		*/
	}

	// append service specific environment variables
	for key, value := range mailhogConfig.Environment {
		containerVariables = append(containerVariables, fmt.Sprintf("%v=%v", strings.ToUpper(key), value))
	}

	containerVariables = append(containerVariables,
		fmt.Sprintf("MH_SMTP_BIND_ADDR=0.0.0.0:%v", smtpPort),
		fmt.Sprintf("MH_UI_BIND_ADDR=0.0.0.0:%v", config.Services["mailhog"].Port),
		fmt.Sprintf("MH_API_BIND_ADDR=0.0.0.0:%v", config.Services["mailhog"].Port),
	)
	mailhogConfig.Config.Env = containerVariables
	mailhogConfig.HostConfig.PortBindings = map[nat.Port][]nat.PortBinding{
		nat.Port(strconv.Itoa(smtpPort)): {{HostIP: "127.0.0.1",
			HostPort: strconv.Itoa(smtpPort)}},
		nat.Port(strconv.Itoa(config.Services["mailhog"].Port)): {{HostIP: "127.0.0.1",
			HostPort: strconv.Itoa(config.Services["mailhog"].Port)}},
	}
	mailhogConfig.Config.ExposedPorts = nat.PortSet{
		nat.Port(strconv.Itoa(smtpPort)):                        struct{}{},
		nat.Port(strconv.Itoa(config.Services["mailhog"].Port)): struct{}{},
	}

	return nil
}

// fetches the logs of a specific container
// and writes them to a log file
func (s *Service) Logs(cli *client.Client, ctx context.Context) ([]byte, error) {

	log.WithFields(logrus.Fields{
		"type":      "container",
		"component": s.Name,
	}).Debug("Fetching logs")

	var response []byte

	options := types.ContainerLogsOptions{ShowStdout: true}

	out, err := cli.ContainerLogs(ctx, s.ID, options)
	if err != nil {
		return response, err
	}

	response, err = io.ReadAll(out)
	if err != nil {
		return response, err
	}

	return response, nil
}

func (s *Service) Exec(docker *client.Client, ctx context.Context, command []string) (types.IDResponse, error) {

	config := types.ExecConfig{
		AttachStderr: true,
		AttachStdout: true,
		Cmd:          command,
	}

	return docker.ContainerExecCreate(ctx, s.ID, config)
}

// generates fresh config.yaml for /nhost dir
func GenerateConfig(options App) Configuration {

	log.Debug("Generating app configuration")

	hasura := Service{
		Version: "v2.0.7",
		Image:   "hasura/graphql-engine",
		Environment: map[string]interface{}{
			"hasura_graphql_enable_remote_schema_permissions": false,
		},
	}

	/*
		// check if a loaded remote project has been passed
		if options.HasuraGQEVersion != "" {
			hasura.Version = options.HasuraGQEVersion
		}

		if options.PostgresVersion != "" {
			postgres.Version = options.PostgresVersion
		}
	*/

	postgres := Service{
		Version: "12-v0.0.6",
	}

	return Configuration{
		Version: 3,
		Services: map[string]*Service{
			"postgres": &postgres,
			"hasura":   &hasura,
		},
		MetadataDirectory: "metadata",
		Storage: map[interface{}]interface{}{
			"force_download_for_content_types": "text/html,application/javascript",
		},
		Auth: map[interface{}]interface{}{
			"client_url":              "http://localhost:3000",
			"anonymous_users_enabled": false,
			"disable_new_users":       false,
			"access_control": map[interface{}]interface{}{
				"url": map[interface{}]interface{}{
					"allowed_redirect_urls": "",
				},
				"email": map[interface{}]interface{}{
					"allowed_emails":        "",
					"allowed_email_domains": "",
					"blocked_emails":        "",
					"blocked_email_domains": "",
				},
			},
			"password": map[interface{}]interface{}{
				"min_length":   3,
				"hibp_enabled": false,
			},
			"user": map[interface{}]interface{}{
				"default_role":                   "user",
				"default_allowed_roles":          "user,me",
				"allowed_roles":                  "user,me",
				"signin_email_verified_required": true,
				"mfa": map[interface{}]interface{}{
					"enabled": false,
					"issuer":  "nhost",
				},
			},
			"token": map[interface{}]interface{}{
				"access": map[interface{}]interface{}{
					"expires_in": 900,
				},
				"refresh": map[interface{}]interface{}{
					"expires_in": 43200,
				},
			},
			"locale": map[interface{}]interface{}{
				"default": "en",
				"allowed": "en",
			},
			"smtp": map[interface{}]interface{}{
				"host":   PREFIX + "_mailhog",
				"port":   GetPort(1000, 1999),
				"user":   "user",
				"pass":   "password",
				"sender": "hasura-auth@example.com",
				"method": "",
				"secure": false,
			},
			"email": map[interface{}]interface{}{
				"enabled":            false,
				"template_fetch_url": "",
				"passwordless": map[interface{}]interface{}{
					"enabled": false,
				},
			},
			"sms": map[interface{}]interface{}{
				"enabled": false,
				"provider": map[interface{}]interface{}{
					"twilio": map[interface{}]interface{}{
						"account_sid":          "",
						"auth_token":           "",
						"messaging_service_id": "",
						"from":                 "",
					},
				},
				"passwordless": map[interface{}]interface{}{
					"enabled": false,
				},
			},
			"provider": generateProviders(),
			"gravatar": generateGravatarVars(),
		},
	}
}

func generateGravatarVars() map[string]interface{} {
	return map[string]interface{}{
		"enabled": true,
		"default": "",
		"rating":  "",
	}
}

func generateProviders() map[string]interface{} {

	return map[string]interface{}{
		"google": map[string]interface{}{
			"enabled":       false,
			"client_id":     "",
			"client_secret": "",
			"scope":         "email,profile",
		},
		"twilio": map[string]interface{}{
			"enabled":              false,
			"account_sid":          "",
			"auth_token":           "",
			"messaging_service_id": "",
		},
		"strava": map[string]interface{}{
			"enabled":       false,
			"client_id":     "",
			"client_secret": "",
		},
		"facebook": map[string]interface{}{
			"enabled":       false,
			"client_id":     "",
			"client_secret": "",
			"scope":         "email,photos,displayName",
		},
		"twitter": map[string]interface{}{
			"enabled":         false,
			"consumer_key":    "",
			"consumer_secret": "",
		},
		"linkedin": map[string]interface{}{
			"enabled":       false,
			"client_id":     "",
			"client_secret": "",
			"scope":         "r_emailaddress,r_liteprofile",
		},
		"apple": map[string]interface{}{
			"enabled":     false,
			"client_id":   "",
			"key_id":      "",
			"private_key": "",
			"team_id":     "",
			"scope":       "name,email",
		},
		"github": map[string]interface{}{
			"enabled":          false,
			"client_id":        "",
			"client_secret":    "",
			"token_url":        "",
			"user_profile_url": "",
			"scope":            "user:email",
		},
		"windows_live": map[string]interface{}{
			"enabled":       false,
			"client_id":     "",
			"client_secret": "",
			"scope":         "wl.basic,wl.emails,wl.contacts_emails",
		},
		"spotify": map[string]interface{}{
			"enabled":       false,
			"client_id":     "",
			"client_secret": "",
			"scope":         "user-read-email,user-read-private",
		},
		"gitlab": map[string]interface{}{
			"enabled":       false,
			"client_id":     "",
			"client_secret": "",
			"base_url":      "",
			"scope":         "read_user",
		},
		"bitbucket": map[string]interface{}{
			"enabled":       false,
			"client_id":     "",
			"client_secret": "",
		},
	}
}

func (s *Session) Spawn() {

	cmd := exec.Command(s.Command)

	if s.Log {
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
	}

	if s.Dir != "" {
		if filepath.IsAbs(s.Dir) {
			cmd.Dir = s.Dir
		} else {
			cmd.Dir = filepath.Join(WORKING_DIR, s.Dir)
		}
	}

	go cmd.Run()

	if s.Browser != "" {
		openbrowser(s.Browser)
	}
}

// fetches saved credentials from auth file
func LoadCredentials() (Credentials, error) {

	log.Debug("Fetching saved auth credentials")

	// we initialize our credentials array
	var credentials Credentials

	// Open our jsonFile
	jsonFile, err := os.Open(AUTH_PATH)
	// if we os.Open returns an error then handle it
	if err != nil {
		return credentials, err
	}

	// defer the closing of our jsonFile so that we can parse it later on
	defer jsonFile.Close()

	// read our opened xmlFile as a byte array.
	byteValue, err := ioutil.ReadAll(jsonFile)
	if err != nil {
		return credentials, err
	}

	// we unmarshal our byteArray which contains our
	// jsonFile's content into 'credentials' which we defined above
	err = json.Unmarshal(byteValue, &credentials)

	return credentials, err
}
