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
	"text/tabwriter"
	"time"

	"github.com/evanw/esbuild/pkg/api"
	"github.com/mrinalwahal/cli/nhost"
	"github.com/spf13/cobra"
)

var (
	jsPort           = getPort(9000, 9999)
	tempDir          string
	nodeServerConfig string
	port             string
	functions        []Function
	nodeServerCode   string
)

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
		serve(cmd, args)
		removeTemp()

		// wait for Ctrl+C
		end_waiter.Wait()

	},
}

// uninstallCmd removed Nhost CLI from system
var routesCmd = &cobra.Command{
	Use:   "routes",
	Short: "Generate routes for Nhost functions",
	Long: `Quick generate and validate routes for your Nhost functions
based on your file tree.`,
	Run: func(cmd *cobra.Command, args []string) {

		if !pathExists(nhost.API_DIR) {
			log.Fatal("Functions directory not found")
		}

		// run recursive function to generate routes
		if err := generateRoutes(nhost.API_DIR); err != nil {
			log.Debug(err)
			log.Fatal("Failed to generate HTTP routes")
		}

		// print the output
		printRoutes(functions)

		if countDuplicates(functions) > 0 {
			log.Error("Duplicate routes detected")
		}
	},
}

func printRoutes(list []Function) {
	w := tabwriter.NewWriter(os.Stdout, 1, 1, 1, ' ', 0)
	fmt.Fprintf(w, "Route\t\t%s%s/%sfile\n", Gray, filepath.Base(nhost.API_DIR), Reset)
	fmt.Fprintln(w, "-----\t\t-----")
	for _, item := range list {
		fmt.Fprintf(w, "%v\t\t%v", item.Route, filepath.Join(item.Base, filepath.Base(item.File)))
		fmt.Fprintln(w)
	}
	w.Flush()
}

func countDuplicates(dupArr []Function) int {
	dupcount := 0
	for i := 0; i < len(dupArr); i++ {
		for j := i + 1; j < len(dupArr); j++ {
			if dupArr[i].Route == dupArr[j].Route {
				dupcount++
				break
			}
		}
	}
	return dupcount
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
		// "hello.test",
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
		http.Error(w, fmt.Sprintf("No function found on route '%s'", r.URL.Path), http.StatusNotFound)
	}

	/*
		if err := f.Search(nhost.API_DIR, r.URL.Path); err != nil {
			log.WithField("component", "server").Debug(err)
			log.WithField("component", "server").Error("No function found on this route")
		}
	*/

	// Prepare to serve
	switch filepath.Ext(f.File) {
	case ".js", ".ts":

		// save the handler
		f.Handler = router

		// initialize NodeJS server config
		nodeServerConfig = filepath.Join(tempDir, "server.js")
		nodeServerCode = fmt.Sprintf(`const express = require('%s/express');
const port = %s;
const app = express();`, filepath.Join(nhost.API_DIR, "node_modules"), jsPort)
	}

	// inform the user of build the request
	log.Println(
		r.Method,
		r.URL.Path,
		r.Proto,
		r.Host,
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
			// Stderr: os.Stderr,
		}

		if err := cmd.Start(); err != nil {
			log.WithField("runtime", "NodeJS").Debug(err)
			log.WithField("runtime", "NodeJS").Error("Failed to start the runtime server")
		}

		// time.Sleep(1 * time.Second)

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

func serve(cmd *cobra.Command, args []string) {

	if !pathExists(nhost.API_DIR) {
		log.Fatal("Functions directory not found")
	}

	/*

		// run recursive function to generate routes
		if err := generateRoutes(nhost.API_DIR); err != nil {
			log.Debug(err)
			log.Error("Failed to generate HTTP routes")
			return
		}

		// check for duplicate routes
		if countDuplicates(functions) > 0 {
			log.Error("Duplicate routes detected")
			printRoutes(functions)
			return
		}

	*/

	http.HandleFunc("/", handler)
	log.Info("Nhost functions serving at: http://localhost:", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.WithField("component", "server").Debug(err)
		log.WithField("component", "server").Error("Failed to serve the functions")
		return
	}
}

func generateRoutes(path string) error {

	// initialize the base directory
	base := strings.TrimPrefix(path, nhost.API_DIR)

	files, err := os.ReadDir(path)
	if err != nil {
		return err
	}

	filesToAvoid := []string{
		"node_modules",
		"package.json",
		"package-lock.json",
		"yarn.lock",
		// "hello.test",
	}

	for _, item := range files {

		// ignore the files not required
		// as well as the files which start with a "."
		// for example: .env should be ignored
		if !contains(filesToAvoid, item.Name()) && fileNameWithoutExtension(item.Name()) != "" {

			itemPath := filepath.Join(nhost.API_DIR, base, item.Name())

			// generate route
			route := strings.Join([]string{base, fileNameWithoutExtension(item.Name())}, "/")
			if fileNameWithoutExtension(item.Name()) == "index" {
				if filepath.Clean(base) == "." {
					route = "/"
				} else {
					route = filepath.Clean(base)
				}
			}

			// if the item is a directory,
			// recursively initiate the function again
			if item.IsDir() {
				if err := generateRoutes(itemPath); err != nil {
					return err
				}
				continue
			}

			// since it's not a directory
			// initialize it's function
			f := Function{
				Route: route,
				File:  itemPath,
				Base:  base,
			}

			// attach the required handler subject to file extension
			switch filepath.Ext(item.Name()) {
			case ".js", ".ts":
				// f.Handler = router
			}

			// add the new function
			functions = append(functions, f)
		}
	}
	return nil
}

func (function *Function) Search(path, url string) error {

	if len(function.File) > 0 {
		return nil
	}

	// initialize the base directory
	base := strings.TrimPrefix(path, nhost.API_DIR)

	files, err := os.ReadDir(nhost.API_DIR)
	if err != nil {
		return err
	}

	filesToAvoid := []string{
		"node_modules",
		"package.json",
		"package-lock.json",
		"yarn.lock",
		// "hello.test",
	}

	for _, item := range files {

		// ignore the files not required
		// as well as the files which start with a "."
		// for example: .env should be ignored
		if !contains(filesToAvoid, item.Name()) && fileNameWithoutExtension(item.Name()) != "" {

			itemPath := filepath.Join(nhost.API_DIR, base, item.Name())

			// generate route
			route := strings.Join([]string{base, fileNameWithoutExtension(item.Name())}, "/")
			if fileNameWithoutExtension(item.Name()) == "index" {
				if filepath.Clean(base) == "." {
					route = "/"
				} else {
					route = filepath.Clean(base)
				}
			}

			// if the item is a directory,
			// recursively initiate the function again
			if item.IsDir() {
				if err := function.Search(itemPath, url); err != nil {
					return err
				}
				continue
			}

			// since it's not a directory
			// initialize it's function
			function.Route = route
			function.File = itemPath
			function.Base = base

			// attach the required handler subject to file extension
			switch filepath.Ext(item.Name()) {
			case ".js", ".ts":
				function.Handler = router
			}
		}
	}
	return nil
}

func (function *Function) BuildNodePackage() error {

	// initialize path for temporary esbuild output
	tempFile, err := ioutil.TempFile(tempDir, "*.js")
	if err != nil {
		log.Fatal(err)
	}

	defer tempFile.Close()
	location := filepath.Join(tempDir, tempFile.Name())

	// build the .js files with esbuild
	result := api.Build(api.BuildOptions{
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
	nodeServerCode += fmt.Sprintf(`
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
	
app.listen(port);`, location, function.Route)

	return nil
}

func (function *Function) Prepare() error {
	switch filepath.Ext(function.File) {
	case ".js", ".ts":
		if err := function.BuildNodePackage(); err != nil {
			return err
		}
		/*
			case ".ts":
				if err := function.BuildNodePackage("\napp.all('%s', require('%s').default);"); err != nil {
					return err
				}
		*/
	case ".go":
		p, err := function.BuildGoPlugin()
		if err != nil {
			log.Error("Failed to build Go plugin: ", filepath.Join(function.Base, filepath.Base(function.File)))
			return err
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
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	body, _ := ioutil.ReadAll(resp.Body)
	fmt.Fprint(w, string(body))
}

func (function *Function) BuildGoPlugin() (*plugin.Plugin, error) {

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

	execute := exec.Cmd{
		Path: CLI,
		Args: []string{CLI, "build", "-ldflags", fmt.Sprintf(`"-pluginpath=%v"`, time.Now().Unix()), "-buildmode=plugin", "-o", pluginPath, function.File},
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
	functionsCmd.AddCommand(routesCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	functionsCmd.Flags().StringVarP(&port, "port", "p", "8080", "Custom port to serve functions on")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
}
