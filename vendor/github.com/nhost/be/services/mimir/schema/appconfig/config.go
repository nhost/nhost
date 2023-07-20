package appconfig

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"unsafe"

	"github.com/nhost/be/services/mimir/model"
	"github.com/valyala/fasttemplate"
)

func SecretsResolver[T any](
	conf *T,
	secrets model.Secrets,
	fillerFunc func(any) (*T, error),
) (*T, error) {
	vars := map[string]any{}
	for _, e := range secrets {
		vars["secrets."+e.Name] = strings.ReplaceAll(e.Value, `"`, `\"`)
	}

	data, err := json.Marshal(conf)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal config: %w", err)
	}

	data, err = interpolateTemplate(data, vars)
	if err != nil {
		return nil, fmt.Errorf("failed to render config tempolate: %w", err)
	}

	cfg := new(T)
	if err := json.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	cfg, err = fillerFunc(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to validate config: %w", err)
	}
	return cfg, nil
}

// Render renders a template with the given variables. Variables are referenced
// in the template using the syntax {{ variable_name }}.
func interpolateTemplate(template []byte, vars map[string]any) ([]byte, error) {
	t := fasttemplate.New(unsafeBytes2String(template), "{{", "}}")
	buf := bytes.NewBuffer(make([]byte, 0, len(template)))
	if _, err := t.ExecuteFunc(buf, templateResolver(vars)); err != nil {
		return nil, fmt.Errorf("failed to render template: %w", err)
	}

	return buf.Bytes(), nil
}

func templateResolver(vars map[string]any) func(w io.Writer, tag string) (int, error) {
	return func(w io.Writer, tag string) (int, error) {
		tag = strings.TrimSpace(tag)

		v, ok := vars[tag]
		if !ok {
			return 0, &VariableNotFoundError{Name: tag}
		}
		n, err := fmt.Fprint(w, v)
		if err != nil {
			return 0, fmt.Errorf("failed to write to buffer: %w", err)
		}
		return n, nil
	}
}

func unsafeBytes2String(b []byte) string {
	return *(*string)(unsafe.Pointer(&b))
}

type VariableNotFoundError struct {
	Name string
}

func (e *VariableNotFoundError) Error() string {
	return fmt.Sprintf("variable not found: %s", e.Name)
}
