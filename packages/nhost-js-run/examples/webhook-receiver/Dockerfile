# Build with the repository root as the build context so the pnpm workspace
# (and the @nhost/nhost-js-run dependency) resolves:
#
#   docker build -f packages/nhost-js-run/examples/webhook-receiver/Dockerfile \
#     -t webhook-receiver:dev .
#
# (run from the repository root)
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /src
COPY . .
# Build the helper, then keep only the example + its production deps.
RUN pnpm --filter @nhost/nhost-js-run install --frozen-lockfile \
  && pnpm --filter @nhost/nhost-js-run build \
  && pnpm --filter @nhost/example-js-run-webhook-receiver install --frozen-lockfile

FROM node:22-slim
WORKDIR /app
COPY --from=build /src/packages/nhost-js-run/examples/webhook-receiver/server.mjs ./
COPY --from=build /src/packages/nhost-js-run/examples/webhook-receiver/node_modules ./node_modules
EXPOSE 8080
CMD ["node", "server.mjs"]
