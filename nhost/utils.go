package nhost

import (
	"fmt"
	"io/ioutil"
	"math/rand"
	"net"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
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

func openbrowser(url string) error {

	var err error

	switch runtime.GOOS {
	case "linux":
		err = exec.Command("xdg-open", url).Start()
	case "windows":
		err = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		err = exec.Command("open", url).Start()
	default:
		err = fmt.Errorf("unsupported platform")
	}

	return err
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
