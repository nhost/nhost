package nhost

import (
	"fmt"
	"github.com/docker/docker/pkg/namesgenerator"
	"github.com/nhost/cli/util"
	"gopkg.in/yaml.v2"
	"io/ioutil"
	"math/rand"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	projectNameFile = "project_name"
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
	projectNameFilename := filepath.Join(DOT_NHOST_DIR, projectNameFile)

	data, err := ioutil.ReadFile(projectNameFilename)
	if err != nil {
		return "", fmt.Errorf("can't read file '%s' %v", projectNameFile, err)
	}

	return strings.TrimSpace(string(data)), nil
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

func EnsureProjectNameFileExists() error {
	projectNameFilename := filepath.Join(DOT_NHOST_DIR, projectNameFile)

	if !util.PathExists(projectNameFilename) {
		rand.Seed(time.Now().UnixNano())
		randomName := strings.Join([]string{filepath.Base(util.WORKING_DIR), namesgenerator.GetRandomName(0)}, "-")

		if err := os.MkdirAll(DOT_NHOST_DIR, os.ModePerm); err != nil {
			return err
		}

		return ioutil.WriteFile(projectNameFilename, []byte(randomName), 0600)
	}

	return nil
}
