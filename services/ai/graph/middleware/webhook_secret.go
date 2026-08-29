package middleware

import (
	"github.com/gin-gonic/gin"
)

func NeedsWebhookSecret(webhookSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.GetHeader("x-graphite-webhook-secret") != webhookSecret {
			c.JSON(401, gin.H{"message": "not authorized"}) //nolint: mnd
			c.Abort()

			return
		}

		c.Next()
	}
}
