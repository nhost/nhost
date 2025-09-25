package gqlparser

import (
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/gqlerror"
	"github.com/vektah/gqlparser/v2/parser"
	"github.com/vektah/gqlparser/v2/validator"
	"github.com/vektah/gqlparser/v2/validator/rules"
)

func LoadSchema(str ...*ast.Source) (*ast.Schema, error) {
	schema, err := validator.LoadSchema(append([]*ast.Source{validator.Prelude}, str...)...)
	gqlErr, ok := err.(*gqlerror.Error)
	if ok {
		return schema, gqlErr
	}
	if err != nil {
		return schema, gqlerror.Wrap(err)
	}
	return schema, nil
}

func MustLoadSchema(str ...*ast.Source) *ast.Schema {
	s, err := validator.LoadSchema(append([]*ast.Source{validator.Prelude}, str...)...)
	if err != nil {
		panic(err)
	}
	return s
}

// Deprecated: use LoadQueryWithRules instead.
func LoadQuery(schema *ast.Schema, str string) (*ast.QueryDocument, gqlerror.List) {
	query, err := parser.ParseQuery(&ast.Source{Input: str})
	if err != nil {
		gqlErr, ok := err.(*gqlerror.Error)
		if ok {
			return nil, gqlerror.List{gqlErr}
		}
		return nil, gqlerror.List{gqlerror.Wrap(err)}
	}
	errs := validator.Validate(schema, query)
	if len(errs) > 0 {
		return nil, errs
	}

	return query, nil
}

func LoadQueryWithRules(schema *ast.Schema, str string, rules *rules.Rules) (*ast.QueryDocument, gqlerror.List) {
	query, err := parser.ParseQuery(&ast.Source{Input: str})
	if err != nil {
		gqlErr, ok := err.(*gqlerror.Error)
		if ok {
			return nil, gqlerror.List{gqlErr}
		}
		return nil, gqlerror.List{gqlerror.Wrap(err)}
	}
	errs := validator.ValidateWithRules(schema, query, rules)
	if len(errs) > 0 {
		return nil, errs
	}

	return query, nil
}

// Deprecated: use MustLoadQueryWithRules instead.
func MustLoadQuery(schema *ast.Schema, str string) *ast.QueryDocument {
	q, err := LoadQuery(schema, str)
	if err != nil {
		panic(err)
	}
	return q
}

func MustLoadQueryWithRules(schema *ast.Schema, str string, rules *rules.Rules) *ast.QueryDocument {
	q, err := LoadQueryWithRules(schema, str, rules)
	if err != nil {
		panic(err)
	}
	return q
}
