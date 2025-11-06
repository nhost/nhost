package types //nolint: dupl,revive,nolintlint

import (
	"encoding/json"
	"fmt"
	"io"
	"strconv"

	"github.com/99designs/gqlgen/graphql"
)

const (
	int16bitSize = 16
)

func MarshalInt16(i int16) graphql.Marshaler { //nolint: ireturn
	return graphql.WriterFunc(func(w io.Writer) {
		_, _ = io.WriteString(w, strconv.FormatInt(int64(i), base))
	})
}

func UnmarshalInt16(v interface{}) (int16, error) {
	switch v := v.(type) {
	case string:
		iv, err := strconv.ParseInt(v, base, int16bitSize)
		if err != nil {
			return 0, fmt.Errorf("problem trying to parse string: %w", err)
		}

		return int16(iv), nil
	case int:
		return int16(v), nil //nolint:gosec
	case int64:
		return int16(v), nil //nolint:gosec
	case json.Number:
		iv, err := strconv.ParseUint(string(v), base, int16bitSize)
		if err != nil {
			return 0, fmt.Errorf("problem trying to parse json.Number: %w", err)
		}

		return int16(iv), nil //nolint:gosec
	default:
		return 0, fmt.Errorf("%T is not an int", v) //nolint: err113
	}
}
