package graphql

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"reflect"
	"sort"
	"strconv"
	"strings"

	"github.com/hasura/go-graphql-client/ident"
)

type constructOptionsOutput struct {
	operationName       string
	operationDirectives []string
}

func (coo constructOptionsOutput) OperationDirectivesString() string {
	operationDirectivesStr := strings.Join(coo.operationDirectives, " ")
	if operationDirectivesStr != "" {
		return fmt.Sprintf(" %s ", operationDirectivesStr)
	}
	return ""
}

func constructOptions(options []Option) (*constructOptionsOutput, error) {
	output := &constructOptionsOutput{}

	for _, option := range options {
		switch option.Type() {
		case optionTypeOperationName:
			output.operationName = option.String()
		case OptionTypeOperationDirective:
			output.operationDirectives = append(output.operationDirectives, option.String())
		default:
			return nil, fmt.Errorf("invalid query option type: %s", option.Type())
		}
	}

	return output, nil
}

// ConstructQuery build GraphQL query string from struct and variables
func ConstructQuery(v interface{}, variables map[string]interface{}, options ...Option) (string, error) {
	query := query(v)

	optionsOutput, err := constructOptions(options)
	if err != nil {
		return "", err
	}

	if len(variables) > 0 {
		return fmt.Sprintf("query %s(%s)%s%s", optionsOutput.operationName, queryArguments(variables), optionsOutput.OperationDirectivesString(), query), nil
	}

	if optionsOutput.operationName == "" && len(optionsOutput.operationDirectives) == 0 {
		return query, nil
	}

	return fmt.Sprintf("query %s%s%s", optionsOutput.operationName, optionsOutput.OperationDirectivesString(), query), nil
}

// ConstructQuery build GraphQL mutation string from struct and variables
func ConstructMutation(v interface{}, variables map[string]interface{}, options ...Option) (string, error) {
	query := query(v)
	optionsOutput, err := constructOptions(options)
	if err != nil {
		return "", err
	}
	if len(variables) > 0 {
		return fmt.Sprintf("mutation %s(%s)%s%s", optionsOutput.operationName, queryArguments(variables), optionsOutput.OperationDirectivesString(), query), nil
	}

	if optionsOutput.operationName == "" && len(optionsOutput.operationDirectives) == 0 {
		return "mutation" + query, nil
	}

	return fmt.Sprintf("mutation %s%s%s", optionsOutput.operationName, optionsOutput.OperationDirectivesString(), query), nil
}

// ConstructSubscription build GraphQL subscription string from struct and variables
func ConstructSubscription(v interface{}, variables map[string]interface{}, options ...Option) (string, error) {
	query := query(v)
	optionsOutput, err := constructOptions(options)
	if err != nil {
		return "", err
	}
	if len(variables) > 0 {
		return fmt.Sprintf("subscription %s(%s)%s%s", optionsOutput.operationName, queryArguments(variables), optionsOutput.OperationDirectivesString(), query), nil
	}
	if optionsOutput.operationName == "" && len(optionsOutput.operationDirectives) == 0 {
		return "subscription" + query, nil
	}
	return fmt.Sprintf("subscription %s%s%s", optionsOutput.operationName, optionsOutput.OperationDirectivesString(), query), nil
}

// queryArguments constructs a minified arguments string for variables.
//
// E.g., map[string]interface{}{"a": Int(123), "b": NewBoolean(true)} -> "$a:Int!$b:Boolean".
func queryArguments(variables map[string]interface{}) string {
	// Sort keys in order to produce deterministic output for testing purposes.
	// TODO: If tests can be made to work with non-deterministic output, then no need to sort.
	keys := make([]string, 0, len(variables))
	for k := range variables {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var buf bytes.Buffer
	for _, k := range keys {
		io.WriteString(&buf, "$")
		io.WriteString(&buf, k)
		io.WriteString(&buf, ":")
		writeArgumentType(&buf, reflect.TypeOf(variables[k]), true)
		// Don't insert a comma here.
		// Commas in GraphQL are insignificant, and we want minified output.
		// See https://facebook.github.io/graphql/October2016/#sec-Insignificant-Commas.
	}
	return buf.String()
}

// writeArgumentType writes a minified GraphQL type for t to w.
// value indicates whether t is a value (required) type or pointer (optional) type.
// If value is true, then "!" is written at the end of t.
func writeArgumentType(w io.Writer, t reflect.Type, value bool) {
	if t.Kind() == reflect.Ptr {
		// Pointer is an optional type, so no "!" at the end of the pointer's underlying type.
		writeArgumentType(w, t.Elem(), false)
		return
	}

	if t.Implements(graphqlTypeInterface) {
		graphqlType, ok := reflect.Zero(t).Interface().(GraphQLType)
		if ok {
			io.WriteString(w, graphqlType.GetGraphQLType())
			if value {
				// Value is a required type, so add "!" to the end.
				io.WriteString(w, "!")
			}
			return
		}
	}

	switch t.Kind() {
	case reflect.Slice, reflect.Array:
		// List. E.g., "[Int]".
		io.WriteString(w, "[")
		writeArgumentType(w, t.Elem(), true)
		io.WriteString(w, "]")
	default:
		// Named type. E.g., "Int".
		name := t.Name()

		if name == "string" { // HACK: Workaround for https://github.com/shurcooL/githubv4/issues/12.
			name = "ID"
		}

		io.WriteString(w, name)
	}

	if value {
		// Value is a required type, so add "!" to the end.
		io.WriteString(w, "!")
	}
}

// query uses writeQuery to recursively construct
// a minified query string from the provided struct v.
//
// E.g., struct{Foo Int, BarBaz *Boolean} -> "{foo,barBaz}".
func query(v interface{}) string {
	var buf bytes.Buffer
	writeQuery(&buf, reflect.TypeOf(v), reflect.ValueOf(v), false)
	return buf.String()
}

// writeQuery writes a minified query for t to w.
// If inline is true, the struct fields of t are inlined into parent struct.
func writeQuery(w io.Writer, t reflect.Type, v reflect.Value, inline bool) {
	switch t.Kind() {
	case reflect.Ptr:
		writeQuery(w, t.Elem(), ElemSafe(v), false)
	case reflect.Struct:
		// If the type implements json.Unmarshaler, it's a scalar. Don't expand it.
		if reflect.PtrTo(t).Implements(jsonUnmarshaler) {
			return
		}
		if !inline {
			io.WriteString(w, "{")
		}
		iter := 0
		for i := 0; i < t.NumField(); i++ {
			f := t.Field(i)
			value, ok := f.Tag.Lookup("graphql")
			// Skip this field if the tag value is hyphen
			if value == "-" {
				continue
			}
			if iter != 0 {
				io.WriteString(w, ",")
			}
			iter++

			inlineField := f.Anonymous && !ok
			if !inlineField {
				if ok {
					io.WriteString(w, value)
				} else {
					io.WriteString(w, ident.ParseMixedCaps(f.Name).ToLowerCamelCase())
				}
			}
			// Skip writeQuery if the GraphQL type associated with the filed is scalar
			if isTrue(f.Tag.Get("scalar")) {
				continue
			}
			writeQuery(w, f.Type, FieldSafe(v, i), inlineField)
		}
		if !inline {
			io.WriteString(w, "}")
		}
	case reflect.Slice:
		if t.Elem().Kind() != reflect.Array {
			writeQuery(w, t.Elem(), IndexSafe(v, 0), false)
			return
		}
		// handle [][2]interface{} like an ordered map
		if t.Elem().Len() != 2 {
			err := fmt.Errorf("only arrays of len 2 are supported, got %v", t.Elem())
			panic(err.Error())
		}
		sliceOfPairs := v
		_, _ = io.WriteString(w, "{")
		for i := 0; i < sliceOfPairs.Len(); i++ {
			pair := sliceOfPairs.Index(i)
			// it.Value() returns interface{}, so we need to use reflect.ValueOf
			// to cast it away
			key, val := pair.Index(0), reflect.ValueOf(pair.Index(1).Interface())
			_, _ = io.WriteString(w, key.Interface().(string))
			writeQuery(w, val.Type(), val, false)
		}
		_, _ = io.WriteString(w, "}")
	case reflect.Map:
		err := fmt.Errorf("type %v is not supported, use [][2]interface{} instead", t)
		panic(err.Error())
	}
}

func IndexSafe(v reflect.Value, i int) reflect.Value {
	if v.IsValid() && i < v.Len() {
		return v.Index(i)
	}
	return reflect.ValueOf(nil)
}

func ElemSafe(v reflect.Value) reflect.Value {
	if v.IsValid() {
		return v.Elem()
	}
	return reflect.ValueOf(nil)
}

func FieldSafe(valStruct reflect.Value, i int) reflect.Value {
	if valStruct.IsValid() {
		return valStruct.Field(i)
	}
	return reflect.ValueOf(nil)
}

var jsonUnmarshaler = reflect.TypeOf((*json.Unmarshaler)(nil)).Elem()

var graphqlTypeInterface = reflect.TypeOf((*GraphQLType)(nil)).Elem()

func isTrue(s string) bool {
	b, _ := strconv.ParseBool(s)
	return b
}
