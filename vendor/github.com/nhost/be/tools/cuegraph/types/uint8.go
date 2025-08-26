package types //nolint:dupl,revive,nolintlint

import (
	"encoding/json"
	"fmt"
	"io"
	"strconv"

	"github.com/99designs/gqlgen/graphql"
)

const (
	uint8bitSize = 8
)

func MarshalUint8(i uint8) graphql.Marshaler { //nolint: ireturn
	return graphql.WriterFunc(func(w io.Writer) {
		_, _ = io.WriteString(w, strconv.FormatUint(uint64(i), base))
	})
}

func UnmarshalUint8(v interface{}) (uint8, error) {
	switch v := v.(type) {
	case string:
		iv, err := strconv.ParseInt(v, base, uint8bitSize)
		if err != nil {
			return 0, fmt.Errorf("problem trying to parse string: %w", err)
		}

		return uint8(iv), nil //nolint:gosec
	case int:
		return uint8(v), nil //nolint:gosec
	case int64:
		return uint8(v), nil //nolint:gosec
	case json.Number:
		iv, err := strconv.ParseUint(string(v), base, uint8bitSize)
		if err != nil {
			return 0, fmt.Errorf("problem trying to parse json.Number: %w", err)
		}

		return uint8(iv), nil
	default:
		return 0, fmt.Errorf("%T is not an uint", v) //nolint: err113
	}
}
