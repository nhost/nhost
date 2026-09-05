# The example is part of the single root Go module (github.com/nhost/nhost), so
# it builds from the repository root against the committed vendor/ tree:
#
#   docker build -f packages/nhost-go/examples/cat-uploader/Dockerfile -t cat-uploader:dev .
#
# (run from the repository root)
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY . .
# CGO_ENABLED=0 pins a statically linked, deterministic binary; -mod=vendor
# builds offline from the repo's vendored dependencies.
RUN CGO_ENABLED=0 go build -mod=vendor -trimpath \
    -o /out/cat-uploader ./packages/nhost-go/examples/cat-uploader

FROM alpine:3.20
# ca-certificates: needed for TLS to cataas.com and (on a laptop) Nhost.
RUN apk add --no-cache ca-certificates \
    && adduser -D -u 10001 app
COPY --from=build /out/cat-uploader /usr/local/bin/cat-uploader
USER app
EXPOSE 8080
ENTRYPOINT ["cat-uploader"]
