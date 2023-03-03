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

- `http://localhost:8080`: [Hasura](https://github.com/hasura/graphql-engine)
- `http://localhost:4000`: [Hasura Auth](https://github.com/nhost/hasura-auth)
- `http://localhost:4001`: [Hasura Storage](https://github.com/nhost/hasura-storage)
- `http://localhost:4002`: [Functions](https://github.com/nhost/functions)

- `http://localhost:8025`: [Mailhog](https://github.com/mailhog/MailHog)
