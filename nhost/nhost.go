package nhost

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/nhost/cli/internal/ports"
	"io/ioutil"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"github.com/nhost/cli/util"
	"github.com/subosito/gotenv"

	"gopkg.in/yaml.v2"
)

func RunCmdAndCaptureStderrIfNotSetup(cmd *exec.Cmd) error {
	var errBuf *bytes.Buffer

	if cmd.Stderr == nil {
		errBuf = bytes.NewBuffer(nil)
		cmd.Stderr = errBuf
	}

	err := cmd.Run()
	if err != nil {
		return fmt.Errorf("%s\n%s", err, errBuf.String())
	}

	return nil
}

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

func Env() ([]string, error) {
	if !util.PathExists(ENV_FILE) {
		return []string{}, nil
	}

	data, err := ioutil.ReadFile(ENV_FILE)
	if err != nil {
		return nil, err
	}

	pairs := gotenv.Parse(strings.NewReader(string(data)))
	envs := []string{}

	for key, value := range pairs {
		envs = append(envs, fmt.Sprintf("%v=%v", key, value))
	}

	return envs, nil
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

// fetches the required asset from release
// depending on OS and Architecture
// by matching download URL
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

// Compares and updates the changelog for specified release
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

// Seaches for required release from supplied list of releases, and returns it.
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

// Downloads the list of all releases from GitHub API
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

// fetches the list of Nhost production servers
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

// generates fresh config.yaml for /nhost dir
func GenerateConfig(options App) Configuration {

	log.Debug("Generating app configuration")

	hasura := Service{
		Environment: map[string]interface{}{
			"hasura_graphql_enable_remote_schema_permissions": true,
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
				"host":   "mailhog",
				"port":   ports.DefaultSMTPPort,
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

// fetches saved credentials from auth file
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
