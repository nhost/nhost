FROM node:14-alpine

# needed for jest --watch to work properly
RUN apk update && apk upgrade && \
    apk add --no-cache bash git openssh

ARG NODE_ENV=development
ENV NODE_ENV $NODE_ENV
ENV PORT 3000

WORKDIR /app

# needed for jest --watch to work properly
RUN git init /app/test

COPY package.json yarn.lock ./
RUN yarn install --production=false

COPY ../../ .

CMD ["yarn", "run", "dev:in-docker"]
