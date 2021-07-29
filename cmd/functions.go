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

	"github.com/evanw/esbuild/pkg/api"
	"github.com/mrinalwahal/cli/nhost"
	"github.com/spf13/cobra"
)

var (
	jsPort           = "9296"
	tempDir, _       = ioutil.TempDir("", nhost.PROJECT+"_functions_runtime")
	nodeServerConfig = filepath.Join(tempDir, "server.js")
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

func serve(cmd *cobra.Command, args []string) {

	if !pathExists(nhost.API_DIR) {
		log.Fatal("Functions directory not found")
	}

	// initialize NodeJS server config
	nodeServerCode = fmt.Sprintf(`const express = require('%s/express');
const port = %s;
const app = express();`, filepath.Join(nhost.API_DIR, "node_modules"), jsPort)

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

	// prepare the generated routes
	for _, item := range functions {
		if err := item.Prepare(); err != nil {
			log.WithField("route", item.Route).Debug(err)
			log.WithField("route", item.Route).Error("Failed to prepare the HTTP route")
			return
		}
	}

	// complete NodeJS server configuration
	nodeServerCode += "\napp.listen(port);"

	// save the nodeJS server config
	f, err := os.Create(nodeServerConfig)
	if err != nil {
		log.WithField("runtime", "NodeJS").Debug(err)
		log.WithField("runtime", "NodeJS").Error("Failed to create server configuration file")
		return
	}

	defer f.Close()

	if _, err := f.Write([]byte(nodeServerCode)); err != nil {
		log.WithField("runtime", "NodeJS").Debug(err)
		log.WithField("runtime", "NodeJS").Error("Failed to save server configuration")
		return
	}

	f.Sync()

	// start the NodeJS server
	nodeCLI, err := exec.LookPath("node")
	if err != nil {
		log.WithField("runtime", "NodeJS").Debug(err)
		log.WithField("runtime", "NodeJS").Error("Runtime not installed")
		return
	}

	execute := exec.Cmd{
		Path: nodeCLI,
		Args: []string{nodeCLI, nodeServerConfig},
	}

	go func() {
		output, err := execute.CombinedOutput()
		if err != nil {
			log.WithField("runtime", "NodeJS").Debug(string(output))
			log.WithField("runtime", "NodeJS").Error("Failed to start the runtime server")
			removeTemp()
		}
	}()

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
				f.Handler = jsHandler
			}

			// add the new function
			functions = append(functions, f)
		}
	}
	return nil
}

func (function *Function) BuildNodePackage(data string) error {

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
	nodeServerCode += fmt.Sprintf(data, function.Route, location)
	return nil
}

func (function *Function) Prepare() error {
	switch filepath.Ext(function.File) {
	case ".js":
		if err := function.BuildNodePackage("\napp.all('%s', require('%s'));"); err != nil {
			return err
		}
	case ".ts":
		if err := function.BuildNodePackage("\napp.all('%s', require('%s').default);"); err != nil {
			return err
		}
	case ".go":
		pluginPath, err := function.BuildGoPlugin()
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

/*
// Route wraps echo server into Lambda Handler
func Route(handler func(http.ResponseWriter, *http.Request)) func(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	return func(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
		body := strings.NewReader(request.Body)
		req := httptest.NewRequest(request.HTTPMethod, request.Path, body)
		for k, v := range request.Headers {
			req.Header.Add(k, v)
		}

		q := req.URL.Query()
		for k, v := range request.QueryStringParameters {
			q.Add(k, v)
		}
		req.URL.RawQuery = q.Encode()

		rec := httptest.NewRecorder()
		handler(rec, req)

		res := rec.Result()
		responseBody, err := ioutil.ReadAll(res.Body)

		responseHeaders := make(map[string]string)
		for key, value := range res.Header {
			responseHeaders[key] = ""
			if len(value) > 0 {
				responseHeaders[key] = value[0]
			}
		}
		if err != nil {
			return events.APIGatewayProxyResponse{
				Body:       err.Error(),
				Headers:    responseHeaders,
				StatusCode: http.StatusInternalServerError,
			}, err
		}

		return events.APIGatewayProxyResponse{
			Body:       string(responseBody),
			Headers:    responseHeaders,
			StatusCode: res.StatusCode,
		}, nil
	}
}
*/

func jsHandler(w http.ResponseWriter, r *http.Request) {

	//Leverage Go's HTTP Post function to make request
	req, _ := http.NewRequest(
		r.Method,
		"http://localhost:"+jsPort+r.URL.Path,
		r.Body,
	)

	req.Header = r.Header
	q := r.URL.Query()
	req.URL.RawQuery = q.Encode()
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

func (function *Function) BuildGoPlugin() (string, error) {

	tempFile, err := ioutil.TempFile(tempDir, "*.so")
	if err != nil {
		log.Fatal(err)
	}

	defer tempFile.Close()

	pluginPath := filepath.Join(tempDir, tempFile.Name())

	log.WithField("plugin", filepath.Base(function.File)).Debug("Creating plugin at: ", pluginPath)

	CLI, err := exec.LookPath("go")
	if err != nil {
		return "", err
	}

	execute := exec.Cmd{
		Path: CLI,
		Args: []string{CLI, "build", "-buildmode=plugin", "-o", pluginPath, function.File},
		// Dir:  nhost.API_DIR,
	}

	if err := execute.Run(); err != nil {
		return "", err
	}

	return pluginPath, nil

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
