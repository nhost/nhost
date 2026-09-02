package autoai

import "github.com/nhost/nhost/services/ai/hasura"

type AutoAI struct {
	hasuraClient  *hasura.Client
	aiBaseURL     string
	webhookSecret string
}

func NewAutoAI(
	hasuraClient *hasura.Client,
	aiBaseURL string,
	webhookSecret string,
) *AutoAI {
	return &AutoAI{
		hasuraClient:  hasuraClient,
		aiBaseURL:     aiBaseURL,
		webhookSecret: webhookSecret,
	}
}
