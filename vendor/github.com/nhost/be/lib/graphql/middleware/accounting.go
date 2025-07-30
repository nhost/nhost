package nhmiddleware

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	nhcontext "github.com/nhost/be/lib/graphql/context"
	"github.com/sirupsen/logrus"
)

func GraphqlAccounting(c *gin.Context) {
	logger := nhcontext.LoggerFromContext(c.Request.Context())

	if c.Request.Body != nil { //nolint:nestif
		b, err := c.GetRawData()
		if err != nil {
			logger.WithError(err).Error("failed to read request body")
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"message": "failed to read request body",
			})

			return
		}

		c.Request.Body = io.NopCloser(bytes.NewBuffer(b))

		var body map[string]any
		if err := json.Unmarshal(b, &body); err != nil {
			logger = logger.WithField("request_body", string(b))
		} else {
			query, ok := body["query"].(string)
			if ok {
				logger = logger.WithField("graphql_query", query)
			} else {
				logger = logger.WithField("request_body", string(b))
			}
		}
	}

	sessionVariables := SessionVariablesFromCtx(c.Request.Context())
	if sessionVariables == nil {
		sessionVariables = &SessionVariables{
			HasAdminSecret:   false,
			HasWebhookSecret: false,
			UserID:           "",
			Role:             "public",
			AllowedRoles:     []any{},
			DefaultRole:      nil,
		}
	}

	logger.WithFields(logrus.Fields{
		"session_variables": map[string]any{
			"has_webhook_secret": sessionVariables.HasWebhookSecret,
			"has_admin_secret":   sessionVariables.HasAdminSecret,
			"user_id":            sessionVariables.UserID,
			"role":               sessionVariables.Role,
			"allowed_roles":      sessionVariables.AllowedRoles,
			"default_role":       sessionVariables.DefaultRole,
		},
	}).Info("accounting")

	c.Next()
}
