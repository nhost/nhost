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
	"errors"
	"fmt"
	"io/fs"
	"io/ioutil"
	"math/rand"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"plugin"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/evanw/esbuild/pkg/api"
	"github.com/mrinalwahal/cli/nhost"
	"github.com/spf13/cobra"
)

var (
	jsPort           = getPort(9000, 9999)
	tempDir          string
	nodeServerConfig string
	funcPort         string
	// functions        []Function
	nodeServerCode string

	// vars to store server state during each runtime
	nodeServerInstalled = false
	npmDepInstalled     = false
	expressPath         = filepath.Join(nhost.WORKING_DIR, "node_modules", "express")
	buildDir            string
	plugins             []GoPlugin
)

type GoPlugin struct {
	Data   []byte
	Plugin *plugin.Plugin
}

// uninstallCmd removed Nhost CLI from system
var functionsCmd = &cobra.Command{
	Use:   "functions [port_number]",
	Short: "Serve and manage serverless functions",
	Long:  `Serve and manage serverless functions.`,
	Run: func(cmd *cobra.Command, args []string) {

		var end_waiter sync.WaitGroup
		end_waiter.Add(1)

		// add cleanup action in case of signal interruption
		c := make(chan os.Signal)
		signal.Notify(c, os.Interrupt, syscall.SIGTERM)
		go func() {
			<-c
			removeTemp()
		}()

		// being the execution
		ServeFuncs(cmd, args)
		removeTemp()

		// wait for Ctrl+C
		end_waiter.Wait()

	},
}

func removeTemp() {
	log.Debug("Removing temporary directory from: ", tempDir)
	os.RemoveAll(tempDir)
	os.Exit(0)
}

func handler(w http.ResponseWriter, r *http.Request) {

	// initialize tempDir
	tempDir, _ = ioutil.TempDir("", "")

	var f Function

	filesToAvoid := []string{
		"node_modules",
		"package.json",
		"package-lock.json",
		"yarn.lock",
	}

	getRoute := func(path string, item fs.FileInfo, err error) error {

		if len(f.File) > 0 || item.IsDir() {
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
					f.File = path
					f.Route = r.URL.Path
					f.Base = base
				}
			} else {
				if filepath.Join(base, fileNameWithoutExtension(file)) == r.URL.Path {
					f.File = path
					f.Route = r.URL.Path
					f.Base = base
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
	if len(f.File) == 0 {
		http.Error(w, http.StatusText(http.StatusNotFound), http.StatusNotFound)
	}

	// Prepare to serve
	switch filepath.Ext(f.File) {
	case ".js", ".ts":

		// detect package.json inside functions dir
		buildDir = nhost.WORKING_DIR
		if pathExists(filepath.Join(nhost.API_DIR, "package.json")) {
			buildDir = nhost.API_DIR
			expressPath = filepath.Join(nhost.API_DIR, "node_modules", "express")
		} else if !pathExists(filepath.Join(nhost.WORKING_DIR, "package.json")) {
			http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
			log.Error("neither a local, nor a root package.json found")
			return
		}

		// save the handler
		f.Handler = router

		// if npm dependencies haven't been confirmed,
		// just install them on first run
		if err := installNPMDependencies(); err != nil {
			log.WithField("component", "server").Debug(err)
			http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
			if strings.Contains(err.Error(), "permission denied") {
				log.WithField("component", "server").Error("Restart server with sudo/root permission")
			} else {
				log.WithField("component", "server").Error("Dependencies required by your functions could not be installed")
			}
			removeTemp()
		}

		// if express has been validated before,
		// skip validation to save execution time
		if err := validateExpress(); err != nil {
			log.WithField("component", "server").Debug(err)
			http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
			if strings.Contains(err.Error(), "permission denied") {
				log.WithField("component", "server").Error("Restart server with sudo/root permission")
			} else {
				log.WithField("component", "server").Error("Required build dependencies could not be installed")
			}
			removeTemp()
		}
	}

	// inform the user of build the request
	log.Debugln(
		Gray,
		r.Method,
		r.Proto,
		r.URL,
		Reset,
		fmt.Sprintf("Serving: %s", filepath.Join(f.Base, filepath.Base(f.File))),
	)

	if err := f.Prepare(); err != nil {
		log.WithField("route", f.Route).Debug(err)
		log.WithField("route", f.Route).Error("Failed to build the function")
		return
	}

	switch filepath.Ext(f.File) {
	case ".js", ".ts":

		// save the nodeJS server config
		file, err := os.Create(nodeServerConfig)
		if err != nil {
			log.WithField("runtime", "NodeJS").Debug(err)
			log.WithField("runtime", "NodeJS").Error("Failed to create server configuration file")
			return
		}

		defer file.Close()

		if _, err := file.Write([]byte(nodeServerCode)); err != nil {
			log.WithField("runtime", "NodeJS").Debug(err)
			log.WithField("runtime", "NodeJS").Error("Failed to save server configuration")
			return
		}

		file.Sync()

		// start the NodeJS server
		nodeCLI, err := exec.LookPath("node")
		if err != nil {
			log.WithField("runtime", "NodeJS").Debug(err)
			log.WithField("runtime", "NodeJS").Error("Runtime not installed")
			return
		}

		cmd := exec.Cmd{
			Path:   nodeCLI,
			Args:   []string{nodeCLI, nodeServerConfig},
			Stdout: os.Stdout,
			Stderr: os.Stderr,
		}

		if err := cmd.Start(); err != nil {
			log.WithField("runtime", "NodeJS").Debug(err)
			log.WithField("runtime", "NodeJS").Error("Failed to start the runtime server")
		}

		// serve
		f.Handler(w, r)

		if err := cmd.Process.Kill(); err != nil {
			log.Error("failed to kill process: ", err)
		}

	case ".go":

		// serve
		f.Handler(w, r)

		// Uncomment the following to catch HTTP ResponseWriter Body
		/*
			w := httptest.NewRecorder()
			f.Handler(w, r)

			fmt.Printf("%s", w.Body.String())
		*/
	}

	// cleanup
	log.Debug("Removing temporary directory from: ", tempDir)
	if err := os.RemoveAll(tempDir); err != nil {
		log.Error("failed to remove temp directory: ", err)
	}
}

func validateExpress() error {

	// if node modules already exist,
	// then return it's path
	// Install express module
	nodeCLI, err := exec.LookPath("npm")
	if err != nil {
		return err
	}

	cmd := exec.Cmd{
		Path: nodeCLI,
		Args: []string{nodeCLI, "list", "-g", "express"},
	}

	output, err := cmd.Output()
	if err != nil {

		// check if express is available in output
		if !strings.Contains(string(output), "express") {
			if err := installExpress(); err != nil {
				return err
			}
		} else {
			return errors.New(string(output))
		}
	}

	// link project with express global installation
	cmd = exec.Cmd{
		Path: nodeCLI,
		Args: []string{nodeCLI, "link", "express"},
		Dir:  buildDir,
	}

	return cmd.Run()
}

func installExpress() error {

	// break if dependency have already been confirmed
	if nodeServerInstalled {
		return nil
	}

	log.Info("Installing build dependencies on your first run")

	nodeCLI, err := exec.LookPath("npm")
	if err != nil {
		return err
	}

	// Install express module
	cmd := exec.Cmd{
		Path: nodeCLI,
		Args: []string{nodeCLI, "install", "-g", "express"},
	}

	output, err := cmd.CombinedOutput()
	if err != nil {
		return errors.New(string(output))
	}

	nodeServerInstalled = true

	return nil
}

func installNPMDependencies() error {

	// break if dependencies have already been confirmed
	if npmDepInstalled {
		return nil
	}

	log.Info("Installing dependencies of your functions")

	nodeCLI, err := exec.LookPath("npm")
	if err != nil {
		return err
	}

	// Install express module
	cmd := exec.Cmd{
		Path: nodeCLI,
		Args: []string{nodeCLI, "install"},
		Dir:  buildDir,
	}

	output, err := cmd.CombinedOutput()
	if err != nil {
		return errors.New(string(output))
	}

	// update the flag
	npmDepInstalled = true

	return nil
}

func ServeFuncs(cmd *cobra.Command, args []string) {

	if !pathExists(nhost.API_DIR) {
		log.Fatal("Functions directory not found")
	}

	http.HandleFunc("/", handler)
	log.Info("Nhost functions serving at: http://localhost:", funcPort)
	if err := http.ListenAndServe(":"+funcPort, nil); err != nil {
		log.WithField("component", "server").Debug(err)
		log.WithField("component", "server").Error("Failed to serve the functions")
		return
	}
}

func (function *Function) BuildNodePackage() error {

	log.WithField("runtime", "NodeJS").Debug("Building function")

	// initialize path for temporary esbuild output
	tempFile, err := ioutil.TempFile(tempDir, "*.js")
	if err != nil {
		log.Fatal(err)
	}

	defer tempFile.Close()
	location := filepath.Join(tempDir, tempFile.Name())

	// build the .js files with esbuild
	result := api.Build(api.BuildOptions{
		AbsWorkingDir:    buildDir,
		EntryPoints:      []string{function.File},
		Outfile:          location,
		Bundle:           true,
		Write:            true,
		Platform:         api.PlatformNode,
		MinifyWhitespace: true,
		MinifySyntax:     true,
	})

	if len(result.Errors) > 0 {
		log.WithField("file", filepath.Base(function.File)).Error("Failed to run esbuild")
		return errors.New(result.Errors[0].Text)
	}

	// add function to NodeJS server config
	nodeServerCode = fmt.Sprintf(`
const express = require('%s');
const app = express();
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
	
app.listen(%s);`, expressPath, location, function.Route, jsPort)

	return nil
}

func (function *Function) Prepare() error {

	switch filepath.Ext(function.File) {

	case ".js", ".ts":

		// initialize NodeJS server config
		nodeServerConfig = filepath.Join(tempDir, "server.js")

		// build the package
		return function.BuildNodePackage()

	case ".go":

		// read the go file
		data, err := ioutil.ReadFile(function.File)
		if err != nil {
			log.Error("Failed to read the function file")
			return err
		}

		// If a plugin for corresponding file data is already saved,
		// then load that plugin instead of building a new one
		pluginExists := false
		var p *plugin.Plugin
		for _, item := range plugins {
			if bytes.Equal(item.Data, data) {
				p = item.Plugin
				pluginExists = true
			}
		}

		// If a plugin hasn't been built yet,
		// then build one and save it
		// REASON:  This will save time in next execution cycle
		if !pluginExists {

			// Build the plugin
			p, err = function.BuildGoPlugin()
			if err != nil {
				log.Error("Failed to build Go plugin: ", filepath.Join(function.Base, filepath.Base(function.File)))
				return err
			}

			// Save the plugin corresponding to file data
			plugins = append(plugins, GoPlugin{
				Data:   data,
				Plugin: p,
			})
		}

		// Lookup - Searches for a symbol name in the plugin
		symbol, err := p.Lookup("Handler")
		if err != nil {
			log.WithField("plugin", filepath.Base(function.Route)).Error("Failed to lookup handler")
			return err
		}

		// symbol - Checks the function signature
		handler, ok := symbol.(func(http.ResponseWriter, *http.Request))
		if !ok {
			log.WithField("plugin", filepath.Base(function.Route)).Error("Handler function is broken")
			return err
		}

		// update the handler for this function
		function.Handler = handler
	}

	// add function handler to `dev` environment server
	// http.HandleFunc(function.Route, function.Handler)
	return nil
}

func router(w http.ResponseWriter, r *http.Request) {

	//Leverage Go's HTTP Post function to make request
	req, _ := http.NewRequest(
		r.Method,
		"http://localhost:"+jsPort+r.URL.Path,
		r.Body,
	)

	req.Header = r.Header
	q := r.URL.Query()
	req.URL.RawQuery = q.Encode()
	client := http.Client{
		Transport: &http.Transport{
			MaxIdleConnsPerHost: 20,
		},
		Timeout: 5 * time.Second,
	}

	//Leverage Go's HTTP Post function to make request
	resp, err := client.Do(req)
	if _, ok := err.(net.Error); ok {
		time.Sleep(30 * time.Millisecond)
		router(w, r)
		return
	}

	/*
		// set the response headers
		for key, value := range resp.Header {
			w.Header().Add(key, "")
			if len(value) > 0 {
				w.Header().Add(key, value[0])
			}
		}

		// set response code to header
		w.WriteHeader(resp.StatusCode)
	*/

	// if request failed, write HTTP error to response
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Add("Access-Control-Allow-Origin", "*")
	w.Header().Add("Access-Control-Allow-Headers", "origin,Accept,Authorization,Content-Type")

	// read the body
	body, _ := ioutil.ReadAll(resp.Body)

	// finally the write the output
	fmt.Fprint(w, string(body))
}

func (function *Function) BuildGoPlugin() (*plugin.Plugin, error) {

	log.WithField("runtime", "Go").Debug("Building function")

	var p *plugin.Plugin
	tempFile, err := ioutil.TempFile(tempDir, "*.so")
	if err != nil {
		return p, err
	}

	defer tempFile.Close()

	pluginPath := filepath.Join(tempDir, tempFile.Name())

	log.WithField("plugin", filepath.Base(function.File)).Debug("Creating plugin at: ", pluginPath)

	CLI, err := exec.LookPath("go")
	if err != nil {
		return p, err
	}

	// "-ldflags", fmt.Sprintf(`"-pluginpath=%v"`, time.Now().Unix()),
	execute := exec.Cmd{
		Path: CLI,
		Args: []string{CLI, "build", "-buildmode=plugin", "-o", pluginPath, function.File},
		// Dir:  nhost.API_DIR,
	}

	if err := execute.Run(); err != nil {
		return p, err
	}

	// Open - Loads the plugin
	return plugin.Open(pluginPath)
}

func fileNameWithoutExtension(fileName string) string {
	return strings.TrimSuffix(fileName, filepath.Ext(fileName))
}

func getPort(low, hi int) string {
	return strconv.Itoa(low + rand.Intn(hi-low))
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
