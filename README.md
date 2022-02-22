
<div align="center">

<p align="center">
  <img width="237" src="https://raw.githubusercontent.com/nhost/nhost/main/assets/logo.png"/>
</p>
</div>

<h3 align="center">
  <b><a href="https://docs.nhost.io/get-started">Get Started</a></b>
  •
  <a href="https://docs.nhost.io/">Docs</a>
  •
  <a href="https://nhost.io/discord">Community</a>
  •
  <a href="https://www.youtube.com/channel/UCJ7irtvV9Y0EQMxpabb6ntg">Youtube</a>
  •
  <a href="https://twitter.com/nhostio">Twitter</a> 
  </h3>
  
**Nhost is a serverless backend for web and mobile apps.** 

Nhost consists of open-source software pre-configured to get started quickly and is easy to scale.

This is what you get with Nhost:

- Database: [Postgres](https://www.postgresql.org/)
- GraphQL API: [Hasura](https://hasura.io/)
- Authentication: [Hasura Auth](https://github.com/nhost/hasura-auth/)
- Storage: [Hasura Storage](https://github.com/nhost/hasura-backend-plus/)
- Serverless Functions: JavaScript and TypeScript runtimes
- CLI: [Nhost CLI](https://docs.nhost.io/reference/cli) for local development

For complete documentation, visit [docs.nhost.io](http://docs.nhost.io/).

### Nhost works with

<div align="center">
<p style="display: flex; align-items: center;">
<a style="margin-right: 10px;" href="https://github.com/nhost/nhost/tree/main/templates/web/nextjs-apollo"><img src="assets/nextjs.svg"/></a>
<a style="margin-right: 10px;" href="https://github.com/nhost/nhost/tree/main/examples/nuxt-apollo"><img src="assets/nuxtjs.svg"/></a>
<a style="margin-right: 10px;" href="https://github.com/nhost/nhost/tree/main/templates/web/react-apollo"><img src="assets/react.svg"/></a>
<a style="margin-right: 10px;" href="https://github.com/nhost/nhost-dart/tree/main/packages/nhost_flutter_graphql/example"><img src="assets/react-native.svg"/></a>
<a style="margin-right: 10px;" href="https://github.com/nhost/nhost/tree/main/packages/nhost-js"><img src="assets/svelte.svg"/></a>
<a style="margin-right: 10px;" href="https://github.com/nhost/nhost/tree/main/packages/nhost-js"><img src="assets/vuejs.svg"/></a>
</p>
</div>

# How to get started

### Option 1: One-click deployment with Nhost (recommended)

1. Create Nhost account
2. Create Nhost app
3. App is live! 

### Option 2: Self-hosting

*Coming soon*

## Sign in a user and make your first GraphQL request

Install the `@nhost/nhost-js` package.

Now you're ready to develop your app:

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

# Resources

Nhost libraries and tools

- [JavaScript/TypeScript SDK](https://docs.nhost.io/reference/sdk)
- [Dart and Flutter SDK](https://github.com/nhost/nhost-dart)
- [Nhost CLI](https://docs.nhost.io/reference/cli)
- [Nhost React Auth](https://docs.nhost.io/reference/supporting-libraries/react-auth)
- [Nhost React Apollo](https://docs.nhost.io/reference/supporting-libraries/react-apollo)

## Community ❤️

First and foremost: **Star and watch this repository** to stay up-to-date.

Also, follow Nhost on [GitHub Discussions](https://github.com/nhost/nhost/discussions), our [Blog](https://nhost.io/blog), and on [Twitter](https://twitter.com/nhostio). You can chat with the team and other members on [Discord](https://discord.com/invite/9V7Qb2U), and follow our tutorials and other video material at [YouTube](https://www.youtube.com/channel/UCJ7irtvV9Y0EQMxpabb6ntg?view_as=subscriber).

## Nhost is Open Source

This repository, and most of our other open source projects, are licensed under the MIT license.

### How to contribute

Here are some ways of contributing to making Nhost better:

- **[Try out Nhost](https://docs.nhost.io/get-started/quick-start)**, and think of ways of how you can make the service better.
- Join our [Discord](https://discord.com/invite/9V7Qb2U) and connect with other members to share and learn from.
- Send a pull request to any of our [open source repositories](https://github.com/nhost) on Github. Check our [contribution guide](https://github.com/nhost/nhost/blob/main/CONTRIBUTING.md) for more details about how to contribute. We're looking forward to your contribution!

For more information, read our [Contribution Guide](https://github.com/nhost/nhost/blob/main/CONTRIBUTING.md)

## Security

If you discover a security vulnerability within Nhost, please send an e-mail to [security@nhost.io](mailto:security@nhost.io). All security vulnerabilities will be promptly addressed.
