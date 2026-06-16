package source

import (
	"context"
	json "encoding/json/v2"
	"errors"
	"fmt"

	"github.com/nhost/nhost/services/constellation/api"
	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

const (
	opPgCreateEventTrigger = "pg_create_event_trigger"
	opPgDeleteEventTrigger = "pg_delete_event_trigger"
)

// ErrEventTriggerNotFound is returned by pg_delete_event_trigger when
// no trigger with the requested name exists. Maps to "not-exists".
var ErrEventTriggerNotFound = errors.New("event trigger not found")

// ===== pg_create_event_trigger =====

// pgCreateEventTriggerArgs is the on-wire shape for pg_create_event_trigger.
// It carries the trigger config plus the (source, table) tuple identifying
// where to attach it. We embed PostgresEventTriggerConfEventTriggerConf
// directly so all of Hasura's trigger fields (definition, webhook,
// retry_conf, headers, …) are accepted and stored as-is.
type pgCreateEventTriggerArgs struct {
	api.PostgresEventTriggerConfEventTriggerConf

	Source string             `json:"source"`
	Table  hasura.TableSource `json:"table"`
	// Replace, when true, overwrites an existing trigger of the same
	// name on the table. Hasura defaults to false; the dashboard sets
	// it explicitly when re-saving.
	Replace bool `json:"replace,omitempty"`
}

func buildPgCreateEventTrigger(argsJSON []byte) (MutationFn, error) {
	var a pgCreateEventTriggerArgs
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opPgCreateEventTrigger, err)
	}

	if a.Table.Schema == "" || a.Table.Name == "" || a.Name == "" {
		return nil, fmt.Errorf(
			"%w: %s: table.schema, table.name and name are required",
			errMissingRequiredField, opPgCreateEventTrigger,
		)
	}

	source := defaultIfEmpty(a.Source)
	conf := a.PostgresEventTriggerConfEventTriggerConf
	replace := a.Replace

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		t, err := resolveTable(h, source, a.Table)
		if err != nil {
			return "", err
		}

		for i, existing := range t.EventTriggers {
			if existing.Name == conf.Name {
				if !replace {
					return CodeAlreadyExists, nil
				}

				t.EventTriggers[i] = conf

				return "", nil
			}
		}

		t.EventTriggers = append(t.EventTriggers, conf)

		return "", nil
	}, nil
}

// PgCreateEventTrigger applies pg_create_event_trigger. Stores the
// config in metadata; does NOT start any delivery loop.
func (s *Store) PgCreateEventTrigger(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildPgCreateEventTrigger(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

// ===== pg_delete_event_trigger =====

type pgDeleteEventTriggerArgs struct {
	Source string             `json:"source"`
	Table  hasura.TableSource `json:"table"`
	Name   string             `json:"name"`
}

//nolint:dupl // intentional mirror of buildPgDeleteRemoteRelationship; one per deletable child kind.
func buildPgDeleteEventTrigger(argsJSON []byte) (MutationFn, error) {
	var a pgDeleteEventTriggerArgs
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opPgDeleteEventTrigger, err)
	}

	if a.Table.Schema == "" || a.Table.Name == "" || a.Name == "" {
		return nil, fmt.Errorf(
			"%w: %s: table.schema, table.name and name are required",
			errMissingRequiredField, opPgDeleteEventTrigger,
		)
	}

	source := defaultIfEmpty(a.Source)

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		t, err := resolveTable(h, source, a.Table)
		if err != nil {
			return "", err
		}

		for i, existing := range t.EventTriggers {
			if existing.Name == a.Name {
				t.EventTriggers = removeAt(t.EventTriggers, i)

				return "", nil
			}
		}

		return "", fmt.Errorf(
			"%w: %q on %s.%s",
			ErrEventTriggerNotFound, a.Name, a.Table.Schema, a.Table.Name,
		)
	}, nil
}

// PgDeleteEventTrigger applies pg_delete_event_trigger.
func (s *Store) PgDeleteEventTrigger(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildPgDeleteEventTrigger(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}
