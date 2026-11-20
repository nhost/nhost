package queries_test

import (
	"bytes"
	"errors"
	"testing"

	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/formatter"
	"github.com/vektah/gqlparser/v2/parser"
	"github.com/vektah/gqlparser/v2/validator"
	"github.com/vektah/gqlparser/v2/validator/rules"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
)

type normalizeInputCase struct {
	name           string
	query          string
	operation      string
	variables      map[string]any
	want           string
	skipCoercion   bool
	skipValidation bool
	wantErr        bool
}

func TestNormalizeInputVariables(t *testing.T) {
	t.Parallel()

	schema, err := gqlparser.LoadSchema(&ast.Source{Input: `
 scalar jsonb
 input Input {first:Int defaulted:Int=7 requiredDefault:Int!=9 nested:Input list:[Int] strict:[Int!] json:jsonb}
 type Item {id:Int items(input:Input,limit:Int,required:Int!=8):[Item!]!}
 type Query {items(input:Input,limit:Int,defaulted:Int=11,required:Int!=12):[Item!]!}
 input Predicate {_and:[Predicate!] _or:[Predicate!] _not:Predicate id:Comparison}
 input Comparison {_eq:Int}
 input Changes {where:Predicate value:Int}
 input OtherInput {where:Input}
 type Mutation {change(where:Predicate,changes:[Changes!],input:OtherInput):Item}
 `})
	if err != nil {
		t.Fatalf("LoadSchema: %v", err)
	}

	tests := []normalizeInputCase{
		{
			name:    "renamed mutation selector rejects omission",
			query:   `mutation($x:Int){change(where:{id:{_eq:$x}}){id}}`,
			wantErr: true,
		},
		{
			name:    "mutation root fragment rejects omission",
			query:   `mutation($x:Int){...M} fragment M on Mutation{change(where:{id:{_eq:$x}}){id}}`,
			wantErr: true,
		},
		{
			name:    "nested whole mutation selector rejects omission",
			query:   `mutation($x:Predicate){change(changes:[{where:$x}]){id}}`,
			wantErr: true,
		},
		{
			name:    "whole optional mutation selector rejects omission",
			query:   `mutation($x:Predicate){change(where:$x){id}}`,
			wantErr: true,
		},
		{
			name:  "mutation non-selector where stays optional",
			query: `mutation($x:Int){change(input:{where:{first:$x}}){id}}`,
			want:  `mutation($x:Int){change(input:{where:{}}){id}}`,
		},
		{
			name:  "mutation returning read inputs stay optional",
			query: `mutation($x:Int){change(where:{}){items(input:{first:$x},limit:$x){id}}}`,
			want:  `mutation($x:Int){change(where:{}){items(input:{}){id}}}`,
		},
		{
			name:  "omitted argument",
			query: `query($x:Int){items(limit:$x){id}}`,
			want:  `query($x:Int){items{id}}`,
		},
		{
			name:  "argument default",
			query: `query($x:Int){items(defaulted:$x){id}}`,
			want:  `query($x:Int){items(defaulted:11){id}}`,
		},
		{
			name:  "required argument default",
			query: `query($x:Int){items(required:$x){id}}`,
			want:  `query($x:Int){items(required:12){id}}`,
		},
		{
			name:  "nested fields and list position",
			query: `query($x:Int){items(input:{first:$x,nested:{first:$x},list:[1,$x,3]}){id}}`,
			want:  `query($x:Int){items(input:{nested:{},list:[1,null,3]}){id}}`,
		},
		{
			name:  "input field defaults",
			query: `query($x:Int){items(input:{defaulted:$x,requiredDefault:$x}){id}}`,
			want:  `query($x:Int){items(input:{defaulted:7,requiredDefault:9}){id}}`,
		},
		{
			name:  "json scalar object and list",
			query: `query($x:Int){items(input:{json:{field:$x,list:[1,$x,3]}}){id}}`,
			want:  `query($x:Int){items(input:{json:{list:[1,null,3]}}){id}}`,
		},
		{
			name:      "explicit null argument keeps presence",
			query:     `query($x:Int){items(defaulted:$x){id}}`,
			variables: map[string]any{"x": nil},
			want:      `query($x:Int){items(defaulted:$x){id}}`,
		},
		{
			name:      "explicit null object field keeps presence",
			query:     `query($x:Int){items(input:{defaulted:$x}){id}}`,
			variables: map[string]any{"x": nil},
			want:      `query($x:Int){items(input:{defaulted:$x}){id}}`,
		},
		{
			name:      "provided variable stays unresolved",
			query:     `query($x:Int){items(limit:$x){id}}`,
			variables: map[string]any{"x": 2},
			want:      `query($x:Int){items(limit:$x){id}}`,
		},
		{
			name:  "coerced variable default",
			query: `query($x:Int=2){items(limit:$x){id}}`,
			want:  `query($x:Int=2){items(limit:$x){id}}`,
		},
		{
			name:         "uncoerced nullable variable default",
			query:        `query($x:Int=2){items(limit:$x){id}}`,
			skipCoercion: true,
			want:         `query($x:Int=2){items(limit:2){id}}`,
		},
		{
			name:         "required variable cannot fall back to input default",
			query:        `query($x:Int!){items(required:$x){id}}`,
			skipCoercion: true,
			want:         `query($x:Int!){items(required:$x){id}}`,
		},
		{
			name:           "unvalidated arguments cannot be omitted",
			query:          `query($x:Int){items(required:$x){id}}`,
			skipCoercion:   true,
			skipValidation: true,
			want:           `query($x:Int){items(required:$x){id}}`,
		},
		{
			name:      "nullable variable null at required argument",
			query:     `query($x:Int=1){items(required:$x){id}}`,
			variables: map[string]any{"x": nil},
			wantErr:   true,
		},
		{
			name:      "nullable variable null at required list position",
			query:     `query($x:Int=1){items(input:{strict:[$x]}){id}}`,
			variables: map[string]any{"x": nil},
			wantErr:   true,
		},
		{
			name:  "inline fragment",
			query: `query($x:Int){items{... on Item{items(limit:$x){id}}}}`,
			want:  `query($x:Int){items{... on Item{items{id}}}}`,
		},
		{
			name:  "nested fragment",
			query: `query($x:Int){items{...Outer}} fragment Outer on Item{...Inner} fragment Inner on Item{items(limit:$x){id}}`,
			want:  `query($x:Int){items{...Outer}} fragment Outer on Item{...Inner} fragment Inner on Item{items{id}}`,
		},
		{
			name:      "fragment uses selected operation definition",
			query:     `query A($x:Int){items{...F}} query B($x:Int!){items{...F}} fragment F on Item{items(limit:$x){id}}`,
			operation: "A",
			want:      `query A($x:Int){items{...F}} fragment F on Item{items{id}}`,
		},
		{
			name:      "only reachable fragments are normalized",
			query:     `query A($x:Int){items(limit:$x){id}} query B($x:Int!){items{...F}} fragment F on Item{items(required:$x){id}}`,
			operation: "A",
			variables: map[string]any{"x": nil},
			want:      `query A($x:Int){items(limit:$x){id}} fragment F on Item{items(required:$x){id}}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			checkNormalizedInput(t, schema, tt)
		})
	}
}

func checkNormalizedInput(t *testing.T, schema *ast.Schema, tt normalizeInputCase) {
	t.Helper()

	document, err := parser.ParseQuery(&ast.Source{Input: tt.query})
	if err != nil {
		t.Fatalf("ParseQuery: %v", err)
	}

	if !tt.skipValidation {
		if errs := validator.ValidateWithRules(
			schema,
			document,
			rules.NewDefaultRules(),
		); len(
			errs,
		) != 0 {
			t.Fatalf("ValidateWithRules: %v", errs)
		}
	}

	operation := document.Operations.ForName(tt.operation)

	variables := tt.variables
	if !tt.skipCoercion {
		variables, err = validator.VariableValues(schema, operation, variables)
		if err != nil {
			t.Fatalf("VariableValues: %v", err)
		}
	}

	var before bytes.Buffer
	formatter.NewFormatter(&before).FormatQueryDocument(document)
	normalized, fragments, err := queries.NormalizeInputVariables(
		operation,
		document.Fragments,
		variables,
	)

	var after bytes.Buffer
	formatter.NewFormatter(&after).FormatQueryDocument(document)

	if before.String() != after.String() {
		t.Fatal("normalization mutated a cached document")
	}

	if tt.wantErr {
		if !errors.Is(err, arguments.ErrInvalidArgument) {
			t.Fatalf("expected input validation error, got %v", err)
		}

		return
	}

	if err != nil {
		t.Fatalf("NormalizeInputVariables: %v", err)
	}

	want, err := parser.ParseQuery(&ast.Source{Input: tt.want})
	if err != nil {
		t.Fatalf("ParseQuery expected document: %v", err)
	}

	var gotText, wantText bytes.Buffer

	cloned := *document
	cloned.Operations = ast.OperationList{normalized}
	cloned.Fragments = fragments
	formatter.NewFormatter(&gotText).FormatQueryDocument(&cloned)
	formatter.NewFormatter(&wantText).FormatQueryDocument(want)

	if gotText.String() != wantText.String() {
		t.Errorf("normalized document:\n%s\nwant:\n%s", gotText.String(), wantText.String())
	}
}
