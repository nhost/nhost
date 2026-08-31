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

// TrackEnumTableRequest is like TrackTableRequest but includes is_enum for Hasura enum tables.
type TrackEnumTableRequest struct {
	Type string             `json:"type"`
	Args TrackEnumTableArgs `json:"args"`
}

// TrackEnumTableArgs includes is_enum in addition to the standard tracking args.
//
//nolint:tagliatelle
type TrackEnumTableArgs struct {
	Source        string                             `json:"source"`
	Table         TrackTableRequestArgsTable         `json:"table"`
	IsEnum        bool                               `json:"is_enum"`
	Configuration TrackTableRequestArgsConfiguration `json:"configuration"`
}

// TrackEnumTable tracks a table as a Hasura enum table.
func (c *Client) TrackEnumTable(ctx context.Context, req *TrackEnumTableRequest) error {
	var resp any

	err := c.QueryMetadata(ctx, req, &resp)

	var reqErr *MetadataRequestError
	if errors.As(err, &reqErr) && reqErr.Body.Code == ErrorCodeAlreadyTracked {
		// This fallback only updates customization; it assumes the table was tracked with is_enum: true.
		customizationReq := &TrackTableRequest{
			Type: "pg_set_table_customization",
			Args: TrackTableRequestArgs{
				Source:        req.Args.Source,
				Table:         req.Args.Table,
				Configuration: req.Args.Configuration,
			},
		}

		return c.QueryMetadata(ctx, customizationReq, &resp)
	}

	return err
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
