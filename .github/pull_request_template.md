Before submitting a pull request, please make sure the following documentation is updated accordinlgy, in particular:

- [Workflows](https://github.com/nhost/hasura-auth/tree/main/docs/workflows). Workflows are [Mermaid sequence diagrams](https://mermaid-js.github.io/mermaid/#/sequenceDiagram)
- [Schema](https://github.com/nhost/hasura-auth/blob/main/docs/schema.md). The schema in a [Mermaid ER diagram](https://mermaid-js.github.io/mermaid/#/entityRelationshipDiagram)
- [Environment variables](https://github.com/nhost/hasura-auth/blob/main/docs/environment-variables.md). Please adjust the [.env.example](https://github.com/nhost/hasura-auth/blob/main/.env.example) file accordingly
- OpenApi specifications. We are using inline [JSDoc annotations](https://www.npmjs.com/package/express-jsdoc-swagger)

Versioning and changelog are generated following [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/). Please do your best to follow the convention, but don't worry about it too much. We will be most likely moving away to [changesets](https://github.com/changesets/changesets) soon.
