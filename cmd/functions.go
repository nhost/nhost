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
	"io/ioutil"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"plugin"
	"strings"
	"sync"
	"syscall"
	"text/tabwriter"

	"github.com/mrinalwahal/cli/nhost"
	"github.com/spf13/cobra"
)

var (
	filesToClean     = []string{}
	jsPort           = "9296"
	tempDir, _       = ioutil.TempDir("", nhost.PROJECT+"_functions_runtime")
	nodeServerConfig = filepath.Join(tempDir, "server.js")
	port             string
	functions        []Function
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
		printRoutes()
	},
}

func printRoutes() {
	w := tabwriter.NewWriter(os.Stdout, 1, 1, 1, ' ', 0)

	fmt.Fprintln(w, "route\t\tfile")
	fmt.Fprintln(w, "---\t\t-----")
	for _, item := range functions {
		fmt.Fprintf(w, "%v\t\t%v", item.Route, filepath.Join(item.Base, filepath.Base(item.File)))
		fmt.Fprintln(w)
	}
	w.Flush()

}

func removeTemp() {
	log.Debug("Removing temporary directory from: ", tempDir)
	os.RemoveAll(tempDir)
	log.Info("Server stopped. See you later!")
	os.Exit(0)
}

func serve(cmd *cobra.Command, args []string) {

	if !pathExists(nhost.API_DIR) {
		log.Fatal("Functions directory not found")
	}

	if err := buildNodeServer(); err != nil {
		log.Debug(err)
		log.Error("Failed to initialize NodeJS server configuration")
		return
	}

	// run recursive function to generate routes
	if err := generateRoutes(nhost.API_DIR); err != nil {
		log.Debug(err)
		log.Error("Failed to generate HTTP routes")
		return
	}

	// prepare the generated routes
	for _, item := range functions {
		if err := item.Prepare(); err != nil {
			log.WithField("route", item.Route).Debug(err)
			log.WithField("route", item.Route).Error("Failed to prepare the HTTP route")
			return
		}
	}

	// complete NodeJS server configuration
	if err := writeToFile(nodeServerConfig, "\napp.listen(port)", "end"); err != nil {
		log.WithField("runtime", "NodeJS").Debug(err)
		log.WithField("runtime", "NodeJS").Error("Failed to complete server configuration")
		removeTemp()
	}

	// start the NodeJS server
	nodeCLI, err := exec.LookPath("node")
	if err != nil {
		log.WithField("runtime", "NodeJS").Debug(err)
		log.WithField("runtime", "NodeJS").Error("Runtime not installed")
		removeTemp()
	}

	execute := exec.Cmd{
		Path: nodeCLI,
		Args: []string{nodeCLI, nodeServerConfig, jsPort},
	}

	go execute.Run()

	log.Info("Nhost functions serving at: http://localhost:", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.WithField("runtime", "NodeJS").Debug(err)
		log.WithField("runtime", "NodeJS").Error("Failed to serve the functions")
		removeTemp()
	}
}

func generateRoutes(path string) error {

	// declare the base directory
	base := strings.TrimPrefix(path, nhost.API_DIR)

	files, err := os.ReadDir(path)
	if err != nil {
		return err
	}

	filesToAvoid := []string{
		"node_modules",
		"package.json",
		"package-lock.json",
		"server.js",
	}

	for _, item := range files {

		if !contains(filesToAvoid, item.Name()) {

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
				return generateRoutes(itemPath)
			}

			switch filepath.Ext(item.Name()) {
			case ".js":
				functions = append(functions, Function{
					Route:     route,
					File:      itemPath,
					Handler:   jsHandler,
					Extension: "js",
					Base:      base,
				})
			case ".go":
				functions = append(functions, Function{
					Route:     route,
					File:      itemPath,
					Extension: "go",
					Base:      base,
				})
			}

		}
	}
	return nil
}

func (function *Function) Prepare() error {
	switch function.Extension {
	case "js":
		// add function to NodeJS server config
		if err := writeToFile(nodeServerConfig, fmt.Sprintf("\napp.use('%s', require('%s'));", function.Route, function.File), "end"); err != nil {
			log.Errorf("Failed to add %s to server configuration", filepath.Base(function.File))
			return err
		}
	case "go":

		pluginPath, err := buildGoPlugin(function.File)
		if err != nil {
			log.Error("Failed to build Go plugin: ", filepath.Join(function.Base, filepath.Base(function.File)))
			return err
		}

		// Glob - Gets the plugin to be loaded
		plugins, err := filepath.Glob(pluginPath)
		if err != nil {
			log.WithField("plugin", filepath.Base(pluginPath)).Error("Failed to search for plugin")
			return err
		}

		if len(plugins) == 0 {
			return errors.New("Failed to search for plugin: " + filepath.Base(pluginPath))
		}

		// Open - Loads the plugin
		p, err := plugin.Open(plugins[0])
		if err != nil {
			log.WithField("plugin", filepath.Base(pluginPath)).Error("Failed to load the plugin")
			return err
		}

		// Lookup - Searches for a symbol name in the plugin
		symbol, err := p.Lookup("Handler")
		if err != nil {
			log.WithField("plugin", filepath.Base(pluginPath)).Error("Failed to lookup handler")
			return err
		}

		// symbol - Checks the function signature
		handler, ok := symbol.(func(http.ResponseWriter, *http.Request))
		if !ok {
			log.WithField("plugin", filepath.Base(pluginPath)).Error("Handler function is broken")
			return err
		}

		// update the handler for this function
		function.Handler = handler
	}

	// add function handler to `dev` environment server
	http.HandleFunc(function.Route, function.Handler)
	return nil
}
func jsHandler(w http.ResponseWriter, r *http.Request) {

	//Leverage Go's HTTP Post function to make request
	req, _ := http.NewRequest(
		r.Method,
		"http://localhost:"+jsPort+r.URL.Path,
		r.Body,
	)

	req.Header = r.Header
	req.URL.RawQuery = r.URL.RawQuery

	client := http.Client{}

	//Leverage Go's HTTP Post function to make request
	resp, err := client.Do(req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	body, _ := ioutil.ReadAll(resp.Body)

	fmt.Fprint(w, string(body))
}

func buildGoPlugin(path string) (string, error) {

	tempFile, err := ioutil.TempFile(tempDir, "*.so")
	if err != nil {
		log.Fatal(err)
	}

	defer tempFile.Close()

	pluginPath := filepath.Join(tempDir, tempFile.Name())

	log.WithField("plugin", filepath.Base(path)).Debug("Creating plugin at: ", pluginPath)

	CLI, err := exec.LookPath("go")
	if err != nil {
		return "", err
	}

	execute := exec.Cmd{
		Path: CLI,
		Args: []string{CLI, "build", "-buildmode=plugin", "-o", pluginPath, path},
		// Dir:  nhost.API_DIR,
	}

	if err := execute.Run(); err != nil {
		return "", err
	}

	return pluginPath, nil

}

// prepare the server before serving
func buildNodeServer() error {
	serverCode := []byte(fmt.Sprintf(`const express = require('%s/express');
	const port = parseInt(process.argv[2], 10);
	const app = express()`, filepath.Join(nhost.API_DIR, "node_modules")))

	f, err := os.Create(nodeServerConfig)
	if err != nil {
		return err
	}

	defer f.Close()

	if _, err := f.Write(serverCode); err != nil {
		return err
	}

	f.Sync()

	filesToClean = append(filesToClean, nodeServerConfig)
	return nil
}

func fileNameWithoutExtension(fileName string) string {
	return strings.TrimSuffix(fileName, filepath.Ext(fileName))
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
