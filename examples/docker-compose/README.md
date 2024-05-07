# Docker-compose example

Here is an example on how to reproduce the Nhost stack from a docker-compose file.

NOTE: You may notice that some options in the dashboard are greyed-out. These include additional services like CI integration, configuration management, etc., offered by the Nhost Cloud and therefore are not accessible when self-hosting.

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
- `http://localhost:9090`: Traefik dashboard

## Running the Nhost dashboard locally

In order for you to be able to make edits to the database from the Nhost dashboard, you need to run the [Hasura console locally from the Hasura CLI](https://hasura.io/docs/latest/hasura-cli/commands/hasura_console/):

```sh
hasura console
```

The Nhost Dashboard [uses](https://github.com/nhost/nhost/discussions/2398) the [Hasura migrations API](https://hasura.io/docs/latest/hasura-cli/commands/hasura_console/#options) in order to make edits to the database. It runs over port 9693 and is only accessible through running the Hasura console from the CLI. Because the Docker compose still only uses the graphql-engine Hasura Docker image and does not include the CLI image, that is why you need to run it locally. See https://github.com/nhost/nhost/issues/1220. Users are welcome to contibute a Docker compose that includes the CLI image to resolve this.

The Nhost Dashboard also requires the Hasura admin secret to `nhost-admin-secret` specified in the `.env` file.
