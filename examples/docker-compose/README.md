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

- `http://localhost:1337`: Hasura Console
- `http://localhost:1337/v1/graphql`: Hasura GraphQL endpoint
- `http://localhost:1337/v1/auth`: Hasura Auth
- `http://localhost:1337/v1/storage`: Hasura Storage
- `http://localhost:1337/v1/functions`: Functions

- `http://localhost:9090`: Traefik dashboad
- `http://localhost:8025`: Mailhog SMTP testing dashboard 
