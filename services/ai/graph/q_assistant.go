package graph

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/Yamashou/gqlgenc/clientv2"
	"github.com/nhost/nhost/services/ai/graph/middleware"
	"github.com/nhost/nhost/services/ai/graph/model"
	"github.com/nhost/nhost/services/ai/hasura"
)

func withRequestHeaders(headers http.Header) clientv2.RequestInterceptor {
	return func(ctx context.Context,
		req *http.Request,
		gqlInfo *clientv2.GQLRequestInfo,
		res any,
		next clientv2.RequestInterceptorFunc,
	) error {
		for k, v := range headers {
			req.Header.Set(k, v[0])
		}

		return next(ctx, req, gqlInfo, res)
	}
}

func (r *queryResolver) assistant(
	ctx context.Context,
	assistantID string,
) (*model.GraphiteAssistant, error) {
	ginC := middleware.GinFromContext(ctx)

	resp, err := r.hasura.GetAssistants(
		ctx,
		//nolint:exhaustruct
		&hasura.GraphiteAssistantsBoolExp{
			AssistantID: &hasura.StringComparisonExp{
				Eq: new(assistantID),
			},
		},
		withRequestHeaders(ginC.Request.Header),
	)
	if err != nil {
		return nil, fmt.Errorf("error querying assistant: %w", err)
	}

	if len(resp.GetGraphiteAssistants()) == 0 ||
		resp.GraphiteAssistants[0] == nil ||
		isEmptyData(resp.GraphiteAssistants[0].Data) {
		return nil, nil //nolint:nilnil // we return nil to emulate hasura's response
	}

	var assistant *model.GraphiteAssistant
	if err := json.Unmarshal(resp.GraphiteAssistants[0].Data, &assistant); err != nil {
		return nil, fmt.Errorf("error unmarshalling assistant: %w", err)
	}

	if assistant == nil {
		return nil, nil //nolint:nilnil // we return nil to emulate hasura's response
	}

	return assistant, nil
}
