package sql_test

import (
	"github.com/nhost/nhost/services/constellation/connector"
	"github.com/nhost/nhost/services/constellation/connector/groupedaggregate"
	csql "github.com/nhost/nhost/services/constellation/connector/sql"
)

// Compile-time guarantees that *csql.Connector satisfies the cross-package
// contracts the rest of the system depends on by type-assertion. A signature
// drift on either interface becomes a build failure here, at the
// implementation site, instead of a silent ok=false on the consumer side
// (controller/resolver/aggregate_resolver.go and the controller's
// subscriptionCapableConnector probe).
//
// These assertions live in an external test file because the production
// package cannot import "connector" without creating an import cycle
// (connector → connector/sql/postgres → connector/sql).
var (
	_ connector.Connector       = (*csql.Connector)(nil)
	_ groupedaggregate.Executor = (*csql.Connector)(nil)
)
