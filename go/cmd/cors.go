package cmd

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func cors() gin.HandlerFunc {
	f := func(c *gin.Context, origin string) {
		c.Header("Access-Control-Allow-Origin", origin)
		c.Header("Access-Control-Allow-Methods", "POST, GET")
		headers := c.Request.Header.Get("Access-Control-Request-Headers")
		c.Header("Access-Control-Allow-Headers", headers)
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Max-Age", "86400")
		c.Writer.Header().Add("Vary", "Origin, Access-Control-Request-Method")
	}

	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if c.Request.Method == http.MethodOptions {
			f(c, origin)

			c.Header("Content-Length", "0")
			c.AbortWithStatus(http.StatusNoContent)
		}

		if origin != "" {
			f(c, origin)
		}

		c.Next()
	}
}
