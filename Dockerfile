FROM golang:1.17-alpine as builder

ARG BUILD_USER

RUN apk add make git

WORKDIR /app

ADD go.mod .
ADD go.sum .

RUN go mod download

ADD . .

RUN make build

FROM alpine:latest as certs
RUN apk --update add ca-certificates

FROM alpine:latest
COPY --from=builder /app/bin/hasura-storage /usr/local/bin/hasura-storage
COPY --from=certs /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
ENTRYPOINT ["/usr/local/bin/hasura-storage"]
