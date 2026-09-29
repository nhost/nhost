package golang

import (
	"go/ast"
	"go/token"
	"io/fs"
	"regexp"
	"testing"

	"github.com/nhost/nhost/tools/codegen/processor"
	"github.com/pb33f/libopenapi/datamodel/high/base"
	"gopkg.in/yaml.v3"
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

func TestMapValuesUseJSON(t *testing.T) {
	t.Parallel()

	stringValue := &yaml.Node{}
	if err := stringValue.Encode("one"); err != nil {
		t.Fatalf("encode string enum value: %v", err)
	}

	integerValue := &yaml.Node{}
	if err := integerValue.Encode(1); err != nil {
		t.Fatalf("encode integer enum value: %v", err)
	}

	tests := []struct {
		name        string
		valueSchema *base.Schema
		want        bool
	}{
		{
			name:        "missing value type",
			valueSchema: &base.Schema{},
			want:        false,
		},
		{
			name: "invalid enum value",
			valueSchema: &base.Schema{
				Type: []string{schemaTypeString},
				Enum: []*yaml.Node{{Kind: yaml.ScalarNode, Tag: "!!int", Value: "x"}},
			},
			want: false,
		},
		{
			name: "multi-type heterogeneous enum",
			valueSchema: &base.Schema{
				Type: []string{schemaTypeString, schemaTypeInteger},
				Enum: []*yaml.Node{stringValue, integerValue},
			},
			want: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			mapSchema := base.CreateSchemaProxy(&base.Schema{
				Type: []string{"object"},
				AdditionalProperties: &base.DynamicValue[*base.SchemaProxy, bool]{
					A: base.CreateSchemaProxy(tt.valueSchema),
				},
			})

			typ, _, err := processor.GetType(
				mapSchema, "Map", &Golang{packageName: ""}, false,
			)
			if err != nil {
				t.Fatalf("create map type: %v", err)
			}

			if got := mapValuesUseJSON(typ); got != tt.want {
				t.Errorf("mapValuesUseJSON() = %t, want %t", got, tt.want)
			}
		})
	}
}

func TestGeneratedHelpersAreReservedMethodBindings(t *testing.T) {
	t.Parallel()

	helperPattern := regexp.MustCompile(`func(?: \([^)]*\))? ([a-z][A-Za-z0-9]*)\(`)
	registered := goMethodBindingNames()
	matchedHelpers := 0

	for _, templatePath := range []string{"templates/main.tmpl", "templates/client.tmpl"} {
		templateSource, err := fs.ReadFile(templatesFS, templatePath)
		if err != nil {
			t.Fatalf("read %s: %v", templatePath, err)
		}

		for _, match := range helperPattern.FindAllSubmatch(templateSource, -1) {
			matchedHelpers++

			helperName := string(match[1])
			if _, ok := registered[helperName]; !ok {
				t.Errorf("generated helper %q from %s is not reserved", helperName, templatePath)
			}
		}
	}

	if matchedHelpers == 0 {
		t.Fatal("generated helper scan matched no template functions")
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
