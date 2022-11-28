# Docker-compose example

Here is an example on how to reproduce the Nhost stack from a docker-compose file.

## Configuration

```sh
git clone https://github.com/nhost/nhost
cd nhost/examples/docker-compose
cp .env.example .env
docker-compose up -d
```

The following endpoints are now exposed:

- `http://localhost:1337/v1/graphql`: Hasura GraphQL endpoint
- `http://localhost:1337/v1/auth`: Hasura Auth
- `http://localhost:1337/v1/storage`: Hasura Storage
- `http://localhost:1337/v1/functions`: Functions

- `http://localhost:3030`: Nhost Dashboard
- `http://localhost:1337`: Hasura Console
- `http://localhost:8025`: Mailhog SMTP testing dashboard
- `http://localhost:9090`: Traefik dashboad

## Running the Nhost dashboard locally

In order to use the Nhost dashboard, you need to run the [Hasura console locally from the Hasura CLI](https://hasura.io/docs/latest/hasura-cli/commands/hasura_console/):

```sh
hasura console
```

The Nhost Dashboard also requires the Hasura admin secret to `nhost-admin-secret`. This will change in the future. If you can't wait, don't hesitate to contribute.
