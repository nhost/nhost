package hasura

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"runtime"

	log "github.com/sirupsen/logrus"

	"github.com/mrinalwahal/cli/nhost"
)

// initialize the binary path
var binaryPath = path.Join(nhost.ROOT, "hasura")

// if the required binary exists in $HOME/.nhost
// this function returns it's exact path
// and if the binary doesn't exist,
// it downloads it from specifically supplied URL
// based on user's OS and ARCH
func Binary() (string, error) {

	var url string

	binary := "hasura"

	nhostConfig, err := nhost.Config()
	if err != nil {
		return url, err
	}

	version := nhostConfig.Environment["hasura_cli_version"]

	url = fmt.Sprintf("https://github.com/hasura/graphql-engine/releases/download/%v/cli-hasura-%v-%v", version, runtime.GOOS, runtime.GOARCH)

	// search for installed binary
	if pathExists(binaryPath) {
		return binaryPath, nil
	}

	// create the binary path
	out, err := os.Create(binaryPath)
	if err != nil {
		return "", err
	}

	defer out.Close()

	// update binary download URL depending upon the OS
	if runtime.GOOS == "windows" {
		url += ".exe"
	}

	log.WithField("component", fmt.Sprintf("%s-%s", runtime.GOOS, runtime.GOARCH)).Infof("Downloading %s binary", binary)

	resp, err := http.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	log.WithField("component", fmt.Sprintf("%s-%s", runtime.GOOS, runtime.GOARCH)).Debugf("Writing %s binary", binary)

	_, err = io.Copy(out, resp.Body)
	if err != nil {
		return "", err
	}

	// Change permissions so that the download file
	// can become accessible and executable
	err = os.Chmod(binaryPath, 0777)

	if err != nil {
		return "", err
	}

	//return the path at which binary has been
	// downloaded and saved
	return binaryPath, nil
}

// validates whether a given folder/file path exists or not
func pathExists(filePath string) bool {
	_, err := os.Stat(filePath)
	return err == nil
}
