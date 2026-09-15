package hasura

import (
	"context"
	"fmt"
)

//nolint:tagliatelle
type PKInformation struct {
	ColumnName string `json:"column_name"`
	DataType   string `json:"data_type"`
}

const queryGetPKInfo = `SELECT
    pg_attribute.attname AS column_name,
    pg_catalog.format_type(pg_attribute.atttypid, pg_attribute.atttypmod) AS data_type
FROM
    pg_index, pg_class, pg_attribute
WHERE
    pg_class.oid = '%s'::regclass
    AND indrelid = pg_class.oid
    AND pg_attribute.attrelid = pg_class.oid
    AND pg_attribute.attnum = any(pg_index.indkey)
    AND indisprimary;`

func (c *Client) GetPKInformation(ctx context.Context, table string) ([]PKInformation, error) {
	i, err := c.RunSQL(ctx, fmt.Sprintf(queryGetPKInfo, table), true)
	if err != nil {
		return nil, fmt.Errorf("failed to run sql: %w", err)
	}

	pkInfo := make([]PKInformation, len(i.Result)-1)
	for i, r := range i.Result[1:] {
		name, ok := r[0].(string)
		if !ok {
			return nil, fmt.Errorf("failed to cast column_name: %w", err)
		}

		dataType, ok := r[1].(string)
		if !ok {
			return nil, fmt.Errorf("failed to cast data_type: %w", err)
		}

		pkInfo[i] = PKInformation{
			ColumnName: name,
			DataType:   dataType,
		}
	}

	return pkInfo, nil
}
