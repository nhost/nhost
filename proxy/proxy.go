package proxy

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/gorilla/websocket"
	"github.com/koding/websocketproxy"
	"github.com/sirupsen/logrus"
)

//	Proxy Route URL structure
type Route struct {
	Name        string
	Source      string
	Destination string
	Show        bool
}

type Service struct {
	Name    string
	Address string
	Port    string
	Routes  []Route

	//	Service specific logger
	log logrus.Logger
}

//	Issue proxy to all services attached to the server.
//	Supports a custom connection multiplexer, and custom request context.
func (s *Server) IssueAll(ctx context.Context) error {

	for _, item := range s.services {
		err := item.Issue(s.config.Mux, ctx)
		if err != nil {
			return err
		}
	}

	return nil
}

//	Issues an HTTP and WS reverse proxy to the respective service.
//	Supports a custom connection multiplexer, and custom request context.
func (s *Service) Issue(mux *http.ServeMux, ctx context.Context) error {

	//	Loop over all handles to be proxied
	for _, item := range s.Routes {

		httpAddress := s.Address
		wsAddress := fmt.Sprintf("ws://localhost:%v", s.Port)

		httpOrigin, err := url.Parse(httpAddress)
		if err != nil {
			return err
		}

		if item.Source != "/" {
			httpAddress += item.Source
		}

		wsOrigin, err := url.Parse(wsAddress)
		if err != nil {
			return err
		}

		httpProxy := httputil.NewSingleHostReverseProxy(httpOrigin)
		wsProxy := websocketproxy.NewProxy(wsOrigin)

		//	Fix: Add the custom upgrader.
		//	To avoid the following error: "websocket: failed to upgrade the request to web-socket"
		wsProxy.Upgrader = &websocket.Upgrader{
			ReadBufferSize:    4096,
			WriteBufferSize:   4096,
			EnableCompression: true,
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		}

		s.log.WithFields(logrus.Fields{
			"value": s.Name,
			"type":  "proxy",
		}).Debugf("%s --> %s", httpAddress, item.Destination)

		mux.HandleFunc(item.Destination, func(w http.ResponseWriter, r *http.Request) {

			//	Log every incoming request
			s.log.WithFields(logrus.Fields{
				"component": "proxy",
				"method":    r.Method,
			}).Debug(r.URL.Path)

			//	If the supplied context is not nil,
			//	wrap the incoming request over the context
			if ctx != nil {
				r = r.WithContext(ctx)
			}

			//	If the client has passed Web-socket protocol header,
			//	then serve the request through web-socket proxy
			for item := range r.Header {
				if strings.ToLower(item) == "sec-websocket-protocol" {
					wsProxy.ServeHTTP(w, r)
					return
				}
			}

			//	Otherwise, serve it through normal HTTP proxy

			//	Get the original service URL without Nhost specific routes
			r.URL.Path = strings.ReplaceAll(r.URL.Path, item.Destination, item.Source)
			httpProxy.ServeHTTP(w, r)
		})
	}

	return nil
}
