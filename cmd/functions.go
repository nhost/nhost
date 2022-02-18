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
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"

	"github.com/nhost/cli/functions"
	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/util"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

var (
	funcPort string

	//  initialize functions server and multiplexer
	functionServer *functions.Server

	buildDir string
)

//  uninstallCmd removed Nhost CLI from system
var functionsCmd = &cobra.Command{
	Use:    "functions [-p port]",
	Hidden: true,
	Short:  "Serve and manage serverless functions",
	Long:   `Serve and manage serverless functions.`,
	Run: func(cmd *cobra.Command, args []string) {

		var end_waiter sync.WaitGroup
		end_waiter.Add(1)

		//  add cleanup action in case of signal interruption
		signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
		go func() {

			//  Catch signal interruption (ctrl+c), and stop the server.
			<-stop

			//  Gracefully shut down the functions server
			functionServer.Shutdown(context.Background())

			end_waiter.Done()
		}()

		ServeFuncs()
		//	status.Info("Nhost functions serving at: http://localhost:", funcPort, filepath.Clean(functionHandler))
		status.Info("Nhost functions serving at: http://localhost:" + funcPort)

		//  Wait for execution to complete
		end_waiter.Wait()

		os.Exit(0)
	},
}

func prepareFunctionServer() error {

	prepareNode := fileExistsByExtension(nhost.API_DIR, ".js") || fileExistsByExtension(nhost.API_DIR, ".ts")
	prepareGo := fileExistsByExtension(nhost.API_DIR, ".go")

	//  validate golang installation
	if prepareGo {
		validateRuntime("go", "https://golang.org/doc/install")
	}

	//  if npm dependencies haven't been confirmed,
	//  just install them on first run
	if prepareNode {

		//  first, check for runtime installation
		validateRuntime("node", "https://nodejs.org/en/download/")

		//  detect package.json inside functions dir
		if util.PathExists(filepath.Join(nhost.API_DIR, "package.json")) {
			buildDir = nhost.API_DIR
		} else if !util.PathExists(filepath.Join(util.WORKING_DIR, "package.json")) {
			status.Warnln("Run `npm init && npm i && npm i express` to use functions")
			return errors.New("neither a local, nor a root package.json found")
		}
	}

	return nil
}

func ServeFuncs() error {

	//	Initialize a new functions server
	serverConfig := functions.ServerConfig{
		BuildDir:    buildDir,
		Environment: &env,
		Log:         log,
	}

	//	If the default/supplied port is available,
	//	attach it to the configuration,
	//	otherwise a random port will get selected
	if util.PortAvailable(funcPort) {
		serverConfig.Port = funcPort
	}

	functionServer = functions.New(&serverConfig)

	go func() {
		if err := functionServer.ListenAndServe(); err != nil {
			log.WithFields(logrus.Fields{"component": "functions", "value": funcPort}).Debug(err)
		}
	}()

	return nil
}

func fileExistsByExtension(directory, ext string) bool {

	//  traverse through the directory
	//  and check if there's even a single file with specified extension
	files, _ := os.ReadDir(directory)
	for _, item := range files {
		switch filepath.Ext(item.Name()) {
		case ext:
			return true
		}
	}

	return false
}

func validateRuntime(runtime, installPath string) {

	if _, err := exec.LookPath(runtime); err != nil {
		log.Debug(err)
		log.WithField("runtime", strings.Title(runtime)).Error("Runtime not found")
		log.WithField("runtime", strings.Title(runtime)).Info("Install from:", installPath)
	}

}

func init() {
	rootCmd.AddCommand(functionsCmd)

	//  Here you will define your flags and configuration settings.

	//  Cobra supports Persistent Flags which will work for this command
	//  and all subcommands, e.g.:
	functionsCmd.Flags().StringVarP(&funcPort, "port", "p", "7777", "Custom port to serve functions on")

	//  Cobra supports local flags which will only run when this command
	//  is called directly, e.g.:
}
