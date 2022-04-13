---
title: 'Serverless Functions'
sidebar_position: 1
---

Nhost gives you the option to run serverless functions on the following runtimes:

- `Node.js 14` (Both JavaScript and Typescript)

---

## Creating functions

Every `.js` and `.ts` file in the `functions/` folder of your Nhost app will be exposed as an HTTP endpoint. You have to

```js
// In functions/hello/[name].js
export default (req, res) => {
  res.status(200).send(`Hello ${req.query.name}!`);
};
```

Or, if you prefer TypeScript:

```ts
// In functions/hello/[name].ts
import { Request, Response } from 'express';

export default (req: Request, res: Response) => {
  res.status(200).send(`Hello ${req.query.name}!`);
};
```

---

## Routing

HTTP endpoints are automatically generated based on the file structure under `functions/`.

As such, given this file structure:

```text
functions/index.js;
functions/users/index.ts;
functions/active.ts;
functions/my-company.js;
```

The following endpoints will be available:

- https://yourappid.nhost.run/v1/functions/ from `functions/index.js`.
- https://yourappid.nhost.run/v1/functions/users from `functions/users/index.ts`.
- https://yourappid.nhost.run/v1/functions/users/active from `functions/users/active.ts`.
- https://yourappid.nhost.run/v1/functions/my-company from `functions/my-company.js`.

If you've used Netlify or Vercel, this routing logic will be familiar to you.

---

## Infrastructure

Serverless Functions are deployed to AWS Lambda in the same region as your app.
