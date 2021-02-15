![Nhost](assets/nhost-logo.svg)

<div align="center">
  <h1>Nhost</h1>
  <a href="https://docs.nhost.io/quick-start">Quickstart</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://nhost.io/">Website</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://docs.nhost.io/">Docs</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://nhost.io/blog">Blog</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://discord.com/invite/9V7Qb2U">Discord</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://twitter.com/nhostio">Twitter</a>
  <br />
  <hr />
</div>

## What is Nhost?

Nhost is a **modern open-source Firebase alternative**. Nhost is also to the backend, what Netlify & Vercel is for the frontend.

Nhost's goal is to provide the **most productive developer experience to build apps**. We use the most popular and powerful technologies and make them easy to use with zero vendor lock-in.

We also provide a **full workflow**. From local development to staging, to production. Every detail is made to make developers as efficient as possible.

A Nhost backend includes PostgreSQL, GraphQL, Hasura, Authentication, Storage and Serverless Functions.

## Getting started

Create a Nhost project for free and get your backend in 45 seconds.

[Start your Nhost project &rarr;](https://console.nhost.io)

## Nhost compared to alternatives

![Nhost Alternatives](assets/nhost-alternatives.png)

## How Nhost works

Nhost stack consists of:

- Database [PostgreSQL](https://github.com/postgres/postgres)
  - The World's Most Advanced Open Source Relational Database
- Realtime GraphQL ([Hasura's GraphQL Engine](https://github.com/hasura/graphql-engine))
  - Instant GraphQL API based on tables and columns in Postgres.
  - Event trigger webhooks on database changes (insert / update / delete).
  - Connect remote GraphQL schemas.
  - Hasura Actions to extend the GraphQL API with custom business logic.
  - Powerful permission system based on JWT tokens.
- Authentication ([Hasura Backend Plus](https://github.com/nhost/hasura-backend-plus))
  - Email / Password
  - OAuth providers (Google, GitHub, Facebook, Twitter, Apple, Spotify, LinkedIn, Windows Live)
- Storage ([Hasura Backend Plus](https://github.com/nhost/hasura-backend-plus))
  - Let users upload and download files / documents / images
  - On-the-fly image transformation
- Custom API (serverless functions)
  - Add any bussiness logic

Nhost also provide a [CLI](https://github.com/nhost/cli) for local development and allow you to connect your repository to deploy database migrations when you push to your default branch.
