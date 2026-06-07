# Action fixtures

These fixtures are opt-in characterization data for Hasura Action parity tests.
They are intentionally not included from `integration/nhost/metadata`, so the
default schema dumps stay unchanged until action runtime support is implemented.

`sync/` contains synchronous `addNumbers`, `echoHeaders`, and `login` actions.
The file-layout fixtures mirror Hasura metadata directory exports: operational
settings live in `actions.yaml`, while action signatures and custom object fields
live in `actions.graphql`. `metadata.json` is the equivalent version-3 DB JSON
shape used by the opt-in parser characterization test and by test helpers that
apply the action metadata to a live Hasura instance.
