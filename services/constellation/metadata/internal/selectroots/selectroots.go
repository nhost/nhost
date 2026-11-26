// Package selectroots validates table select root allowlists across metadata formats.
package selectroots

import (
	"errors"
	"fmt"
)

// Kind names the allowlist key and determines which operations it accepts.
type Kind string

const (
	Query        Kind = "query_root_fields"
	Subscription Kind = "subscription_root_fields"
)

var (
	errNotList   = errors.New("expected a list of operation names or null")
	errNotString = errors.New("expected an operation name string")
	errUnknown   = errors.New("unknown root operation")
)

// Decode accepts the JSON/YAML representation without coercing list entries.
// A nil value leaves roots unrestricted; a non-nil empty list hides all roots.
func (k Kind) Decode(value any) (*[]string, error) {
	if value == nil {
		return nil, nil //nolint:nilnil // a nil allowlist explicitly means unrestricted
	}

	list, ok := value.([]any)
	if !ok {
		return nil, fmt.Errorf("%s: %w", k, errNotList)
	}

	fields := make([]string, len(list))
	for i, entry := range list {
		field, ok := entry.(string)
		if !ok {
			return nil, fmt.Errorf("%s[%d]: %w (got %T)", k, i, errNotString, entry)
		}

		fields[i] = field
	}

	if err := k.Validate(fields); err != nil {
		return nil, err
	}

	return &fields, nil
}

// Validate checks the operation names in an already typed allowlist.
func (k Kind) Validate(fields []string) error {
	for i, field := range fields {
		switch field {
		case "select", "select_by_pk", "select_aggregate":
			continue
		case "select_stream":
			if k == Subscription {
				continue
			}
		}

		return fmt.Errorf("%s[%d]: %w %q", k, i, errUnknown, field)
	}

	return nil
}
