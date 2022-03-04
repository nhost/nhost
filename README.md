<div align="center">
  <img width="237" src="https://raw.githubusercontent.com/nhost/nhost/main/assets/logo.png"/>

  <br />
  <br />

<a href="https://docs.nhost.io/get-started">Quickstart</a>
<span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
<a href="http://nhost.io/">Website</a>
<span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
<a href="https://docs.nhost.io/get-started">Docs</a>
<span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
<a href="https://nhost.io/blog">Blog</a>
<span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
<a href="https://twitter.com/nhostio">Twitter</a>
<span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
<a href="https://nhost.io/discord">Discord</a>
<br />

  <hr />
</div>

**Nhost is a serverless backend for web and mobile apps** and is built with the following things in mind:

- Open Source
- Developer Productivity
- SQL
- GraphQL

Nhost consists of open source software:

- Database: [PostgreSQL](https://www.postgresql.org/)
- Instant GraphQL API: [Hasura](https://hasura.io/)
- Authentication: [Hasura Auth](https://github.com/nhost/hasura-auth/)
- Storage: [Hasura Storage](https://hub.docker.com/r/nhost/hasura-storage)
- Serverless Functions: Node.js (JavaScript and TypeScript)
- [Nhost CLI](https://docs.nhost.io/reference/cli) for local development

Visit [https://docs.nhost.io](http://docs.nhost.io) for the complete documentation.

# How to get started

### Option 1: One-click deployment with Nhost (recommended)

1. Create [Nhost account](https://app.nhost.io) (you can use GitHub to sign up)
2. Create Nhost app
3. Done!

### Option 2: Self-hosting

Since Nhost is 100% open source, you can self-host the whole Nhost stack. Check out the example [docker-compose file](https://github.com/nhost/nhost/tree/main/examples/docker-compose) to self-host Nhost.

## Sign in a user and make your first GraphQL query

Install the `@nhost/nhost-js` package and start build your app:

```jsx
import { NhostClient } from '@nhost/nhost-js'

const nhost = new NhostClient({
  backendUrl: 'https://awesome-app.nhost.run'
})

await nhost.auth.signIn({ email: 'elon@musk.com', password: 'spaceX' })

await nhost.graphql.request(`{
  users {
    id
    displayName
    email
  }
}`)
```

## Frontend Agnostic

Nhost is frontend agnostic, which means Nhost works with all frontend frameworks.

<div align="center">
  <a href="https://github.com/nhost/nhost/tree/main/templates/web/nextjs-apollo"><img src="assets/nextjs.svg"/></a>
  <a href="https://github.com/nhost/nhost/tree/main/examples/nuxt-apollo"><img src="assets/nuxtjs.svg"/></a>
  <a href="https://github.com/nhost/nhost/tree/main/templates/web/react-apollo"><img src="assets/react.svg"/></a>
  <img src="assets/react-native.svg"/>
  <a href="https://github.com/nhost/nhost/tree/main/packages/nhost-js"><img src="assets/svelte.svg"/></a>
  <a href="https://github.com/nhost/nhost/tree/main/packages/nhost-js"><img src="assets/vuejs.svg"/></a>
</div>

# Resources

Nhost libraries and tools

- [JavaScript/TypeScript SDK](https://docs.nhost.io/reference/sdk)
- [Dart and Flutter SDK](https://github.com/nhost/nhost-dart)
- [Nhost CLI](https://docs.nhost.io/reference/cli)
- [Nhost React Auth](https://docs.nhost.io/reference/supporting-libraries/react-auth)
- [Nhost React Apollo](https://docs.nhost.io/reference/supporting-libraries/react-apollo)

## Community ❤️

First and foremost: **Star and watch this repository** to stay up-to-date.

Also, follow Nhost on [GitHub Discussions](https://github.com/nhost/nhost/discussions), our [Blog](https://nhost.io/blog), and on [Twitter](https://twitter.com/nhostio). You can chat with the team and other members on [Discord](https://discord.com/invite/9V7Qb2U) and follow our tutorials and other video material at [YouTube](https://www.youtube.com/channel/UCJ7irtvV9Y0EQMxpabb6ntg?view_as=subscriber).

## Nhost is Open Source

This repository, and most of our other open source projects, are licensed under the MIT license.

### How to contribute

Here are some ways of contributing to making Nhost better:

- **[Try out Nhost](https://docs.nhost.io/get-started/quick-start)**, and think of ways to make the service better. Let us know here on GitHub.
- Join our [Discord](https://discord.com/invite/9V7Qb2U) and connect with other members to share and learn from.
- Send a pull request to any of our [open source repositories](https://github.com/nhost) on Github. Check our [contribution guide](https://github.com/nhost/nhost/blob/main/CONTRIBUTING.md) for more details about how to contribute. We're looking forward to your contribution!

## Security

If you discover a security vulnerability within Nhost, please e-mail [security@nhost.io](mailto:security@nhost.io). All security vulnerabilities will be promptly addressed.
