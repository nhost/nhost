package functions

import (
	"fmt"
	"io/fs"
	"io/ioutil"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/nhost/cli-go/environment"
	"github.com/nhost/cli-go/logger"
	"github.com/nhost/cli-go/nhost"
	"github.com/nhost/cli-go/util"
	"github.com/sirupsen/logrus"
)

//
//	Functions Server
//
//	The server will read environment variables on runtime
//	from the attached environment, if any.
//	And the environment variables in the locally saved
//	.env.development file.
type Server struct {

	//	Server specific logger
	log *logrus.Logger

	//	It's inherently an HTTP server under the hood.
	*http.Server

	//	Server configuration
	config *ServerConfig

	//	(Optional) Environment to attach to this server.
	environment *environment.Environment
}

//	Server configuration that the user can decide to load inside the functions server.
type ServerConfig struct {

	//	Base route on which the handle function should listen to.
	//	If not supplied, "/" is chosen by default.
	Handle string

	//	(Optional) Environment to attach to this server.
	Environment *environment.Environment

	//	Port on which to run the server
	Port string

	//	Overwrite the list of any files to avoid during path/tree walking.
	//	If left empty, the default list of files to avoid will be used.
	FilesToAvoid []string

	//	Directory where NodeJS functions must be built.
	//	This must be the location where node_modules exists.
	//	If left empty, the default Nhost working directory is used.
	BuildDir string

	//	Server specific logger.
	//	In nil, then common Nhost logger is used.
	Log *logrus.Logger

	Mux *http.ServeMux
}

//	Intializes and returns a new functions server.
func New(config *ServerConfig) *Server {

	//	Initialize the temporary directory
	tempDir, _ = ioutil.TempDir("", "")

	if config.Port == "" {
		config.Port = fmt.Sprint(nhost.GetPort(3000, 3999))
	}

	if config.Handle == "" {
		config.Handle = "/"
	}

	if config.BuildDir == "" {
		config.BuildDir = nhost.WORKING_DIR
	}

	if config.FilesToAvoid == nil {
		config.FilesToAvoid = defaultFilesToAvoid
	}

	if config.Log == nil {
		config.Log = &logger.Log
	}

	if config.Mux == nil {
		config.Mux = http.NewServeMux()
	}

	server := &Server{
		environment: config.Environment,
		config:      config,
		log:         config.Log,
		Server:      &http.Server{Addr: ":" + config.Port, Handler: config.Mux},
	}

	//	Remove the tmeporary directory on server shutdown
	server.RegisterOnShutdown(func() {
		util.DeleteAllPaths(tempDir)
	})

	//	Attach the request handler
	server.config.Mux.HandleFunc(config.Handle, server.FunctionHandler)
	/*
		functionMux.HandleFunc(functionHandler, func(w http.ResponseWriter, r *http.Request) {

			//	If the Nhost specific handler route exists,
			//	trim it to get the original service URL
			r.URL.Path = strings.TrimPrefix(r.URL.Path, functionHandler)

			//	Serve the request
			handler(w, r)
		})
	*/

	return server
}

//	Main handler function that will handle all our incoming requests.
func (s *Server) FunctionHandler(w http.ResponseWriter, r *http.Request) {

	f := Function{
		log:      s.log,
		buildDir: s.config.BuildDir,
	}

	getRoute := func(path string, item fs.FileInfo, err error) error {

		if len(f.Path) > 0 || item.IsDir() {
			return nil
		}

		// initialize the base directory
		base, file := filepath.Split(strings.TrimPrefix(path, nhost.API_DIR))
		base = filepath.Clean(base)

		for _, itemToAvoid := range s.config.FilesToAvoid {
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
		s.log.WithField("component", "server").Debug(err)
		s.log.WithField("component", "server").Error("No function found on this route")
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

					s.log.WithField("route", f.Route).Debug("Found cached copy of function")
					f = item
					preBuilt = true

				} else {

					// if file has been modified, clean the cache location
					s.log.Debug("Removing temporary directory from: ", filepath.Dir(item.Build))
					if err := os.RemoveAll(filepath.Dir(item.Build)); err != nil {
						if _, ok := err.(*os.PathError); ok {
							s.log.Debug("failed to remove temp directory: ", err)
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
			s.log.WithField("route", f.Route).Debug(err)
			s.log.WithField("route", f.Route).Error("Failed to prepare location to cache function file")
			return
		}

		if err := f.Prepare(); err != nil {
			s.log.WithField("route", f.Route).Debug(err)
			s.log.WithField("route", f.Route).Error("Failed to build the function")
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
	if s.environment.State == environment.Active {

		runtimeVars := []string{
			fmt.Sprintf("HASURA_GRAPHQL_JWT_SECRET=%v", fmt.Sprintf(`{"type":"HS256", "key": "%v"}`, nhost.JWT_KEY)),
			fmt.Sprintf("NHOST_JWT_SECRET=%v", fmt.Sprintf(`{"type":"HS256", "key": "%v"}`, nhost.JWT_KEY)),
			fmt.Sprintf("HASURA_GRAPHQL_ADMIN_SECRET=%v", nhost.ADMIN_SECRET),
			fmt.Sprintf("NHOST_BACKEND_URL=http://localhost:%v", s.environment.Port),
			fmt.Sprintf("NHOST_ADMIN_SECRET=%v", nhost.ADMIN_SECRET),
			fmt.Sprintf("NHOST_WEBHOOK_SECRET=%v", nhost.WEBHOOK_SECRET),
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
			s.log.WithField("runtime", "NodeJS").Debug(err)
			s.log.WithField("runtime", "NodeJS").Error("Runtime not installed")
			return
		}

		// initialize random port to serve the file
		jsPort := nhost.GetPort(9401, 9500)

		// prepare the node server configuration
		if err := f.BuildNodeServer(jsPort); err != nil {
			s.log.WithField("runtime", "NodeJS").Debug(err)
			s.log.WithField("runtime", "NodeJS").Error("Failed to start the runtime server")
		}

		// prepare the execution command
		cmd := exec.Cmd{
			Path:   nodeCLI,
			Env:    envVars,
			Args:   []string{nodeCLI, f.ServerConfig},
			Stdout: os.Stdout,
			Stderr: os.Stderr,
		}

		//	begin the comand execution
		if err := cmd.Start(); err != nil {
			s.log.WithField("runtime", "NodeJS").Debug(err)
			s.log.WithField("runtime", "NodeJS").Error("Failed to start the runtime server")
		}

		//	update request URL
		q := r.URL.Query()
		//	url, _ := url.Parse(fmt.Sprintf("%s://localhost:%v%s", r.URL.Scheme, jsPort, r.URL.Path))
		url, _ := url.Parse(fmt.Sprintf("http://localhost:%v%s", jsPort, r.URL.Path))
		r.URL = url
		r.URL.RawQuery = q.Encode()

		// serve
		f.Handler(w, r)

		// kill the command execution once the req is served
		if err := cmd.Process.Kill(); err != nil {
			s.log.Error("failed to kill process: ", err)
		}

		// delete the node server configuration
		if err := os.Remove(f.ServerConfig); err != nil {
			s.log.WithField("runtime", "NodeJS").Debug(err)
		}

	case ".go":

		// serve
		f.Handler(w, r)
	}
}
