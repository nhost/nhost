package types //nolint: revive,nolintlint

import (
	"encoding/json"
	"fmt"
	"io"

	"github.com/99designs/gqlgen/graphql"
)

func MarshalRawJSON(v json.RawMessage) graphql.Marshaler { //nolint:ireturn
	return graphql.WriterFunc(func(w io.Writer) {
		if v == nil {
			_, _ = io.WriteString(w, "null")
			return
		}

		_, _ = w.Write(v)
	})
}

func UnmarshalRawJSON(v any) (json.RawMessage, error) {
	if v == nil {
		return nil, nil
	}

	b, err := json.Marshal(v)
	if err != nil {
		return nil, fmt.Errorf("marshaling raw JSON: %w", err)
	}

	return b, nil
}
