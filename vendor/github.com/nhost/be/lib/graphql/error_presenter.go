package nhgraphql

import (
	"context"

	"github.com/99designs/gqlgen/graphql"
	"github.com/vektah/gqlparser/v2/gqlerror"
)

// ErrorPresenterWithoutLocations preserves the GraphQL error wire format used before gqlgen 0.17.91.
func ErrorPresenterWithoutLocations(ctx context.Context, err error) *gqlerror.Error {
	presented := graphql.DefaultErrorPresenter(ctx, err)
	if presented != nil {
		presented.Locations = nil
	}

	return presented
}
