package source

import (
	"context"
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"errors"
	"fmt"

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

// pgCreateEventTriggerArgs is the on-wire shape for pg_create_event_trigger. It
// carries the (source, table) tuple identifying where to attach the trigger,
// the trigger name, the replace flag, and — via the ,unknown sink — every other
// top-level field of the request.
//
// Hasura's pg_create_event_trigger request puts the operation specs
// (insert/update/delete/enable_manual) at the TOP LEVEL of args, NOT under a
// "definition" wrapper (the wrapper is the metadata/export shape). Capturing the
// remaining fields verbatim in Conf and normalizing them in
// buildStoredEventTrigger lets Constellation accept the real Hasura request
// shape while still storing the canonical hdb_metadata form.
type pgCreateEventTriggerArgs struct {
	Source string             `json:"source"`
	Table  hasura.TableSource `json:"table"`
	Name   string             `json:"name"`
	// Replace, when true, overwrites an existing trigger of the same
	// name on the table. Hasura defaults to false; the dashboard sets
	// it explicitly when re-saving.
	Replace bool `json:"replace,omitempty"`
	// Conf captures every top-level request field other than source/table/
	// name/replace: the flat op specs, webhook(_from_env), retry_conf, headers,
	// and any unmodeled keys (request_transform, response_transform, comment,
	// future Hasura keys). All are preserved verbatim into the stored entry.
	Conf jsontext.Value `json:",unknown"`
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
	replace := a.Replace

	stored, err := buildStoredEventTrigger(a.Name, a.Conf)
	if err != nil {
		return nil, err
	}

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		t, err := resolveTable(h, source, a.Table)
		if err != nil {
			return "", err
		}

		for i, existing := range t.EventTriggers {
			name, err := eventTriggerName(existing)
			if err != nil {
				return "", err
			}

			if name == a.Name {
				if !replace {
					return CodeAlreadyExists, nil
				}

				t.EventTriggers[i] = stored

				return "", nil
			}
		}

		t.EventTriggers = append(t.EventTriggers, stored)

		return "", nil
	}, nil
}

// buildStoredEventTrigger assembles the verbatim hdb_metadata event-trigger
// entry from the create request's name and captured config. It accepts both
// Hasura's flat request shape (operation specs at the top level) and a
// pre-nested "definition" object (re-imported metadata / older clients): when
// no "definition" is present, the top-level op specs are moved under one. All
// other fields — including keys the engine does not model — are preserved as-is
// so export round-trips losslessly.
func buildStoredEventTrigger(name string, conf jsontext.Value) (jsontext.Value, error) {
	fields := map[string]jsontext.Value{}
	if len(conf) > 0 {
		if err := json.Unmarshal(conf, &fields); err != nil {
			return nil, fmt.Errorf("parsing %s config: %w", opPgCreateEventTrigger, err)
		}
	}

	if _, hasDefinition := fields["definition"]; !hasDefinition {
		// Operation-spec fields Hasura's pg_create_event_trigger request carries
		// at the top level of args; the stored hdb_metadata form nests them under
		// "definition".
		opSpecKeys := []string{"insert", "update", "delete", "enable_manual"}
		definition := map[string]jsontext.Value{}

		for _, key := range opSpecKeys {
			if spec, ok := fields[key]; ok {
				definition[key] = spec

				delete(fields, key)
			}
		}

		if len(definition) > 0 {
			raw, err := json.Marshal(definition, json.Deterministic(true))
			if err != nil {
				return nil, fmt.Errorf(
					"assembling %s definition: %w", opPgCreateEventTrigger, err,
				)
			}

			fields["definition"] = jsontext.Value(raw)
		}
	}

	nameRaw, err := json.Marshal(name)
	if err != nil {
		return nil, fmt.Errorf("encoding %s name: %w", opPgCreateEventTrigger, err)
	}

	fields["name"] = jsontext.Value(nameRaw)

	stored, err := json.Marshal(fields, json.Deterministic(true))
	if err != nil {
		return nil, fmt.Errorf("assembling %s entry: %w", opPgCreateEventTrigger, err)
	}

	return jsontext.Value(stored), nil
}

// eventTriggerName extracts the "name" field from a stored event-trigger entry.
// Unmodeled fields are ignored, so only the identity field is read.
func eventTriggerName(raw jsontext.Value) (string, error) {
	var probe struct {
		Name string `json:"name"`
	}

	if err := json.Unmarshal(raw, &probe); err != nil {
		return "", fmt.Errorf("reading event trigger name: %w", err)
	}

	return probe.Name, nil
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
			name, err := eventTriggerName(existing)
			if err != nil {
				return "", err
			}

			if name == a.Name {
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
