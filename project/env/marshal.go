package env

import (
	"bufio"
	"bytes"
	"fmt"
	"strings"

	"github.com/nhost/be/services/mimir/model"
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

func parseContents(data []byte, secrets *model.Secrets) error {
	scanner := bufio.NewScanner(bufio.NewReader(bytes.NewReader(data)))
	scanner.Split(bufio.ScanLines)

	i := 1
	for scanner.Scan() {
		line := scanner.Text()
		line = strings.Split(line, "#")[0]
		line = strings.TrimSpace(line)

		if line == "" {
			continue
		}

		parts := strings.SplitN(line, "=", 2) //nolint:gomnd
		if len(parts) != 2 {                  //nolint:gomnd
			return &InvalidLineError{i}
		}

		*secrets = append(
			*secrets,
			&model.ConfigEnvironmentVariable{
				Name:  strings.TrimSpace(parts[0]),
				Value: strings.TrimSpace(parts[1]),
			},
		)
		i++
	}

	return nil
}

// Only supports parsing secrets into a *model.Secrets.
func Unmarshal(data []byte, v any) error {
	switch secrets := v.(type) {
	case *model.Secrets:
		return parseContents(data, secrets)
	default:
		return &UnsupportedTypeError{v}
	}
}

// Only supports parsing secrets from a *model.Secrets.
func Marshal(v any) ([]byte, error) {
	buf := bytes.NewBuffer(nil)
	switch secrets := v.(type) {
	case *model.Secrets:
		for _, v := range *secrets {
			if _, err := fmt.Fprintf(buf, "%s=%s\n", v.Name, v.Value); err != nil {
				return nil, fmt.Errorf("failed to write env: %w", err)
			}
		}
	case model.Secrets:
		for _, v := range secrets {
			if _, err := fmt.Fprintf(buf, "%s=%s\n", v.Name, v.Value); err != nil {
				return nil, fmt.Errorf("failed to write env: %w", err)
			}
		}
	default:
		return nil, &UnsupportedTypeError{v}
	}

	return buf.Bytes(), nil
}
