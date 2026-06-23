package eval

import (
	"fmt"
	"strconv"

	"github.com/nhost/nhost/services/constellation/internal/jsontmpl/ast"
	"github.com/nhost/nhost/services/constellation/internal/jsontmpl/token"
)

// Binding is a single (name, value) entry in the evaluator scope.
type Binding struct {
	Name  string
	Value Value
}

// Func is a one-arg template function. Mirrors upstream's
// `J.Value -> Either CustomFunctionError J.Value`.
type Func func(arg Value) (Value, error)

// Eval evaluates root against the given bindings and function table.
// Bindings are searched right-to-left (later entries shadow earlier),
// matching upstream's `Compat.fromList` last-wins semantics.
func Eval(root ast.Node, bindings []Binding, funcs map[string]Func) (Value, error) {
	e := &evaluator{
		bindings: bindings,
		funcs:    funcs,
	}
	return e.eval(root)
}

type evaluator struct {
	bindings []Binding
	funcs    map[string]Func
}

func (e *evaluator) lookup(name string) (Value, bool) {
	for i := len(e.bindings) - 1; i >= 0; i-- {
		if e.bindings[i].Name == name {
			return e.bindings[i].Value, true
		}
	}
	return nil, false
}

// withBindings runs fn with the prefix extended. Restores on return.
func (e *evaluator) withBindings(extra []Binding, fn func() (Value, error)) (Value, error) {
	prev := len(e.bindings)
	e.bindings = append(e.bindings, extra...)
	v, err := fn()
	e.bindings = e.bindings[:prev]
	return v, err
}

func (e *evaluator) eval(n ast.Node) (Value, error) {
	switch x := n.(type) {
	case ast.Null:
		return nil, nil
	case ast.Boolean:
		return x.Value, nil
	case ast.Number:
		f, err := strconv.ParseFloat(x.Text, 64)
		if err != nil {
			return nil, &Error{
				Code: CodeType,
				Msg:  fmt.Sprintf("invalid number %q: %v", x.Text, err),
				Span: x.Span,
			}
		}
		return f, nil
	case ast.String:
		return x.Value, nil
	case ast.Array:
		out := make([]Value, 0, len(x.Elems))
		for _, el := range x.Elems {
			v, err := e.eval(el)
			if err != nil {
				return nil, err
			}
			out = append(out, v)
		}
		return out, nil
	case ast.Object:
		out := NewObject()
		for _, f := range x.Fields {
			v, err := e.eval(f.Value)
			if err != nil {
				return nil, err
			}
			out.Set(f.Key, v)
		}
		return out, nil
	case ast.StringTem:
		return e.evalStringTem(x)
	case ast.Var:
		v, ok := e.lookup(x.Name)
		if !ok {
			return nil, nameError(x.Span, x.Name)
		}
		return v, nil
	case ast.RequiredFieldAccess:
		return e.evalRequiredField(x)
	case ast.OptionalFieldAccess:
		return e.evalOptionalField(x)
	case ast.Iff:
		return e.evalIff(x)
	case ast.Eq:
		l, err := e.eval(x.Left)
		if err != nil {
			return nil, err
		}
		r, err := e.eval(x.Right)
		if err != nil {
			return nil, err
		}
		return Equal(l, r), nil
	case ast.NotEq:
		l, err := e.eval(x.Left)
		if err != nil {
			return nil, err
		}
		r, err := e.eval(x.Right)
		if err != nil {
			return nil, err
		}
		return !Equal(l, r), nil
	case ast.Lt:
		return e.evalCompare(x.Left, x.Right, func(c int) bool { return c < 0 })
	case ast.Lte:
		return e.evalCompare(x.Left, x.Right, func(c int) bool { return c <= 0 })
	case ast.Gt:
		return e.evalCompare(x.Left, x.Right, func(c int) bool { return c > 0 })
	case ast.Gte:
		return e.evalCompare(x.Left, x.Right, func(c int) bool { return c >= 0 })
	case ast.And:
		return e.evalAndOr(x.Left, x.Right, x.Span, func(p, q bool) bool { return p && q })
	case ast.Or:
		return e.evalAndOr(x.Left, x.Right, x.Span, func(p, q bool) bool { return p || q })
	case ast.In:
		return e.evalIn(x)
	case ast.Defaulting:
		l, err := e.eval(x.Left)
		if err != nil {
			return nil, err
		}
		if l == nil {
			return e.eval(x.Right)
		}
		return l, nil
	case ast.Range:
		return e.evalRange(x)
	case ast.Function:
		return e.evalFunction(x)
	}
	return nil, &Error{Code: CodeType, Msg: fmt.Sprintf("unhandled node type %T", n)}
}

func (e *evaluator) evalStringTem(x ast.StringTem) (Value, error) {
	var out string
	for _, p := range x.Parts {
		v, err := e.eval(p)
		if err != nil {
			return nil, err
		}
		s, err := EncodeForStringTem(v)
		if err != nil {
			return nil, &Error{Code: CodeType, Msg: err.Error(), Span: x.Span}
		}
		out += s
	}
	return out, nil
}

func (e *evaluator) evalRequiredField(x ast.RequiredFieldAccess) (Value, error) {
	root, err := e.eval(x.Root)
	if err != nil {
		return nil, err
	}
	if x.Field.IsName {
		// `obj.ident` form. Root must be Object.
		obj, ok := root.(Object)
		if !ok {
			return nil, typeError(x.Root.GetSpan(), TypeName(root), "Object")
		}
		v, ok := obj.Get(x.Field.Name)
		if !ok {
			return nil, attrError(x.Span, x.Field.Name)
		}
		return v, nil
	}
	// `root[ expr ]` form: dispatch on root type, not subscript type.
	switch r := root.(type) {
	case Object:
		key, err := e.eval(x.Field.Expr)
		if err != nil {
			return nil, err
		}
		s, ok := key.(string)
		if !ok {
			return nil, typeError(x.Root.GetSpan(), TypeName(key), "String")
		}
		v, ok := r.Get(s)
		if !ok {
			return nil, attrError(x.Span, s)
		}
		return v, nil
	case []Value:
		idx, err := e.eval(x.Field.Expr)
		if err != nil {
			return nil, err
		}
		f, ok := idx.(float64)
		if !ok {
			return nil, typeError(x.Span, TypeName(idx), "Integer")
		}
		i, ok := AsInt(f)
		if !ok {
			return nil, typeError(x.Span, TypeName(idx), "Integer")
		}
		if i < 0 || i >= len(r) {
			return nil, indexError(x.Span, "")
		}
		return r[i], nil
	default:
		return nil, typeError(x.Root.GetSpan(), TypeName(root), "Object")
	}
}

func (e *evaluator) evalOptionalField(x ast.OptionalFieldAccess) (Value, error) {
	// Root eval errors are caught and replaced with null. This is the
	// only place where errors are silently swallowed (Eval.hs:142).
	root, err := e.eval(x.Root)
	if err != nil {
		root = nil
	}
	// Evaluate field-chain subscripts up-front so that an error in any
	// of them propagates (only the root catch is allowed per upstream).
	keys, err := e.evalFieldChain(x.Fields)
	if err != nil {
		return nil, err
	}
	switch r := root.(type) {
	case Object, []Value:
		return walkOptional(r, keys), nil
	case nil:
		return nil, nil
	default:
		// Plain value at the root: TypeError (no chain to walk).
		// Span points at the root expression, matching upstream.
		return nil, typeError(x.Root.GetSpan(), TypeName(root), "Object")
	}
}

func (e *evaluator) evalFieldChain(fields []ast.FieldKey) ([]Value, error) {
	out := make([]Value, 0, len(fields))
	for _, f := range fields {
		if f.IsName {
			out = append(out, f.Name)
			continue
		}
		v, err := e.eval(f.Expr)
		if err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, nil
}

// walkOptional applies a chain of keys (strings for objects, numbers
// for arrays) to v. Any missing/typemismatch step yields null.
func walkOptional(v Value, keys []Value) Value {
	for _, k := range keys {
		switch root := v.(type) {
		case Object:
			s, ok := k.(string)
			if !ok {
				return nil
			}
			val, ok := root.Get(s)
			if !ok {
				return nil
			}
			v = val
		case []Value:
			f, ok := k.(float64)
			if !ok {
				return nil
			}
			i, ok := AsInt(f)
			if !ok {
				return nil
			}
			if i < 0 || i >= len(root) {
				return nil
			}
			v = root[i]
		default:
			return nil
		}
	}
	return v
}

func (e *evaluator) evalIff(x ast.Iff) (Value, error) {
	v, err := e.eval(x.Cond)
	if err != nil {
		return nil, err
	}
	b, ok := v.(bool)
	if !ok {
		return nil, typeError(x.Span, TypeName(v), "Boolean")
	}
	if b {
		return e.eval(x.Then)
	}
	for _, el := range x.Elifs {
		ev, err := e.eval(el.Cond)
		if err != nil {
			return nil, err
		}
		eb, ok := ev.(bool)
		if !ok {
			return nil, typeError(el.Span, TypeName(ev), "Boolean")
		}
		if eb {
			return e.eval(el.Then)
		}
	}
	return e.eval(x.Else)
}

func (e *evaluator) evalCompare(l, r ast.Node, predicate func(int) bool) (Value, error) {
	lv, err := e.eval(l)
	if err != nil {
		return nil, err
	}
	rv, err := e.eval(r)
	if err != nil {
		return nil, err
	}
	return predicate(Compare(lv, rv)), nil
}

func (e *evaluator) evalAndOr(
	l, r ast.Node,
	sp token.Span,
	op func(bool, bool) bool,
) (Value, error) {
	// Both eager (Eval.hs:170-186). No short-circuit.
	lv, err := e.eval(l)
	if err != nil {
		return nil, err
	}
	rv, err := e.eval(r)
	if err != nil {
		return nil, err
	}
	lb, lok := lv.(bool)
	rb, rok := rv.(bool)
	if !lok {
		return nil, typeError(sp, TypeName(lv), "Boolean")
	}
	if !rok {
		return nil, typeError(sp, TypeName(rv), "Boolean")
	}
	return op(lb, rb), nil
}

func (e *evaluator) evalIn(x ast.In) (Value, error) {
	lv, err := e.eval(x.Left)
	if err != nil {
		return nil, err
	}
	rv, err := e.eval(x.Right)
	if err != nil {
		return nil, err
	}
	switch r := rv.(type) {
	case Object:
		s, ok := lv.(string)
		if !ok {
			return nil, typeError(x.Span, TypeName(lv), "String")
		}
		_, present := r.Get(s)
		return present, nil
	case []Value:
		for _, el := range r {
			if Equal(lv, el) {
				return true, nil
			}
		}
		return false, nil
	default:
		return nil, typeError(x.Span, TypeName(rv), "Array")
	}
}

func (e *evaluator) evalRange(x ast.Range) (Value, error) {
	src, err := e.eval(x.Source)
	if err != nil {
		return nil, err
	}
	arr, ok := src.([]Value)
	if !ok {
		// Upstream raises IndexErrorCode here ("Can only range over an
		// array"), not TypeError, per the SerializeError instance
		// (Eval.hs:48). Plan §4.8 notes the surprise.
		return nil, indexError(x.Span, "Can only range over an array")
	}
	out := make([]Value, 0, len(arr))
	for i, el := range arr {
		extra := []Binding{{Name: x.BinderName, Value: el}}
		if x.IdxName != "" {
			extra = append(extra, Binding{Name: x.IdxName, Value: float64(i)})
		}
		v, err := e.withBindings(extra, func() (Value, error) {
			return e.eval(x.Body)
		})
		if err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, nil
}

func (e *evaluator) evalFunction(x ast.Function) (Value, error) {
	arg, err := e.eval(x.Arg)
	if err != nil {
		return nil, err
	}
	fn, ok := e.funcs[x.Name]
	if !ok {
		return nil, nameError(x.Span, x.Name)
	}
	v, err := fn(arg)
	if err != nil {
		return nil, functionError(x.Arg.GetSpan(), err.Error())
	}
	return v, nil
}
