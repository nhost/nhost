package golang

import (
	"go/ast"
	"go/token"
	"testing"

	"github.com/nhost/nhost/tools/codegen/processor"
	"github.com/pb33f/libopenapi/datamodel/high/base"
)

type testType struct {
	name string
}

func (t testType) Name() string {
	return t.name
}

func (testType) Kind() processor.KindIdentifier {
	return processor.KindIdentifierScalar
}

func (testType) Schema() *base.SchemaProxy {
	return nil
}

type testRawType struct {
	testType

	rawName string
}

func (t testRawType) RawName() string {
	return t.rawName
}

func TestSetImportPosition(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		importName   *ast.Ident
		position     token.Pos
		wantNamePos  token.Pos
		wantValuePos token.Pos
	}{
		{
			name:         "unaliased",
			position:     10,
			wantValuePos: 10,
		},
		{
			name:         "aliased",
			importName:   &ast.Ident{Name: "alias"},
			position:     20,
			wantNamePos:  20,
			wantValuePos: 26,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			importSpec := &ast.ImportSpec{
				Name:   test.importName,
				Path:   &ast.BasicLit{Value: `"example.com/dependency"`},
				EndPos: 99,
			}

			setImportPosition(importSpec, test.position)

			if importSpec.EndPos != token.NoPos {
				t.Errorf("EndPos = %d, want token.NoPos", importSpec.EndPos)
			}

			if importSpec.Path.ValuePos != test.wantValuePos {
				t.Errorf("Path.ValuePos = %d, want %d", importSpec.Path.ValuePos, test.wantValuePos)
			}

			if importSpec.Name != nil && importSpec.Name.NamePos != test.wantNamePos {
				t.Errorf("Name.NamePos = %d, want %d", importSpec.Name.NamePos, test.wantNamePos)
			}
		})
	}
}

func TestImportUsed(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		importName string
		importPath string
		used       map[string]struct{}
		want       bool
	}{
		{
			name:       "blank import",
			importName: "_",
			importPath: `"example.com/dependency"`,
			want:       true,
		},
		{
			name:       "dot import",
			importName: ".",
			importPath: `"example.com/dependency"`,
			want:       true,
		},
		{
			name:       "used alias",
			importName: "alias",
			importPath: `"example.com/dependency"`,
			used:       map[string]struct{}{"alias": {}},
			want:       true,
		},
		{
			name:       "unused alias",
			importName: "alias",
			importPath: `"example.com/dependency"`,
			want:       false,
		},
		{
			name:       "used path base",
			importPath: `"example.com/dependency"`,
			used:       map[string]struct{}{"dependency": {}},
			want:       true,
		},
		{
			name:       "unused path base",
			importPath: `"example.com/dependency"`,
			want:       false,
		},
		{
			name:       "invalid quoted path is retained",
			importPath: `"example.com/dependency`,
			want:       true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			importSpec := &ast.ImportSpec{
				Path: &ast.BasicLit{Value: test.importPath},
			}
			if test.importName != "" {
				importSpec.Name = &ast.Ident{Name: test.importName}
			}

			if got := importUsed(importSpec, test.used); got != test.want {
				t.Errorf("importUsed() = %t, want %t", got, test.want)
			}
		})
	}
}

func TestToExportedSanitizesInvalidNames(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		input string
		want  string
	}{
		{name: "empty", input: "", want: "Field"},
		{name: "punctuation only", input: "!@#", want: "Field"},
		{name: "digit prefix", input: "123-name", want: "F123Name"},
		{name: "initialisms", input: "api-url", want: "APIURL"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if got := toExported(test.input); got != test.want {
				t.Errorf("toExported(%q) = %q, want %q", test.input, got, test.want)
			}
		})
	}
}

func TestGoRawTypeName(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		typeValue processor.Type
		want      string
	}{
		{
			name:      "mapped name",
			typeValue: testType{name: "MappedName"},
			want:      "MappedName",
		},
		{
			name: "raw name",
			typeValue: testRawType{
				testType: testType{name: "MappedName"},
				rawName:  "raw-name",
			},
			want: "raw-name",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if got := goRawTypeName(test.typeValue); got != test.want {
				t.Errorf("goRawTypeName() = %q, want %q", got, test.want)
			}
		})
	}
}

func TestEnumValueKind(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		value any
		want  string
	}{
		{name: "boolean", value: true, want: schemaTypeBoolean},
		{name: "integer", value: int64(1), want: schemaTypeInteger},
		{name: "number", value: 1.5, want: schemaTypeNumber},
		{name: "string", value: "value", want: schemaTypeString},
		{name: "unsupported", value: nil, want: ""},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if got := enumValueKind(test.value); got != test.want {
				t.Errorf("enumValueKind(%v) = %q, want %q", test.value, got, test.want)
			}
		})
	}
}

func TestGoTypeForSchemaKind(t *testing.T) {
	t.Parallel()

	tests := []struct {
		kind string
		want string
	}{
		{kind: schemaTypeBoolean, want: goBooleanType},
		{kind: schemaTypeInteger, want: goIntegerType},
		{kind: schemaTypeNumber, want: goNumberType},
		{kind: schemaTypeString, want: goStringType},
		{kind: "unsupported", want: goRawMessageType},
	}

	for _, test := range tests {
		t.Run(test.kind, func(t *testing.T) {
			t.Parallel()

			if got := goTypeForSchemaKind(test.kind); got != test.want {
				t.Errorf("goTypeForSchemaKind(%q) = %q, want %q", test.kind, got, test.want)
			}
		})
	}
}

func TestGoReturnType(t *testing.T) {
	t.Parallel()

	goReturnType, ok := (&Golang{}).GetFuncMap()["goReturnType"].(func(string) string)
	if !ok {
		t.Fatal("goReturnType template function has an unexpected type")
	}

	tests := []struct {
		input string
		want  string
	}{
		{input: "", want: goRawMessageType},
		{input: "void", want: goRawMessageType},
		{input: "Result | void", want: goRawMessageType},
		{input: "Result", want: "Result"},
	}

	for _, test := range tests {
		t.Run(test.input, func(t *testing.T) {
			t.Parallel()

			if got := goReturnType(test.input); got != test.want {
				t.Errorf("goReturnType(%q) = %q, want %q", test.input, got, test.want)
			}
		})
	}
}

func TestTypeScalarNameFallsBackToAny(t *testing.T) {
	t.Parallel()

	plugin := &Golang{}

	typeValue, _, err := processor.GetType(
		base.CreateSchemaProxy(&base.Schema{Type: []string{"null"}}),
		"unknown",
		plugin,
		false,
	)
	if err != nil {
		t.Fatalf("failed to create scalar type: %v", err)
	}

	scalar, ok := typeValue.(*processor.TypeScalar)
	if !ok {
		t.Fatalf("type = %T, want *processor.TypeScalar", typeValue)
	}

	if got := plugin.TypeScalarName(scalar); got != "any" {
		t.Errorf("TypeScalarName() = %q, want %q", got, "any")
	}
}

func TestMethodPath(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		input string
		want  string
	}{
		{name: "parameter", input: "/items/{id}", want: "/items/%s"},
		{name: "percent", input: "/items/100%", want: "/items/100%%"},
		{
			name:  "unterminated parameter",
			input: "/items/{id%",
			want:  "/items/{id%%",
		},
	}

	plugin := &Golang{}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if got := plugin.MethodPath(test.input); got != test.want {
				t.Errorf("MethodPath(%q) = %q, want %q", test.input, got, test.want)
			}
		})
	}
}

func TestUnexportedReservedIdentifier(t *testing.T) {
	t.Parallel()

	tests := []struct {
		input string
		want  string
	}{
		{input: "", want: ""},
		{input: "Type", want: "type_"},
		{input: "Len", want: "len_"},
		{input: "ID", want: "id"},
		{input: "URLValue", want: "urlValue"},
	}

	for _, test := range tests {
		t.Run(test.input, func(t *testing.T) {
			t.Parallel()

			if got := unexported(test.input); got != test.want {
				t.Errorf("unexported(%q) = %q, want %q", test.input, got, test.want)
			}
		})
	}
}
