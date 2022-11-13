Before submitting this PR:

### Checklist

- [ ] No breaking changes
- [ ] Tests pass
- [ ] New features have new tests
- [ ] Documentation is updated

### Breaking changes

Avoid breaking changes and regressions. If you feel it is unavoidable, make it explicit in your PR comment so we can review it and see how to handle it.

### Tests

- please make sure your changes pass the current tests (Use the `make test` or the `make watch` command).
- if you are introducing a new feature, please write as much tests as possible.

### Documentation

Please make sure the documentation is updated accordingly, in particular:

- [Workflows](https://github.com/nhost/hasura-auth/tree/main/docs/workflows). Workflows are [Mermaid sequence diagrams](https://mermaid-js.github.io/mermaid/#/sequenceDiagram)
- [Schema](https://github.com/nhost/hasura-auth/blob/main/docs/schema.md). The schema in a [Mermaid ER diagram](https://mermaid-js.github.io/mermaid/#/entityRelationshipDiagram)
- [Environment variables](https://github.com/nhost/hasura-auth/blob/main/docs/environment-variables.md). Please adjust the [.env.example](https://github.com/nhost/hasura-auth/blob/main/.env.example) file accordingly
- OpenApi specifications. We are using inline [JSDoc annotations](https://www.npmjs.com/package/express-jsdoc-swagger)
