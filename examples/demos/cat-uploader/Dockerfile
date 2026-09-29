# The example is its own Go module, and its go.mod replaces the SDK with
# packages/nhost-go, so the build context is the repository root:
#
#   docker build -f examples/demos/cat-uploader/Dockerfile -t cat-uploader:dev .
#
# (run from the repository root)
FROM golang:1.27-alpine AS build
WORKDIR /src
COPY packages/nhost-go packages/nhost-go
COPY examples/demos/cat-uploader examples/demos/cat-uploader
WORKDIR /src/examples/demos/cat-uploader
# CGO_ENABLED=0 pins a statically linked, deterministic binary. The module
# depends only on the SDK, so nothing is downloaded.
RUN CGO_ENABLED=0 go build -trimpath -o /out/cat-uploader .

FROM alpine:3.20
# ca-certificates: needed for TLS to cataas.com and (on a laptop) Nhost.
RUN apk add --no-cache ca-certificates \
    && adduser -D -u 10001 app
COPY --from=build /out/cat-uploader /usr/local/bin/cat-uploader
USER app
EXPOSE 8080
ENTRYPOINT ["cat-uploader"]
