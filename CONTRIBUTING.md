# Contributing

Welcome and thank you for considering contributing to Nhost!

This document outlines the rules to follow to make the contribution process easy and effective for everyone involved. If you are ever in doubt about anything, we encourage you to reach out [via Discord](https://discord.com/invite/9V7Qb2U).

## Code of Conduct

We take our open source community seriously and hold ourselves and other contributors to high standards of communication. By participating and contributing to this project, you agree to uphold our [Code of Conduct](https://github.com/nhost/nhost/blob/main/CODE_OF_CONDUCT.md).

## Getting Started

Contributions are made to Nhost repos via Issues and Pull Requests (PRs). A few general guidelines that cover both:

- Search for existing Issues and PRs before creating your own.
- We work hard to make sure issues are handled on time, but it could take a while to investigate the root cause depending on the impact. A friendly ping in the comment thread to the submitter or a contributor can help draw attention if your issue is blocking.
- If you've never contributed before, see [the first-timer's guide](https://github.com/firstcontributions/first-contributions) for resources and tips on getting started.

### AI-Assisted Contributions

We have specific policies regarding AI-assisted contributions:

- **Issues**: Bug reports and feature requests that are clearly AI-generated will not be accepted and will be closed immediately. Please write your issues in your own words to ensure they are clear, specific, and contain the necessary context.
- **Pull Requests**: Contributions with the help of AI are permitted, but you are ultimately responsible for the quality of your submission and for ensuring it follows our contributing guidelines. The PR description must be written in your own words. Additionally, please remove any superfluous code comments introduced by AI tools before submitting. PRs that clearly violate this rule will be closed without further review.

In all cases, contributors must ensure their submissions are thoughtful, well-tested, and meet the project's quality standards.

### Issues

Issues should be used to report problems with Nhost, request a new feature, or discuss potential changes before a PR is created.

If you find an Issue that addresses the problem you're having, please add your reproduction information to the existing issue rather than creating a new one. Adding a [reaction](https://github.blog/2016-03-10-add-reactions-to-pull-requests-issues-and-comments/) can also help indicate to our maintainers that a particular problem affects more than just the reporter.

### Pull Requests

PRs to our libraries are always welcome and can be a quick way to get your fix or improvement slated for the next release. In general, PRs should:

## Monorepo Structure

This repository is a monorepo that contains multiple packages and applications. The structure is as follows:

- `cli` - The Nhost CLI
- `dashboard` - The Nhost Dashboard
- `docs` - Documentation
- `examples` - Various example projects
- `packages/nhost-js` - The Nhost JavaScript/TypeScript SDK
- `services/auth` - Nhost Authentication service
- `services/storage` - Nhost Storage service
- `tools/codegen` - Internal code generation tool to build the SDK
- `tools/mintlify-openapi` - Internal tool to generate reference documentation for Mintlify from an OpenAPI spec.

For details about those projects and how to contribute, please refer to their respective `README.md` and `CONTRIBUTING.md` files.
