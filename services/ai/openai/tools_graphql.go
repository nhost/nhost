package openai

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"slices"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
)

func getGraphqlSchema(
	ctx context.Context,
	endpoint, adminSecret string,
) (*ast.SchemaDocument, error) {
	res, err := execCmd(
		ctx,
		"rover",
		"graph",
		"introspect",
		"-H",
		"X-Hasura-admin-secret: "+adminSecret,
		endpoint,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get graphql schema: %w", err)
	}

	q, err := parser.ParseSchema(&ast.Source{
		Name:    "schema.graphql",
		Input:   res,
		BuiltIn: false,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to parse schema: %w", err)
	}

	return q, nil
}

func getSchemaLayout(document *ast.SchemaDocument) string {
	queryRoot, mutationRoot, subscriptionRoot := getRoots(document)

	definitions := make(map[string]*ast.Definition)
	for _, d := range document.Definitions {
		definitions[d.Name] = d
	}

	var res strings.Builder

	for _, d := range document.Definitions {
		switch d.Name {
		case queryRoot:
			res.WriteString(getRoot("type", "query", d, definitions))
			res.WriteString("\n")

		case mutationRoot:
			res.WriteString(getRoot("type", "mutation", d, definitions))
			res.WriteString("\n")

		case subscriptionRoot:
			res.WriteString(getRoot("type", "subscription", d, definitions))
		}
	}

	return res.String()
}

func getRoot(
	prefix string,
	operation string,
	root *ast.Definition,
	definitions map[string]*ast.Definition,
) string {
	var rootBody strings.Builder

	rootBody.WriteString(prefix)
	rootBody.WriteString(" ")
	rootBody.WriteString(operation)
	rootBody.WriteString(" {\n")

	for _, f := range root.Fields {
		rootBody.WriteString(printQueryMutationLayout(f, "    ", definitions))
	}

	rootBody.WriteString("}\n")

	return rootBody.String()
}

func printQueryMutationLayout(
	f *ast.FieldDefinition, indent string, definitions map[string]*ast.Definition,
) string {
	if len(f.Arguments) == 0 {
		if strings.Contains(f.Type.Name(), "Query") || strings.Contains(f.Type.Name(), "Mutation") {
			var layout strings.Builder

			layout.WriteString(indent)
			layout.WriteString(f.Name)
			layout.WriteString(" {\n")

			d, ok := definitions[f.Type.Name()]
			if ok {
				for _, f := range d.Fields {
					layout.WriteString(printQueryMutationLayout(f, indent+"  ", definitions))
				}
			}

			layout.WriteString(indent)
			layout.WriteString("}\n")

			return layout.String()
		}

		return fmt.Sprintf("%s%s: %s\n\n", indent, f.Name, f.Type.String())
	}

	return fmt.Sprintf("%s%s(...): %s\n", indent, f.Name, f.Type.String())
}

func getQueryMutation(
	f *ast.FieldDefinition, indent string, definitions map[string]*ast.Definition,
) (string, []*ast.Definition) {
	traversed := make([]*ast.Definition, 0, 10) //nolint: mnd

	if len(f.Arguments) == 0 {
		if strings.Contains(f.Type.Name(), "Query") || strings.Contains(f.Type.Name(), "Mutation") {
			var query strings.Builder

			query.WriteString(indent)
			query.WriteString(f.Name)
			query.WriteString(" {\n")

			d, ok := definitions[f.Type.Name()]
			if ok {
				for _, f := range d.Fields {
					s, t := getQueryMutation(f, indent+"  ", definitions)
					query.WriteString(s)

					traversed = append(traversed, t...)
				}
			}

			query.WriteString(indent)
			query.WriteString("}\n\n")

			return query.String(), traversed
		}

		return fmt.Sprintf("%s%s: %s\n\n", indent, f.Name, f.Type.String()), traversed
	}

	var query strings.Builder

	query.WriteString(indent)
	query.WriteString(f.Name)
	query.WriteString("(\n")

	for _, a := range f.Arguments {
		query.WriteString(indent)
		query.WriteString("  ")
		query.WriteString(a.Name)
		query.WriteString(": ")
		query.WriteString(a.Type.String())
		query.WriteString("\n")

		typ, ok := definitions[a.Type.Name()]
		if ok {
			traversed = append(traversed, typ)
		}
	}

	query.WriteString(indent)
	query.WriteString("): ")
	query.WriteString(f.Type.String())
	query.WriteString("\n\n")

	typ, ok := definitions[f.Type.Name()]
	if ok {
		traversed = append(traversed, typ)
	}

	return query.String(), traversed
}

func getRoots(document *ast.SchemaDocument) (string, string, string) {
	var (
		queryRoot        string
		mutationRoot     string
		subscriptionRoot string
	)

	for _, s := range document.Schema {
		for _, o := range s.OperationTypes {
			switch o.Operation {
			case ast.Query:
				queryRoot = o.Type
			case ast.Mutation:
				mutationRoot = o.Type
			case ast.Subscription:
				subscriptionRoot = o.Type
			}
		}
	}

	return queryRoot, mutationRoot, subscriptionRoot
}

func getSpecificMethod(document *ast.SchemaDocument, operation, method string) string {
	definitions := make(map[string]*ast.Definition)
	for _, d := range document.Definitions {
		definitions[d.Name] = d
	}

	var methodSchema strings.Builder

	methodSchema.WriteString("query {\n")

	traversed := make([]*ast.Definition, 0, 10) //nolint: mnd
	for _, d := range document.Definitions {
		if d.Name == operation {
			for _, f := range d.Fields {
				if f.Name == method {
					s, t := getQueryMutation(f, "  ", definitions)
					methodSchema.WriteString(s)

					traversed = append(traversed, t...)
				}
			}
		}
	}

	methodSchema.WriteString("}\n")

	traversed = append(traversed, recursiveTraverse(traversed, definitions)...)

	for _, t := range traversed {
		var prefix string
		switch t.Kind { //nolint:exhaustive
		case "OBJECT":
			prefix = "type"
		case "INPUT_OBJECT":
			prefix = "input"
		}

		methodSchema.WriteString(getRoot(prefix, t.Name, t, definitions))
	}

	return methodSchema.String()
}

func recursiveTraverse(
	traversed []*ast.Definition, definitions map[string]*ast.Definition,
) []*ast.Definition {
	for _, t := range traversed {
		for _, f := range t.Fields {
			typ, ok := definitions[f.Type.Name()]
			if ok && !slices.Contains(traversed, typ) {
				if typ.Name == "OBJECT" || typ.Name == "IPUT_OBJECT" {
					traversed = append(traversed, typ)
					traversed = append(traversed, recursiveTraverse(traversed, definitions)...)
				}
			}
		}
	}

	return traversed
}

func toolGetGraphqlLayout(endpoint, adminSecret string) toolFn {
	return func(ctx context.Context, _ string, logger *slog.Logger) string {
		document, err := getGraphqlSchema(ctx, endpoint, adminSecret)
		if err != nil {
			logger.ErrorContext(
				ctx,
				"failed to get graphql schema",
				slog.String("error", err.Error()),
			)

			return fmt.Sprintf("failed to get graphql schema: %s", err)
		}

		return getSchemaLayout(document)
	}
}

func toolGetGraphqlMethod(endpoint, adminSecret string) toolFn {
	return func(ctx context.Context, arguments string, logger *slog.Logger) string {
		args := struct {
			Operation string `json:"operation"`
			Method    string `json:"method"`
		}{
			Operation: "",
			Method:    "",
		}
		if err := json.Unmarshal([]byte(arguments), &args); err != nil {
			logger.ErrorContext(
				ctx,
				"failed to decode arguments",
				slog.String("error", err.Error()),
			)

			return "Failed to decode arguments. Expecting a JSON object with a schema and table property."
		}

		document, err := getGraphqlSchema(ctx, endpoint, adminSecret)
		if err != nil {
			logger.ErrorContext(
				ctx,
				"failed to get graphql schema",
				slog.String("error", err.Error()),
			)

			return fmt.Sprintf("failed to get graphql schema: %s", err)
		}

		op := strings.ToLower(args.Operation) + "_root"

		return getSpecificMethod(document, op, args.Method)
	}
}
