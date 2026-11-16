package autoai

import (
	"bytes"
	"fmt"
	"text/template"
)

func renderTemplate(tmpl string, data any) (string, error) {
	t, err := template.New("").Parse(tmpl)
	if err != nil {
		return "", fmt.Errorf("failed to parse template: %w", err)
	}

	var b bytes.Buffer
	if err := t.Execute(&b, data); err != nil {
		return "", fmt.Errorf("failed to execute template: %w", err)
	}

	return b.String(), nil
}
