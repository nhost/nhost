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
	"errors"
	"fmt"
	"io"
	"io/fs"
	"io/ioutil"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"plugin"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/evanw/esbuild/pkg/api"
	"github.com/mrinalwahal/cli/nhost"
	"github.com/spf13/cobra"
)

var (
	jsPort         = nhost.GetPort(9401, 9500)
	tempDir, _     = ioutil.TempDir("", "")
	funcPort       string
	functions      []Function
	nodeServerCode string

	// vars to store server state during each runtime
	nodeServerInstalled = false
	npmDepInstalled     = false
	expressPath         = filepath.Join(nhost.WORKING_DIR, "node_modules", "express")
	buildDir            string
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
		args = append(args, "inform")
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
					f.Name = fileNameWithoutExtension(file)
					f.File = item
				}
			} else {
				if filepath.Join(base, fileNameWithoutExtension(file)) == r.URL.Path {
					f.Path = path
					f.Route = r.URL.Path
					f.Base = base
					f.Name = fileNameWithoutExtension(file)
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
	for index, item := range functions {

		// check whether it's the same function file
		if item.Path == f.Path {

			// now compare modification time of function file
			// with it's cached copy
			if f.File.ModTime() == item.File.ModTime() {
				log.WithField("route", f.Route).Debug("Found cached copy of function")
				f = item
				preBuilt = true
				break

			} else {

				// if file has been modified, clean the cache location
				log.Debug("Removing temporary directory from: ", filepath.Join(tempDir, f.Base))
				if err := os.RemoveAll(filepath.Join(tempDir, f.Base)); err != nil {
					log.Error("failed to remove temp directory: ", err)
				}

				// delete the saved function from array
				functions = remove(functions, index)
			}
		}
	}

	// inform the user of build the request
	log.Debugln(
		r.Method,
		r.Proto,
		r.URL,
		fmt.Sprintf("Serving: %s", filepath.Join(f.Base, f.File.Name())),
	)

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

		if _, err := copy(f.Path, filepath.Join(tempDir, f.Base, filepath.Base(f.Path))); err != nil {
			log.WithField("route", f.Route).Debug(err)
			log.WithField("route", f.Route).Error("Failed to cache function file")
			return
		}

		// save the function before serving it
		functions = append(functions, f)

	}

	// load .env.development
	env, err := nhost.Env()
	if err != nil {
		log.WithField("environment", ".env.development").Debug(err)
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

		cmd := exec.Cmd{
			Path:   nodeCLI,
			Env:    env,
			Args:   []string{nodeCLI, f.ServerConfig},
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
	}
}

func copy(src, dst string) (int64, error) {
	sourceFileStat, err := os.Stat(src)
	if err != nil {
		return 0, err
	}

	if !sourceFileStat.Mode().IsRegular() {
		return 0, fmt.Errorf("%s is not a regular file", src)
	}

	source, err := os.Open(src)
	if err != nil {
		return 0, err
	}
	defer source.Close()

	destination, err := os.Create(dst)
	if err != nil {
		return 0, err
	}
	defer destination.Close()
	nBytes, err := io.Copy(destination, source)
	return nBytes, err
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

	prepareNode := false

	// traverse through the directory
	// and check if there's even a single JS/TS func
	files, _ := os.ReadDir(nhost.API_DIR)
	for _, item := range files {
		if filepath.Ext(item.Name()) == ".js" || filepath.Ext(item.Name()) == ".ts" {
			prepareNode = true
			break
		}
	}

	// if npm dependencies haven't been confirmed,
	// just install them on first run
	if prepareNode {

		// detect package.json inside functions dir
		buildDir = nhost.WORKING_DIR
		if pathExists(filepath.Join(nhost.API_DIR, "package.json")) {
			buildDir = nhost.API_DIR
			expressPath = filepath.Join(nhost.API_DIR, "node_modules", "express")
		} else if !pathExists(filepath.Join(nhost.WORKING_DIR, "package.json")) {
			log.Error("neither a local, nor a root package.json found")
			return
		}

		/*
			if err := installNPMDependencies(); err != nil {
				log.WithField("component", "server").Debug(err)
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
				if strings.Contains(err.Error(), "permission denied") {
					log.WithField("component", "server").Error("Restart server with sudo/root permission")
				} else {
					log.WithField("component", "server").Error("Required build dependencies could not be installed")
				}
				removeTemp()
			}
		*/
	}

	http.HandleFunc("/", handler)
	if contains(args, "inform") {
		log.Info("Nhost functions serving at: http://localhost:", funcPort)
	}
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
	function.Build = filepath.Join(tempDir, tempFile.Name())

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
		log.WithField("file", filepath.Base(function.Path)).Error("Failed to run esbuild")
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
	
app.listen(%d);`, expressPath, function.Build, function.Route, jsPort)

	return nil
}

func (function *Function) Prepare() error {

	switch filepath.Ext(function.Path) {

	case ".js", ".ts":

		// initialize NodeJS server config
		function.ServerConfig = filepath.Join(tempDir, function.Base, "server.js")

		// build the package
		if err := function.BuildNodePackage(); err != nil {
			return err
		}

		// save the nodeJS server config
		file, err := os.Create(function.ServerConfig)
		if err != nil {
			log.WithField("runtime", "NodeJS").Error("Failed to create server configuration file")
			return err
		}

		defer file.Close()

		if _, err := file.Write([]byte(nodeServerCode)); err != nil {
			log.WithField("runtime", "NodeJS").Error("Failed to save server configuration")
			return err
		}

		file.Sync()

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

	//Leverage Go's HTTP Post function to make request
	req, _ := http.NewRequest(
		r.Method,
		fmt.Sprintf("http://localhost:%v"+r.URL.Path, jsPort),
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

	// set the response headers
	for key, value := range resp.Header {
		w.Header().Add(key, value[0])
	}

	// set response code to header
	w.WriteHeader(resp.StatusCode)

	// if request failed, write HTTP error to response
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Check CORS headers
	cors := map[string]string{
		"Access-Control-Allow-Origin":  "*",
		"Access-Control-Allow-Headers": "origin,Accept,Authorization,Content-Type",
	}

	for key, value := range cors {
		if w.Header().Get(key) == "" {
			w.Header().Add(key, value)
		}
	}

	// read the body
	body, _ := ioutil.ReadAll(resp.Body)

	// finally the write the output
	fmt.Fprint(w, string(body))
}

func (function *Function) BuildGoPlugin() (*plugin.Plugin, error) {

	log.WithField("runtime", "Go").Debug("Building function")

	var p *plugin.Plugin
	tempFile, err := ioutil.TempFile(tempDir, function.Name+".so")
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
