FROM node:14-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install
COPY . . 
RUN yarn build

FROM node:14-alpine
ARG NODE_ENV=production
ENV NODE_ENV $NODE_ENV
ENV PORT 3000

ENV PGOPTIONS "-c search_path=auth"

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --production
RUN yarn cache clean

COPY --from=builder /app/dist dist

COPY migrations migrations
COPY prod-paths.js .

# Build Next.js UI
RUN cd ui; yarn build
RUN cp -r ui/out src/ui

HEALTHCHECK --interval=60s --timeout=2s --retries=3 CMD wget localhost:${PORT}/healthz -q -O - > /dev/null 2>&1

EXPOSE $PORT
CMD ["yarn", "start"]