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
	port string

	// initialize boolean to determine
	// whether to expose the local environment to the public internet
	// through a tunnel
	expose bool

	// proxy mux
	mux *http.ServeMux

	// reverse proxy server
	proxy *http.Server

	// signal interruption channel
	stop = make(chan os.Signal)

	// fsnotify watcher
	watcher *fsnotify.Watcher

	// execution specific context
	executionContext context.Context
	executionCancel  context.CancelFunc
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
		5.2	Once the container has been started, save the new container ID and assigned Port.
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
			go environment.Watch(watcher, cmd, args)
		}

		var end_waiter sync.WaitGroup
		end_waiter.Add(1)

		// add cleanup action in case of signal interruption
		signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
		go func() {
			<-stop
			cleanup(cmd)
		}()

		// being the execution
		execute(cmd, args)

		// Desginate the environment to have been Started
		environment.Started = true

		// wait for Ctrl+C
		end_waiter.Wait()
	},
}

func cleanup(cmd *cobra.Command) {

	if environment.Started {
		executionCancel()

		// Shut down the local reverse proxy
		proxy.Shutdown(environment.Context)

		// Shut down the functions server
		functionServer.Shutdown(environment.Context)
	}

	if environment.Active {
		log.Warn("Please wait while we cleanup")
		if err := environment.Shutdown(false); err != nil {
			log.Debug(err)
			log.Fatal("Failed to stop running services")
		}
		log.Info("Cleanup complete. See you later, grasshopper!")
	}

	// Don't cancel the contexts before shutting down the containers
	environment.Cancel()
	close(stop)

	// Exit the CLI
	os.Exit(0)
}

func execute(cmd *cobra.Command, args []string) {

	var err error

	// initialize new context for execution specific jobs
	executionContext, executionCancel = context.WithCancel(environment.Context)
	defer executionCancel()

	// initialize the proxy server
	mux = http.NewServeMux()
	proxy = &http.Server{Addr: ":" + port, Handler: mux}

	// initialize a common http client
	environment.HTTP = &http.Client{}

	// check if this is the first time dev env is running
	firstRun := !pathExists(filepath.Join(nhost.DOT_NHOST, "db_data"))
	if firstRun {
		log.Info("First run takes longer, please be patient")
	}

	// if functions exist,
	// start them and register as a service
	if pathExists(nhost.API_DIR) {

		funcPortStr, _ := strconv.Atoi(funcPort)
		portStr, _ := strconv.Atoi(port)
		environment.Config.Services["functions"] = &nhost.Service{
			Name:    "functions",
			Address: fmt.Sprintf("http://localhost:%v", funcPortStr),
			Handle:  "/v1/functions/",
			Proxy:   true,
			Port:    portStr,
		}
	}

	// Validate the availability of required docker images,
	// and download the ones that are missing
	if err := environment.CheckImages(); err != nil {
		log.Debug(err)
		log.Fatal("Failed to prepare environment")
	}

	// generate configuration for every service
	// this generates all env vars, mount points and commands
	if err := environment.Config.Init(); err != nil {
		log.Debug(err)
		log.Fatal("Failed to generate configuration")
	}

	// create the Nhost network if it doesn't exist
	if err := environment.PrepareNetwork(); err != nil {
		log.Debug(err)
		log.WithFields(logrus.Fields{
			"type":    "network",
			"network": nhost.PREFIX,
		}).Fatal("Failed to prepare network")
	}

	// create and start the conatiners
	for _, item := range environment.Config.Services {

		// Only those services which have a container configuration
		// This is being done to exclude FUNCTIONS
		if item.Config != nil {
			if err := item.Run(environment.Docker, environment.Context, environment.Network); err != nil {
				log.WithFields(logrus.Fields{
					"container": item.Name,
					"type":      "container",
				}).Debug(err)
				log.WithFields(logrus.Fields{
					"container": item.Name,
					"type":      "container",
				}).Error("Failed to run container")
				cleanup(cmd)
			}

			// Even if a single service has been successfully started,
			// designate the environment as "activated" to let it be cleaned on shutdown
			environment.Active = true
		}
	}

	//
	// Update the ports and IDs of services against the running ones
	//
	// Fetch list of existing containers
	containers, err := environment.GetContainers()
	if err != nil {
		log.Debug(err)
		log.Error("Failed to get running Nhost services")
		cleanup(cmd)
	}

	// Wrap fetched containers as services in the environment
	_ = environment.WrapContainersAsServices(containers)

	log.Info("Running a quick health check on services")
	if err := environment.HealthCheck(executionContext); err != nil {
		log.Debug(err)
		cleanup(cmd)
	}

	// prepare and load required binaries
	hasuraCLI, _ := hasura.Binary()

	environment.Hasura = &hasura.Client{
		Endpoint:    fmt.Sprintf(`http://localhost:%v`, environment.Config.Services["hasura"].Port),
		AdminSecret: fmt.Sprint(environment.Config.Services["hasura"].AdminSecret),
		Client:      &http.Client{},
		CLI:         hasuraCLI,
	}

	//
	// Apply migrations and metadata
	//
	log.Info("Preparing your data")
	if err = environment.Prepare(); err != nil {
		log.Debug(err)
		cleanup(cmd)
	}

	//
	// Everything after this point,
	// needs to be executed only the first time
	// the environment has been started.
	//
	if environment.Started {
		return
	}

	//
	// Apply Seeds on the first run
	//
	if firstRun {
		if err = environment.Seed(); err != nil {
			log.Debug(err)
			cleanup(cmd)
		}
	}

	// run the functions command
	go ServeFuncs(cmd, []string{"do_not_inform"})

	//spawn hasura console
	consolePort := nhost.GetPort(9301, 9400)

	go func() {

		// Start the hasura console
		cmd := exec.Cmd{
			Path: hasuraCLI,
			Args: []string{
				hasuraCLI,
				"console",
				"--endpoint",
				environment.Hasura.Endpoint,
				"--admin-secret",
				environment.Hasura.AdminSecret,
				"--console-port",
				fmt.Sprint(consolePort),
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

	// launch a local reverse proxy
	// for all Nhost services the CLI is running locally
	go func() {
		if err := proxy.ListenAndServe(); err != nil {
			log.WithFields(logrus.Fields{"component": "proxy", "value": port}).Debug(err)
		}
	}()

	// expose to public internet
	var exposed bool
	/*
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

			if err := item.IssueProxy(mux); err != nil {
				log.WithField("component", "server").Debug(err)
				log.WithField("component", "server").Error("Failed to proxy", name)
				cleanup(cmd)
			}

			// print the name and handle
			if exposed {
				fmt.Fprintf(
					w,
					"%v\t\t%v\t\t%v",
					strings.Title(strings.ToLower(name)), fmt.Sprintf("%shttp://localhost:%v%s%s", Gray, port, Reset, filepath.Clean(item.Handle)),
					fmt.Sprintf("%s%s%s%s", Gray, tunnelAddress, Reset, filepath.Clean(item.Handle)),
				)
			} else {
				fmt.Fprintf(w, "%v\t\t%v", strings.Title(strings.ToLower(name)), fmt.Sprintf("%shttp://localhost:%v%s%s", Gray, port, Reset, filepath.Clean(item.Handle)))
			}
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
	if exposed {
		fmt.Fprintln(w, "---\t\t-----\t\t-----")
	} else {
		fmt.Fprintln(w, "---\t\t-----")
	}
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

	log.Warn("Use Ctrl + C to stop running evironment")

	// launch sessions
	for key, item := range environment.Config.Sessions {

		log.WithFields(logrus.Fields{
			"type":  "session",
			"value": key,
		}).Debug("Spawning")

		item.Spawn()
	}
}

func init() {
	rootCmd.AddCommand(devCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	devCmd.PersistentFlags().StringVarP(&port, "port", "p", "1337", "Port for dev proxy")
	// devCmd.PersistentFlags().BoolVarP(&expose, "expose", "e", false, "Expose local environment to public internet")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	//devCmd.Flags().BoolVarP(&background, "background", "b", false, "Run dev services in background")
}
