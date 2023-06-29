# Node.js Storage Example

This example demonstrates how to use the [Nhost Storage SDK](https://docs.nhost.io/reference/javascript/storage) in Node.js.

Make sure to install the dependencies:

```bash
pnpm install
```

## Settting up the environment

Create a `.env` file in the root of the project with the following content:

```bash
SUBDOMAIN=<your-subdomain>
REGION=<your-region>
ADMIN_SECRET=<your-admin-secret>
```

You can use the `.env.example` file as a starting point.

## Running the example

```bash
pnpm start
```

The example will run a few upload operations and then exit.
