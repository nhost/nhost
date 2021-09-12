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
	"errors"
	"fmt"
	"io/fs"
	"io/ioutil"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"plugin"
	"strings"
	"syscall"
	"time"

	"github.com/evanw/esbuild/pkg/api"
	"github.com/mrinalwahal/cli/nhost"
	"github.com/spf13/cobra"
)

var (
	// initialize temporary directory for caching
	tempDir, _ = ioutil.TempDir("", "")

	funcPort string

	// vars to store server state during each runtime
	functions []Function
	buildDir  string

	// runtime environment variables
	envVars []string

	// initialize functions server and multiplexer
	functionMux    *http.ServeMux
	functionServer *http.Server
)

type GoPlugin struct {
	Data   []byte
	Plugin *plugin.Plugin
}

// uninstallCmd removed Nhost CLI from system
var functionsCmd = &cobra.Command{
	Use:   "functions [-p port]",
	Short: "Serve and manage serverless functions",
	Long:  `Serve and manage serverless functions.`,
	PostRun: func(cmd *cobra.Command, args []string) {

		if err := deletePath(tempDir); err != nil {
			log.WithField("component", "cache").Debug(err)
		}
		os.Exit(0)

	},
	Run: func(cmd *cobra.Command, args []string) {

		// add cleanup action in case of signal interruption
		signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
		go func() {
			<-stop
			cmd.PostRun(cmd, args)
		}()

		ServeFuncs(cmd, args)
	},
}

func ServeFuncs(cmd *cobra.Command, args []string) {

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
	if prepareNode {

		// first, check for runtime installation
		if _, err := exec.LookPath("node"); err != nil {
			log.Debug(err)
			log.WithField("runtime", "NodeJS").Error("Runtime not found")
			log.WithField("runtime", "NodeJS").Info("Install from:", "https://nodejs.org/en/download/")
		}

		// detect package.json inside functions dir
		buildDir = nhost.WORKING_DIR
		if pathExists(filepath.Join(nhost.API_DIR, "package.json")) {
			buildDir = nhost.API_DIR
		} else if !pathExists(filepath.Join(nhost.WORKING_DIR, "package.json")) {
			log.WithField("runtime", "NodeJS").Error("Neither a local, nor a root package.json found")
			log.WithField("runtime", "NodeJS").Warn("Run `npm init && npm i` to use functions")
		}
	}

	// initialize server multiplexer
	functionMux = http.NewServeMux()
	functionServer = &http.Server{Addr: ":" + funcPort, Handler: functionMux}

	functionMux.HandleFunc("/", handler)

	if !contains(args, "do_not_inform") {
		log.Info("Nhost functions serving at: http://localhost:", funcPort)
	}

	go func() {
		if err := functionServer.ListenAndServe(); err != nil {
			log.WithField("component", "functions").Debug(err)
		}
	}()

	// Catch signal interruption (ctrl+c), and stop the server.
	<-stop

	// Gracefully shut down the functions server
	functionServer.Shutdown(context.Background())
}

func handler(w http.ResponseWriter, r *http.Request) {

	var f Function

	filesToAvoid := []string{
		"node_modules",
		"package.json",
		"package-lock.json",
		"yarn.lock",
		"go.mod",
		"go.sum",
	}

	getRoute := func(path string, item fs.FileInfo, err error) error {

		if len(f.Path) > 0 || item.IsDir() {
			return nil
		}

		// initialize the base directory
		base, file := filepath.Split(strings.TrimPrefix(path, nhost.API_DIR))
		base = filepath.Clean(base)

		for _, itemToAvoid := range filesToAvoid {
			if strings.Contains(path, itemToAvoid) {
				return nil
			}
		}

		if fileNameWithoutExtension(item.Name()) != "" {
			if r.URL.Path == base {
				if fileNameWithoutExtension(file) == "index" {
					f.Path = path
					f.Route = r.URL.Path
					f.Base = base
					f.File = item
				}
			} else {
				if filepath.Join(base, fileNameWithoutExtension(file)) == r.URL.Path {
					f.Path = path
					f.Route = r.URL.Path
					f.Base = base
					f.File = item
				}
			}
		}

		return nil
	}

	if err := filepath.Walk(nhost.API_DIR, getRoute); err != nil {
		log.WithField("component", "server").Debug(err)
		log.WithField("component", "server").Error("No function found on this route")
	}

	// If no function file has been found,
	// then return 404 error
	if len(f.Path) == 0 {
		http.Error(w, http.StatusText(http.StatusNotFound), http.StatusNotFound)
		return
	}

	// Validate whether the function has been built before
	preBuilt := false

	// Uncomment the following to enable caching
	/*
		for index, item := range functions {

			// check whether it's the same function file
			if item.Path == f.Path {

				// now compare modification time of function file
				// with it's cached copy
				if f.File.ModTime().Equal(item.File.ModTime()) {

					log.WithField("route", f.Route).Debug("Found cached copy of function")
					f = item
					preBuilt = true

				} else {

					// if file has been modified, clean the cache location
					log.Debug("Removing temporary directory from: ", filepath.Dir(item.Build))
					if err := os.RemoveAll(filepath.Dir(item.Build)); err != nil {
						if _, ok := err.(*os.PathError); ok {
							log.Debug("failed to remove temp directory: ", err)
						}
					}

					// delete the saved function from array
					functions = remove(functions, index)
				}

				break
			}
		}
	*/

	if !preBuilt {

		// cache the function file to temporary directory
		if err := os.MkdirAll(filepath.Join(tempDir, f.Base), os.ModePerm); err != nil {
			log.WithField("route", f.Route).Debug(err)
			log.WithField("route", f.Route).Error("Failed to prepare location to cache function file")
			return
		}

		if err := f.Prepare(); err != nil {
			log.WithField("route", f.Route).Debug(err)
			log.WithField("route", f.Route).Error("Failed to build the function")
			return
		}

		// save the function before serving it
		functions = append(functions, f)

	}

	//
	// Handle Environment Variables
	//

	// If environment variables haven't been loaded
	// then load them from .env.development
	if len(envVars) == 0 {
		envVars, _ = nhost.Env()
	}

	// If the environment is active,
	// assign important env vars during runtime
	if environment.Active {

		runtimeVars := []string{
			fmt.Sprintf("HASURA_GRAPHQL_JWT_SECRET=%v", fmt.Sprintf(`{"type":"HS256", "key": "%v"}`, nhost.JWT_KEY)),
			fmt.Sprintf("HASURA_GRAPHQL_ADMIN_SECRET=%v", environment.Config.Services["hasura"].AdminSecret),
			fmt.Sprintf("NHOST_BACKEND_URL=http://localhost:%v", port),
		}

		// set the runtime env vars
		for _, item := range runtimeVars {
			payload := strings.Split(item, "=")
			os.Setenv(payload[0], payload[1])
		}

		// append the runtime env vars
		envVars = append(envVars, runtimeVars...)
	}

	switch filepath.Ext(f.Path) {
	case ".js", ".ts":

		// start the NodeJS server
		nodeCLI, err := exec.LookPath("node")
		if err != nil {
			log.WithField("runtime", "NodeJS").Debug(err)
			log.WithField("runtime", "NodeJS").Error("Runtime not installed")
			return
		}

		// initialize random port to serve the file
		jsPort := nhost.GetPort(9401, 9500)

		// prepare the node server configuration
		if err := f.BuildNodeServer(jsPort); err != nil {
			log.WithField("runtime", "NodeJS").Debug(err)
			log.WithField("runtime", "NodeJS").Error("Failed to start the runtime server")
		}

		// prepare the execution command
		cmd := exec.Cmd{
			Path:   nodeCLI,
			Env:    envVars,
			Args:   []string{nodeCLI, f.ServerConfig},
			Stdout: os.Stdout,
			Stderr: os.Stderr,
		}

		// begin the comand execution
		if err := cmd.Start(); err != nil {
			log.WithField("runtime", "NodeJS").Debug(err)
			log.WithField("runtime", "NodeJS").Error("Failed to start the runtime server")
		}

		// update request URL
		q := r.URL.Query()
		url, _ := url.Parse(fmt.Sprintf("%s://localhost:%v%s", r.URL.Scheme, jsPort, r.URL.Path))
		r.URL = url
		r.URL.RawQuery = q.Encode()

		// serve
		f.Handler(w, r)

		// kill the command execution once the req is served
		if err := cmd.Process.Kill(); err != nil {
			log.Error("failed to kill process: ", err)
		}

		// delete the node server configuration
		if err := os.Remove(f.ServerConfig); err != nil {
			log.WithField("runtime", "NodeJS").Debug(err)
		}

	case ".go":

		// serve
		f.Handler(w, r)
	}

	// log the request
	log.WithField("method", r.Method).Debugln(
		r.Proto,
		r.URL,
		fmt.Sprint("Served: ", filepath.Join(f.Base, f.File.Name())),
	)

}

func (function *Function) BuildNodePackage() error {

	log.WithField("runtime", "NodeJS").Debug("Building function")

	// initialize path for temporary esbuild output
	file, err := ioutil.TempFile(filepath.Join(tempDir, function.Base), "*.js")
	if err != nil {
		return err
	}

	defer file.Close()

	function.Build = file.Name()

	// build the .js files with esbuild
	result := api.Build(api.BuildOptions{
		AbsWorkingDir:    buildDir,
		EntryPoints:      []string{function.Path},
		Outfile:          function.Build,
		Bundle:           true,
		Write:            true,
		Platform:         api.PlatformNode,
		MinifyWhitespace: true,
		MinifySyntax:     true,
	})

	if len(result.Errors) > 0 {
		log.WithField("file", function.File.Name()).Error("Failed to run esbuild")
		return errors.New(result.Errors[0].Text)
	}

	return nil
}

func (function *Function) BuildNodeServer(port int) error {

	// add function to NodeJS server config
	nodeServerCode := fmt.Sprintf(`
		const express = require('%s');
		const app = express();
		
		app.use(express.json());
		app.use(express.urlencoded({ extended: true }));
		app.disable('x-powered-by');
		
		let func;
		const requiredFile = require('%s')
		
		if (typeof requiredFile === "function") {
			func = requiredFile;
		} else if (typeof requiredFile.default === "function") {
			func = requiredFile.default;
		} else {
			return;
		}
		
		app.all('%s', func);
			
		app.listen(%d);`, filepath.Join(buildDir, "node_modules", "express"), function.Build, function.Route, port)

	// save the nodeJS server config
	file, err := ioutil.TempFile(filepath.Join(tempDir, function.Base), "*.js")
	if err != nil {
		log.WithField("runtime", "NodeJS").Error("Failed to create server configuration file")
		return err
	}

	// save the server file location
	function.ServerConfig = file.Name()

	defer file.Close()

	if _, err := file.Write([]byte(nodeServerCode)); err != nil {
		log.WithField("runtime", "NodeJS").Error("Failed to save server configuration")
		return err
	}

	file.Sync()

	return nil
}

func (function *Function) Prepare() error {

	switch filepath.Ext(function.Path) {

	case ".js", ".ts":

		// build the package
		if err := function.BuildNodePackage(); err != nil {
			return err
		}

		// save the handler
		function.Handler = router

		return nil

	case ".go":

		// Build the plugin
		p, err := function.BuildGoPlugin()
		if err != nil {
			log.Error("Failed to build Go plugin: ", filepath.Join(function.Base, filepath.Base(function.Path)))
			return err
		}

		// Save the plugin
		function.Plugin = p

		// Lookup - Searches for a symbol name in the plugin
		symbol, err := function.Plugin.Lookup("Handler")
		if err != nil {
			log.WithField("plugin", function.Route).Error("Failed to lookup handler")
			return err
		}

		// symbol - Checks the function signature
		handler, ok := symbol.(func(http.ResponseWriter, *http.Request))
		if !ok {
			return errors.New("handler function is broken")
		}

		// update the handler for this function
		function.Handler = handler
	}

	return nil
}

func router(w http.ResponseWriter, r *http.Request) {

	var err error
	var resp *http.Response

	buf, _ := ioutil.ReadAll(r.Body)
	/*
		ctx, cancel := context.WithCancel(r.Context())
		defer cancel()
	*/

	req, _ := http.NewRequestWithContext(
		r.Context(),
		r.Method,
		r.URL.String(),
		bytes.NewBuffer(buf),
	)

	req.Header = r.Header

	/*
		client := &http.Client{
			Transport: &http.Transport{
				// DisableKeepAlives:   true,
				MaxIdleConns:        0,
				MaxIdleConnsPerHost: 0,
				MaxConnsPerHost:     0,
			},
			Timeout: time.Second * 5,
		}
	*/

	for {
		resp, err = http.DefaultClient.Do(req)
		if _, ok := err.(net.Error); ok {
			time.Sleep(60 * time.Millisecond)
		} else {
			break
		}
	}

	if resp != nil {

		// set the response headers
		for key, value := range resp.Header {
			if resp.Header.Get(key) != "" {
				w.Header().Add(key, value[0])
			}
		}

		// if request failed, write HTTP error to response
		if err != nil {
			http.Error(w, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
			return
		}

		// remember to close the connection after reading the body
		defer resp.Body.Close()

		// read the body
		body, err := ioutil.ReadAll(resp.Body)
		if err != nil {
			http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
			return
		}

		// Check CORS headers
		cors := map[string]string{
			"Access-Control-Allow-Origin":  "*",
			"Access-Control-Allow-Headers": "origin,Accept,Authorization,Content-Type",
		}

		for key, value := range cors {
			if resp.Header.Get(key) == "" {
				w.Header().Set(key, value)
			}
		}

		// set response code to header
		if resp.StatusCode != http.StatusOK {
			w.WriteHeader(resp.StatusCode)
		}

		fmt.Fprint(w, string(body))
	}
}

func (function *Function) BuildGoPlugin() (*plugin.Plugin, error) {

	log.WithField("runtime", "Go").Debug("Building function")

	var p *plugin.Plugin
	tempFile, err := ioutil.TempFile(tempDir, fileNameWithoutExtension(function.File.Name())+".so")
	if err != nil {
		return p, err
	}

	defer tempFile.Close()

	function.Build = filepath.Join(tempDir, tempFile.Name())

	log.WithField("plugin", filepath.Base(function.Path)).Debug("Creating plugin at: ", function.Build)

	CLI, err := exec.LookPath("go")
	if err != nil {
		return p, err
	}

	// "-ldflags", fmt.Sprintf(`"-pluginpath=%v"`, time.Now().Unix()),
	execute := exec.Cmd{
		Path: CLI,
		Args: []string{CLI, "build", "-buildmode=plugin", "-o", function.Build, function.Path},
		// Dir:  nhost.API_DIR,
	}

	if err := execute.Run(); err != nil {
		return p, err
	}

	// Open - Loads the plugin
	return plugin.Open(function.Build)
}

func fileNameWithoutExtension(fileName string) string {
	return strings.TrimSuffix(fileName, filepath.Ext(fileName))
}

func remove(s []Function, i int) []Function {
	s[i] = s[len(s)-1]
	return s[:len(s)-1]
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
