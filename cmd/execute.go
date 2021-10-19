/*
MIT License

Copyright (c) Nhost

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
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

type ExecResult struct {
	StdOut   string
	StdErr   string
	ExitCode int
}

// executeCmd represents the execute command
var executeCmd = &cobra.Command{
	Use:   "execute",
	Short: "Execute commands inside your Nhost containers",
	Long: `Run shell commands directly inside your 
already running Nhost service containers.`,
	Run: func(cmd *cobra.Command, args []string) {

		if command == "" {
			log.Error("Invalid arguments")
			log.Info("Run `nhost execute --help` to understand how to use this command")
			os.Exit(0)
		}

		// Initialize the runtime environment
		if err := env.Init(); err != nil {
			log.Debug(err)
			log.Fatal("Failed to initialize the environment")
		}

		// if no containers found - abort the execution
		if len(env.Config.Services) == 0 {
			log.Fatal("Make sure your Nhost environment is running with `nhost dev`")
		}

		var selected *nhost.Service

		if service == "" {

			// load the saved Nhost configuration
			type Option struct {
				Key   string
				Value string
			}

			var services []Option
			for name := range env.Config.Services {
				services = append(services, Option{
					Key:   strings.Title(strings.ToLower(name)),
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

		for name, item := range env.Config.Services {
			if strings.EqualFold(name, service) {
				selected = item
				break
			}
		}

		if selected == nil {
			log.Fatal("No such service found")
		}

		// create the command execution skeleton
		response, err := selected.Exec(env.Docker, env.Context, strings.Split(command, " "))
		if err != nil {
			log.WithField("service", service).Debug(err)
			log.WithField("service", service).Fatal("Failed to prepare execution shell")
		}

		// execute the command
		// and inspect the response
		result, err := InspectExecResp(env.Docker, env.Context, response.ID)
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
