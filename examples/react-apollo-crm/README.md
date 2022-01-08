# CRM Example App with Nhost

![Customers](assets/customers.png)

Using the following technologies:

- [Nhost](https://nhost.io) (obviously)
- [React]()
- [TypeScript]()
- [GraphQL Codegen](https://www.graphql-code-generator.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Tailwind UI](https://tailwindui.com/)

This includes among others the following features:

- GraphQL
- Permissions
- Authentication
  - Sign Up
  - Sign In
- Storage
  - Upload
  - Download (with presigned URLs)

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

1. Install dependencies

```
npm install
```

2. Terminal 1: Start Nhost

```
nhost dev
```

2. Terminal 2: Start React App

```
npm run start
```

3. Terminal 3: Start GraphQL Codegens

> Make sure that the Nhost backend in step 2 has started and is available

```
npm run codegen -- -w
```
