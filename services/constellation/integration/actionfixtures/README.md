# Action fixtures

This directory holds copyable, reference action metadata used by the parser
tests in `metadata/action_test.go` (YAML+SDL vs. DB JSON equivalence) and for
regenerating action metadata examples. It is **not** loaded by the live
integration environment: `integration/nhost/metadata/actions.yaml` currently
declares `actions: []` and `actions.graphql` is empty, so the action surface
below must be copied into `integration/nhost/metadata` separately (and the
schema goldens regenerated) before the live parity tests exercise it.

`default/` contains `addNumbers`, `echoHeaders`, `login`, `actionProfiles`,
`transformEcho`, and `asyncEcho`. `actionProfiles` carries object and array
custom-type relationships for relationship parity tests. `transformEcho`
exercises request/response transforms. `asyncEcho` exercises asynchronous action
mutation/result parity when the default Constellation runner is configured with
an action-log store.

The file-layout fixtures mirror Hasura metadata directory exports: operational
settings live in `actions.yaml`, while action signatures and custom object fields
live in `actions.graphql`. `metadata.json` is the equivalent version-3 DB JSON
shape used by the DB JSON parser test.
