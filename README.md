<h1 align="center">Hasura Auth</h1>
<h2 align="center">Authentication for Hasura</h2>

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

# Environment variables

| env var                     | default value |
| --------------------------- | ------------- |
| HASURA_GRAPHQL_DATABASE_URL |               |
| HASURA_GRAPHQL_JWT_SECRET   |               |
| HASURA_GRAPHQL_ADMIN_SECRET |               |
| HASURA_GRAPHQL_GRAPHQL_URL  |               |
| AUTH_HOST                   | 0.0.0.0       |
| AUTH_PORT                   | 4000          |
| EMAIL_ENABLED               | false         |
| AUTH_SMTP_HOST              |               |
| AUTH_SMTP_PORT              | 587           |
| AUTH_SMTP_USER              |               |
| AUTH_SMTP_PASS              |               |
| AUTH_SMTP_SENDER            |               |
| AUTH_SMTP_AUTH_METHOD       | PLAIN         |
| AUTH_SMTP_SECURE            | false         |
| AUTH_GRAVATAR_ENABLED       | true          |
| AUTH_GRAVATAR_DEFAULT       | blank         |
| AUTH_GRAVATAR_RATING        | g             |
