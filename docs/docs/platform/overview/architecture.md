---
title: 'Architecture'
sidebar_position: 2
---

Nhost is a backend as a service built with open source tools to provide developers the general building blocks required to build fantastic digital apps and products.

Here's a diagram of the Nhost stack on a high level:

![Nhost Architecture Diagram](/img/architecture/nhost-diagram.png)

As you see in the image above, Nhost provides endpoints for:

- GraphQL (`/graphql`)
- Authentication (`/auth`)
- Storage (`/storage`)
- Functions (`/functions`)

Data is stored in Postgres and files are stored in S3.

## Open Source

The open source tools used for the full Nhost stack are:

- Database: [Postgres](https://www.postgresql.org/)
- GraphQL: [Hasura](https://github.com/hasura/graphql-engine)
- Authentication: [Hasura Auth](https://github.com/nhost/hasura-auth)
- Storage: [Hasura Storage](https://github.com/nhost/hasura-storage)
- Functions: [Node.js](https://nodejs.org/en/)
