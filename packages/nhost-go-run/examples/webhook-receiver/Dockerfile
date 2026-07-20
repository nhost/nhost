# Build with the package root (packages/nhost-go-run) as the build context so
# the `replace` in go.mod can resolve the local package:
#
#   docker build -f examples/webhook-receiver/Dockerfile -t webhook-receiver:dev .
#
# (run from packages/nhost-go-run)
FROM golang:1.23-alpine AS build
WORKDIR /src
COPY . .
WORKDIR /src/examples/webhook-receiver
RUN go build -trimpath -o /out/webhook-receiver .

FROM alpine:3.20
COPY --from=build /out/webhook-receiver /usr/local/bin/webhook-receiver
EXPOSE 8080
ENTRYPOINT ["webhook-receiver"]
