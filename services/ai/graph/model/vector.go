package model

import (
	"encoding/json"
	"fmt"
	"io"

	"github.com/99designs/gqlgen/graphql"
)

func MarshalVector(val []float32) graphql.Marshaler { //nolint:ireturn,nolintlint
	return graphql.WriterFunc(func(w io.Writer) {
		err := json.NewEncoder(w).Encode(val)
		if err != nil {
			panic(err)
		}
	})
}

func UnmarshalVector(v any) ([]float32, error) {
	switch v := v.(type) {
	case []float32:
		return v, nil
	case string:
		var val []float32
		if err := json.Unmarshal([]byte(v), &val); err != nil {
			return nil, fmt.Errorf("%T is not a vector", v) //nolint:err113
		}

		return val, nil
	case []byte:
		var val []float32
		if err := json.Unmarshal(v, &val); err != nil {
			return nil, fmt.Errorf("%T is not a vector", v) //nolint:err113
		}

		return val, nil
	}

	return nil, fmt.Errorf("%T is not a supported type", v) //nolint:err113
}
