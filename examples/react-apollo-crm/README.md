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

### Create customer

- [ ] Add zipcode, town and country to new users
- [ ] Toast for submits

### Render customer

- [ ] Render customer's information

### Customers listing

- [ ] Show correct current and total results
- [ ] Correct pagination

---

## Get started

1. Install dependencies

```
npm install
```

2. Terminal 1: Start Nhost

```
nhos dev
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
