FROM node:16-alpine AS builder
WORKDIR /app
RUN npm i -g pnpm@8.5.1
COPY package.json pnpm-lock.yaml tsconfig.json tsconfig.build.json ./
RUN pnpm install --frozen-lockfile
COPY src/ ./src/
COPY types/ ./types/
RUN pnpm run build

FROM node:16-alpine as remover
ARG NODE_ENV=production
ENV NODE_ENV $NODE_ENV
ENV AUTH_PORT 4000
WORKDIR /app
RUN npm i -g pnpm@8.5.1
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod  && pnpm store prune
COPY migrations/ ./migrations/
COPY email-templates/ ./email-templates
COPY --from=builder ./app/dist dist/
HEALTHCHECK --interval=60s --timeout=2s --retries=3 CMD wget http://localhost:${AUTH_PORT}/healthz -q -O - > /dev/null 2>&1
CMD ["pnpm", "run", "start"]
