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
- if you are introducing a new feature, please as much tests as possible.

### Documentation

Please make sure the documentation is updated accordinlgy, in particular:

- [Workflows](https://github.com/nhost/hasura-auth/tree/main/docs/workflows). Workflows are [Mermaid sequence diagrams](https://mermaid-js.github.io/mermaid/#/sequenceDiagram)
- [Schema](https://github.com/nhost/hasura-auth/blob/main/docs/schema.md). The schema in a [Mermaid ER diagram](https://mermaid-js.github.io/mermaid/#/entityRelationshipDiagram)
- [Environment variables](https://github.com/nhost/hasura-auth/blob/main/docs/environment-variables.md). Please adjust the [.env.example](https://github.com/nhost/hasura-auth/blob/main/.env.example) file accordingly
- OpenApi specifications. We are using inline [JSDoc annotations](https://www.npmjs.com/package/express-jsdoc-swagger)

### Conventional commits

Versioning and changelog are generated following [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/). Please do your best to follow the convention, but don't worry about it too much. We will be most likely moving away to [changesets](https://github.com/changesets/changesets) soon.
