package controller

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func (ctrl *Controller) PostChangeEnv(c *gin.Context) { //nolint:funlen,cyclop
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

	if err := json.Unmarshal(b, &ctrl.wf.config); err != nil {
		_ = c.Error(err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})

		return
	}

	if ctrl.config.CustomClaims == "" { //nolint:nestif
		ctrl.wf.jwtGetter.customClaimer = nil
	} else {
		var rawClaims map[string]string
		if err := json.Unmarshal([]byte(ctrl.config.CustomClaims), &rawClaims); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "failed to unmarshal custom claims", "error": err.Error()})
		}

		var defaults map[string]any
		if ctrl.config.CustomClaimsDefaults == "" {
			defaults = nil
		} else {
			if err := json.Unmarshal([]byte(ctrl.config.CustomClaimsDefaults), &defaults); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": "failed to unmarshal custom claims defaults", "error": err.Error()})
			}
		}

		if len(rawClaims) > 0 {
			cc, err := NewCustomClaims(
				rawClaims,
				&http.Client{}, //nolint:exhaustruct
				ctrl.config.HasuraGraphqlURL,
				defaults,
				CustomClaimerAddAdminSecret(ctrl.config.HasuraAdminSecret),
			)
			if err != nil {
				_ = c.Error(err)
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})

				return
			}

			ctrl.wf.jwtGetter.customClaimer = cc
		} else {
			ctrl.wf.jwtGetter.customClaimer = nil
		}
	}

	if ctrl.config.BlockedEmailDomains != nil ||
		ctrl.config.BlockedEmails != nil ||
		ctrl.config.AllowedEmailDomains != nil ||
		ctrl.config.AllowedEmails != nil {
		ctrl.wf.ValidateEmail = ValidateEmail(
			ctrl.config.BlockedEmailDomains,
			ctrl.config.BlockedEmails,
			ctrl.config.AllowedEmailDomains,
			ctrl.config.AllowedEmails,
		)
	}

	if ctrl.config.WebauthnEnabled {
		wa, err := NewWebAuthn(ctrl.config)
		if err != nil {
			_ = c.Error(err)
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})

			return
		}

		ctrl.Webauthn = wa
	}

	c.JSON(
		http.StatusOK,
		gin.H{"message": "environment changed successfully"},
	)
}
