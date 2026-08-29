package autoai

import "github.com/nhost/nhost/services/ai/hasura"

type AutoAI struct {
	hasuraClient    *hasura.Client
	graphiteBaseURL string
	graphiteSecret  string
}

func NewAutoAI(
	hasuraClient *hasura.Client,
	graphiteBaseURL string,
	graphiteSecret string,
) *AutoAI {
	return &AutoAI{
		hasuraClient:    hasuraClient,
		graphiteBaseURL: graphiteBaseURL,
		graphiteSecret:  graphiteSecret,
	}
}
