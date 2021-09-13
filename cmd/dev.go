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
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"text/tabwriter"

	"github.com/fsnotify/fsnotify"
	"github.com/mrinalwahal/cli/hasura"
	"github.com/mrinalwahal/cli/nhost"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

var (
	// initialize boolean to determine
	// whether to expose the local environment to the public internet
	// through a tunnel
	expose bool

	// signal interruption channel
	stop = make(chan os.Signal)

	// fsnotify watcher
	watcher *fsnotify.Watcher
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

// devCmd represents the dev command
var devCmd = &cobra.Command{
	Use:     "dev [-p port]",
	Aliases: []string{"d", "start", "up"},
	Short:   "Start local development environment",
	Long:    `Initialize a local Nhost environment for development and testing.`,
	Run: func(cmd *cobra.Command, args []string) {

		log.Info("Initializing environment")

		// check if /nhost exists
		if !pathExists(nhost.NHOST_DIR) {
			log.Info("Initialize a project by running 'nhost'")
			log.Fatal("Project not found in this directory")
		}

		// create /.nhost if it doesn't exist
		if err := os.MkdirAll(nhost.DOT_NHOST, os.ModePerm); err != nil {
			log.Debug(err)
			log.Fatal("Failed to initialize nhost data directory")
		}

		var err error

		// Initialize the runtime environment
		if err = environment.Init(); err != nil {
			log.Debug(err)
			log.Fatal("Failed to initialize the environment")
		}

		// Parse the nhost/config.yaml
		if err = environment.Config.Wrap(); err != nil {
			log.Debug(err)
			log.Fatal("Failed to read Nhost config")
		}

		// Launch the Watchers of this environment
		if len(environment.Watchers) > 0 {

			watcher, err = fsnotify.NewWatcher()
			if err != nil {
				log.Fatal(err)
			}
			defer watcher.Close()

			// Add the files to our watcher
			for file := range environment.Watchers {
				if pathExists(file) {
					if err := addToWatcher(watcher, file); err != nil {
						log.WithField("component", "watcher").Error(err)
					}
				}
			}

			// launch the infinite watching goroutine
			go environment.Watch(watcher)
		}

		var end_waiter sync.WaitGroup
		end_waiter.Add(1)

		// add cleanup action in case of signal interruption
		signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
		go func() {
			<-stop

			// Cancel any ongoing excution
			environment.ExecutionCancel()

			// Cleanup the environment
			environment.cleanup()

			end_waiter.Done()
			os.Exit(0)
		}()

		// Register functions as a service in our environment
		funcPortStr, _ := strconv.Atoi(funcPort)
		environment.Config.Services["functions"] = &nhost.Service{
			Name:   "functions",
			Handle: "/v1/functions/",
			Proxy:  true,
			Port:   funcPortStr,
		}

		// Initialize cancellable context for this specific execution
		environment.ExecutionContext, environment.ExecutionCancel = context.WithCancel(environment.Context)

		// Execute the environment
		if err := environment.Execute(); err != nil {

			//	Only perform the cleanup before ending,
			//	if the error has occurred under execution stage.
			//
			//	This is being done to account for the state change
			//	imposed by git ops watcher.

			/* 			for {
			   				<-environment.ExecutionContext.Done()
			   				if environment.ExecutionContext.Err() != context.Canceled {
			   					break
			   				}
			   			}
			*/
			if environment.state <= Executing {
				log.Debug(err)
				log.Error("Failed to initialize your environment")
				environment.cleanup()
				end_waiter.Done()
			}
		}

		//
		// Everything after this point,
		// needs to be executed only the first time
		// the environment has been started.
		//

		// Start functions
		go ServeFuncs()

		// Register the functions server in our environment
		environment.Servers = append(environment.Servers, functionServer)

		//spawn hasura console
		consolePort := nhost.GetPort(9301, 9400)

		go func() {

			// Start the hasura console
			cmd := exec.Cmd{
				Path: environment.Hasura.CLI,
				Args: []string{
					environment.Hasura.CLI,
					"console",
					"--endpoint",
					environment.Hasura.Endpoint,
					"--admin-secret",
					environment.Hasura.AdminSecret,
					"--console-port",
					fmt.Sprint(consolePort),
					"--api-port",
					fmt.Sprint(nhost.GetPort(8301, 9400)),
					"--skip-update-check",
				},
				Dir: nhost.NHOST_DIR,
			}

			if err := cmd.Start(); err != nil {
				log.WithField("component", "console").Debug(err)
			}

			if err := cmd.Wait(); err != nil {
				log.WithField("component", "console").Debug(err)
			}
		}()

		// launch mailhog UI
		go openbrowser(environment.Config.Services["mailhog"].Address)

		// Initialize a reverse proxy server,
		// to make all our locally running Nhost services
		// available from a single port
		mux := http.NewServeMux()
		proxy := &http.Server{Addr: ":" + environment.Port, Handler: mux}

		go func() {

			// Before launching, register the proxy server in our environment
			environment.Servers = append(environment.Servers, proxy)

			// Now start the server
			if err := proxy.ListenAndServe(); err != nil {
				log.WithFields(logrus.Fields{"component": "proxy", "value": environment.Port}).Debug(err)
			}
		}()

		// print the proxy routes
		w := tabwriter.NewWriter(os.Stdout, 1, 1, 1, ' ', 0)
		fmt.Println()
		if expose {
			fmt.Fprintln(w, "---\t\t-----\t\t-----")
		} else {
			fmt.Fprintln(w, "---\t\t-----")
		}

		for name, item := range environment.Config.Services {

			// Only issue a proxy to those,
			// which have proxy enabled
			if item.Proxy {

				if err := item.IssueProxy(mux, environment.Context); err != nil {
					log.WithField("component", "server").Debug(err)
					log.WithField("component", "server").Error("Failed to proxy ", name)
					environment.cleanup()
				}

				// print the name and handle
				fmt.Fprintf(w, "%v\t\t%v", strings.Title(strings.ToLower(name)), fmt.Sprintf("%shttp://localhost:%v%s%s", Gray, environment.Port, Reset, filepath.Clean(item.Handle)))
				fmt.Fprintln(w)
			}
		}

		// print Hasura console and mailhog URLs
		fmt.Fprintf(
			w,
			"%v\t\t%v",
			strings.Title("console"), fmt.Sprintf("%shttp://localhost:%v%s", Gray, consolePort, Reset),
		)
		fmt.Fprintln(w)
		fmt.Fprintf(
			w,
			"%v\t\t%v",
			strings.Title("mailhog"), fmt.Sprintf("%s%s%s", Gray, environment.Config.Services["mailhog"].Address, Reset),
		)
		fmt.Fprintln(w)

		// End the pretty printing
		fmt.Fprintln(w, "---\t\t-----")
		w.Flush()
		fmt.Println()

		// give example of using Functions inside Hasura
		if pathExists(nhost.API_DIR) {
			log.Info("ProTip: You can call Functions inside Hasura!")
			fmt.Println()
			fmt.Fprintln(w, "--\t\t----")
			fmt.Fprintf(w, "%v\t\t%v", "URL", fmt.Sprintf("%s{{NHOST_FUNCTIONS}}%s/hello", Gray, Reset))
			fmt.Fprintln(w)
			fmt.Fprintln(w, "--\t\t----")
			w.Flush()
			fmt.Println()
		}

		// Update environment state
		environment.UpdateState(Active)

		log.Warn("Use Ctrl + C to stop running evironment")

		/*
			// launch sessions
			for key, item := range environment.Config.Sessions {

				log.WithFields(logrus.Fields{
					"type":  "session",
					"value": key,
				}).Debug("Spawning")

				item.Spawn()
			}
		*/

		// wait for Ctrl+C
		end_waiter.Wait()

		// Close the signal interruption channel
		close(stop)
	},
}

// Explain what it does
func (e *Environment) Execute() error {

	var err error

	// Update environment state
	e.UpdateState(Executing)

	//	Cancel the execution context as soon as this function completed
	defer e.ExecutionCancel()

	// check if this is the first time dev env is running
	firstRun := !pathExists(filepath.Join(nhost.DOT_NHOST, "db_data"))
	if firstRun {
		log.Info("First run takes longer, please be patient")
	}

	// Validate the availability of required docker images,
	// and download the ones that are missing
	if err := e.CheckImages(); err != nil {
		return err
	}

	//	Generate configuration for every service.
	//	This generates all env vars, mount points and commands
	if err := e.Config.Init(environment.Port); err != nil {
		return err
	}

	//	Create the Nhost network if it doesn't exist
	if err := e.PrepareNetwork(); err != nil {
		return err
	}

	// create and start the conatiners
	for _, item := range e.Config.Services {

		// Only those services which have a container configuration
		// This is being done to exclude FUNCTIONS
		if item.Config != nil {

			//	We are passing execution context, and not parent context,
			//	because if this execution is cancelled in between,
			//	we want docker to abort this procedure.
			if err := item.Run(e.Docker, e.ExecutionContext, e.Network); err != nil {
				return err
			}
		}
	}

	//
	// Update the ports and IDs of services against the running ones
	//
	// Fetch list of existing containers
	containers, err := e.GetContainers()
	if err != nil {
		return err
	}

	// Wrap fetched containers as services in the environment
	_ = e.WrapContainersAsServices(containers)

	log.Info("Running a quick health check on services")
	if err := e.HealthCheck(e.ExecutionContext); err != nil {
		return err
	}

	// Now that Hasura container is active,
	// initialize the Hasura client.
	e.Hasura = &hasura.Client{}
	if err := e.Hasura.Init(
		e.Config.Services["hasura"].Address,
		fmt.Sprint(e.Config.Services["hasura"].AdminSecret),
		nil,
	); err != nil {
		return err
	}

	//
	// Apply migrations and metadata
	//
	log.Info("Preparing your data")
	if err = e.Prepare(); err != nil {
		return err
	}

	//
	// Apply Seeds if required
	//
	if firstRun && pathExists(filepath.Join(nhost.SEEDS_DIR, nhost.DATABASE)) {
		if err = environment.Seed(filepath.Join(nhost.SEEDS_DIR, nhost.DATABASE)); err != nil {
			log.Debug(err)
			environment.cleanup()
		}
	}

	return err
}

func (e *Environment) cleanup() {

	/*
		// Gracefully shut down all registered servers of the environment
		for _, server := range e.Servers {
			server.Shutdown(e.Context)
		}
	*/

	if e.state >= Executing {
		log.Warn("Please wait while we cleanup")

		//	Pass the parent context of the environment,
		//	because this is the final cleanup procedure
		//	and we are going to cancel this context shortly after
		if err := e.Shutdown(false, e.Context); err != nil {
			log.Debug(err)
			log.Fatal("Failed to stop running services")
		}

		log.Info("Cleanup complete. See you later, grasshopper!")
	}

	// Don't cancel the contexts before shutting down the containers
	e.Cancel()
}

func init() {
	rootCmd.AddCommand(devCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	devCmd.PersistentFlags().StringVarP(&environment.Port, "port", "p", "1337", "Port for dev proxy")
	// devCmd.PersistentFlags().BoolVarP(&expose, "expose", "e", false, "Expose local environment to public internet")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	//devCmd.Flags().BoolVarP(&background, "background", "b", false, "Run dev services in background")
}

/*
	// Following code belongs to Nhost tunnelling service
	// We've decided not to incorporate this feature inside the CLI until V2

	// expose to public internet
	var exposed bool
		if expose {
			go func() {

				// get the user's credentials
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

						// Listen for tunnel state changes
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
