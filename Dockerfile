FROM node:14-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock tsconfig.json tsconfig.build.json ./
RUN yarn install
COPY src/ ./src/
COPY types/ ./types/
RUN yarn build

FROM node:14-alpine as remover
ARG NODE_ENV=production
ENV NODE_ENV $NODE_ENV
ENV AUTH_HOST localhost
ENV AUTH_PORT 4000
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --production
COPY migrations/ ./migrations/
COPY email-templates/ ./email-templates
COPY --from=builder ./app/dist dist/
HEALTHCHECK --interval=60s --timeout=2s --retries=3 CMD wget ${AUTH_HOST}:${AUTH_PORT}/healthz -q -O - > /dev/null 2>&1
CMD ["yarn", "run", "start"]