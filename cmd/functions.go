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
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"plugin"
	"sync"
	"syscall"

	"github.com/nhost/cli-go/environment"
	"github.com/nhost/cli-go/functions"
	"github.com/nhost/cli-go/nhost"
	"github.com/nhost/cli-go/util"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

var (
	funcPort string

	// initialize functions server and multiplexer
	functionServer *functions.Server
)

type GoPlugin struct {
	Data   []byte
	Plugin *plugin.Plugin
}

// uninstallCmd removed Nhost CLI from system
var functionsCmd = &cobra.Command{
	Use:    "functions [-p port]",
	Hidden: true,
	Short:  "Serve and manage serverless functions",
	Long:   `Serve and manage serverless functions.`,
	Run: func(cmd *cobra.Command, args []string) {

		var end_waiter sync.WaitGroup
		end_waiter.Add(1)

		// add cleanup action in case of signal interruption
		signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
		go func() {

			// Catch signal interruption (ctrl+c), and stop the server.
			<-stop

			// Gracefully shut down the functions server
			functionServer.Shutdown(context.Background())

			end_waiter.Done()
		}()

		ServeFuncs()
		//	log.Info("Nhost functions serving at: http://localhost:", funcPort, filepath.Clean(functionHandler))
		log.Info("Nhost functions serving at: http://localhost:", funcPort)

		// Wait for execution to complete
		end_waiter.Wait()

		os.Exit(0)
	},
}

func ServeFuncs() {

	prepareNode := false
	prepareGo := false

	// traverse through the directory
	// and check if there's even a single JS/TS func
	files, _ := os.ReadDir(nhost.API_DIR)
	for _, item := range files {
		switch filepath.Ext(item.Name()) {
		case ".js", ".ts":
			prepareNode = true
		case ".go":
			prepareGo = true
		}
	}

	// validate golang installation
	if prepareGo {
		if _, err := exec.LookPath("go"); err != nil {
			log.Debug(err)
			log.WithField("runtime", "Go").Error("Runtime not found")
			log.WithField("runtime", "Go").Info("Install from:", "https://golang.org/doc/install")
		}
	}

	// if npm dependencies haven't been confirmed,
	// just install them on first run
	var buildDir string
	if prepareNode {

		// first, check for runtime installation
		if _, err := exec.LookPath("node"); err != nil {
			log.Debug(err)
			log.WithField("runtime", "NodeJS").Error("Runtime not found")
			log.WithField("runtime", "NodeJS").Info("Install from:", "https://nodejs.org/en/download/")
		}

		// detect package.json inside functions dir
		if util.PathExists(filepath.Join(nhost.API_DIR, "package.json")) {
			buildDir = nhost.API_DIR
		} else if !util.PathExists(filepath.Join(nhost.WORKING_DIR, "package.json")) {
			log.WithField("runtime", "NodeJS").Error("Neither a local, nor a root package.json found")
			log.WithField("runtime", "NodeJS").Warn("Run `npm init && npm i && npm i express` to use functions")
		}
	}

	//	Initialize a new functions server
	serverConfig := functions.ServerConfig{
		BuildDir:    buildDir,
		Environment: &env,
	}

	//	If the default/supplied port is available,
	//	attach it to the configuration,
	//	otherwise a random port will get selected
	if nhost.PortAvaiable(funcPort) {
		serverConfig.Port = funcPort
	}

	functionServer = functions.New(&serverConfig)

	go func() {
		if err := functionServer.ListenAndServe(); err != nil {
			log.WithFields(logrus.Fields{"component": "functions", "value": funcPort}).Debug(err)
		}
	}()

	// After launching, register the functions server in our environment
	if env.State > environment.Unknown {
		env.Servers = append(env.Servers, functionServer.Server)
	}
}

func init() {
	rootCmd.AddCommand(functionsCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	functionsCmd.Flags().StringVarP(&funcPort, "port", "p", "7777", "Custom port to serve functions on")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
}
