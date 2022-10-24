<h1 align="center">@nhost/google-translation</h1>
<h2 align="center">Google Translation GraphQL API</h2>

<p align="center">
  <img alt="npm" src="https://img.shields.io/npm/v/@nhost/google-translation">
  <img alt="npm" src="https://img.shields.io/npm/dm/@nhost/google-translation">
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="license: MIT" />
  </a>
</p>

This package creates a Google Translation GraphQL API.

```graphql
query {
  # Detect the initial language automatically, and set the destination language to the user's default, or the server's default
  first: googleTranslation(text: "le service est disponible")
  # Specify the destination language
  second: googleTranslation(text: "le service est disponible", to: "es")
  # Specify both initial and destination languages
  third: googleTranslation(text: "le service est disponible", from: "fr", to: "it")
}
```

You can also user the Google Translation GraphQL API with Hasura Remote Schema Relationships and connect data from your database and the Google Translation API. This allows you to request data from your database and the Google Translation API in a single GraphQL query:

```graphql
query {
  books {
    title # a text column in the books table
    translatedTitle # title translated into the user's  default locale
    italianTitle: translatedTitle(to: "it") # title translated into italian
  }
}
```

## Install

```bash
npm install @nhost/google-translation
```

## Quick Start

### Serverless Function Setup

Create a new [Serverless Function](https://docs.nhost.io/platform/serverless-functions) `functions/graphql/google-translation.ts`:

```js
import { createGoogleTranslationGraphQLServer } from '@nhost/google-translation'

export default createGoogleTranslationGraphQLServer()
```

> You can run the Google Translation GraphQL API in any JS environment because it's built using [GraphQL Yoga](https://github.com/dotansimha/graphql-yoga).

### Google Project ID and API Key

Add `GOOGLE_TRANSLATION_PROJECT_ID` as an environment variable. If you're using Nhost, add `GOOGLE_TRANSLATION_API_KEY` to `.env.development` like this:

```
GOOGLE_TRANSLATION_PROJECT_ID=project-id
GOOGLE_TRANSLATION_API_KEY=xxxxxxx
```

Learn more about [Google Projects and API keys](https://cloud.google.com/translate/docs/setup).

### Start Nhost

```
nhost up
```

Learn more about the [Nhost CLI](https://docs.nhost.io/platform/cli).

### Test

Test the Google Translation GraphQL API in the browser:

[http://localhost:1337/v1/functions/graphql/google-translation](http://localhost:1337/v1/functions/graphql/google-translation)

### Remote Schema

Add the Google Translation GraphQL API as a Remote Schema in Hasura.

**URL**

```
{{NHOST_BACKEND_URL}}/v1/functions/graphql/google-translation
```

**Headers**

```
x-nhost-webhook-secret: NHOST_WEBHOOK_SECRET (from env var)
```

### Remote Schema Relationships

You can use the GraphQL API to translate values from other columns.

## Settings

### Default language

- `defaultLanguage`
- `getDefaultLanguage`

### Permissions

- `canTranslate`
- context: `userLanguage`

### Server settings

- `cors`
- `graphiql`
- `logger`
- project id / API key

### Context

The `context` object contains:

- `userClaims` - verified JWT claims from the user's access token.
- `isAdmin` - `true` if the request was made using a valid `x-hasura-admin-secret` header.
- `request` - [Fetch API Request object](https://developer.mozilla.org/en-US/docs/Web/API/Request) that represents the incoming HTTP request in platform-independent way. It can be useful for accessing headers to authenticate a user
- `query` - the DocumentNode that was parsed from the GraphQL query string
- `operationName` - the operation name selected from the incoming query
- `variables` - the variables that were defined in the query
- `extensions` - the extensions that were received from the client

Read more about the [default context from GraphQL Yoga](https://www.the-guild.dev/graphql/yoga-server/docs/features/context#default-context).

## Development

Install dependencies:

```bash
pnpm install
```

Start the development server:

```bash
pnpm run start
```

The GraphQL Server will reload every time the code changes.

Open GraphiQL:

[http://0.0.0.0:4000](http://0.0.0.0:4000)
