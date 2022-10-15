# CRM Example App with Nhost [WIP]

![Customers](assets/customers.png)

### Using the following technologies:

- [Nhost](https://nhost.io) (obviously)
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
- Storage
  - Upload
  - Download (with presigned URLs)
- Serverless functions

---

## Todo

This example app has some work in progress:

### Customers: New

- [ ] Add zipcode, town and country to new users
- [ ] Toast for submits

### Customers: Customer

- [ ] Render single customer

### Customers: List

- [ ] Show correct current and total results
- [ ] Correct pagination

## Orders: List

- [ ] List existing orders

## Orders: New

- [ ] Create new order

## Orders: Order

- [ ] Render single order

## Settings

- [ ] Update company name and address
- [ ] Add company logo
- [ ] ~ Client-side cropping to company logo before uploading

## Search:

- [ ] Make top-level search bar working

---

## Get started

1. Clone the repository

```sh
git clone https://github.com/nhost/nhost
cd nhost
```

2. Terminal 1: Run SDKs in dev-mode

```sh
pnpm install
pnpm dev
```

3. Terminal 2: Install dependencies and start Nhost

```sh
cd examples/react-apollo-crm
pnpm install
nhost dev
```

4. Terminal 3: Start React App

```sh
cd examples/react-apollo-crm
pnpm run dev
```

5. Terminal 4 (optional): Start GraphQL Codegens

> Make sure that the Nhost backend in step 2 has started and is available before you run this command

```
cd examples/react-apollo-crm
pnpm run codegen -- -w
```
