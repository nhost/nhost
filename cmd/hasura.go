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
	"os"
	"os/exec"

	"github.com/nhost/cli/hasura"
	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/util"
	"github.com/spf13/cobra"
)

var production bool

//  hasuraCmd represents the hasura command
var hasuraCmd = &cobra.Command{
	Use:    "hasura [ARGS] [--prod]",
	Hidden: true,
	Short:  "Run any Hasura command from Nhost CLI",
	Long: `Scaffolding for all Hasura commands.
You can run any legitimate Hasura command under this scaffolding command,
and the command will automatically wrap your running Hasura credentials along.

Example: nhost hasura migrate apply

The above command will automatically wrap your --endpoint
and --admin-secret flags with correct values from your running local environment
along with your original command.

If you wish to use Hasura credentials from a production app,
simply make sure your local app is linked with your production app
using 'nhost link', and augment your command with --prod flag.

Example: nhost hasura migrate apply --prod

The above command will automatically wrap your --endpoint
and --admin-secret flags with correct values from your production app
along with your original command.
`,
	Run: func(cmd *cobra.Command, args []string) {

		if len(args) == 0 {
			status.Fatal("No arguments mentioned")
		}

		//	Initialize credential variables
		var endpoint, adminsecret string

		//	If production flag is false,
		//	we need to use local Hasura credentials,
		//	and therefore, make sure local environment is running.
		if !production {

			//  Initialize the runtime environment
			if err := env.Init(); err != nil {
				log.Debug(err)
				status.Fatal("Failed to initialize the environment")
			}

			//  if no containers found - abort the execution
			if len(env.Config.Services) == 0 {
				status.Fatal("Make sure your environment is running with `nhost dev`")
			}

			//	Update Hasura credentials
			endpoint = env.Config.Services["hasura"].Address
			adminsecret = util.ADMIN_SECRET

		} else {

			var app nhost.App

			for {

				//	Read the app info saved locally
				var err error
				app, err = nhost.Info()
				if err != nil {
					log.Debug(err)
					status.Error("Failed to fetch app info locally")
					status.Info("Please run `nhost link`")
					os.Exit(0)
				}

				if app.ID == "" {

					//	Run `nhost link`
					linkCmd.PreRun(cmd, args)
					linkCmd.Run(cmd, args)

				} else {
					break
				}

			}

			//	Update the credentials
			adminsecret = app.GraphQLAdminSecret
			endpoint = fmt.Sprintf("https://%s.%s", app.Subdomain, nhost.DOMAIN)
		}

		status.Clean()

		//	Intialize the Hasura client
		env.Hasura = &hasura.Client{}
		if err := env.Hasura.Init(
			endpoint,
			adminsecret,
			nil,
		); err != nil {
			log.Debug(err)
			status.Fatal("Failed to initialize Hasura client")
		}

		//	Initialize the command
		cmdArgs := []string{env.Hasura.CLI}
		cmdArgs = append(cmdArgs, args...)
		cmdArgs = append(cmdArgs, env.Hasura.CommonOptionsWithoutDB...)

		execute := exec.Cmd{
			Path:   env.Hasura.CLI,
			Dir:    nhost.NHOST_DIR,
			Args:   cmdArgs,
			Stdout: os.Stdout,
			Stderr: os.Stderr,
			Stdin:  os.Stdin,
		}

		log.Debug("Executing: ", execute.Args)

		_ = execute.Run()
	},
}

func init() {
	rootCmd.AddCommand(hasuraCmd)

	//  Here you will define your flags and configuration settings.

	//  Cobra supports Persistent Flags which will work for this command
	//  and all subcommands, e.g.:
	//  hasuraCmd.PersistentFlags().String("foo", "", "A help for foo")

	//  Cobra supports local flags which will only run when this command
	//  is called directly, e.g.:
	hasuraCmd.Flags().BoolVar(&production, "prod", false, "Use production credentials")
}
