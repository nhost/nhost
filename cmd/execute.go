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
	"bytes"
	"context"
	"io/ioutil"
	"os"
	"strings"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/stdcopy"
	"github.com/manifoldco/promptui"
	"github.com/mrinalwahal/cli/nhost"
	"github.com/spf13/cobra"
)

var (

	// initialize flags
	command string
	service string
)

// executeCmd represents the execute command
var executeCmd = &cobra.Command{
	Use:   "execute",
	Short: "Execute commands inside your Nhost services",
	Long: `Run shell commands directly inside your 
already running Nhost service containers.`,
	Run: func(cmd *cobra.Command, args []string) {

		if command == "" {
			log.Error("Invalid arguments")
			log.Info("Run `nhost execute --help` to understand how to use this command")
			os.Exit(0)
		}

		var err error

		// connect to docker client
		environment.Context = context.Background()
		environment.Docker, err = client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to connect to docker client")
		}
		defer environment.Docker.Close()

		// break execution if docker deamon is not running
		_, err = environment.Docker.Info(environment.Context)
		if err != nil {
			log.Fatal(err)
		}

		// get running containers with prefix "nhost_"
		containers, err := environment.GetContainers()
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to shut down Nhost services")
		}

		// if no containers found - abort the execution
		if len(containers) == 0 {
			log.Fatal("Make sure your Nhost environment is running with `nhost dev`")
		}

		// wrap the fetched containers inside the environment
		_ = environment.WrapContainersAsServices(containers)

		var selected *nhost.Service

		if service == "" {

			// load the saved Nhost configuration
			type Option struct {
				Key   string
				Value string
			}

			var services []Option
			for name := range environment.Config.Services {
				services = append(services, Option{
					Key:   strings.Title(strings.ToLower(strings.Split(name, "_")[1])),
					Value: name,
				})
			}

			// configure interactive prompt template
			templates := promptui.SelectTemplates{
				Active:   `{{ "✔" | green | bold }} {{ .Key | cyan | bold }}`,
				Inactive: `   {{ .Key | cyan }}`,
				Selected: `{{ "✔" | green | bold }} {{ "Selected" | bold }}: {{ .Key | cyan }}`,
			}

			// configure interative prompt
			prompt := promptui.Select{
				Label:     "Select Service",
				Items:     services,
				Templates: &templates,
			}

			index, _, err := prompt.Run()
			if err != nil {
				os.Exit(0)
			}

			service = services[index].Value
		}

		for _, item := range environment.Config.Services {
			if strings.Contains(item.Name, strings.ToLower(service)) {
				selected = item
				break
			}
		}

		if selected == nil {
			log.Fatal("No such service found")
		}

		// create the command execution skeleton
		response, err := selected.Exec(environment.Docker, environment.Context, strings.Split(command, " "))
		if err != nil {
			log.WithField("service", service).Debug(err)
			log.WithField("service", service).Fatal("Failed to prepare execution shell")
		}

		// execute the command
		// and inspect the response
		result, err := InspectExecResp(environment.Docker, environment.Context, response.ID)
		if err != nil {
			log.WithField("service", service).Debug(err)
			log.WithField("service", service).Error("Failed to execute the command.")

			if len(result.StdErr) > 0 {
				os.Stderr.Write([]byte(result.StdErr))
			}
		}

		os.Stdout.Write([]byte(result.StdOut))
	},
}

func InspectExecResp(docker *client.Client, ctx context.Context, id string) (ExecResult, error) {
	var execResult ExecResult

	resp, err := docker.ContainerExecAttach(ctx, id, types.ExecStartCheck{})
	if err != nil {
		return execResult, err
	}
	defer resp.Close()

	// read the output
	var outBuf, errBuf bytes.Buffer
	outputDone := make(chan error)

	go func() {
		// StdCopy demultiplexes the stream into two buffers
		_, err = stdcopy.StdCopy(&outBuf, &errBuf, resp.Reader)
		outputDone <- err
	}()

	select {
	case err := <-outputDone:
		if err != nil {
			return execResult, err
		}
		break

	case <-ctx.Done():
		return execResult, ctx.Err()
	}

	stdout, err := ioutil.ReadAll(&outBuf)
	if err != nil {
		return execResult, err
	}
	stderr, err := ioutil.ReadAll(&errBuf)
	if err != nil {
		return execResult, err
	}

	res, err := docker.ContainerExecInspect(ctx, id)
	if err != nil {
		return execResult, err
	}

	execResult.ExitCode = res.ExitCode
	execResult.StdOut = string(stdout)
	execResult.StdErr = string(stderr)
	return execResult, nil
}

func init() {
	rootCmd.AddCommand(executeCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	// executeCmd.PersistentFlags().String("foo", "", "A help for foo")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	executeCmd.Flags().StringVarP(&command, "command", "c", "", "Command to run inside service")
	executeCmd.Flags().StringVarP(&service, "service", "s", "", "Service to run the command inside")
}
