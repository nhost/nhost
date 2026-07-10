# Build with the package root (packages/nhost-rust-run) as the build context so
# the `path = "../.."` dependency on nhost-run resolves:
#
#   docker build -f examples/webhook-receiver/Dockerfile -t webhook-receiver:dev .
#
# (run from packages/nhost-rust-run)
FROM rust:1.82-slim AS build
WORKDIR /src
COPY . .
WORKDIR /src/examples/webhook-receiver
RUN cargo build --release

FROM debian:bookworm-slim
COPY --from=build \
  /src/examples/webhook-receiver/target/release/webhook-receiver \
  /usr/local/bin/webhook-receiver
EXPOSE 8080
ENTRYPOINT ["webhook-receiver"]
