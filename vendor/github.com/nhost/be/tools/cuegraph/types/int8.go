package types //nolint: dupl,revive,nolintlint

import (
	"encoding/json"
	"fmt"
	"io"
	"strconv"

	"github.com/99designs/gqlgen/graphql"
)

const (
	int8bitSize = 8
)

func MarshalInt8(i int8) graphql.Marshaler { //nolint: ireturn
	return graphql.WriterFunc(func(w io.Writer) {
		_, _ = io.WriteString(w, strconv.FormatInt(int64(i), base))
	})
}

func UnmarshalInt8(v any) (int8, error) {
	switch v := v.(type) {
	case string:
		iv, err := strconv.ParseInt(v, base, int8bitSize)
		if err != nil {
			return 0, fmt.Errorf("problem trying to parse string: %w", err)
		}

		return int8(iv), nil
	case int:
		return int8(v), nil //nolint:gosec
	case int64:
		return int8(v), nil //nolint:gosec
	case json.Number:
		iv, err := strconv.ParseUint(string(v), base, int8bitSize)
		if err != nil {
			return 0, fmt.Errorf("problem trying to parse json.Number: %w", err)
		}

		return int8(iv), nil //nolint:gosec
	default:
		return 0, fmt.Errorf("%T is not an int", v) //nolint: err113
	}
}
