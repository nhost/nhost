package types

import (
	"encoding/json"
	"fmt"
	"io"
	"strconv"

	"github.com/99designs/gqlgen/graphql"
)

const (
	base          = 10
	uint16bitSize = 16
)

func MarshalUint16(i uint16) graphql.Marshaler { //nolint: ireturn
	return graphql.WriterFunc(func(w io.Writer) {
		_, _ = io.WriteString(w, strconv.FormatUint(uint64(i), base))
	})
}

func UnmarshalUint16(v interface{}) (uint16, error) {
	switch v := v.(type) {
	case string:
		iv, err := strconv.ParseInt(v, base, uint16bitSize)
		if err != nil {
			return 0, fmt.Errorf("problem trying to parse string: %w", err)
		}
		return uint16(iv), nil //nolint:gosec
	case int:
		return uint16(v), nil //nolint:gosec
	case int64:
		return uint16(v), nil //nolint:gosec
	case json.Number:
		iv, err := strconv.ParseUint(string(v), base, uint16bitSize)
		if err != nil {
			return 0, fmt.Errorf("problem trying to parse json.Number: %w", err)
		}
		return uint16(iv), nil
	default:
		return 0, fmt.Errorf("%T is not an uint", v) //nolint: goerr113
	}
}
