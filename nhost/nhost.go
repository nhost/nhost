package nhost

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
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
	"github.com/sirupsen/logrus"

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

	log.Debug("Saving project configuration")

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

func Env() ([]string, error) {

	log.Debug("Reading environment variables")

	data, err := ioutil.ReadFile(ENV_FILE)
	if err != nil {
		return nil, err
	}

	var response []string

	split := strings.Split(string(data), "\n")
	for _, item := range split {
		if strings.Contains(item, "=") {
			response = append(response, item)
		}
	}

	return response, nil
}

func Exists() bool {
	return pathExists(NHOST_DIR)
}

// validates whether a given folder/file path exists or not
func pathExists(filePath string) bool {
	_, err := os.Stat(filePath)
	return err == nil
}

func Info() (Information, error) {

	log.Debug("Fetching project information")

	var response Information

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

func Config() (Configuration, error) {

	log.Debug("Parsing project configuration")

	var response Configuration

	data, err := ioutil.ReadFile(CONFIG_PATH)
	if err != nil {
		return response, err
	}

	err = yaml.Unmarshal(data, &response)

	// add the additional services
	port := GetPort(8200, 8500)
	response.Services["minio"] = &Service{
		Image:          "minio/minio",
		Version:        "latest",
		Port:           port,
		Address:        fmt.Sprintf("http://localhost:%v", port),
		Name:           GetContainerName("minio"),
		HealthEndpoint: "/minio/health/live",
	}

	port = 8025
	response.Services["mailhog"] = &Service{
		Name:    GetContainerName("mailhog"),
		Image:   "mailhog/mailhog",
		Version: "latest",
		Port:    port,
		Address: fmt.Sprintf("http://localhost:%v", port),
	}

	port = GetPort(9000, 9100)
	response.Services["auth"] = &Service{
		Name:           GetContainerName("auth"),
		Image:          "nhost/hasura-auth",
		Version:        "sha-c68cd71",
		Port:           port,
		Address:        fmt.Sprintf("http://localhost:%v", port),
		Proxy:          true,
		Handle:         "/v1/auth/",
		HealthEndpoint: "/healthz",
	}

	port = GetPort(8501, 8999)
	response.Services["storage"] = &Service{
		Name:           GetContainerName("storage"),
		Image:          "nhost/hasura-storage",
		Version:        "sha-e7fc9c9",
		Port:           port,
		Address:        fmt.Sprintf("http://localhost:%v", port),
		Proxy:          true,
		Handle:         "/v1/storage/",
		HealthEndpoint: "/healthz",
	}

	// set the defaults
	port = GetPort(5000, 5999)
	response.Services["postgres"] = &Service{
		Name:    GetContainerName("postgres"),
		Image:   "nhost/postgres",
		Version: response.Services["postgres"].Version,
		Port:    port,
		Address: fmt.Sprintf(`postgres://%v:%v@%s:%v/postgres`, "postgres", "postgres", GetContainerName("postgres"), port),
	}

	port = GetPort(9200, 9300)
	response.Services["hasura"] = &Service{
		Name:    GetContainerName("hasura"),
		Image:   response.Services["hasura"].Image,
		Version: fmt.Sprintf("%v.%s", response.Services["hasura"].Version, "cli-migrations-v3"),
		// Version:     response.Services["hasura"].Version,
		AdminSecret:    response.Services["hasura"].AdminSecret,
		Port:           port,
		Address:        fmt.Sprintf("http://localhost:%v", port),
		Proxy:          true,
		Handle:         "/v1/graphql",
		HealthEndpoint: "/healthz",
	}

	// return the response
	return response, err
}

// start a fresh container in background and connect it to specified network
func (s *Service) Run(client *client.Client, ctx context.Context, networkID string) error {

	// first search if the container already exists
	// if it does, use that one
	s.ID = s.Exists(client, ctx)
	if s.ID == "" {

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

		if err := client.NetworkConnect(ctx, networkID, s.ID, nil); err != nil {
			return err
		}

	}
	/*
		else {

			// Inspect the container configuration
			if err := s.Inspect(client, ctx); err != nil {

				// If the configuration is invalid,
				// kill the container and create a new one
				if err := s.Remove(client, ctx); err != nil {
					return err
				} else {

					// Create a fresh container
					s.Run(client, ctx, networkID)
				}
			}
		}
	*/

	if err := client.ContainerStart(ctx, s.ID, types.ContainerStartOptions{}); err != nil {
		return err
	}

	return nil
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

	fmt.Println("fetched config", data.Config)
	fmt.Println("loaded config", s.Config)

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

// generates fresh config.yaml for /nhost dir
func GenerateConfig(options Project) Configuration {

	log.Debug("Generating project configuration")

	hasura := Service{
		Version:     "v2.0.7",
		Image:       "hasura/graphql-engine",
		AdminSecret: "hasura-admin-secret",
	}

	// check if a loaded remote project has been passed
	if options.HasuraGQEVersion != "" {
		hasura.Version = options.HasuraGQEVersion
	}

	postgres := Service{
		Version: "12-v0.0.6",
	}

	if options.PostgresVersion != "" {
		postgres.Version = options.PostgresVersion
	}

	return Configuration{
		Version: 3,
		Services: map[string]*Service{
			"postgres": &postgres,
			"hasura":   &hasura,
		},
		/*
			Environment: map[string]interface{}{
				// "env_file":           ENV_FILE,
				"hasura_cli_version": "v2.0.0-alpha.11",
			},
		*/
		MetadataDirectory: "metadata",
		Storage: map[interface{}]interface{}{
			"force_download_for_content_types": "text/html,application/javascript",
		},
		Auth: map[interface{}]interface{}{
			"providers": generateProviders(),
			"tokens":    generateTokenVars(),
			"signin":    generateSignInVars(),
			"signup":    generateSignUpVars(),
			"email":     generateEmailVars(),
			"gravatar":  generateGravatarVars(),
		},
	}
}

func (s *Service) Healthz() bool {

	for counter := 1; counter <= 240; counter++ {
		if valid := Check200(s.Address + s.HealthEndpoint); valid {
			return true
		}
		time.Sleep(1 * time.Second)
		log.WithFields(logrus.Fields{
			"type":      "container",
			"component": s.Name,
		}).Debugf("Health check attempt #%v unsuccessful", counter)
	}

	return false
}

func Check200(url string) bool {

	resp, err := http.Get(url)
	if err != nil {
		return false
	}

	return resp.StatusCode == 200
}

func (s *Service) IssueProxy(mux *http.ServeMux) error {

	address := s.Address
	if s.Name == GetContainerName("hasura") {
		address += "/v1/graphql"
	}

	log.WithFields(logrus.Fields{
		"value": s.Name,
		"type":  "proxy",
	}).Debugf("%s --> %s", address, s.Handle)

	origin, err := url.Parse(address)
	if err != nil {
		return err
	}

	proxy := httputil.NewSingleHostReverseProxy(origin)
	mux.HandleFunc(s.Handle, func(w http.ResponseWriter, r *http.Request) {
		r.URL.Path = strings.TrimPrefix(r.URL.Path, s.Handle)
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

func (s *Service) InitConfig() {

	log.WithFields(logrus.Fields{
		"type":      "container",
		"component": s.Name,
	}).Debug("Initializing configuration")

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

// stops given container
func (s *Service) Stop(client *client.Client, ctx context.Context) error {

	log.WithFields(logrus.Fields{
		"type":      "container",
		"component": s.Name,
	}).Debug("Stopping")

	timeout := 2 * time.Second
	return client.ContainerStop(ctx, s.ID, &timeout)
}

// removes given container
func (s *Service) Remove(client *client.Client, ctx context.Context) error {

	log.WithFields(logrus.Fields{
		"type":      "container",
		"component": s.Name,
	}).Debug("Removing")

	removeOptions := types.ContainerRemoveOptions{
		RemoveVolumes: true,
		Force:         true,
	}

	return client.ContainerRemove(ctx, s.ID, removeOptions)
}

func (config *Configuration) Init() error {

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
	postgresConfig.Config.Env = append(postgresConfig.Config.Env, []string{
		"POSTGRES_USER=postgres",
		"POSTGRES_PASSWORD=postgres",
	}...)

	// prepare env variables for following container
	containerVariables := []string{
		fmt.Sprintf("HASURA_GRAPHQL_SERVER_PORT=%v", config.Services["hasura"].Port),
		fmt.Sprintf("HASURA_GRAPHQL_DATABASE_URL=%v", config.Services["postgres"].Address),
		"HASURA_GRAPHQL_ENABLE_CONSOLE=false",
		"HASURA_GRAPHQL_ENABLED_LOG_TYPES=startup, http-log, webhook-log, websocket-log, query-log",
		fmt.Sprintf("HASURA_GRAPHQL_ADMIN_SECRET=%v", config.Services["hasura"].AdminSecret),
		fmt.Sprintf("HASURA_GRAPHQL_MIGRATIONS_SERVER_TIMEOUT=%d", 20),
		fmt.Sprintf("HASURA_GRAPHQL_NO_OF_RETRIES=%d", 20),
		"HASURA_GRAPHQL_UNAUTHORIZED_ROLE=public",
		fmt.Sprintf("HASURA_GRAPHQL_JWT_SECRET=%v", fmt.Sprintf(`{"type":"HS256", "key": "%v"}`, JWT_KEY)),
	}
	containerVariables = append(containerVariables, envVars...)

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

	hasuraConfig.HostConfig.Mounts = mountPoints
	hasuraConfig.Config.Env = append(hasuraConfig.Config.Env, containerVariables...)

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
	minioConfig.Config.Env = append(minioConfig.Config.Env, []string{
		"MINIO_ROOT_USER=minioaccesskey123123",
		"MINIO_ROOT_PASSWORD=minioaccesskey123123",
	}...)

	minioConfig.Config.Cmd = []string{
		"-c",
		fmt.Sprintf(`mkdir -p /data/nhost && /usr/bin/minio server --address :%v /data`, config.Services["minio"].Port),
	}
	//User:  "999:1001",
	minioConfig.Config.Entrypoint = []string{"sh"}

	// prepare env variables for following container
	containerVariables = []string{
		fmt.Sprintf("HASURA_GRAPHQL_ADMIN_SECRET=%v", config.Services["hasura"].AdminSecret),
		fmt.Sprintf("HASURA_GRAPHQL_DATABASE_URL=%v", config.Services["postgres"].Address),
		fmt.Sprintf("HASURA_GRAPHQL_GRAPHQL_URL=http://%s:%v/v1/graphql", config.Services["hasura"].Name, config.Services["hasura"].Port),
		fmt.Sprintf("HASURA_GRAPHQL_JWT_SECRET=%v", fmt.Sprintf(`{"type":"HS256", "key": "%v"}`, JWT_KEY)),
		fmt.Sprintf("AUTH_PORT=%v", config.Services["auth"].Port),
		fmt.Sprintf("AUTH_SERVER_URL=http://localhost:%v", config.Services["auth"].Port),
		fmt.Sprintf("AUTH_CLIENT_URL=http://localhost:%v", "3000"),

		// set the defaults
		"AUTH_LOG_LEVEL=info",
		"AUTH_HOST=0.0.0.0",
	}

	// append social auth credentials and other env vars
	containerVariables = append(containerVariables, appendEnvVars(config.Auth, "AUTH")...)

	// create mount point if it doesn't exit
	customMountPoint := filepath.Join(DOT_NHOST, "custom", "keys")
	if err = os.MkdirAll(customMountPoint, os.ModePerm); err != nil {
		log.Errorf("Failed to create %s directory", customMountPoint)
		return err
	}

	authConfig.Config.Env = append(authConfig.Config.Env, containerVariables...)
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
		fmt.Sprintf("HASURA_GRAPHQL_ADMIN_SECRET=%v", config.Services["hasura"].AdminSecret),
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

	// append storage env vars
	containerVariables = append(containerVariables, appendEnvVars(config.Storage, "STORAGE")...)
	storageConfig.Config.Env = append(storageConfig.Config.Env, containerVariables...)

	// prepare env variables for following container
	containerVariables = []string{}
	var smtpPort int
	switch t := config.Auth["email"].(type) {
	case map[interface{}]interface{}:
		for key, value := range t {
			if value != "" {
				if key.(string) == "smtp_host" {
					containerVariables = append(containerVariables, fmt.Sprintf("%v=%v", strings.ToUpper(fmt.Sprint(key)), GetContainerName(value.(string))))
				} else {
					containerVariables = append(containerVariables, fmt.Sprintf("%v=%v", strings.ToUpper(fmt.Sprint(key)), value))
				}
				if key.(string) == "smtp_port" {
					smtpPort = value.(int)
				}
			}
		}
	}

	mailhogConfig.Config.Env = append(mailhogConfig.Config.Env, containerVariables...)
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

	return err
}

func (s *Service) Exec(docker *client.Client, ctx context.Context, command []string) (types.IDResponse, error) {

	config := types.ExecConfig{
		AttachStderr: true,
		AttachStdout: true,
		Cmd:          command,
	}

	return docker.ContainerExecCreate(ctx, s.ID, config)
}

func generateSignInVars() map[string]interface{} {
	return map[string]interface{}{
		"passwordless_email_enabled":     true,
		"passwordless_sms_enabled":       "",
		"signin_email_verified_required": "",
		"allowed_redirect_urls":          "",
		"mfa_enabled":                    "",
		"totp_issuer":                    "",
	}
}

func generateSignUpVars() map[string]interface{} {
	return map[string]interface{}{
		"anonymous_users_enabled":    false,
		"disable_new_users":          "",
		"whitelist_enabled":          "",
		"allowed_email_domains":      "",
		"signup_profile_fields":      "",
		"min_password_length":        "",
		"hibp_enabled":               "",
		"default_user_role":          "",
		"default_allowed_user_roles": "",
		"allowed_user_roles":         "",
		"default_locale":             "",
		"allowed_locales":            "",
	}
}

func generateEmailVars() map[string]interface{} {
	return map[string]interface{}{
		"refresh_token_expires_in": "",
		"emails_enabled":           true,
		"smtp_host":                "mailhog",
		"smtp_port":                1025,
		"smtp_user":                "user",
		"smtp_pass":                "password",
		"smtp_sender":              "hasura-auth@examplcom",
		"smtp_method":              "",
		"smtp_secure":              false,
		"email_template_fetch_url": "",
	}
}

func generateGravatarVars() map[string]interface{} {
	return map[string]interface{}{
		"gravatar_enabled": "",
		"gravatar_default": "",
		"gravatar_rating":  "",
	}
}

func generateTokenVars() map[string]interface{} {
	return map[string]interface{}{
		"refresh_token_expires_in":        "",
		"access_token_expires_in":         "",
		"user_session_variable_fields":    "",
		"profile_session_variable_fields": "",
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
