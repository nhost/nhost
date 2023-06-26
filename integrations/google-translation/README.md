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

Result:

```json
{
  "data": {
    "first": "service is available",
    "second": "el servicio está disponible",
    "third": "il servizio è disponibile"
  }
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

Result:

```json
{
  "data": {
    "books": [
      {
        "title": "Guerre et Paix",
        "translatedTitle": "War and peace",
        "italianTitle": "Guerra e Pace"
      },
      {
        "title": "Le Bruit et la Fureur",
        "translatedTitle": "The Sound and the Fury",
        "italianTitle": "Il suono e la furia"
      }
    ]
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

[https://local.functions.nhost.run/v1/graphql/google-translation](https://local.functions.nhost.run/v1/graphql/google-translation)

### Remote Schema

Add the Google Translation GraphQL API as a Remote Schema in Hasura.

**URL**

```
https://local.functions.nhost.run/v1/graphql/google-translation
```

**Headers**

```
x-nhost-webhook-secret: NHOST_WEBHOOK_SECRET (from env var)
```

### Remote Schema Relationships

You can use the GraphQL API to translate values from other columns.

## Settings

### Default language

It is possible to configure a default language by setting the `getDefaultLanguage` option, which is a function that gets the context as first argument, and returns either the language code, or `null`.
The `getDefaultLanguage` option is preconfigured to get the user locale from the authenticated user, using the `auth.users.locale` value as per defined in Hasura Auth.

If the `getDefaultLanguage` option returns `null`, the default language falls back to the `defaultLanguage` string option, which is preconfigured as `en`.

### Permissions

The `canTranslate` options is a function that accepts the [GraphQL Yoga context](https://www.the-guild.dev/graphql/yoga-server/docs/features/context#default-context) as an argument, augmented with the `useLanguage` string value that has been set by the `getDefaultLanguage` method.
By default, the `canTranslate` method returns true when:

1. the `x-nhost-webhook-secret` header is equal to the `NHOST_WEBHOOK_SECRET` environment variable; and
2. the user is an admin (either valid `x-hasura-admin-secret` is passed on as a header or `x-hasura-role` is `admin`), OR the user is authenticated (the request `Authorization` has a valid JWT)

### Server settings

Other options are available to configure the GraphQL server:

- Google Project API and API Key can be passed on with the `projectId` and `apiKey` parameters. When not set, they will fall back respectively to `process.env.GOOGLE_TRANSLATION_PROJECT_ID` and `process.env.GOOGLE_TRANSLATION_API_KEY`.
- `graphiql` defaults to `true`. Set it to `false` if you don't want to serve the GraphiQL UI.
- Custom `cors` configuration. See [GraphQL Yoga documentation](https://www.the-guild.dev/graphql/yoga-server/docs/features/cors) for further information.

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

[http://0.0.0.0:4000](http://0.0.0.0:4000/graphql)
