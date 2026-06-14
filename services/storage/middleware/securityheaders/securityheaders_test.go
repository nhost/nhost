package securityheaders_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/storage/middleware/securityheaders"
)

const cspValue = "default-src 'none'; sandbox"

func setupRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(securityheaders.New())

	router.GET("/text", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	router.GET("/html", func(c *gin.Context) {
		c.Data(http.StatusOK, "text/html; charset=utf-8", []byte("<h1>hi</h1>"))
	})

	router.GET("/svg", func(c *gin.Context) {
		c.Data(http.StatusOK, "image/svg+xml", []byte("<svg/>"))
	})

	router.GET("/xml", func(c *gin.Context) {
		c.Data(http.StatusOK, "application/xml", []byte("<root/>"))
	})

	// A feed is XML the browser may render via an <?xml-stylesheet?> PI, so it is
	// caught by the "+xml" suffix rule even though it is not enumerated.
	router.GET("/rss", func(c *gin.Context) {
		c.Data(http.StatusOK, "application/rss+xml", []byte("<rss/>"))
	})

	// An arbitrary "+xml" vocabulary must also be sandboxed by the suffix rule.
	router.GET("/gpx", func(c *gin.Context) {
		c.Data(http.StatusOK, "application/gpx+xml", []byte("<gpx/>"))
	})

	router.GET("/json", func(c *gin.Context) {
		c.Data(http.StatusOK, "application/json", []byte("{}"))
	})

	router.GET("/pdf", func(c *gin.Context) {
		c.Data(http.StatusOK, "application/pdf", []byte("%PDF-1.4"))
	})

	// An error rendered as HTML is still active content and must be sandboxed.
	router.GET("/html-error", func(c *gin.Context) {
		c.Data(http.StatusInternalServerError, "text/html", []byte("<h1>boom</h1>"))
	})

	// A malformed Content-Type a browser may still read as text/html must fail
	// closed (be sandboxed), not slip through unparsed.
	router.GET("/malformed-html", func(c *gin.Context) {
		c.Data(http.StatusOK, "text/html; charset", []byte("<script>alert(1)</script>"))
	})

	return router
}

func TestSecurityHeaders(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		path    string
		wantCSP bool
	}{
		{name: "text/plain is not sandboxed", path: "/text", wantCSP: false},
		{name: "html is sandboxed", path: "/html", wantCSP: true},
		{name: "svg is sandboxed", path: "/svg", wantCSP: true},
		{name: "xml is sandboxed", path: "/xml", wantCSP: true},
		{name: "rss feed is sandboxed", path: "/rss", wantCSP: true},
		{name: "arbitrary +xml is sandboxed", path: "/gpx", wantCSP: true},
		{name: "json is not sandboxed", path: "/json", wantCSP: false},
		{name: "pdf is not sandboxed", path: "/pdf", wantCSP: false},
		{name: "html error is sandboxed", path: "/html-error", wantCSP: true},
		{name: "malformed html fails closed", path: "/malformed-html", wantCSP: true},
	}

	router := setupRouter()

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			req := httptest.NewRequest(http.MethodGet, tc.path, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			header := w.Result().Header

			// nosniff is set on every response, regardless of type or status.
			if got := header.Get("X-Content-Type-Options"); got != "nosniff" {
				t.Errorf("X-Content-Type-Options: want %q, got %q", "nosniff", got)
			}

			got := header.Get("Content-Security-Policy")
			switch {
			case tc.wantCSP && got != cspValue:
				t.Errorf("Content-Security-Policy: want %q, got %q", cspValue, got)
			case !tc.wantCSP && got != "":
				t.Errorf("Content-Security-Policy: want no header, got %q", got)
			}
		})
	}
}
