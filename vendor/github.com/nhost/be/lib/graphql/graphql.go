package nhgraphql

import (
	"context"

	"github.com/99designs/gqlgen/graphql"
)

type Directive func(ctx context.Context, obj any, next graphql.Resolver) (res any, err error)
