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
	"fmt"
	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/nhost/compose"
	"github.com/spf13/cobra"
	"os"
)

//  logsCmd prints the logs from containers and HBP_Catalog
var logsCmd = &cobra.Command{
	Use:                "logs",
	FParseErrWhitelist: cobra.FParseErrWhitelist{UnknownFlags: true},
	Short:              "Read container logs",
	Long: `Read container logs

  Example:
    nhost logs  (read logs of all services)
    nhost logs -f (follow logs of all services)
    nhost logs -f functions (follow logs of functions service)
`,
	RunE: func(cmd *cobra.Command, args []string) error {
		// we override the args processed by cobra/pflag because we wanna use them as-is for docker compose
		dcArgs := []string{"logs"}
		if len(os.Args) > 2 {
			// filter out the first two args (i.e. "nhost logs") and keep the rest
			dcArgs = append(dcArgs, os.Args[2:]...)
		}

		config, err := nhost.GetConfiguration()
		if err != nil {
			return err
		}

		projectName, err := nhost.GetDockerComposeProjectName()
		if err != nil {
			return err
		}

		env, err := nhost.Env()
		if err != nil {
			return fmt.Errorf("failed to read .env.development: %v", err)
		}

		conf := compose.NewConfig(config, nil, env, nhost.GetCurrentBranch(), projectName)
		dc, err := compose.WrapperCmd(cmd.Context(), dcArgs, conf, &compose.DataStreams{Stdout: os.Stdout, Stderr: os.Stderr})
		if err != nil {
			return err
		}

		return dc.Run()
	},
}

func init() {
	rootCmd.AddCommand(logsCmd)
}
