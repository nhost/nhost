/*
Copyright © 2021 NAME HERE <EMAIL ADDRESS>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
package cmd

import (
	"fmt"
	"io/ioutil"
	"net"
	"os"
	"path"
	"strconv"

	"github.com/spf13/cobra"
	"gopkg.in/yaml.v2"
)

// devCmd represents the dev command
var devCmd = &cobra.Command{
	Use:   "dev",
	Short: "Start local development environment",
	Long:  `Initialize a local Nhost environment for development and testing.`,
	Run: func(cmd *cobra.Command, args []string) {

		if verbose {
			printMessage("Initializing dev environment...", "info")
		}

		// check if project is already initialized
		if !pathExists(nhostDir) {
			throwError(nil, "initialize your project before with \"nhost init\" or make sure to run commands at your project root", true)
		}

		// check if .nhost exists
		if !pathExists(dotNhost) {
			if err := os.MkdirAll(dotNhost, os.ModePerm); err != nil {
				throwError(err, "couldn't initialize nhost specific directory", true)
			}
		}

		// check if hasura is installed
		if !verifyUtility("docker-compose") {
			throwError(nil, "docker-compose not installed: follow instructions here - https://docs.docker.com/compose/install/", true)
		}

		// check if this is the first time dev env is running
		firstRun := !pathExists(path.Join(dotNhost, "db_data"))
		printMessage("Nhost is starting...", "info")
		if firstRun {
			printMessage("first run takes longer...", "warn")
		}

		// add cleanup action in case of abort by user
		/*
					process.on("SIGINT", () => {
			      stopSpinner();
			      cleanup(dotNhost, "interrupted by signal");
			    });
		*/

		nhostConfig, err := readYaml(path.Join(nhostDir, "config.yaml"))
		if err != nil {
			throwError(err, "couldn't read Nhost config", true)
		}

		ports := []string{
			"hasura_graphql_port",
			"hasura_backend_plus_port",
			"postgres_port",
			"minio_port",
			"api_port",
		}

		var mappedPorts []float64

		for _, port := range ports {
			mappedPorts = append(mappedPorts, nhostConfig[port].(float64))
		}

		mappedPorts = append(mappedPorts, 9695)

		freePorts := getFreePorts(mappedPorts)
		fmt.Println(freePorts)
	},
}

// read YAML files
func readYaml(path string) (map[string]interface{}, error) {

	f, err := ioutil.ReadFile(path)

	var data map[string]interface{}
	yaml.Unmarshal(f, &data)

	return data, err
}

func getFreePorts(ports []float64) []float64 {

	var freePorts []float64

	for _, port := range ports {
		if portAvaiable(port) {
			freePorts = append(freePorts, port)
		}
	}
	return freePorts
}

func portAvaiable(port float64) bool {
	ln, err := net.Listen("tcp", ":"+strconv.FormatFloat(port, 'f', 6, 64))
	if err != nil {
		ln.Close()
		return false
	}
	ln.Close()
	return true
}

func init() {
	rootCmd.AddCommand(devCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	// devCmd.PersistentFlags().String("foo", "", "A help for foo")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	// devCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}
