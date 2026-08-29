package graph

import (
	"context"
	"fmt"

	"github.com/Yamashou/gqlgenc/clientv2"
	"github.com/nhost/nhost/services/ai/graph/middleware"
	"github.com/nhost/nhost/services/ai/graph/model"
	"github.com/nhost/nhost/services/ai/hasura"
)

func (r *mutationResolver) getVectorStoreIDsFromAssistant(
	ctx context.Context,
	assistantID string,
) ([]string, error) {
	aFileStores, err := r.hasura.GetAssistantFileStores(
		ctx,
		&hasura.GraphiteAssistantFileStoresBoolExp{ //nolint:exhaustruct
			AssistantID: &hasura.StringComparisonExp{ //nolint:exhaustruct
				Eq: new(assistantID),
			},
		},
	)
	if err != nil {
		return nil, fmt.Errorf("error querying assistant file stores: %w", err)
	}

	if len(aFileStores.GetGraphiteAssistantFileStores()) == 0 {
		return []string{}, nil
	}

	ids := make([]string, len(aFileStores.GetGraphiteAssistantFileStores()))
	for i, fs := range aFileStores.GetGraphiteAssistantFileStores() {
		ids[i] = fs.FileStoreID
	}

	fileStores, err := r.hasura.GetGraphiteFileStores(
		ctx,
		&hasura.GraphiteFileStoresBoolExp{ //nolint:exhaustruct
			ID: &hasura.UUIDComparisonExp{ //nolint:exhaustruct
				In: ids,
			},
		},
	)
	if err != nil {
		return nil, fmt.Errorf("error querying file stores: %w", err)
	}

	vss := make([]string, len(fileStores.GetGraphiteFileStores()))
	for i, fs := range fileStores.GraphiteFileStores {
		vss[i] = *fs.VectorStoreID
	}

	return vss, nil
}

func (r *mutationResolver) getAssistantByID(
	ctx context.Context,
	assistantID string,
	interceptors ...clientv2.RequestInterceptor,
) error {
	getResp, err := r.hasura.GetAssistants(
		ctx,
		&hasura.GraphiteAssistantsBoolExp{ //nolint:exhaustruct
			AssistantID: &hasura.StringComparisonExp{ //nolint:exhaustruct
				Eq: new(assistantID),
			},
		},
		interceptors...,
	)
	if err != nil {
		return fmt.Errorf("failed to get assistant metadata: %w", err)
	}

	data, err := firstAssistantData(getResp.GraphiteAssistants)
	if err != nil {
		return err
	}

	_, err = decodeAssistantData(data)

	return err
}

func (r *mutationResolver) startSession(
	ctx context.Context, assistantID string,
) (*model.GraphiteSession, error) {
	ginC := middleware.GinFromContext(ctx)

	userID, err := getUserID(ginC.Request.Header)
	if err != nil {
		return nil, fmt.Errorf("error getting user id: %w", err)
	}

	requestHeaders := withRequestHeaders(ginC.Request.Header)
	if err := r.getAssistantByID(ctx, assistantID, requestHeaders); err != nil {
		return nil, err
	}

	insertResp, err := r.hasura.InsertSession(
		ctx,
		hasura.GraphiteSessionsInsertInput{ //nolint:exhaustruct
			AssistantID: new(assistantID),
			UserID:      userID,
		},
		requestHeaders,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to insert session: %w", err)
	}

	insertedSessionID := insertResp.GetInsertGraphiteSession().GetID()

	vss, err := r.getVectorStoreIDsFromAssistant(ctx, assistantID)
	if err != nil {
		return nil, fmt.Errorf("error getting vector stores: %w", err)
	}

	uid := "admin"
	if userID != nil {
		uid = *userID
	}

	session, err := r.ai.SessionsStart(ctx, uid, assistantID, vss)
	if err != nil {
		return nil, fmt.Errorf("failed to start session: %w", err)
	}

	if _, err := r.hasura.UpdateSessions(
		ctx,
		hasura.GraphiteSessionsBoolExp{ //nolint:exhaustruct
			ID: &hasura.UUIDComparisonExp{ //nolint:exhaustruct
				Eq: &insertedSessionID,
			},
		},
		hasura.GraphiteSessionsSetInput{ //nolint:exhaustruct
			SessionID: new(session.SessionID),
		},
	); err != nil {
		return nil, fmt.Errorf("error updating assistant's metadata: %w", err)
	}

	return session, nil
}
