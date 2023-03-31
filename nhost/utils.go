package nhost

import (
	"fmt"
	"io/ioutil"
	"math/rand"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/docker/docker/pkg/namesgenerator"
	"github.com/nhost/cli/util"
)

const (
	projectNameFile = "project_name"
)

var (
	projectNameIgnoreRegex = regexp.MustCompile(`([^a-z0-9-_])+`)
)

func GetDockerComposeProjectName() (string, error) {
	projectNameFilename := filepath.Join(DOT_NHOST_DIR, projectNameFile)

	data, err := os.ReadFile(projectNameFilename)
	if err != nil {
		return "", fmt.Errorf("can't read file '%s' %v", projectNameFile, err)
	}

	return strings.TrimSpace(string(data)), nil
}

func EnsureProjectNameFileExists() error {
	projectNameFilename := filepath.Join(DOT_NHOST_DIR, projectNameFile)

	if !util.PathExists(projectNameFilename) {
		randomName := randomProjectName(filepath.Base(util.WORKING_DIR))

		if err := os.MkdirAll(DOT_NHOST_DIR, os.ModePerm); err != nil {
			return err
		}

		return ioutil.WriteFile(projectNameFilename, []byte(randomName), 0600)
	}

	return nil
}

func randomProjectName(base string) string {
	base = strings.ToLower(base)
	base = strings.TrimLeft(base, "_")
	base = strings.TrimRight(base, "_")
	base = projectNameIgnoreRegex.ReplaceAllString(base, "-")
	base = strings.TrimSuffix(base, "-")

	rand.Seed(time.Now().UnixNano())
	return strings.ToLower(strings.Join([]string{base, namesgenerator.GetRandomName(0)}, "-"))
}
