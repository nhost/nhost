FROM node:16-alpine AS pruner
RUN apk add --no-cache libc6-compat
RUN apk update
WORKDIR /app

RUN yarn global add turbo@1.6.3
COPY . .
RUN turbo prune --scope="@nhost/dashboard" --docker

FROM node:16-alpine AS builder
ARG TURBO_TOKEN
ARG TURBO_TEAM

RUN apk add --no-cache libc6-compat
RUN apk update
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED 1
ENV NEXT_PUBLIC_ENV dev
ENV NEXT_PUBLIC_NHOST_PLATFORM false

# placeholders for ports, will be replaced on runtime by entrypoint script
ENV NEXT_PUBLIC_NHOST_MIGRATIONS_PORT __NEXT_PUBLIC_NHOST_MIGRATIONS_PORT__
ENV NEXT_PUBLIC_NHOST_HASURA_PORT __NEXT_PUBLIC_NHOST_HASURA_PORT__
ENV NEXT_PUBLIC_NHOST_LOCAL_BACKEND_PORT __NEXT_PUBLIC_NHOST_LOCAL_BACKEND_PORT__

RUN yarn global add pnpm@7.17.0
COPY .gitignore .gitignore
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-*.yaml .
RUN pnpm install --frozen-lockfile

COPY --from=pruner /app/out/full/ .
COPY turbo.json turbo.json
COPY config/ config/
RUN pnpm build:dashboard

FROM node:16-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

COPY --chown=nextjs:nodejs dashboard/docker-entrypoint.sh .
COPY --from=builder --chown=nextjs:nodejs /app/dashboard/next.config.js .
COPY --from=builder --chown=nextjs:nodejs /app/dashboard/package.json .
COPY --from=builder --chown=nextjs:nodejs /app/dashboard/public ./dashboard/public


COPY --from=builder --chown=nextjs:nodejs /app/dashboard/.next/standalone/app ./
COPY --from=builder --chown=nextjs:nodejs /app/dashboard/.next/static ./dashboard/.next/static

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dashboard/server.js"]
