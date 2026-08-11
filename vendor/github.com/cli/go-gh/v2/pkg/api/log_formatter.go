package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"github.com/cli/go-gh/v2/pkg/jsonpretty"
)

type graphqlBody struct {
	Query         string          `json:"query"`
	OperationName string          `json:"operationName"`
	Variables     json.RawMessage `json:"variables"`
}

// jsonFormatter is a httpretty.Formatter that prettifies JSON payloads and GraphQL queries.
type jsonFormatter struct {
	colorize bool
}

func (f *jsonFormatter) Format(w io.Writer, src []byte) error {
	var graphqlQuery graphqlBody
	// TODO: find more precise way to detect a GraphQL query from the JSON payload alone
	if err := json.Unmarshal(src, &graphqlQuery); err == nil && graphqlQuery.Query != "" && len(graphqlQuery.Variables) > 0 {
		colorHighlight := "\x1b[35;1m"
		colorReset := "\x1b[m"
		if !f.colorize {
			colorHighlight = ""
			colorReset = ""
		}
		if _, err := fmt.Fprintf(w, "%sGraphQL query:%s\n%s\n", colorHighlight, colorReset, strings.ReplaceAll(strings.TrimSpace(graphqlQuery.Query), "\t", "  ")); err != nil {
			return err
		}
		if _, err := fmt.Fprintf(w, "%sGraphQL variables:%s %s\n", colorHighlight, colorReset, string(graphqlQuery.Variables)); err != nil {
			return err
		}
		return nil
	}
	return jsonpretty.Format(w, bytes.NewReader(src), "  ", f.colorize)
}

func (f *jsonFormatter) Match(t string) bool {
	return jsonTypeRE.MatchString(t)
}
