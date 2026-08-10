package controller

import (
	"errors"
	"slices"
	"strings"

	"github.com/nhost/nhost/services/constellation/connector/groupedaggregate"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/controller/planner"
	"github.com/vektah/gqlparser/v2/ast"
)

func (c *Controller) validateRemoteTargets(
	state *controllerState,
	plan *planner.QueryPlan,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
) []map[string]any {
	var allStructuredErrs []map[string]any

	for _, target := range remoteValidationTargets(state, plan, fragments, variables) {
		conn := state.connectors[target.connectorName]
		if conn == nil {
			// Missing target connectors are reported by the remote resolver; skip them here.
			continue
		}

		var err error
		if target.aggregateRequest != nil {
			validator, ok := conn.(interface {
				ValidateGroupedAggregate(
					req groupedaggregate.Request,
					role string,
					sessionVariables map[string]any,
				) error
			})
			if !ok {
				continue
			}

			err = validator.ValidateGroupedAggregate(
				*target.aggregateRequest, role, sessionVariables,
			)
		} else {
			err = conn.ValidateOperation(
				target.operation, target.fragments, variables, role, sessionVariables,
			)
			err = remapRemoteValidationArgumentPath(
				err, target.remoteRootPath, target.clientPath,
			)
		}

		if err == nil {
			continue
		}

		if structuredErrs, ok := classifyStructuredConnectorError(err); ok {
			allStructuredErrs = append(allStructuredErrs, structuredErrs...)
		}
	}

	return allStructuredErrs
}

type remoteValidationTarget struct {
	connectorName    string
	clientPath       string
	remoteRootPath   string
	operation        *ast.OperationDefinition
	fragments        ast.FragmentDefinitionList
	aggregateRequest *groupedaggregate.Request
}

func (t remoteValidationTarget) kind() string {
	if t.aggregateRequest != nil {
		return "aggregate"
	}

	return "operation"
}

func remoteValidationTargets(
	state *controllerState,
	plan *planner.QueryPlan,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
) []remoteValidationTarget {
	if plan == nil || !plan.HasRemoteQueries() {
		return nil
	}

	targets := make([]remoteValidationTarget, 0, len(plan.RemoteQueries))
	for _, rqp := range plan.RemoteQueries {
		if rqp == nil || rqp.Selection == nil {
			continue
		}

		clientPath := remoteQueryArgumentPath(rqp)
		if rqp.IsArrayAggregate {
			req, ok := remoteAggregateValidationRequest(rqp, fragments, variables, clientPath)
			if !ok {
				continue
			}

			targets = append(targets, remoteValidationTarget{
				connectorName:    rqp.TargetConnector,
				clientPath:       clientPath,
				remoteRootPath:   "",
				operation:        nil,
				fragments:        nil,
				aggregateRequest: &req,
			})

			continue
		}

		op, remoteRootPath := remoteValidationOperation(state, rqp)
		if op == nil {
			continue
		}

		targets = append(targets, remoteValidationTarget{
			connectorName:    rqp.TargetConnector,
			clientPath:       clientPath,
			remoteRootPath:   remoteRootPath,
			operation:        op,
			fragments:        fragments,
			aggregateRequest: nil,
		})
	}

	slices.SortFunc(targets, compareRemoteValidationTargets)

	return targets
}

func compareRemoteValidationTargets(a, b remoteValidationTarget) int {
	if a.connectorName != b.connectorName {
		return strings.Compare(a.connectorName, b.connectorName)
	}

	if a.clientPath != b.clientPath {
		return strings.Compare(a.clientPath, b.clientPath)
	}

	return strings.Compare(a.kind(), b.kind())
}

func remoteValidationOperation(
	state *controllerState,
	rqp *planner.RemoteQueryPlan,
) (*ast.OperationDefinition, string) {
	if rqp.ResolverType == planner.ResolverKindSchema {
		// Remote-schema connectors own argument validation and their
		// ValidateOperation implementation is intentionally a no-op.
		return nil, ""
	}

	targetName := remoteTargetTableName(state, rqp)
	if targetName == "" {
		return nil, ""
	}

	field := &ast.Field{ //nolint:exhaustruct
		Name:         targetName,
		Arguments:    remoteDatabaseValidationArguments(rqp.Selection.Arguments),
		SelectionSet: rqp.Selection.SelectionSet,
		Position:     rqp.Selection.Position,
	}

	return &ast.OperationDefinition{ //nolint:exhaustruct
		Operation:    ast.Query,
		SelectionSet: ast.SelectionSet{field},
	}, responseFieldName(field)
}

func remoteTargetTableName(state *controllerState, rqp *planner.RemoteQueryPlan) string {
	targetName := rqp.TargetTable
	if state == nil || rqp.TargetTableSchema == "" {
		return targetName
	}

	conn := state.connectors[rqp.TargetConnector]
	if conn == nil {
		return targetName
	}

	resolved := conn.GetTypeName(rqp.TargetTableSchema + "." + rqp.TargetTable)
	if resolved == "" {
		return targetName
	}

	return resolved
}

func remoteDatabaseValidationArguments(args ast.ArgumentList) ast.ArgumentList {
	if len(args) == 0 {
		return nil
	}

	out := make(ast.ArgumentList, 0, len(args))
	for _, arg := range args {
		if arg == nil || arg.Name == "where" {
			continue
		}

		out = append(out, arg)
	}

	return out
}

func remoteAggregateValidationRequest(
	rqp *planner.RemoteQueryPlan,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	clientPath string,
) (groupedaggregate.Request, bool) {
	var empty groupedaggregate.Request

	targetCol, ok := singleTargetJoinColumn(rqp.JoinMapping)
	if !ok {
		return empty, false
	}

	req, err := groupedaggregate.NewRequest(groupedaggregate.Request{
		TableSchema:       rqp.TargetTableSchema,
		TableName:         rqp.TargetTable,
		JoinColumnSQLName: targetCol,
		JoinValues:        []any{""},
		Field:             rqp.Selection,
		ArgumentPath:      clientPath,
		Fragments:         fragments,
		Variables:         variables,
	})
	if err != nil {
		return empty, false
	}

	return req, true
}

func singleTargetJoinColumn(joinMapping map[string]string) (string, bool) {
	if len(joinMapping) != 1 {
		return "", false
	}

	for _, targetCol := range joinMapping {
		if targetCol == "" {
			return "", false
		}

		return targetCol, true
	}

	return "", false
}

func remoteQueryArgumentPath(rqp *planner.RemoteQueryPlan) string {
	path := make([]string, 0, len(rqp.SourcePath)+1)
	path = append(path, rqp.SourcePath...)
	path = append(path, rqp.OutputField)

	return strings.Join(path, ".selectionSet.")
}

func responseFieldName(field *ast.Field) string {
	if field.Alias != "" {
		return field.Alias
	}

	return field.Name
}

func remapRemoteValidationArgumentPath(
	err error,
	remoteRootPath string,
	clientPath string,
) error {
	if err == nil || clientPath == "" {
		return err
	}

	if vErr, ok := errors.AsType[*arguments.QueryValidationError](err); ok {
		vErr.RemapArgumentPath(func(path string) string {
			if remoteRootPath == "" || path == remoteRootPath {
				return clientPath
			}

			suffix, ok := strings.CutPrefix(path, remoteRootPath+".selectionSet.")
			if !ok {
				return clientPath
			}

			return clientPath + ".selectionSet." + suffix
		})
	}

	return err
}
