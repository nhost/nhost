package util

import (
	"os"
	"path/filepath"

	"github.com/mrinalwahal/cli/logger"
	"github.com/mrinalwahal/cli/nhost"
)

var (

	//	Import commong logger used by the entire utility
	log = &logger.Log
)

const (

	//	Common Error Codes
	ErrDockerNotFound   = "Is docker running on your machine?"
	ErrServicesNotFound = "No services found currently running for this app"

	//	Common Information Codes
	InfoDockerDownload  = "Download docker from: https://www.docker.com/products/docker-desktop"
	InfoServicesRunning = "Start your app with `nhost dev`"
)

// check whether source array contains value or not
func Contains(s []string, e string) bool {
	for _, a := range s {
		if a == e {
			return true
		}
	}
	return false
}

// validates whether a given folder/file path exists or not
func PathExists(filePath string) bool {
	_, err := os.Stat(filePath)
	return err == nil
}

// Returns path relative to Nhost current working directory
func Rel(path string) string {

	target, err := filepath.Rel(nhost.WORKING_DIR, path)
	if err == nil {
		return target
	}
	return path
}

// deletes the given file/folder path and unlink from filesystem
func DeletePath(path string) error {

	log.WithField("component", "path").Debugln("Removing", Rel(path))

	os.Chmod(path, 0777)
	return os.Remove(path)
}

// deletes all the paths leading to the given file/folder and unlink from filesystem
func DeleteAllPaths(path string) error {

	log.WithField("component", "path").Debugln("Removing", Rel(path))

	os.Chmod(path, 0777)
	return os.RemoveAll(path)
}
