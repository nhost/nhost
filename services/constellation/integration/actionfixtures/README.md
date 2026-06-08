# Action fixtures

The default integration metadata in `integration/nhost/metadata` includes the
same action surface used by the live action parity tests. This directory keeps
copyable JSON/file-layout fixtures for parser tests and for regenerating action
metadata examples.

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
