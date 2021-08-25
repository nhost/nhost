package nhost

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"math/rand"
	"net"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"strings"

	log "github.com/sirupsen/logrus"

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

	data, err := ioutil.ReadFile(ENV_FILE)
	if err != nil {
		return nil, err
	}

	if len(string(data)) > 0 {
		return strings.Split(string(data), "\n"), nil
	}

	return nil, errors.New("no environment variables found")
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
func LatestRelease() (Release, error) {

	log.Debug("Fetching latest release")

	var response Release

	resp, err := http.Get(fmt.Sprintf("https://api.github.com/repos/%v/releases/latest", REPOSITORY))
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

	log.Debug("Fetching Nhost server locations")

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

	log.Debug("Fetching project configuration")

	var response Configuration

	data, err := ioutil.ReadFile(CONFIG_PATH)
	if err != nil {
		return response, err
	}

	err = yaml.Unmarshal(data, &response)

	// add the additional services
	response.Services["minio"] = Service{
		Image:   "minio/minio",
		Version: "latest",
		Port:    GetPort(8200, 8500),
	}
	response.Services["mailhog"] = Service{
		Image:   "mailhog/mailhog",
		Version: "latest",
		Port:    8025,
	}
	response.Services["auth"] = Service{
		Image:   "nhost/hasura-auth",
		Version: "sha-c68cd71",
		Port:    GetPort(9000, 9100),
	}
	response.Services["storage"] = Service{
		Image:   "nhost/hasura-storage",
		Version: "sha-e7fc9c9",
		Port:    GetPort(8501, 8999),
	}

	// set the defaults
	response.Services["postgres"] = Service{
		Image:   "nhost/postgres",
		Version: response.Services["postgres"].Version,
		Port:    GetPort(5000, 5999),
	}
	response.Services["hasura"] = Service{
		Image:   response.Services["hasura"].Image,
		Version: fmt.Sprintf("%v.%s", response.Services["hasura"].Version, "cli-migrations-v2"),
		// Version:     response.Services["hasura"].Version,
		AdminSecret: response.Services["hasura"].AdminSecret,
		Port:        GetPort(9200, 9300),
		// ConsolePort: GetPort(9301, 9400),
	}

	// return the response
	return response, err
}

// generates fresh config.yaml for /nhost dir
func GenerateConfig(options Project) Configuration {

	log.Debug("Generating project configuration")

	hasura := Service{
		Version:     "v2.0.0",
		Image:       "hasura/graphql-engine",
		AdminSecret: "hasura-admin-secret",
	}

	// check if a loaded remote project has been passed
	if options.HasuraGQEVersion != "" {
		hasura.Version = options.HasuraGQEVersion
	}

	postgres := Service{
		Version: 12,
	}

	if options.PostgresVersion != "" {
		postgres.Version = options.PostgresVersion
	}

	return Configuration{
		Version: 2,
		Services: map[string]Service{
			"postgres": postgres,
			"hasura":   hasura,
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
		"smtp_sender":              "hasura-auth@example.com",
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

func GetPort(low, hi int) int {

	// generate a random port value
	port := strconv.Itoa(low + rand.Intn(hi-low))

	// validate wehther the port is available
	if !portAvaiable(port) {
		return GetPort(low, hi)
	}

	// return the value, if it's available
	response, _ := strconv.Atoi(port)
	return response
}

func portAvaiable(port string) bool {

	log.WithField("port", port).Debug("Checking port for availability")

	ln, err := net.Listen("tcp", ":"+port)

	if err != nil {
		return false
	}

	ln.Close()
	return true
}
