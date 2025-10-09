package testhelpers

import (
	"fmt"

	"github.com/google/go-cmp/cmp"
)

type gomockCmpOpts[T any] struct {
	w    T
	opts cmp.Options
	diff string
}

func GomockCmpOpts[T any](w T, opts ...cmp.Option) *gomockCmpOpts[T] { //nolint:revive,nolintlint
	return &gomockCmpOpts[T]{
		w:    w,
		opts: opts,
		diff: "",
	}
}

func (a *gomockCmpOpts[T]) Matches(got any) bool {
	var ok bool

	got, ok = got.(T)
	if !ok {
		panic(fmt.Sprintf("got (%T) is not of type %T", got, a.w))
	}

	a.diff = cmp.Diff(got, a.w, a.opts...)

	return a.diff == ""
}

func (a *gomockCmpOpts[T]) String() string {
	return a.diff
}
