package cmd

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"text/template"

	"github.com/urfave/cli/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
)

const (
	flagPath = "path"
)

//go:embed gen-docs.gotmpl
var goTemplate string

func CommandGenDocs() *cli.Command {
	return &cli.Command{ //nolint: exhaustruct
		Name:   "gen-docs",
		Hidden: true,
		Usage:  "Generate docs",
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:  flagPath,
				Usage: "Output folder",
				Value: "docs",
			},
		},
		Action: genDocsAction,
	}
}

type Types struct {
	Object map[string]*ast.Definition
	Scalar map[string]*ast.Definition
}

func getSchemaDocument() (*ast.SchemaDocument, error) {
	b, err := os.ReadFile("schema/graphite.graphqls")
	if err != nil {
		return nil, fmt.Errorf("failed to read schema file: %w", err)
	}

	doc, err := parser.ParseSchema(&ast.Source{
		Name:    "schema.graphql",
		Input:   string(b),
		BuiltIn: true,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to parse schema: %w", err)
	}

	return doc, nil
}

func genDocsAction(c *cli.Context) error {
	doc, err := getSchemaDocument()
	if err != nil {
		return err
	}

	types := Types{
		Object: map[string]*ast.Definition{},
		Scalar: map[string]*ast.Definition{},
	}

	for _, d := range doc.Definitions {
		switch d.Kind {
		case ast.Scalar:
			types.Scalar[d.Name] = d
		case ast.Object, ast.InputObject:
			types.Object[d.Name] = d
		case ast.Enum, ast.Interface, ast.Union:
			return fmt.Errorf("unsupported type: %s", d.Kind) //nolint:err113
		}

		if d.Kind == ast.Object && d.Name == "Query" {
			if err := genQuery(c, d, types); err != nil {
				return err
			}
		}

		if d.Kind == ast.Object && d.Name == "Mutation" {
			if err := genMutation(c, d, types); err != nil {
				return err
			}
		}
	}

	return nil
}

func genQuery(c *cli.Context, d *ast.Definition, types Types) error {
	for _, f := range d.Fields {
		path := filepath.Join(c.String(flagPath), "query")
		if err := os.MkdirAll(path, 0o755); err != nil { //nolint:mnd
			return fmt.Errorf("failed to create folder: %w", err)
		}

		path = filepath.Join(path, f.Name+".mdx")

		dst, err := os.Create(path)
		if err != nil {
			return fmt.Errorf("failed to create file: %w", err)
		}
		defer dst.Close()

		processQuery(f, types, dst)
	}

	return nil
}

func renderArgumentsExample(types Types) func(*ast.FieldDefinition) string {
	return func(f *ast.FieldDefinition) string {
		args := make(map[string]any)

		for _, arg := range f.Arguments {
			switch arg.Type.Name() {
			case "String":
				args[arg.Name] = "string"
			case "Int":
				args[arg.Name] = 1
			case "Float":
				args[arg.Name] = 1.0
			case "Boolean":
				args[arg.Name] = true
			default:
				t, ok := types.Object[arg.Type.Name()]
				if ok {
					if strings.HasPrefix(f.Type.String(), "[") {
						args[arg.Name] = []any{populateResponseExample(t, types)}
					} else {
						args[arg.Name] = populateResponseExample(t, types)
					}
				} else {
					panic("unsupported type: " + arg.Type.Name())
				}
			}
		}

		b, err := json.MarshalIndent(args, "", "  ")
		if err != nil {
			panic(err)
		}

		return string(b)
	}
}

func populateResponseExample(t *ast.Definition, types Types) any {
	resp := make(map[string]any)

	for _, f := range t.Fields {
		switch f.Type.Name() {
		case "String":
			resp[f.Name] = "string"
		case "Int":
			resp[f.Name] = 1
		case "Float":
			resp[f.Name] = 1.0
		case "Boolean":
			resp[f.Name] = true
		case "uuid":
			resp[f.Name] = "61809D37-DA3F-4EFC-A324-EB181F38DD85"
		case "timestampz":
			resp[f.Name] = "2023-12-14T07:45:15.20353+00:00"
		default:
			t, ok := types.Object[f.Type.Name()]
			if ok {
				if strings.HasPrefix(f.Type.String(), "[") {
					resp[f.Name] = []any{populateResponseExample(t, types)}
				} else {
					resp[f.Name] = populateResponseExample(t, types)
				}
			} else {
				panic("unsupported type: " + f.Type.Name())
			}
		}
	}

	return resp
}

func renderResponseExample(f *ast.FieldDefinition, types Types) func() string {
	return func() string {
		resp := make(map[string]any)
		resp["data"] = make(map[string]any)
		//nolint: forcetypeassert
		resp["data"].(map[string]any)["graphite"] = make(map[string]any)

		//nolint: forcetypeassert
		graphite := resp["data"].(map[string]any)["graphite"].(map[string]any)

		t, ok := types.Object[f.Type.Name()]
		if ok {
			if strings.HasPrefix(f.Type.String(), "[") {
				graphite[f.Name] = []any{populateResponseExample(t, types)}
			} else {
				graphite[f.Name] = populateResponseExample(t, types)
			}
		}

		b, err := json.MarshalIndent(resp, "", "  ")
		if err != nil {
			panic(err)
		}

		return string(b)
	}
}

func isRequired(t *ast.Type) bool {
	return strings.HasSuffix(t.String(), "!")
}

func getObject(types Types) func(string) *ast.Definition {
	return func(name string) *ast.Definition {
		return types.Object[name]
	}
}

func isNested(types Types) func(string) bool {
	return func(name string) bool {
		_, ok := types.Object[name]
		return ok
	}
}

type objectSelectionParam struct {
	Type   *ast.Definition
	Indent string
}

func objectSelectionParamArg(t *ast.Definition, indent string) objectSelectionParam {
	return objectSelectionParam{
		Type:   t,
		Indent: indent,
	}
}

func processQuery(f *ast.FieldDefinition, types Types, dst io.Writer) {
	tpl := template.Must(
		template.New("gen-docs").
			Funcs(template.FuncMap{
				"isRequired":              isRequired,
				"getObject":               getObject(types),
				"isNested":                isNested(types),
				"objectSelectionParamArg": objectSelectionParamArg,
				"renderArgumentsExample":  renderArgumentsExample(types),
				"renderResponseExample":   renderResponseExample(f, types),
			}).
			Parse(goTemplate),
	)

	err := tpl.Execute(dst, f)
	if err != nil {
		panic(err)
	}
}

func genMutation(c *cli.Context, d *ast.Definition, types Types) error {
	for _, f := range d.Fields {
		path := filepath.Join(c.String(flagPath), "mutation")
		if err := os.MkdirAll(path, 0o755); err != nil { //nolint:mnd
			return fmt.Errorf("failed to create folder: %w", err)
		}

		path = filepath.Join(path, f.Name+".mdx")

		dst, err := os.Create(path)
		if err != nil {
			return fmt.Errorf("failed to create file: %w", err)
		}
		defer dst.Close()

		processQuery(f, types, dst)
	}

	return nil
}
