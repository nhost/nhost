---
title: 'Event triggers'
sidebar_position: 2
---

Event triggers are HTTP webhooks that fire on a database event, such as insert, update, or delete. These events are usually a result of GraphQL mutations, but any other database operation will also fire events.

**Example:** Imagine you want to send an email every time a user makes a new order in an e-commerce application. To achieve that, you would create an event trigger on **insert** for the **orders table**. Every time an order is created, an event trigger will send a webhook with the order information, and the webhook can send out an email to the customer.

---

## Creating event triggers

Event triggers are managed in Hasura. Go to Hasura, then select **Events** in the main menu and press "Create".

![Creating event trigger in Hasura](/img/platform/hasura-create-event-trigger.png)

Nhost's [environment variables](/platform/environment-variables) can be used in event trigger headers. For example, you can attach `NHOST_WEBHOOK_SECRET` to an outgoing webhook here.

---

## Serverless functions

It's a common pattern to write a serverless function to catch a webhook fired by an event. When creating webhooks that are meant for your own serverless functions, use the following URL:

```bash
https://[app-subdomain].nhost.run/v1/functions/my-endpoint
```

The environment variable `NHOST_BACKEND_URL` will have the correct value.

```bash
{{NHOST_BACKEND_URL}}/v1/functions/my-endpoint
```

---

## Security

In your serverless function, you need to make sure the request actually comes from your Hasura instance. To do this, you must do two things:

- Add the header `nhost-webhook-secret` when creating the event in Hasura. Set this to `NHOST_WEBHOOK_SECRET`.
- Check the header in the serverless function. It should match the environment variable `NHOST_WEBHOOK_SECRET`.

```js
export default async function handler(req, res) {

  // Check webhook secret to make sure the request is valid
  if (
    req.headers['nhost-webhook-secret'] !== process.env.NHOST_WEBHOOK_SECRET
  ) {
    return res.status(400).send('Incorrect webhook secret')
  }

  // Do something
  // Example:
  // - Send an email
  // - Create a subscription in Stripe
  // - Generate a PDF
  // - Send a message to Slack or Discord
  // - Update some data in the database

  console.log(JSON.stringify(req.body, null, 2))

  return res.send('OK')
}
```
