
FROM node:16-alpine AS builder
RUN apk add --no-cache libc6-compat python3 py3-pip make g++
RUN apk update
WORKDIR /app

RUN yarn global add turbo
COPY ./ ./
RUN turbo prune --scope="@nhost/dashboard" --docker

FROM node:16-alpine AS installer
RUN apk add --no-cache libc6-compat python3 py3-pip make g++
RUN apk update
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED 1
ENV NEXT_PUBLIC_NHOST_PLATFORM false
ENV NEXT_PUBLIC_NHOST_BACKEND_URL http://localhost:1337

RUN yarn global add pnpm
COPY .gitignore .gitignore
COPY --from=builder /app/out/json ./
COPY --from=builder /app/out/pnpm-*.yaml ./
RUN pnpm install --frozen-lockfile

COPY --from=builder /app/out/full ./
COPY turbo.json turbo.json
COPY config/ config/

RUN pnpm build:dashboard

FROM node:16-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

COPY --from=installer /app/dashboard/.next ./
COPY --from=installer /app/dashboard/package.json .

EXPOSE 3000

ENV PORT 3000

RUN yarn global add pnpm
CMD ["pnpm", "start"]