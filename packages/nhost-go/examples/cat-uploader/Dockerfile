# Build with the SDK package root (packages/nhost-go) as the build context so
# the `replace` in go.mod can resolve the local SDK:
#
#   docker build -f examples/cat-uploader/Dockerfile -t cat-uploader:dev .
#
# (run from packages/nhost-go)
FROM golang:1.23-alpine AS build
WORKDIR /src
COPY . .
WORKDIR /src/examples/cat-uploader
# CGO_ENABLED=0 pins a statically linked, deterministic binary.
RUN CGO_ENABLED=0 go build -trimpath -o /out/cat-uploader .

FROM alpine:3.20
# ca-certificates: needed for TLS to cataas.com and (on a laptop) Nhost.
RUN apk add --no-cache ca-certificates \
    && adduser -D -u 10001 app
COPY --from=build /out/cat-uploader /usr/local/bin/cat-uploader
USER app
EXPOSE 8080
ENTRYPOINT ["cat-uploader"]
