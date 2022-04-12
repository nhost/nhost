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
	"errors"
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"sync"
	"syscall"
	"text/tabwriter"
	"time"

	"github.com/nhost/cli/environment"
	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/proxy"
	"github.com/nhost/cli/util"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

var (
	//  initialize boolean to determine
	//  whether to expose the local environment to the public internet
	//  through a tunnel
	expose bool

	//  signal interruption channel
	stop = make(chan os.Signal)
)

/*

	---------------------------------
	`nhost dev` Operational Strategy
	---------------------------------

	1.	Initialize your running environment.
	2.	Fetch the list of running containers.
	3.	Wrap those existing containers as services inside the runtime environment.
		This will save the container ID in the service structure, so that it can be used to simply
		restart the container later, instead of creating it from scratch.
	4.	Parse the Nhost project configuration from config.yaml,
		and wrap it on existing services configurations.
		This will update all the fields of the service, which until now, only contained the container ID.
		This also includes initializing the service config and host config.
	5. 	Run the services.
		5.1	If the service ID exists --> start the same container
			else {
			--> create the container from configuration, and attach it to the network.
			--> now start the newly created container.
		}
		5.2	Once the container has been started, save the new container ID and assigned Port, and updated address.
			This will ensure that the new port is used for attaching a reverse proxy to this service, if required.
*/

//  devCmd represents the dev command
var devCmd = &cobra.Command{
	Use:        "dev [-p port]",
	Aliases:    []string{"up"},
	SuggestFor: []string{"list", "init"},
	Short:      "Start local development environment",
	Long:       `Initialize a local Nhost environment for development and testing.`,
	PreRunE: func(cmd *cobra.Command, args []string) error {

		//  check if nhost/ exists
		if !util.PathExists(nhost.NHOST_DIR) {
			status.Info("Initialize new app by running 'nhost init'")
			return errors.New("app not found in this directory")
		}

		//  create .nhost/ if it doesn't exist
		if err := os.MkdirAll(nhost.DOT_NHOST, os.ModePerm); err != nil {
			status.Errorln("Failed to initialize nhost data directory")
			return err
		}

		return nil
	},
	Run: func(cmd *cobra.Command, args []string) {

		//	Fixes GH #129, by moving it from pre-run to run.
		//
		//	If the default port is not available,
		//	choose a random one.
		if !util.PortAvailable(env.Port) {
			status.Info("Choose a different port with `nhost dev [--port]`")
			status.Fatal(fmt.Sprintf("port %s not available", env.Port))
		}

		var err error

		//  Initialize the runtime environment
		if err = env.Init(); err != nil {
			log.Debug(err)
			status.Fatal(util.WarnDockerNotFound)
		}

		env.UpdateState(environment.Executing)

		//  Parse the nhost/config.yaml
		if err = env.Config.Wrap(); err != nil {
			log.Debug(err)
			status.Fatal("Failed to read Nhost config")
		}

		//	Start the Watcher
		go env.Watcher.Start()

		var end_waiter sync.WaitGroup
		end_waiter.Add(1)

		//  add cleanup action in case of signal interruption
		signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
		go func() {
			<-stop

			//  Cancel any ongoing excution
			env.ExecutionCancel()

			//  Cleanup the environment
			env.Cleanup()

			end_waiter.Done()
			os.Exit(0)
		}()

		//  Initialize a reverse proxy server,
		//  to make all our locally running Nhost services
		//  available from a single port
		reverseproxy := proxy.New(&proxy.ServerConfig{
			Port:        env.Port,
			Environment: &env,
			Log:         log,
		})

		//  Register Functions as a service to the reverse proxy to route it's UI port
		reverseproxy.AddService(&proxy.Service{
			Name:    "functions",
			Routes:  []proxy.Route{{Name: "Functions", Source: "/", Destination: "/v1/functions/"}},
			Port:    funcPort,
			Address: fmt.Sprintf("http://localhost:%v", funcPort),

			//	Initialize this function service,
			//	directly with functions HTTP handler.
			//	This will allow us to avoid launching a separate functions server.
			//	Handler: functionServer.Handler,
		})

		//  Initialize cancellable context for this specific execution
		env.ExecutionContext, env.ExecutionCancel = context.WithCancel(env.Context)

		//  Execute the environment
		if err := env.Execute(); err != nil {

			//	Only perform the cleanup before ending,
			//	if the error has occurred under execution stage.
			//
			//	This is being done to account for the state change
			//	imposed by git ops watcher.

			/* 			for {
			   				<-env.ExecutionContext.Done()
			   				if env.ExecutionContext.Err() != context.Canceled {
			   					break
			   				}
			   			}
			if env.State <= environment.Executing {
				log.Debug(err)
				status.Errorln("Failed to initialize your environment")
				env.Cleanup()
				end_waiter.Done()
					return
			}
			*/
			log.Debug(err)
			status.Errorln("Failed to initialize your environment")
			env.Cleanup()
			end_waiter.Done()
			return
		}

		//
		//  Everything after this point,
		//  needs to be executed only the first time
		//  the environment has been started.
		//

		go func() {

			//  Prepare functions server
			if err := prepareFunctionServer(); err != nil {
				log.Debug(err)
				status.Errorln("Failed to initialize functions server")
				env.Cleanup()
				end_waiter.Done()
				return
			}

			//  Start functions
			ServeFuncs()

			//  After launching, register the functions server in our environment
			env.Servers = append(env.Servers, functionServer.Server)
		}()

		//spawn hasura console
		consolePort := util.GetPort(9301, 9400)

		go func() {

			//  Start the hasura console
			cmd := exec.Cmd{
				Path: env.Hasura.CLI,
				Args: []string{
					env.Hasura.CLI,
					"console",
					"--endpoint",
					env.Hasura.Endpoint,
					"--admin-secret",
					env.Hasura.AdminSecret,
					"--console-port",
					fmt.Sprint(consolePort),
					"--api-port",
					fmt.Sprint(util.GetPort(8301, 9400)),
					"--skip-update-check",
					"--no-browser",
				},
				Dir: nhost.NHOST_DIR,
			}

			//	Start the command
			if err := cmd.Start(); err != nil {
				log.WithField("component", "console").Debug(err)
			}

			//	Add a 1 second delay
			time.Sleep(1 * time.Second)

			//	If the `--no-browser` flag is passed,
			//	don't open the console window in browser automatically
			if !noBrowser {
				go openbrowser(fmt.Sprintf("http://localhost:%s", env.Port))
			}

			if err := cmd.Wait(); err != nil {

				//	If it's a signal interruption error,
				//	kill the process forcefully.
				if err.Error() == "signal: interrupt" {
					if err := cmd.Process.Kill(); err != nil {
						log.WithField("component", "console").Debug(err)
					} else {
						log.WithField("component", "console").Debug("process killed")
					}
				} else {
					log.WithField("component", "console").Debug(err)
				}
			}
		}()

		//	Register all services along with their proxy routes.
		for name, item := range env.Config.Services {

			var routes []proxy.Route

			switch name {
			case "auth":
				routes = []proxy.Route{{Name: "Authentication", Source: "/", Destination: "/v1/auth/", Show: true}}
			case "storage":
				routes = []proxy.Route{{Name: "Storage", Source: "/v1/storage/", Destination: "/v1/storage/", Show: true}}
			case "hasura":
				routes = []proxy.Route{
					{Name: "GraphQL", Source: "/v1/graphql", Destination: "/v1/graphql", Show: true},
					{Name: "Query", Source: "/v2/query", Destination: "/v2/query"},
					{Name: "Metadata", Source: "/v1/metadata", Destination: "/v1/metadata"},
					{Name: "Config", Source: "/v1/config", Destination: "/v1/config"},
				}
			}

			if len(routes) > 0 {
				reverseproxy.AddService(&proxy.Service{
					Name:    item.Name,
					Routes:  routes,
					Port:    fmt.Sprint(item.Port),
					Address: nhost.GetAddress(item),
				})
			}
		}

		//  Register Hasura Console as a service to the reverse proxy to route it's UI port
		reverseproxy.AddService(&proxy.Service{
			Name:    "console",
			Routes:  []proxy.Route{{Name: "Console", Source: "/", Destination: "/"}},
			Port:    fmt.Sprint(consolePort),
			Address: fmt.Sprintf("http://localhost:%v", consolePort),
		})

		go func() {

			//	Issue proxies of all registered services
			if err := reverseproxy.IssueAll(env.Context); err != nil {
				log.WithField("component", "reverseproxy").Debug(err)
				status.Errorln("Failed to issue proxies")
			}

			//  Before launching, register the proxy server in our environment
			env.Servers = append(env.Servers, reverseproxy.Server)

			//  Now start the server
			if err := reverseproxy.ListenAndServe(); err != nil {
				log.WithFields(logrus.Fields{"component": "proxy", "value": env.Port}).Debug(err)
			}
		}()

		//  Update environment state
		env.UpdateState(environment.Active)

		//  wait for Ctrl+C
		end_waiter.Wait()

		//  Close the signal interruption channel
		close(stop)
	},
}

type Printer struct {
	*tabwriter.Writer
}

func newPrinter() *Printer {
	t := tabwriter.NewWriter(os.Stdout, 1, 1, 1, ' ', 0)
	return &Printer{
		Writer: t,
	}
}

func (p *Printer) print(loc, head, tail string) {

	switch loc {
	case "header":
		fmt.Fprintln(p)
		//	fmt.Fprintln(p, "---\t\t-----")
	case "footer":
		//	fmt.Fprintln(p, "---\t\t-----")
	case "info":
		status.Info(head)
	default:
		fmt.Fprintf(p, "%v\t\t%v", head, tail)
		fmt.Fprintln(p)
	}
}

func (p *Printer) close() {
	p.Flush()
	fmt.Println()
}

func init() {
	rootCmd.AddCommand(devCmd)

	//  Here you will define your flags and configuration settings.

	//  Cobra supports Persistent Flags which will work for this command
	//  and all subcommands, e.g.:
	devCmd.PersistentFlags().StringVarP(&env.Port, "port", "p", "1337", "Port for dev proxy")
	devCmd.PersistentFlags().BoolVar(&noBrowser, "no-browser", false, "Don't open browser windows automatically")
	//	devCmd.PersistentFlags().BoolVarP(&expose, "expose", "e", false, "Expose local environment to public internet")

	//  Cobra supports local flags which will only run when this command
	//  is called directly, e.g.:
	//devCmd.Flags().BoolVarP(&background, "background", "b", false, "Run dev services in background")
}

/*
	//  Following code belongs to Nhost tunnelling service
	//  We've decided not to incorporate this feature inside the CLI until V2

	//  expose to public internet
	var exposed bool
		if expose {
			go func() {

				//  get the user's credentials
				credentials, err := nhost.LoadCredentials()
				if err != nil {
					log.WithField("component", "tunnel").Debug(err)
					log.WithField("component", "tunnel").Error("Failed to fetch authentication credentials")
					log.WithField("component", "tunnel").Info("Login again with `nhost login` and re-start the environment")
					log.WithField("component", "tunnel").Warn("We're skipping exposing your environment to the outside world")
					return
				} else {
					go func() {

						state := make(chan *tunnels.ClientState)
						client := &tunnels.Client{
							Address: "wahal.tunnel.nhost.io:443",
							Port:    port,
							Token:   credentials.Token,
							State:   state,
						}

						if err := client.Init(); err != nil {
							log.WithField("component", "tunnel").Debug(err)
							log.WithField("component", "tunnel").Error("Failed to initialize your tunnel")
							return
						}

						//  Listen for tunnel state changes
						go func() {
							for {
								change := <-state
								if *change == tunnels.Connecting {
									log.WithField("component", "tunnel").Debug("Connecting")
								} else if *change == tunnels.Connected {
									exposed = true
									log.WithField("component", "tunnel").Debug("Connected")
								} else if *change == tunnels.Disconnected {
									log.WithField("component", "tunnel").Debug("Disconnected")
								}
							}
						}()

						if err := client.Connect(); err != nil {
							log.WithField("component", "tunnel").Debug(err)
							log.WithField("component", "tunnel").Error("Failed to expose your environment to the outside world")
						}

					}()
				}
			}()
		}
*/
