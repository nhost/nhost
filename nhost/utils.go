package nhost

import (
	"fmt"
	"io/ioutil"
	"math/rand"
	"net"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"
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

func GetPort(low, hi int) int {

	//
	//  Initialize the seed
	//
	//  This is done to prevent Go from choosing pseudo-random numbers
	rand.Seed(time.Now().UnixNano())

	//  generate a random port value
	port := strconv.Itoa(low + rand.Intn(hi-low))

	//  validate wehther the port is available
	if !PortAvaiable(port) {
		return GetPort(low, hi)
	}

	//  return the value, if it's available
	response, _ := strconv.Atoi(port)
	return response
}

func PortAvaiable(port string) bool {

	ln, err := net.Listen("tcp", ":"+port)

	if err != nil {
		return false
	}

	ln.Close()
	return true
}

func GetContainerName(name string) string {
	return strings.Join([]string{PREFIX, name}, "_")
}

func GetCurrentBranch() string {

	log.Debug("Fetching local git branch")
	data, err := ioutil.ReadFile(filepath.Join(GIT_DIR, "HEAD"))
	if err != nil {
		return ""
	}
	payload := strings.Split(string(data), " ")
	return strings.TrimSpace(filepath.Base(payload[1]))
}

//	Detects whether the host machine is running on Apple Silicon processor.
func runningSilicon() bool {

	r, err := syscall.Sysctl("sysctl.proc_translated")
	if err != nil {
		if err.Error() == "no such file or directory" {
			return false
		}
	}

	return r == "\x00\x00\x00" || r == "\x01\x00\x00"
}
