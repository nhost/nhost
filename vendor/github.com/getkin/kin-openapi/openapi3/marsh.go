package openapi3

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/invopop/yaml"
)

func unmarshalError(jsonUnmarshalErr error) error {
	if before, after, found := strings.Cut(jsonUnmarshalErr.Error(), "Bis"); found && before != "" && after != "" {
		before = strings.ReplaceAll(before, " Go struct ", " ")
		return fmt.Errorf("%s%s", before, strings.ReplaceAll(after, "Bis", ""))
	}
	return jsonUnmarshalErr
}

func unmarshal(data []byte, v interface{}) error {
	// See https://github.com/getkin/kin-openapi/issues/680
	if err := json.Unmarshal(data, v); err != nil {
		// UnmarshalStrict(data, v) TODO: investigate how ymlv3 handles duplicate map keys
		return yaml.Unmarshal(data, v)
	}
	return nil
}
