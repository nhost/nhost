package cmd

import (
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"

	"github.com/gin-gonic/gin"
)

func nodejsHandler() (gin.HandlerFunc, error) {
	remote, err := url.Parse("http://localhost:4001")
	if err != nil {
		return nil, fmt.Errorf("failed to parse nodejs url: %w", err)
	}

	return func(c *gin.Context) {
		proxy := httputil.NewSingleHostReverseProxy(remote)
		proxy.Director = func(req *http.Request) {
			req.Header = c.Request.Header
			req.Host = remote.Host
			req.URL.Scheme = remote.Scheme
			req.URL.Host = remote.Host
			req.URL.Path = c.Request.URL.Path
		}
		proxy.ServeHTTP(c.Writer, c.Request)
	}, nil
}
