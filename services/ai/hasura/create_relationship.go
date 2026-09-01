package hasura

import (
	"context"
	"errors"
)

type CreateRelationshipRequest struct {
	Type string                 `json:"type"`
	Args CreateRelationshipArgs `json:"args"`
}

type CreateRelationshipArgs struct {
	Table  TrackTableRequestArgsTable `json:"table"`
	Name   string                     `json:"name"`
	Source string                     `json:"source"`
	Using  RelationshipUsing          `json:"using"`
}

type RelationshipUsing struct {
	ForeignKeyConstraintOn any `json:"foreign_key_constraint_on"`
}

type ArrayRelationshipForeignKey struct {
	Table  TrackTableRequestArgsTable `json:"table"`
	Column string                     `json:"column"`
}

func (c *Client) CreateRelationship(ctx context.Context, req *CreateRelationshipRequest) error {
	var resp any

	err := c.QueryMetadata(ctx, req, &resp)

	var reqErr *MetadataRequestError
	if errors.As(err, &reqErr) && reqErr.Body.Code == ErrorCodeAlreadyExists {
		return nil
	}

	return err
}
