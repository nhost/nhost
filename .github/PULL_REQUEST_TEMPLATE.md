### Checklist

- [ ] No breaking changes
- [ ] Tests pass
- [ ] New features have new tests
- [ ] Documentation is updated (if applicable)
- [ ] Title of the PR is in the correct format (see below)

--- Delete everything below this line before submitting your PR ---

> **Note on AI-assisted contributions:** Contributions with the help of AI are permitted, but you are ultimately responsible for the quality of your submission and for ensuring it follows our contributing guidelines. **The PR description must be written in your own words and be clear and concise**. PRs that do not meet our standards will be closed without further review.

### PR title format

The PR title must follow the following pattern:

`TYPE(PKG): SUMMARY`

Where `TYPE` is:

- feat:   mark this pull request as a feature
- fix:    mark this pull request as a bug fix
- chore:  mark this pull request as a maintenance item

Where `PKG` is:

- `auth`: For changes to the Nhost Auth service
- `ci`: For general changes to the build and/or CI/CD pipeline
- `cli`: For changes to the Nhost CLI
- `codegen`: For changes to the code generator
- `dashboard`: For changes to the Nhost Dashboard
- `deps`: For changes to dependencies
- `docs`: For changes to the documentation
- `examples`: For changes to the examples
- `mintlify-openapi`: For changes to the Mintlify OpenAPI tool
- `nhost-js`: For changes to the Nhost JavaScript SDK
- `nixops`: For changes to the NixOps
- `storage`: For changes to the Nhost Storage service

Where `SUMMARY` is a short description of what the PR does.

### Tests

- please make sure your changes pass the current tests (Use the `make test`
- if you are introducing a new feature, please write as much tests as possible.
