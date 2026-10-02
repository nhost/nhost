package hasura

import (
	"context"
	"errors"
)

type TrackTableRequest struct {
	Type string                `json:"type"`
	Args TrackTableRequestArgs `json:"args"`
}

type TrackTableRequestArgsTable struct {
	Schema string `json:"schema"`
	Name   string `json:"name"`
}

//nolint:tagliatelle
type TrackTableRequestArgsConfigurationCustomRootFields struct {
	Select          string `json:"select"`
	SelectByPk      string `json:"select_by_pk"`
	SelectAggregate string `json:"select_aggregate"`
	SelectStream    string `json:"select_stream"`
	Insert          string `json:"insert"`
	InsertOne       string `json:"insert_one"`
	Update          string `json:"update"`
	UpdateByPk      string `json:"update_by_pk"`
	UpdateMany      string `json:"update_many"`
	Delete          string `json:"delete"`
	DeleteByPk      string `json:"delete_by_pk"`
}

//nolint:tagliatelle
type TrackTableRequestArgsConfigurationColumnConfig struct {
	CustomName string `json:"custom_name"`
}

//nolint:tagliatelle
type TrackTableRequestArgsConfiguration struct {
	CustomName       string                                                    `json:"custom_name"`
	CustomRootFields TrackTableRequestArgsConfigurationCustomRootFields        `json:"custom_root_fields"`
	ColumnConfig     map[string]TrackTableRequestArgsConfigurationColumnConfig `json:"column_config"`
}

type TrackTableRequestArgs struct {
	Source        string                             `json:"source"`
	Table         TrackTableRequestArgsTable         `json:"table"`
	Configuration TrackTableRequestArgsConfiguration `json:"configuration"`
}

func (c *Client) TrackTable(ctx context.Context, req *TrackTableRequest) error {
	var resp any

	err := c.QueryMetadata(ctx, req, &resp)

	var reqErr *MetadataRequestError
	if errors.As(err, &reqErr) && reqErr.Body.Code == ErrorCodeAlreadyTracked {
		req.Type = "pg_set_table_customization"
		return c.QueryMetadata(ctx, req, &resp)
	}

	return err
}
