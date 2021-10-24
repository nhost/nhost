package functions

import (
	"bytes"
	"errors"
	"fmt"
	"io/ioutil"
	"net"
	"net/http"
	"os/exec"
	"path/filepath"
	"plugin"
	"time"

	"github.com/evanw/esbuild/pkg/api"
	"github.com/sirupsen/logrus"
)

func (function *Function) BuildNodePackage() error {

	function.log.WithFields(logrus.Fields{
		"component": "functions",
		"runtime":   "NodeJS",
	}).Debugln("Building", filepath.Join(function.Base, function.File.Name()))

	//  initialize path for temporary esbuild output
	file, err := ioutil.TempFile(filepath.Join(tempDir, function.Base), "*.js")
	if err != nil {
		return err
	}

	defer file.Close()

	function.Build = file.Name()

	//  build the .js files with esbuild
	result := api.Build(api.BuildOptions{
		AbsWorkingDir:    function.buildDir,
		EntryPoints:      []string{function.Path},
		Outfile:          function.Build,
		Bundle:           true,
		Write:            true,
		Platform:         api.PlatformNode,
		MinifyWhitespace: true,
		MinifySyntax:     true,
	})

	if len(result.Errors) > 0 {
		function.log.WithField("file", function.File.Name()).Error("Failed to run esbuild")
		return errors.New(result.Errors[0].Text)
	}

	return nil
}

func (function *Function) BuildNodeServer(port int) error {

	//  add function to NodeJS server config
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
			
		app.listen(%d);`, filepath.Join(function.buildDir, "node_modules", "express"), function.Build, function.Route, port)

	//  save the nodeJS server config
	file, err := ioutil.TempFile(filepath.Join(tempDir, function.Base), "*.js")
	if err != nil {
		function.log.WithField("runtime", "NodeJS").Error("Failed to create server configuration file")
		return err
	}

	//  save the server file location
	function.ServerConfig = file.Name()

	defer file.Close()

	if _, err := file.Write([]byte(nodeServerCode)); err != nil {
		function.log.WithField("runtime", "NodeJS").Error("Failed to save server configuration")
		return err
	}

	file.Sync()

	return nil
}

func (function *Function) Prepare() error {

	switch filepath.Ext(function.Path) {

	case ".js", ".ts":

		//  build the package
		if err := function.BuildNodePackage(); err != nil {
			return err
		}

		//  save the handler
		function.Handler = router

		return nil

	case ".go":

		//  Build the plugin
		p, err := function.BuildGoPlugin()
		if err != nil {
			function.log.Error("Failed to build Go plugin: ", filepath.Join(function.Base, filepath.Base(function.Path)))
			return err
		}

		//  Save the plugin
		function.Plugin = p

		//  Lookup - Searches for a symbol name in the plugin
		symbol, err := function.Plugin.Lookup("Handler")
		if err != nil {
			function.log.WithField("plugin", function.Route).Error("Failed to lookup handler")
			return err
		}

		//  symbol - Checks the function signature
		handler, ok := symbol.(func(http.ResponseWriter, *http.Request))
		if !ok {
			return errors.New("handler function is broken")
		}

		//  update the handler for this function
		function.Handler = handler
	}

	return nil
}

func router(w http.ResponseWriter, r *http.Request) {

	var err error
	var resp *http.Response

	buf, _ := ioutil.ReadAll(r.Body)
	req, _ := http.NewRequestWithContext(
		r.Context(),
		r.Method,
		r.URL.String(),
		bytes.NewBuffer(buf),
	)
	req.Header = r.Header

	for {
		resp, err = http.DefaultClient.Do(req)
		if _, ok := err.(net.Error); ok {
			time.Sleep(60 * time.Millisecond)
		} else {
			break
		}
	}

	if resp != nil {

		//  set the response headers
		for key, value := range resp.Header {
			if resp.Header.Get(key) != "" {
				w.Header().Add(key, value[0])
			}
		}

		//  if request failed, write HTTP error to response
		if err != nil {
			http.Error(w, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
			return
		}

		//  remember to close the connection after reading the body
		defer resp.Body.Close()

		//  read the body
		body, err := ioutil.ReadAll(resp.Body)
		if err != nil {
			http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
			return
		}

		//  Check CORS headers
		cors := map[string]string{
			"Access-Control-Allow-Origin":  "*",
			"Access-Control-Allow-Headers": "origin,Accept,Authorization,Content-Type",
		}

		for key, value := range cors {
			if resp.Header.Get(key) == "" {
				w.Header().Set(key, value)
			}
		}

		//  set response code to header
		if resp.StatusCode != http.StatusOK {
			w.WriteHeader(resp.StatusCode)
		}

		fmt.Fprint(w, string(body))
	}
}

func (function *Function) BuildGoPlugin() (*plugin.Plugin, error) {

	function.log.WithFields(logrus.Fields{
		"component": "functions",
		"runtime":   "Go",
	}).Debugln("Building", filepath.Join(function.Base, function.File.Name()))

	var p *plugin.Plugin
	tempFile, err := ioutil.TempFile(tempDir, fileNameWithoutExtension(function.File.Name())+".so")
	if err != nil {
		return p, err
	}

	defer tempFile.Close()

	function.Build = filepath.Join(tempDir, tempFile.Name())

	function.log.WithField("plugin", filepath.Base(function.Path)).Debug("Creating plugin at: ", function.Build)

	CLI, err := exec.LookPath("go")
	if err != nil {
		return p, err
	}

	//  "-ldflags", fmt.Sprintf(`"-pluginpath=%v"`, time.Now().Unix()),
	execute := exec.Cmd{
		Path: CLI,
		Args: []string{CLI, "build", "-buildmode=plugin", "-o", function.Build, function.Path},
		//  Dir:  nhost.API_DIR,
	}

	if err := execute.Run(); err != nil {
		return p, err
	}

	//  Open - Loads the plugin
	return plugin.Open(function.Build)
}
