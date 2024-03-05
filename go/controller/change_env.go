package controller

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func (ctrl *Controller) PostChangeEnv(fn gin.HandlerFunc) gin.HandlerFunc {
	return func(c *gin.Context) {
		b, err := io.ReadAll(c.Request.Body)
		if err != nil {
			_ = c.Error(err)
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.Request.Body = io.NopCloser(strings.NewReader(string(b)))

		if err := json.Unmarshal(b, &ctrl.config); err != nil {
			_ = c.Error(err)
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if ctrl.config.CustomClaims == "" {
			ctrl.jwtGetter.customClaimer = nil
		} else {
			cc, err := NewCustomClaims(
				ctrl.config.CustomClaims,
				&http.Client{}, //nolint:exhaustruct
				ctrl.config.HasuraGraphqlURL,
				CustomClaimerAddAdminSecret(ctrl.config.HasuraAdminSecret),
			)
			if err != nil {
				_ = c.Error(err)
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			ctrl.jwtGetter.customClaimer = cc
		}

		ctrl.validator.cfg.PasswordHIBPEnabled = ctrl.config.PasswordHIBPEnabled

		fn(c)
	}
}
