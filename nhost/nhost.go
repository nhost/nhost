package nhost

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"os"
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
	"github.com/nhost/cli/util"
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

func InitLocations() error {

	//	if required directories don't exist, then create them
	for _, dir := range LOCATIONS.Directories {
		if err := os.MkdirAll(*dir, os.ModePerm); err != nil {
			return err
		}
		log.Debug("Created ", util.Rel(*dir))
	}

	//	#106: Don't create file if it already exists.
	//	Otherwise, it will reset the contents of the file.
	for _, file := range LOCATIONS.Files {
		if !util.PathExists(*file) {
			if _, err := os.Create(*file); err != nil {
				return err
			}
			log.Debug("Created ", util.Rel(*file))
		} else {
			log.Debug("Found existing ", util.Rel(*file))
		}
	}

	return nil
}

func (config *Configuration) Save() error {

	log.Debug("Saving app configuration")

	//  convert generated Nhost configuration to YAML
	marshalled, err := config.MarshalYAML()
	if err != nil {
		return err
	}

	f, err := os.Create(CONFIG_PATH)
	if err != nil {
		return err
	}

	defer f.Close()

	//  write the marshalled YAML configuration to file
	if _, err = f.Write(marshalled); err != nil {
		return err
	}

	f.Sync()

	return nil
}

//  Get the expected current DotNhost directory as per git branch head
func GetDotNhost() (string, error) {

	//  set default branch name
	branch := "main"

	//  If the current directory is a git repository,
	//  then read the branch name from HEAD
	if pathExists(GIT_DIR) {
		branch = GetCurrentBranch()
	}

	return filepath.Join(util.WORKING_DIR, ".nhost", branch), nil
}

func Env() ([]string, error) {

	data, err := ioutil.ReadFile(ENV_FILE)
	if err != nil {
		return nil, err
	}

	pairs := gotenv.Parse(strings.NewReader(string(data)))
	envs := []string{}

	//  split := strings.Split(string(data), "\n")
	for key, value := range pairs {
		envs = append(envs, fmt.Sprintf("%v=%v", key, value))
	}

	return envs, nil
}

func Exists() bool {
	return pathExists(NHOST_DIR)
}

//  validates whether a given folder/file path exists or not
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

	err = json.Unmarshal(file, &response)
	return response, err
}

//  fetches the required asset from release
//  depending on OS and Architecture
//  by matching download URL
func (release *Release) Asset() Asset {

	log.Debug("Extracting asset from release")

	payload := []string{"cli", release.TagName, runtime.GOOS, runtime.GOARCH}

	var response Asset

	for _, asset := range release.Assets {
		if strings.Contains(asset.BrowserDownloadURL, strings.Join(payload, "-")) {
			response = asset
			break
		}
	}

	return response
}

func (r *Release) MarshalJSON() ([]byte, error) {
	return json.Marshal(r)
}

//	Compares and updates the changelog for specified release
func (r *Release) Changes(releases []Release) (string, error) {

	var response string
	for _, item := range releases {
		item_time, _ := time.Parse(time.RFC3339, item.CreatedAt)
		release_time, _ := time.Parse(time.RFC3339, r.CreatedAt)

		//	If the release is older,
		//	update changelog
		if item_time.After(release_time) {
			response += item.Body
		}
	}

	return response, nil
}

//  Seaches for required release from supplied list of releases, and returns it.
func SearchRelease(releases []Release, version string) (Release, error) {

	log.Debug("Fetching latest release")

	var response Release

	//	If a custom version has been passed,
	//	search for that one ONLY.
	//	Otherwise, search for the latest release.
	//	If no release is found, return an error.
	//	If a release is found, return it.
	if version != "" {
		for _, item := range releases {
			if item.TagName == strings.ToLower(version) {
				return item, nil
			}
		}
		return response, errors.New("no such release found")

	} else {

		//	If no custom version has been passed,
		//	search for the latest release.
		//	If there are no releases, return an error.
		//	If there are releases, return the latest one.
		//	If there are multiple releases, return the latest one.

		//	Following loop is used under the assumption,
		//	that GitHub's API will always return release list,
		//	in descending order of timestamps.
		//	That is, the latest release being on index 0.
		for _, item := range releases {

			//	Else, search for latest release fit for public use.
			//	Following code has been commented because we are shifting
			//	from "internal" releases to pre-releases.
			/*
						if !strings.Contains(item.TagName, "internal") {
						   				return item, nil
				   			}
			*/

			//	Skip the pre-releases.
			if !item.Prerelease {
				return item, nil
			}
		}
	}

	if len(releases) == 0 {
		return response, errors.New("no release found")
	}

	return releases[0], nil
}

//	Downloads the list of all releases from GitHub API
func GetReleases() ([]Release, error) {

	log.Debug("Fetching list of all releases")

	var array []Release

	resp, err := http.Get("https://cli.nhost.io/releases.json")
	if err != nil {
		return array, err
	}

	//  read our opened xmlFile as a byte array.
	body, _ := ioutil.ReadAll(resp.Body)
	defer resp.Body.Close()
	json.Unmarshal(body, &array)
	return array, nil
}

//  fetches the list of Nhost production servers
func Servers() ([]Server, error) {

	log.Debug("Fetching server locations")

	var response []Server

	resp, err := http.Get(API + "/custom/cli/get-server-locations")
	if err != nil {
		return response, err
	}

	//  read our opened xmlFile as a byte array.
	body, _ := ioutil.ReadAll(resp.Body)

	defer resp.Body.Close()

	var res map[string]interface{}
	//  we unmarshal our body byteArray which contains our
	//  jsonFile's content into 'server' strcuture
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

	//  Parse additional services against supplied payload
	for _, name := range SERVICES {

		//  If no such service exists in the environment configuration,
		//  then initialize the structure for it
		if parsed.Services[name] == nil {
			parsed.Services[name] = &Service{}
		}

		if c.Services[name] != nil && c.Services[name].ID != "" {
			parsed.Services[name].ID = c.Services[name].ID
		}

		parsed.Services[name].Name = GetContainerName(name)

		/*
			//  Initialize the channel to send out [de/]activation
			//  signals to whoever needs to listen for these signals
			if parsed.Services[name].Active == nil {
				parsed.Services[name].Active = make(chan bool, 10)
			}
		*/

		switch name {
		case "minio":

			if parsed.Services[name].Port == 0 {
				parsed.Services[name].Port = util.GetPort(8200, 8500)
			}

			if parsed.Services[name].Version == nil {
				parsed.Services[name].Version = "RELEASE.2021-09-24T00-24-24Z"
			}

			if parsed.Services[name].Image == "" {
				parsed.Services[name].Image = "minio/minio"
			}

		case "mailhog":

			if parsed.Services[name].Port == 0 {
				parsed.Services[name].Port = util.GetPort(8800, 8900)
			}

			if parsed.Services[name].Version == nil {
				parsed.Services[name].Version = "v1.0.1"
			}

			if parsed.Services[name].Image == "" {
				parsed.Services[name].Image = "docker.io/mailhog/mailhog"
			}

		case "auth":

			if parsed.Services[name].Port == 0 {
				parsed.Services[name].Port = util.GetPort(9000, 9100)
			}

			if parsed.Services[name].Version == nil {
				parsed.Services[name].Version = "0.6.3"
			}

			if parsed.Services[name].Image == "" {
				parsed.Services[name].Image = "docker.io/nhost/hasura-auth"
			}

			if parsed.Services[name].HealthEndpoint == "" {
				parsed.Services[name].HealthEndpoint = "/healthz"
			}

		case "storage":

			if parsed.Services[name].Port == 0 {
				parsed.Services[name].Port = util.GetPort(8501, 8799)
			}

			if parsed.Services[name].Version == nil {
				parsed.Services[name].Version = "0.2.0"
			}

			if parsed.Services[name].Image == "" {
				parsed.Services[name].Image = "docker.io/nhost/hasura-storage"
			}

			if parsed.Services[name].HealthEndpoint == "" {
				parsed.Services[name].HealthEndpoint = "/healthz"
			}

		case "postgres":

			if parsed.Services[name].Port == 0 {
				parsed.Services[name].Port = util.GetPort(5000, 5999)
			}

			if parsed.Services[name].Version == nil {
				parsed.Services[name].Version = "12-v0.0.6"
			}

			if parsed.Services[name].Image == "" {
				parsed.Services[name].Image = "docker.io/nhost/postgres"
			}

		case "hasura":

			if parsed.Services[name].Port == 0 {
				parsed.Services[name].Port = util.GetPort(9200, 9300)
			}

			if parsed.Services[name].Version == nil {
				parsed.Services[name].Version = "v2.2.0"
			}

			if parsed.Services[name].Image == "" {
				parsed.Services[name].Image = "docker.io/hasura/graphql-engine"
			}

			if parsed.Services[name].HealthEndpoint == "" {
				parsed.Services[name].HealthEndpoint = "/healthz"
			}
		}

		//	If no custom address is mentioned,
		//	save the default container address
		if parsed.Services[name].Address == "" {

			parsed.Services[name].Address = GetAddress(parsed.Services[name])

		} else {

			//	Do not launch the container if custom address exists
			log.WithField("service", parsed.Services[name]).Debug("Disabling container launch")
			parsed.Services[name].NoContainer = true
		}

		//  Initialize configuration for the service
		parsed.Services[name].InitConfig()
	}

	//  update the environment configuration
	*c = parsed
	return nil
}

//  Reset the service ID, port, address and any other fields
func (s *Service) Reset() {
	s.Lock()
	s.ID = ""
	s.Active = false
	s.Unlock()
}

//  Generate service address based on assigned port
func GetAddress(s *Service) string {

	switch s.Name {
	case GetContainerName("postgres"):
		return fmt.Sprintf(`postgres://%v:%v@%s:%v/postgres?sslmode=disable`, s.Environment["postgres_user"], s.Environment["postgres_password"], GetContainerName("postgres"), s.Port)
	default:
		if s.NoContainer {
			return s.Address
		} else {
			return fmt.Sprintf("http://localhost:%v", s.Port)
		}
	}
}

//  start a fresh container in background and connect it to specified network
func (s *Service) Run(client *client.Client, ctx context.Context, networkID string) error {

	//	If a remote service is being used,
	//	and no container needs to be launched,
	//	then don't create or start the container.
	if !s.NoContainer {

		//  first search if the container already exists
		//  if it does, use that one
		if s.ID != "" {

			log.WithFields(logrus.Fields{
				"type":      "container",
				"component": s.Name,
			}).Debug("Starting")
			return client.ContainerStart(ctx, s.ID, types.ContainerStartOptions{})

		} else {

			//  if the container doesn't already exist,
			//  create a new one and attach it to the network

			log.WithFields(logrus.Fields{
				"type":      "container",
				"component": s.Name,
			}).Debug("Creating")

			service, err := client.ContainerCreate(ctx, s.Config, s.HostConfig, nil, nil, s.Name)
			if err != nil {
				return err
			}

			//  Save the it's ID for future use
			s.ID = service.ID

			//  Connect the newly created container to Nhost docker network
			if err := client.NetworkConnect(ctx, networkID, s.ID, nil); err != nil {
				return err
			}

			//  Start the newly created container
			return s.Run(client, ctx, networkID)

		}
	}
	/*
		//  avoid using the code below if you want to run the containers in background

		statusCh, errCh := client.ContainerWait(ctx, cont.ID, container.WaitConditionNotRunning)
		select {
		case err := <-errCh:
			if err != nil {
				return err
			}
		case <-statusCh:
		}
	*/
	return nil
}

//  Fetches container's configuration, mount points and host configuration,
//  and validates them against configuration initialized by Nhost for it's respective service.
func (s *Service) Inspect(client *client.Client, ctx context.Context) error {

	log.WithFields(logrus.Fields{
		"type":      "container",
		"component": s.Name,
	}).Debug("Inspecting")

	data, err := client.ContainerInspect(ctx, s.ID)
	if err != nil {
		return err
	}

	//  Validate the fetched configuration against the loaded one
	if data.Config == s.Config && data.HostConfig == s.HostConfig {
		return nil
	}

	return errors.New("invalid configuration")
}

//  Checks whether the service's container already exists. Returns container ID string if true.
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
		//  AutoRemove:   true,
		PortBindings: map[nat.Port][]nat.PortBinding{nat.Port(fmt.Sprintf("%v", s.Port)): {{HostIP: "127.0.0.1", HostPort: fmt.Sprintf("%v", s.Port)}}},
		RestartPolicy: container.RestartPolicy{
			Name: "always",
		},
		//  running following commands on launch were throwing errors,
		//  server is running and responding absolutely fine without these commands
		//Cmd:          []string{"graphql-engine", "serve"},
	}
}

//  Sends out the activation signal
//  to whoever is listening,
//  or whichever resource is waiting for this signal
func (s *Service) Activate() {
	s.Lock()
	s.Active = true
	s.Unlock()
}

//  Sends out the de-activation signal
//  to whoever is listening,
//  or whichever resource is waiting for this signal
func (s *Service) Deactivate() {
	s.Lock()
	s.Active = false
	s.Unlock()
}

//  Stops given container
func (s *Service) Stop(client *client.Client, ctx context.Context) error {

	log.WithFields(logrus.Fields{
		"type":      "container",
		"component": s.Name,
	}).Debug("Stopping")

	timeout := 2 * time.Second
	return client.ContainerStop(ctx, s.ID, &timeout)
}

//  Removes given container
func (s *Service) Remove(client *client.Client, ctx context.Context) error {

	log.WithFields(logrus.Fields{
		"type":      "container",
		"component": s.Name,
	}).Debug("Removing")

	removeOptions := types.ContainerRemoveOptions{
		RemoveVolumes: true,
		//  RemoveLinks:   true,
		Force: true,
	}

	return client.ContainerRemove(ctx, s.ID, removeOptions)
}

func (config *Configuration) Init(port string) error {

	//
	//  This section initializes any environment variables,
	//  commands or mount points required by containers
	//

	log.Debug("Configuring services")

	//  segregate configurations for different services
	postgresConfig := config.Services["postgres"]
	hasuraConfig := config.Services["hasura"]
	storageConfig := config.Services["storage"]
	authConfig := config.Services["auth"]
	minioConfig := config.Services["minio"]
	mailhogConfig := config.Services["mailhog"]

	//  load .env.development
	devVars, _ := Env()

	//  properly log the location from where you are mounting the data
	dataTarget, _ := filepath.Rel(util.WORKING_DIR, DOT_NHOST)
	log.WithField("service", "data").Debugln("Mounting data from ", dataTarget)

	//  create mount point if it doesn't exist
	sourceDir := filepath.Join(DOT_NHOST, "db_data")
	targetDir := "/var/lib/postgresql/data"

	if err := os.MkdirAll(sourceDir, os.ModePerm); err != nil {
		return err
	}

	postgresConfig.Config.Cmd = []string{"-p", fmt.Sprint(config.Services["postgres"].Port)}
	postgresConfig.HostConfig.Binds = []string{fmt.Sprintf("%s:%s:Z", sourceDir, targetDir)}

	var pgUser, pgPass string

	//  append service specific environment variables
	for key, value := range postgresConfig.Environment {
		postgresConfig.Config.Env = append(postgresConfig.Config.Env, fmt.Sprintf("%v=%v", strings.ToUpper(key), value))

		switch strings.ToLower(key) {
		case "postgres_user":
			pgUser = value.(string)
		case "postgres_password":
			pgPass = value.(string)
		}
	}

	//
	//	Backward compatibility for CLI < v0.6.
	//
	//	If the environment interface is nil,
	//	then initialize a blank one.
	if config.Services["postgres"].Environment == nil {
		config.Services["postgres"].Environment = make(map[string]interface{})
	}
	//
	//	If credentials are not available in config.yaml,
	//	add the default ones.
	if pgUser == "" {
		config.Services["postgres"].Environment["postgres_user"] = DB_USER
		postgresConfig.Config.Env = append(postgresConfig.Config.Env, fmt.Sprintf("%v=%v", strings.ToUpper("postgres_user"), DB_USER))
	}

	if pgPass == "" {
		config.Services["postgres"].Environment["postgres_password"] = DB_PASSWORD
		postgresConfig.Config.Env = append(postgresConfig.Config.Env, fmt.Sprintf("%v=%v", strings.ToUpper("postgres_password"), DB_PASSWORD))
	}

	//	Update the service address
	config.Services["postgres"].Address = GetAddress(config.Services["postgres"])

	//  prepare env variables for following container
	containerVariables := []string{
		fmt.Sprintf("HASURA_GRAPHQL_SERVER_PORT=%v", config.Services["hasura"].Port),
		fmt.Sprintf("HASURA_GRAPHQL_DATABASE_URL=%v", config.Services["postgres"].Address),
		"HASURA_GRAPHQL_ENABLE_CONSOLE=false",
		"HASURA_GRAPHQL_ENABLED_LOG_TYPES=startup, http-log, webhook-log, websocket-log, query-log",
		fmt.Sprintf("HASURA_GRAPHQL_MIGRATIONS_SERVER_TIMEOUT=%d", 20),
		fmt.Sprintf("HASURA_GRAPHQL_NO_OF_RETRIES=%d", 20),
		"HASURA_GRAPHQL_UNAUTHORIZED_ROLE=public",
	}

	//	Append .env.development variables
	containerVariables = append(containerVariables, devVars...)

	//  Append service specific environment variables
	for key, value := range hasuraConfig.Environment {
		containerVariables = append(containerVariables, fmt.Sprintf("%v=%v", strings.ToUpper(key), value))
	}

	//  Append network based runtime variables,
	//  to allow NHOST FUNCTIONS, and other addresses,
	//	to be reachable from Hasura Event Triggers.
	//  This is being done over here, because development proxy port is required.
	containerVariables = append(
		containerVariables,
		util.MapToStringArray(util.RuntimeVars(port, true))...,
	)

	/*
		//  create mount points if they doesn't exist
		mountPoints = []mount.Mount{
				{
					Type:   mount.TypeBind,
					Source: MIGRATIONS_DIR,
					Target: "/hasura-migrations",
				},
		}

					//  parse the metadata directory tree
					meta_files, err := ioutil.ReadDir(METADATA_DIR)
					if err != nil {
						status.Errorln("Failed to parse the tree of metadata directory")
						return err
					}

					//  mount the metadata directory if meta files exist
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

	//  create mount points if they doesn't exit
	mountPoints := []mount.Mount{
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

	var minioUser, minioPass string

	//  append service specific environment variables
	for key, value := range minioConfig.Environment {
		minioConfig.Config.Env = append(minioConfig.Config.Env, fmt.Sprintf("%v=%v", strings.ToUpper(key), value))

		switch strings.ToLower(key) {
		case "minio_root_user":
			minioUser = value.(string)
		case "minio_root_password":
			minioPass = value.(string)
		}
	}

	//
	//	Backward compatibility for CLI < v0.6.
	//
	//	If the environment interface is nil,
	//	then initialize a blank one.
	if config.Services["minio"].Environment == nil {
		config.Services["minio"].Environment = make(map[string]interface{})
	}
	//
	//	If credentials are not available in config.yaml,
	//	add the default ones.
	if minioUser == "" {
		config.Services["minio"].Environment["minio_root_user"] = MINIO_USER
		minioConfig.Config.Env = append(minioConfig.Config.Env, fmt.Sprintf("%v=%v", strings.ToUpper("minio_root_user"), MINIO_USER))
	}

	if minioPass == "" {
		config.Services["minio"].Environment["minio_root_password"] = MINIO_PASSWORD
		minioConfig.Config.Env = append(minioConfig.Config.Env, fmt.Sprintf("%v=%v", strings.ToUpper("minio_root_password"), MINIO_PASSWORD))
	}

	//	Update the service address
	config.Services["minio"].Address = GetAddress(config.Services["minio"])

	minioConfig.Config.Cmd = []string{
		"-c",
		fmt.Sprintf(`mkdir -p /data/nhost && /opt/bin/minio server --address :%v /data`, config.Services["minio"].Port),
	}

	//User:  "999:1001",
	minioConfig.Config.Entrypoint = []string{"sh"}

	//  prepare env variables for following container
	containerVariables = []string{
		fmt.Sprintf("HASURA_GRAPHQL_DATABASE_URL=%v", config.Services["postgres"].Address),
		fmt.Sprintf(`HASURA_GRAPHQL_GRAPHQL_URL=http://%s:%v/v1/graphql`, config.Services["hasura"].Name, config.Services["hasura"].Port),
		fmt.Sprintf("AUTH_PORT=%v", config.Services["auth"].Port),
		fmt.Sprintf("AUTH_SERVER_URL=http://localhost:%v/v1/auth", port),
		fmt.Sprintf("AUTH_CLIENT_URL=%v", config.Auth["client_url"]),

		//  set the defaults
		"AUTH_LOG_LEVEL=info",
		"AUTH_HOST=0.0.0.0",
	}

	//	Append runtime variables
	containerVariables = append(
		containerVariables,
		util.MapToStringArray(util.RuntimeVars(port, true))...,
	)

	//  append social auth credentials and other env vars
	containerVariables = append(containerVariables, ParseEnvVarsFromConfig(config.Auth, "AUTH")...)

	//  append service specific environment variables
	for key, value := range authConfig.Environment {
		containerVariables = append(containerVariables, fmt.Sprintf("%v=%v", strings.ToUpper(key), value))
	}

	//  create mount point if it doesn't exit
	customMountPoint := filepath.Join(DOT_NHOST, "custom", "keys")
	if err := os.MkdirAll(customMountPoint, os.ModePerm); err != nil {
		status.Errorln(fmt.Sprintf("Failed to create %s directory", customMountPoint))
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

	//  prepare env variables for following container
	containerVariables = []string{
        fmt.Sprintf("BIND=:%d", config.Services["storage"].Port),
		fmt.Sprintf("PUBLIC_URL=http://localhost:%d", config.Services["storage"].Port),

		"HASURA_METADATA=1",
		fmt.Sprintf(`HASURA_ENDPOINT=http://%s:%d/v1`, config.Services["hasura"].Name, config.Services["hasura"].Port),
		fmt.Sprintf("HASURA_GRAPHQL_ADMIN_SECRET=%s", util.ADMIN_SECRET),

		fmt.Sprintf("S3_ACCESS_KEY=%s", minioConfig.Environment["minio_root_user"]),
		fmt.Sprintf("S3_SECRET_KEY=%s", minioConfig.Environment["minio_root_password"]),
		"S3_BUCKET=nhost",

		"POSTGRES_MIGRATIONS=1",
        "POSTGRES_MIGRATIONS_SOURCE="+ GetAddress(config.Services["postgres"]),
	}

	//	Add S3 endpoint
	if config.Services["minio"].NoContainer {
		containerVariables = append(
			containerVariables,
			fmt.Sprintf("S3_ENDPOINT=%s", config.Services["minio"].Address),
		)
	} else {
		containerVariables = append(
			containerVariables,
			fmt.Sprintf("S3_ENDPOINT=http://%s:%v", config.Services["minio"].Name, config.Services["minio"].Port),
		)
	}

	//	Append runtime variables
	containerVariables = append(
		containerVariables,
		util.MapToStringArray(util.RuntimeVars(port, true))...,
	)

	//  append service specific environment variables
	for key, value := range storageConfig.Environment {
		containerVariables = append(containerVariables, fmt.Sprintf("%v=%v", strings.ToUpper(key), value))
	}

	//  append storage env vars
	containerVariables = append(containerVariables, ParseEnvVarsFromConfig(config.Storage, "STORAGE")...)
	storageConfig.Config.Env = containerVariables
	storageConfig.Config.Cmd = []string{
		"serve",
	}

	//  prepare env variables for following container
	//	containerVariables = appenddevVars(config.Auth["smtp"].(map[interface{}]interface{}), "SMTP")
	var smtpPort int
	for _, item := range authVars {
		payload := strings.Split(item, "=")
		if payload[0] == "AUTH_SMTP_PORT" {
			smtpPort, _ = strconv.Atoi(payload[1])
		}

		//	If the SMTP server address inside config.yaml
		//	doesn't match the container name,
		//	i.e. it is a custom server address,
		//	then don't launch the mailhog container
		if payload[0] == "AUTH_SMTP_HOST" && payload[1] != GetContainerName("mailhog") {
			log.WithField("service", "mailhog").Debug("Disabling container launch")
			config.Services["mailhog"].NoContainer = true
		}
	}

	//	If the SMTP port is busy,
	//	choose a random one
	if !util.PortAvailable(strconv.Itoa(smtpPort)) {
		log.WithField("component", "smtp").Errorf("Port %v not available", smtpPort)
		log.WithField("component", "smtp").Info("Change your SMTP port in ./nhost/config.yaml")
		return fmt.Errorf("SMTP port %v not available", smtpPort)
		/*
			smtpPort = util.GetPort(1000, 1999)
			log.WithField("component", "smtp").Debugf("Running SMTP server on port %s", smtpPort)
		*/
	}

	//  append service specific environment variables
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

//  fetches the logs of a specific container
//  and writes them to a log file
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

//  generates fresh config.yaml for /nhost dir
func GenerateConfig(options App) Configuration {

	log.Debug("Generating app configuration")

	hasura := Service{
		Environment: map[string]interface{}{
			"hasura_graphql_enable_remote_schema_permissions": false,
		},
	}

	postgres := Service{
		Environment: map[string]interface{}{
			"postgres_user":     DB_USER,
			"postgres_password": DB_PASSWORD,
		},
	}

	minio := Service{
		Environment: map[string]interface{}{
			"minio_root_user":     MINIO_USER,
			"minio_root_password": MINIO_PASSWORD,
		},
	}

	//	This is no longer required from Hasura >= v2.1.0,
	//	because it officially supports Apple Silicon machines.
	//
	//	Hasura's image is still not natively working on Apple Silicon.
	//	If it's an Apple Silicon processor,
	//	then add the custom Hasura image, as a temporary fix.
	/*
		if runtime.GOOS == "darwin" && runtime.GOARCH == "arm64" {
			hasura.Image = "fedormelexin/graphql-engine-arm64"
		}
	*/

	return Configuration{
		Version: 3,
		Services: map[string]*Service{
			"hasura":   &hasura,
			"postgres": &postgres,
			"minio":    &minio,
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
				"default_role":          "user",
				"default_allowed_roles": "user,me",
				"allowed_roles":         "user,me",
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
				"host":   GetContainerName("mailhog"),
				"port":   util.GetPort(1000, 1999),
				"user":   "user",
				"pass":   "password",
				"sender": "hasura-auth@example.com",
				"method": "",
				"secure": false,
			},
			"email": map[interface{}]interface{}{
				"enabled":                        false,
				"signin_email_verified_required": true,
				"template_fetch_url":             "",
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

//  fetches saved credentials from auth file
func LoadCredentials() (Credentials, error) {

	log.Debug("Fetching saved auth credentials")

	//  we initialize our credentials array
	var credentials Credentials

	//  Open our jsonFile
	jsonFile, err := os.Open(AUTH_PATH)
	//  if we os.Open returns an error then handle it
	if err != nil {
		return credentials, err
	}

	//  defer the closing of our jsonFile so that we can parse it later on
	defer jsonFile.Close()

	//  read our opened xmlFile as a byte array.
	byteValue, err := ioutil.ReadAll(jsonFile)
	if err != nil {
		return credentials, err
	}

	//  we unmarshal our byteArray which contains our
	//  jsonFile's content into 'credentials' which we defined above
	err = json.Unmarshal(byteValue, &credentials)

	return credentials, err
}
