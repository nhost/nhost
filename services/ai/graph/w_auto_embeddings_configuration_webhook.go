package graph

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/ai/graph/middleware"
	"github.com/nhost/nhost/services/ai/hasura"
)

//nolint:tagliatelle
type autoEmbeddingsConfigurationWebhookEvent struct {
	Event struct {
		Op   string `json:"op"`
		Data struct {
			New struct {
				ID string `json:"id"`
			} `json:"new"`
			Old struct {
				ID         string `json:"id"`
				Name       string `json:"name"`
				Model      string `json:"model"`
				SchemaName string `json:"schema_name"`
				TableName  string `json:"table_name"`
				ColumnName string `json:"column_name"`
			} `json:"old"`
		} `json:"data"`
	}
	ID      string `json:"id"`
	Trigger struct {
		Name string `json:"name"`
	} `json:"trigger"`
}

func (r *Resolver) HandleAutoEmbeddingsConfigurationWebhook(c *gin.Context) {
	logger := middleware.LoggerFromContext(c.Request.Context())

	var e autoEmbeddingsConfigurationWebhookEvent
	if err := c.ShouldBindJSON(&e); err != nil {
		webhookFail(c, http.StatusBadRequest, err)
		return
	}

	var (
		config *hasura.GraphiteAutoEmbeddingsConfigurationFragment
		remove bool
	)

	switch e.Event.Op {
	case insertEvent, updateEvent:
		remove = false

		id := e.Event.Data.New.ID

		resp, err := r.hasura.GetGraphiteAutoEmbeddingsConfiguration(
			c.Request.Context(),
			id,
		)
		if err != nil {
			err := fmt.Errorf("error getting auto embeddings configuration: %w", err)
			webhookFail(c, http.StatusInternalServerError, err)

			return
		}

		config = resp.GetGraphiteAutoEmbeddingsConfiguration()
	case deleteEvent:
		remove = true

		config = &hasura.GraphiteAutoEmbeddingsConfigurationFragment{
			ID:         e.Event.Data.Old.ID,
			Name:       e.Event.Data.Old.Name,
			Model:      e.Event.Data.Old.Model,
			SchemaName: e.Event.Data.Old.SchemaName,
			TableName:  e.Event.Data.Old.TableName,
			ColumnName: e.Event.Data.Old.ColumnName,
			Query:      nil,
			Mutation:   nil,
			LastRun:    nil,
		}
	default:
		err := fmt.Errorf("unknown op: %s", e.Event.Op) //nolint:err113
		webhookFail(c, http.StatusBadRequest, err)

		return
	}

	if err := r.autoai.SynchAutoEmbeddingsConfiguration(
		c.Request.Context(), config, remove, logger,
	); err != nil {
		err := fmt.Errorf("error synchronizing auto embeddings configuration: %w", err)
		webhookFail(c, http.StatusInternalServerError, err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}
