
FROM node:16-alpine AS pruner
RUN apk add --no-cache libc6-compat python3 py3-pip make g++
RUN apk update
WORKDIR /app

RUN yarn global add turbo
COPY . .
RUN turbo prune --scope="@nhost/dashboard" --docker

FROM node:16-alpine AS builder
RUN apk add --no-cache libc6-compat python3 py3-pip make g++
RUN apk update
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED 1
ENV NEXT_PUBLIC_NHOST_PLATFORM false
ENV NEXT_PUBLIC_NHOST_BACKEND_URL http://localhost:1337
ENV NEXT_PUBLIC_NHOST_MIGRATIONS_URL http://localhost:9693
ENV NEXT_PUBLIC_NHOST_HASURA_URL http://localhost:9695
ENV NEXT_PUBLIC_ENV dev

RUN yarn global add pnpm
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

COPY --from=builder /app/dashboard/next.config.js .
COPY --from=builder /app/dashboard/package.json .
COPY --from=builder /app/dashboard/public ./dashboard/public

COPY --from=builder --chown=nextjs:nodejs /app/dashboard/.next/standalone/app ./
COPY --from=builder --chown=nextjs:nodejs /app/dashboard/.next/static ./dashboard/.next/static

CMD node dashboard/server.js