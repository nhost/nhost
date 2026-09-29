module github.com/nhost/nhost/examples/tutorials/nhost-go-tutorial

go 1.27.0

require (
	github.com/nhost/nhost/packages/nhost-go v0.0.0-00010101000000-000000000000
	github.com/urfave/cli/v3 v3.10.1
)

// Builds against the SDK in this repository rather than a published release,
// so the example always exercises the current API.
replace github.com/nhost/nhost/packages/nhost-go => ../../../packages/nhost-go
