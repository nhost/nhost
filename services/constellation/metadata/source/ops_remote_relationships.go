package source

import (
	"context"
	json "encoding/json/v2"
	"fmt"

	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

const (
	opPgCreateRemoteRelationship = "pg_create_remote_relationship"
	opPgDeleteRemoteRelationship = "pg_delete_remote_relationship"
)

type pgCreateRemoteRelationshipArgs struct {
	Source     string                       `json:"source"`
	Table      hasura.TableSource           `json:"table"`
	Name       string                       `json:"name"`
	Definition hasura.RemoteRelationshipDef `json:"definition"`
}

func buildPgCreateRemoteRelationship(argsJSON []byte) (MutationFn, error) {
	var a pgCreateRemoteRelationshipArgs
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opPgCreateRemoteRelationship, err)
	}

	if a.Table.Schema == "" || a.Table.Name == "" || a.Name == "" {
		return nil, fmt.Errorf(
			"%w: %s: table.schema, table.name and name are required",
			errMissingRequiredField, opPgCreateRemoteRelationship,
		)
	}

	source := defaultIfEmpty(a.Source)

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		t, err := resolveTable(h, source, a.Table)
		if err != nil {
			return "", err
		}

		for _, r := range t.RemoteRelationships {
			if r.Name == a.Name {
				return CodeAlreadyExists, nil
			}
		}

		t.RemoteRelationships = append(
			t.RemoteRelationships,
			hasura.RemoteRelationship{
				Name:       a.Name,
				Definition: a.Definition,
				Unknown:    nil,
			},
		)

		return "", nil
	}, nil
}

// PgCreateRemoteRelationship applies pg_create_remote_relationship.
func (s *Store) PgCreateRemoteRelationship(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildPgCreateRemoteRelationship(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

type pgDeleteRemoteRelationshipArgs struct {
	Source string             `json:"source"`
	Table  hasura.TableSource `json:"table"`
	Name   string             `json:"name"`
}

//nolint:dupl // intentional mirror of buildPgDeleteEventTrigger; one per deletable child kind.
func buildPgDeleteRemoteRelationship(argsJSON []byte) (MutationFn, error) {
	var a pgDeleteRemoteRelationshipArgs
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opPgDeleteRemoteRelationship, err)
	}

	if a.Table.Schema == "" || a.Table.Name == "" || a.Name == "" {
		return nil, fmt.Errorf(
			"%w: %s: table.schema, table.name and name are required",
			errMissingRequiredField, opPgDeleteRemoteRelationship,
		)
	}

	source := defaultIfEmpty(a.Source)

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		t, err := resolveTable(h, source, a.Table)
		if err != nil {
			return "", err
		}

		for i, r := range t.RemoteRelationships {
			if r.Name == a.Name {
				t.RemoteRelationships = removeAt(t.RemoteRelationships, i)

				return "", nil
			}
		}

		return "", fmt.Errorf(
			"%w: %q on %s.%s",
			ErrRelationshipNotFound, a.Name, a.Table.Schema, a.Table.Name,
		)
	}, nil
}

// PgDeleteRemoteRelationship applies pg_delete_remote_relationship.
func (s *Store) PgDeleteRemoteRelationship(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildPgDeleteRemoteRelationship(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}
