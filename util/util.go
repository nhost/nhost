package util

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"runtime"

	"github.com/nhost/cli/logger"
)

var (

	//	Import commong logger used by the entire utility
	log = &logger.Log

	WORKING_DIR string
)

const (

	//	Common Error Codes
	WarnDockerNotFound  = "Make sure Docker is running and restart `nhost dev`"
	ErrDockerNotFound   = "Docker not running"
	ErrServicesNotFound = "No services found currently running for this app"

	//	Common Information Codes
	InfoDockerDownload  = "Download docker from: https://www.docker.com/products/docker-desktop"
	InfoServicesRunning = "Start your app with `nhost dev`"
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

//  check whether source array contains value or not
func Contains(s []string, e string) bool {
	for _, a := range s {
		if a == e {
			return true
		}
	}
	return false
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

//	Wraps given map into string array
func MapToStringArray(payload map[string]interface{}) []string {

	var response []string
	for key, value := range payload {
		response = append(response, fmt.Sprintf("%s=%v", key, value))
	}

	return response
}

//
//	Returns preferred local address value
//	for accessing resources throughout docker containers,
//	depending on the Operating System.
//
//	For Mac and Windows, the address value is "host.docker.internal".
//	And for Linux, we are using the Outbound IP of host machine.
//
func GetLocalhost() string {
	switch runtime.GOOS {
	case "darwin", "windows":
		return "host.docker.internal"
	default:
		return fmt.Sprint(getOutboundIP())
	}
}

//  Get preferred outbound IP of host machine
func getOutboundIP() net.IP {
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err != nil {
		return nil
	}
	defer conn.Close()

	localAddr := conn.LocalAddr().(*net.UDPAddr)

	return localAddr.IP
}

//
//	Augments default runtime variables, with dynamically generated ones,
//	specific to the environment. For example: Backend URL with environment port.
//
//	If the additional `networkBased` flag is true,
//	it makes sure to use that localhost address value,
//	which can be accessed by docker across host network.
//
//	This is because docker requires different local addresses,
//	depending on the host operating system.
//
func RuntimeVars(port string, networkBased bool) map[string]interface{} {

	payload := RUNTIME_VARS
	localhost := "localhost"
	if networkBased {
		localhost = GetLocalhost()
	}
	payload["NHOST_BACKEND_URL"] = fmt.Sprintf("http://%s:%v", localhost, port)
	//	payload["NHOST_FUNCTIONS"] = fmt.Sprintf("http://%s:%v/v1/functions", localhost, port)
	payload["LOCALHOST"] = fmt.Sprintf("http://%s", localhost)

	return payload
}

//  Generates a random 128 byte key
func generateRandomKey(len int) string {
	key := make([]byte, len)
	rand.Read(key)
	return hex.EncodeToString(key)
}
