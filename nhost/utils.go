package nhost

import (
	"fmt"
	"gopkg.in/yaml.v2"
	"io/ioutil"
	"path/filepath"
	"strings"
)

func ParseEnvVarsFromConfig(payload map[interface{}]interface{}, prefix string) []string {
	var response []string
	for key, item := range payload {
		switch item := item.(type) {
		case map[interface{}]interface{}:
			response = append(response, ParseEnvVarsFromConfig(item, strings.ToUpper(strings.Join([]string{prefix, fmt.Sprint(key)}, "_")))...)
		case interface{}:
			if item != "" {
				response = append(response, fmt.Sprintf("%s_%v=%v", prefix, strings.ToUpper(fmt.Sprint(key)), item))
			}
		}
	}
	return response
}

func GetDockerComposeProjectName() (string, error) {
	data, err := ioutil.ReadFile(filepath.Join(DOT_NHOST_DIR, "project_name"))
	if err != nil {
		return "", err
	}

	return strings.TrimSpace(string(data)), nil
}

func SetDockerComposeProjectName(name string) error {
	return ioutil.WriteFile(filepath.Join(DOT_NHOST_DIR, "project_name"), []byte(name), 0644)
}

func GetCurrentBranch() string {
	data, err := ioutil.ReadFile(filepath.Join(GIT_DIR, "HEAD"))
	if err != nil {
		return ""
	}
	payload := strings.Split(string(data), " ")
	return strings.TrimSpace(filepath.Base(payload[1]))
}
func GetConfiguration() (*Configuration, error) {
	var c Configuration

	data, err := ioutil.ReadFile(CONFIG_PATH)
	if err != nil {
		return nil, err
	}

	err = yaml.Unmarshal(data, &c)
	return &c, err
}
