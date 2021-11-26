package proxy

import (
	"fmt"
	"io/ioutil"
	"net/http"

	"github.com/nhost/cli/environment"
	"github.com/nhost/cli/logger"
	"github.com/nhost/cli/util"
	"github.com/sirupsen/logrus"
)

//
//	Proxy Server
//
//	Fundamentally used for a reverse proxy by `dev` command.
type Server struct {

	//	Server specific logger
	log *logrus.Logger

	//	It's inherently an HTTP server under the hood.
	*http.Server

	//	Server configuration
	config *ServerConfig

	//	(Optional) Environment to attach to this server.
	environment *environment.Environment

	//  All the services attached to this server.
	services []*Service
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

	//	Server specific logger.
	//	In nil, then common Nhost logger is used.
	Log *logrus.Logger

	Mux *http.ServeMux

	//	(Optional) Do not delete the call logs on server shutdown.
	SaveLogs bool
}

//	Intializes and returns a new functions server.
func New(config *ServerConfig) *Server {

	if config.Port == "" {
		config.Port = fmt.Sprint(util.GetPort(3000, 3999))
	}

	if config.Handle == "" {
		config.Handle = "/"
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

	//  Save server logs to a temporary location.
	logsDir, _ := ioutil.TempDir("", "")

	//	Remove those logs on server shutdown, additionally allowing users to save them.
	if !config.SaveLogs {
		server.log.Debug("Server logs will be deleted on shutdown.")
		server.RegisterOnShutdown(func() {
			util.DeleteAllPaths(logsDir)
		})
	}

	//	Attach the request handler
	//	server.config.Mux.HandleFunc(config.Handle, server.Handler)

	return server
}

//	Attaches a service to this server.
func (s *Server) AddService(service *Service) {
	service.log = *s.log

	//	TODO: add logs to temporary logs location.

	// Finally, attach the service to the server.
	s.services = append(s.services, service)
}

/* func (s *Server) Handler(w http.ResponseWriter, r *http.Request) {

}
*/
