# CRM Example App with Nhost [WIP]

![Customers](assets/customers.png)

### Using the following technologies:

- [Nhost](https://nhost.io) (obviously)
- [Stripe](https://stripe.com)
- [React](https://reactjs.org/)
- [React Router v6](https://reactrouter.com/docs/en/v6)
- [TypeScript](https://www.typescriptlang.org/)
- [GraphQL Codegen](https://www.graphql-code-generator.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Tailwind UI](https://tailwindui.com/)

### Some features showcased in this example

- Postgres
- GraphQL
- Permissions
- Authentication
  - Sign Up
  - Sign In
  - Reset Password
- Serverless Functions

---

## Todo

- [ ] Create Stripe Subscription on Start Up
- [ ] Clients: New
- [ ] Clients: List
- [ ] Clients: Edit
- [ ] Clients: Delete
- [ ] Invoices: New
- [ ] Invoices: List
- [ ] Invoices: Edit
- [ ] Invoices: Delete

---

## Get started

1. Install dependencies

```bash
yarn install
```

2. Terminal 1: Start Nhost

```bash
nhost dev
```

2. Terminal 2: Start React App

```bash
yarn start
```

3. Terminal 3: Start GraphQL Codegens

> Make sure that the Nhost backend in step 2 has started and is available before you run this command

```bash
yarn codegen:watch
```
