FROM node:14-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install
COPY . . 

# build express
RUN yarn build

# Build Next.js UI
RUN cd ui; yarn build

FROM node:14-alpine
ARG NODE_ENV=production
ENV NODE_ENV $NODE_ENV
ENV PORT 3000

ENV PGOPTIONS "-c search_path=auth"

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --production
RUN yarn cache clean

# Copy express
COPY --from=builder /app/dist dist

COPY migrations migrations
COPY prod-paths.js .

# Copy Next js
COPY --from=builder /app/ui/out /app/src/ui

HEALTHCHECK --interval=60s --timeout=2s --retries=3 CMD wget localhost:${PORT}/healthz -q -O - > /dev/null 2>&1

EXPOSE $PORT
CMD ["yarn", "start"]