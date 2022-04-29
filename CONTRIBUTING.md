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

### Issues

Issues should be used to report problems with Nhost, request a new feature, or discuss potential changes before a PR is created.

If you find an Issue that addresses the problem you're having, please add your reproduction information to the existing issue rather than creating a new one. Adding a [reaction](https://github.blog/2016-03-10-add-reactions-to-pull-requests-issues-and-comments/) can also help indicate to our maintainers that a particular problem affects more than just the reporter.

### Pull Requests

Please have a look at our [developers guide](https://github.com/nhost/nhost/blob/main/DEVELOPERS.md) to start coding!

PRs to our libraries are always welcome and can be a quick way to get your fix or improvement slated for the next release. In general, PRs should:

- Only fix/add the functionality in question **OR** address wide-spread whitespace/style issues, not both.
- Add unit or integration tests for fixed or changed functionality (if a test suite exists).
- Address a single concern in the least number of changed lines as possible.
- Include documentation in the repo or on our [docs site](https://docs.nhost.io/get-started).
- Be accompanied by a complete Pull Request template (loaded automatically when a PR is created).

For changes that address core functionality or require breaking changes (e.g., a major release), it's best to open an Issue to discuss your proposal first. This is not required but can save time creating and reviewing changes.

In general, we follow the ["fork-and-pull" Git workflow](https://github.com/susam/gitpr)

1. Fork the repository to your own Github account
2. Clone the project to your machine
3. Create a branch locally with a succinct but descriptive name. All changes should be part of a branch and submitted as a pull request - your branches should be prefixed with one of:
   - `bug/` for bug fixes
   - `feat/` for features
   - `chore/` for configuration changes
   - `docs/` for documentation changes
4. Commit changes to the branch
5. Following any formatting and testing guidelines specific to this repo
6. Push changes to your fork
7. Open a PR in our repository and follow the PR template to review the changes efficiently.
