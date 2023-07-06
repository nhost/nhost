package env

import (
	"fmt"

	"github.com/nhost/be/services/mimir/model"
	"github.com/pelletier/go-toml/v2"
)

type UnsupportedTypeError struct {
	v any
}

func (e *UnsupportedTypeError) Error() string {
	return fmt.Sprintf("unsupported type %T", e.v)
}

type InvalidLineError struct {
	line int
}

func (e *InvalidLineError) Error() string {
	return fmt.Sprintf("invalid secret on line %d", e.line)
}

// Only supports parsing secrets into a *model.Secrets.
func Unmarshal(data []byte, v any) error {
	switch secrets := v.(type) {
	case *model.Secrets:
		m := make(map[string]string)
		if err := toml.Unmarshal(data, &m); err != nil {
			return err //nolint:wrapcheck
		}

		for k, v := range m {
			*secrets = append(
				*secrets, &model.ConfigEnvironmentVariable{
					Name:  k,
					Value: v,
				},
			)
		}
		return nil
	default:
		return toml.Unmarshal(data, v) //nolint:wrapcheck
	}
}

// Only supports parsing secrets from a *model.Secrets.
func Marshal(v any) ([]byte, error) {
	m := make(map[string]string)
	switch secrets := v.(type) {
	case *model.Secrets:
		for _, v := range *secrets {
			m[v.Name] = v.Value
		}
	case model.Secrets:
		for _, v := range secrets {
			m[v.Name] = v.Value
		}
	default:
		return nil, &UnsupportedTypeError{v}
	}

	return toml.Marshal(m) //nolint:wrapcheck
}
