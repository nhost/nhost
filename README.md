<h1 align="center">Hasura Auth</h1>
<h2 align="center">The Open Source Authentication Service for Hasura.</h2>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.2.1-blue.svg?cacheSeconds=2592000" />
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="license: MIT" />
  </a>
  <a href="https://commitizen.github.io/cz-cli">
    <img src="https://img.shields.io/badge/commitizen-friendly-brightgreen.svg" alt="commitizen: friendly" />
  </a>
  <a href="https://prettier.io">
    <img src="https://img.shields.io/badge/code_style-prettier-ff69b4.svg" alt="code style: prettier" />
  </a>
  <a href="https://github.com/nhost/hasura-auth/actions?query=workflow%Build+branch%3Amain+event%3Apush">
    <img src="https://github.com/nhost/hasura-auth/workflows/Build/badge.svg?branch=main"/>
  </a>
  <a href="https://codecov.io/gh/nhost/hasura-auth/branch/main">
    <img src="https://codecov.io/gh/nhost/hasura-auth/branch/main/graph/badge.svg"
    />
  </a>
</p>

## Documentation:

Find more information about Hasura Auth in [our documentation](https://docs.nhost.io/reference/hasura-auth).

## Core Features:

- 🧑‍🤝‍🧑 Users are stored in Postgres and accessed via GraphQL
- 🔑 Multiple sign-in methods.
- ✨ Integrates with GraphQL and Hasura Permissions
- 🔐 JWT tokens and Refresh Tokens.
- ✉️ Emails sent on various operations
- ✅ Optional checking for Pwned Passwords.
- 👨‍💻 Written 100% in TypeScript.

## Sign in methods:

- **Email and Password** - simple email and password method.
- **Email** - also called **passwordless email** or **magic link**.
- **SMS** - also called **passwordless sms**.
- **Anonymous** - sign in users without any method. Anonymous users can be
  converted to _regular_ users.
- **OAuth providers**:
  - Facebook
  - Google
  - GitHub
  - Twitter
  - Apple
  - LinkedIn
  - Windows Live
  - Spotify
  - Strava
  - GitLab
  - BitBucket

## Deploy Hasura Auth in Seconds

Use [Nhost](https://nhost.io) to start using Hasura Auth in seconds.

### Using Docker-compose

```sh
git clone https://github.com/nhost/hasura-auth.git
cd hasura-auth
cp .env.example .env
docker-compose -f docker-compose-example.yaml up
```

## 🤝 Contributing

Contributions and issues are welcome. Please have a look at the [developer's guide](./DEVELOPERS.md) if you want to prepare a pull request.

Feel free to check the issues page.

## Show your support

Give a ⭐️ if this project helped you!

## 📝 License

This project is MIT licensed.
