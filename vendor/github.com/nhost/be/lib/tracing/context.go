package nhtracing

import "context"

type tracingCtxKey struct{}

func ToContext(ctx context.Context, tracing Trace) context.Context {
	return context.WithValue(ctx, tracingCtxKey{}, tracing)
}

func FromContext(ctx context.Context) (Trace, bool) {
	tracing, ok := ctx.Value(tracingCtxKey{}).(Trace)
	return tracing, ok
}
