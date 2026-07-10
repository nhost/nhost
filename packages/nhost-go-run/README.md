# nhost-go-run

Small helper for writing [Nhost Run](https://docs.nhost.io/products/run) services
in Go. It wires the health-check endpoint the platform probes and manages the
HTTP server lifecycle so your service only has to define its handlers.

It is a companion to the [`nhost-go`](../nhost-go) client SDK, kept as a separate
module so the client stays free of any HTTP-server dependency. This package
depends only on the Go standard library.

## What it does

Nhost Run probes `GET /healthz` on the port configured under `[healthCheck]`;
the endpoint must return `200` within 5 seconds or the container is restarted.
`runservice` provides that endpoint from a health closure and runs a server that
shuts down gracefully on `SIGTERM`.

## Usage

```go
package main

import (
	"context"
	"net/http"

	runservice "github.com/nhost/nhost/packages/nhost-go-run"
)

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("hello from an Nhost Run service"))
	})

	// health returns nil while the service is healthy; return an error to make
	// /healthz respond 503 and let the platform restart the container.
	health := func(context.Context) error { return nil }

	// Blocks until SIGINT/SIGTERM, then drains in-flight requests.
	if err := runservice.Serve(context.Background(), ":8080", mux, health); err != nil {
		panic(err)
	}
}
```

Match the port in your `nhost-run-service.toml`:

```toml
[[ports]]
port = 8080
type = "http"
publish = true

[healthCheck]
port = 8080
```

If you already have a router and just want the probe, mount `runservice.Healthz`
yourself instead of calling `Serve`.

## API

- `Serve(ctx, addr, handler, health) error` — serve `/healthz` + `handler`, graceful shutdown.
- `Healthz(health) http.Handler` — the `GET /healthz` handler, to mount on your own router.
- `HealthFunc func(context.Context) error` — `nil` → 200, error → 503.
