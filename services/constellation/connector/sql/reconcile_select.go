package sql

import (
	"context"
	"fmt"
	"log/slog"
	"slices"

	"github.com/nhost/nhost/services/constellation/internal/selectroots"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// reconcileSelectRootAllowlists runs after reconcilePermissionColumns has
// copied the permissions, expanded wildcard grants and filtered the columns.
// Like Hasura, discard the entire select permission when an explicitly
// allowed root lacks a prerequisite, including access through relationships.
func reconcileSelectRootAllowlists(
	ctx context.Context,
	logger *slog.Logger,
	inc *metadata.Inconsistencies,
	source string,
	table *metadata.TableMetadata,
	primaryKeys []string,
) {
	table.SelectPermissions = slices.DeleteFunc(
		table.SelectPermissions,
		func(p metadata.SelectPermission) bool {
			if p.Role == metadata.RoleAdmin {
				return false
			}

			reason := selectRootAllowlistProblem(p.Permission, primaryKeys)
			if reason == "" {
				return false
			}

			inc.RecordPermission(
				ctx,
				logger,
				"select",
				source,
				table.Table.Schema,
				table.Table.Name,
				p.Role,
				reason,
			)

			return true
		},
	)
}

func selectRootAllowlistProblem(p metadata.SelectPermissionConfig, primaryKeys []string) string {
	if explicitlyAllowsSelectRoot(p, selectroots.SelectByPK) {
		const prefix = `"select_by_pk" cannot be included in query_root_fields or subscription_root_fields because `
		if len(primaryKeys) == 0 {
			return prefix + "the table has no primary key"
		}

		for _, key := range primaryKeys {
			if !slices.Contains(p.Columns, key) {
				return prefix + fmt.Sprintf("the role cannot select primary key column %q", key)
			}
		}
	}

	if !p.AllowAggregations && explicitlyAllowsSelectRoot(p, selectroots.SelectAggregate) {
		return `"select_aggregate" in query_root_fields or subscription_root_fields requires "allow_aggregations" to be true`
	}

	return ""
}

func explicitlyAllowsSelectRoot(p metadata.SelectPermissionConfig, root string) bool {
	return (p.QueryRootFields != nil && slices.Contains(*p.QueryRootFields, root)) ||
		(p.SubscriptionRootFields != nil && slices.Contains(*p.SubscriptionRootFields, root))
}
