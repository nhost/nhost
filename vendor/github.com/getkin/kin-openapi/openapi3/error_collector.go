package openapi3

import "context"

// errCollector aggregates validation errors inside a Validate method.
//
// When multi-error mode is enabled (EnableMultiError), emit records the error
// and returns nil so the caller continues to the next sibling; if the error is
// itself a MultiError, its leaves are appended individually so the result is a
// flat MultiError of fully-wrapped problems (this matches what most consumers
// expect: one MultiError entry per independent problem).
//
// When multi-error mode is off, emit returns the error unchanged so the caller
// fails fast, preserving the historical behavior byte-for-byte.
//
// emitWrapped applies wrap to err, distributing wrap over each leaf when err
// is a MultiError. This is how validators attach per-section / per-path /
// per-operation context to each aggregated leaf.
//
// result returns the accumulated MultiError, or nil if none were recorded.
type errCollector struct {
	multi bool
	errs  MultiError
}

func newErrCollector(ctx context.Context) *errCollector {
	return &errCollector{multi: getValidationOptions(ctx).multiErrorEnabled}
}

func (c *errCollector) emit(err error) error {
	if err == nil {
		return nil
	}
	if !c.multi {
		return err
	}
	if me, ok := err.(MultiError); ok {
		for _, sub := range me {
			if e := c.emit(sub); e != nil {
				return e
			}
		}
		return nil
	}
	c.errs = append(c.errs, err)
	return nil
}

func (c *errCollector) emitWrapped(wrap func(error) error, err error) error {
	if err == nil {
		return nil
	}
	if !c.multi {
		return wrap(err)
	}
	if me, ok := err.(MultiError); ok {
		for _, sub := range me {
			if e := c.emitWrapped(wrap, sub); e != nil {
				return e
			}
		}
		return nil
	}
	return c.emit(wrap(err))
}

func (c *errCollector) result() error {
	if len(c.errs) > 0 {
		return c.errs
	}
	return nil
}

// finalize emits err (typically the last sibling validation in a container,
// e.g. the extensions check) and returns the accumulated result. It collapses
// the trailing emit-then-result pattern into a single line at each call site.
func (c *errCollector) finalize(err error) error {
	if e := c.emit(err); e != nil {
		return e
	}
	return c.result()
}
