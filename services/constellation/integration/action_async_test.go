package integration_test

import (
	"os"
	"testing"
)

const actionAsyncTestsEnv = "CONSTELLATION_ACTIONS_ASYNC_TESTS"

func TestActionsAsync(t *testing.T) { //nolint:paralleltest
	if os.Getenv(actionAsyncTestsEnv) != "1" {
		t.Skipf(
			"set %s=1 to run the dedicated async action parity harness; live Hasura/Constellation async fixtures are not enabled by default",
			actionAsyncTestsEnv,
		)
	}

	skipUnlessActionGraphQLEndpoints(t)
	t.Skip("live async action metadata/function fixture is not available in this harness yet")
}
