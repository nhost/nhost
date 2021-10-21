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
	"context"

	"github.com/docker/docker/client"
	"github.com/nhost/cli-go/nhost"
	"github.com/nhost/cli-go/util"
	"github.com/spf13/cobra"
)

// intialise variable to remove containers and network
var purgeData bool

// var purge bool

// downCmd represents the down command
var purgeCmd = &cobra.Command{
	Use:        "purge [--data]",
	Aliases:    []string{"pg", "down"},
	SuggestFor: []string{"health", "dev"},
	Short:      "Delete all containers created by `nhost dev`",
	Long: `If you have changed your nhost/config.yaml, 
then use this command to delete all your container.
And re-create them next time you run 'nhost dev'`,
	Run: func(cmd *cobra.Command, args []string) {

		var err error

		// connect to docker client
		env.Context = context.Background()
		env.Docker, err = client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to connect to docker client")
		}
		defer env.Docker.Close()

		// break execution if docker deamon is not running
		_, err = env.Docker.Info(env.Context)
		if err != nil {
			log.Fatal(err)
		}

		// get running containers with prefix "nhost_"
		containers, err := env.GetContainers()
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to shut down Nhost services")
		}

		// wrap the fetched containers inside the environment
		_ = env.WrapContainersAsServices(containers)

		if err := env.Shutdown(true, context.Background()); err != nil {
			log.Debug(err)
			log.Error("Failed to shut down Nhost services")
		}

		if purgeData {

			// Delete database and storage as well
			paths := []string{
				nhost.DOT_NHOST,
			}

			for _, item := range paths {
				if err := util.DeleteAllPaths(item); err != nil {
					log.Debug(err)
					log.Warnln("Please delete path manually:", item)
				}
			}
		}

		if env.Network == "" {
			env.Network, _ = env.GetNetwork()
		}
		env.RemoveNetwork()

		if !contains(args, "do_not_inform") {
			log.Info("Purge complete. See you later, grasshopper!")
		}
	},
}

func init() {
	rootCmd.AddCommand(purgeCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	// downCmd.PersistentFlags().String("foo", "", "A help for foo")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	purgeCmd.Flags().BoolVar(&purgeData, "data", false, "Delete database and storage")
}
