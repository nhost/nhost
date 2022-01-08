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

```
npm run codegen -- -w
```

> Make sure that the Nhost backend in step 2 has started and is available

---
