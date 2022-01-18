## Developer guide

## Getting this ready

First, clone this repository:

```sh
git clone https://github.com/nhost/hasura-auth
```

Then, create a `.env` file from the example:

```sh
cd hasura-auth
cp .env.example .env
```

## Run Hasura-auth in dev mode

Run Hasura, PostgreSQL and the mock email server MailHog:

```sh
docker-compose up -d
```

Start Hasura-auth:

```sh
yarn dev
```

Hasura-auth is now running on `http://localhost:4000` and will restart on evey change. GraphQL-codegen is watching the Hasura GraphQL and will regenerate every change in the schema.

Don't forget to stop the docker-compose stack once you're done:

```sh
docker-compose down
```

## Run tests

```sh
yarn test
```

### Watch tests

```sh
yarn test --watch
```

## Build

### Build locally

```sh
yarn build
```

### Build the Docker image

```sh
yarn build:docker
# Equivalent command:
# docker build -t nhost/hasura-auth:local .
```
