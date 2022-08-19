package util

import (
	"os"
	"path/filepath"

	"github.com/nhost/cli/logger"
)

var (

	//	Import commong logger used by the entire utility
	log = &logger.Log

	WORKING_DIR string
)

type Config struct {
	WorkingDir string
	Writer     *Status
}

func Init(config Config) {

	if config.WorkingDir == "" {
		WORKING_DIR, _ = os.Getwd()
	}

	if config.Writer == nil {
		Writer = New(true)
	}
}

//  validates whether a given folder/file path exists or not
func PathExists(filePath string) bool {
	_, err := os.Stat(filePath)
	return err == nil
}

//  Returns path relative to Nhost current working directory
func Rel(path string) string {

	target, err := filepath.Rel(WORKING_DIR, path)
	if err == nil {
		return target
	}
	return path
}

//  deletes the given file/folder path and unlink from filesystem
func DeletePath(path string) error {

	log.WithField("component", "path").Debugln("Removing", Rel(path))

	os.Chmod(path, 0777)
	return os.Remove(path)
}

//  deletes all the paths leading to the given file/folder and unlink from filesystem
func DeleteAllPaths(path string) error {

	log.WithField("component", "path").Debugln("Removing", Rel(path))

	os.Chmod(path, 0777)
	return os.RemoveAll(path)
}
