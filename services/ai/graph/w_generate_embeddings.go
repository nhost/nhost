package graph

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

type generateEmbeddingsWebhookRequest struct {
	Query string `json:"query"`
	Model string `json:"model"`
}

func (r *Resolver) HandleGenerateEmbeddingsWebhook(c *gin.Context) {
	var e generateEmbeddingsWebhookRequest
	if err := c.ShouldBindJSON(&e); err != nil {
		webhookFail(c, http.StatusBadRequest, err)
		return
	}

	embeddings, err := r.ai.EmbeddingsGenerate(c.Request.Context(), e.Query, e.Model)
	if err != nil {
		err := fmt.Errorf("failed to generate embeddings: %w", err)
		webhookFail(c, http.StatusInternalServerError, err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"embeddings": embeddings.Embeddings})
}
