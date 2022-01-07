# CRM

A CRM example app with Nhost.

Using the following technologies:

- Nhost (obviously)
- React
- TypeScript
- GraphQL Codegens
- TailwindCSS

Showing off:

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

2. Start Nhost (in terminal window 1)

```
nhos dev
```

2. Start React App (in terminal window 2)

```
npm run start
```

3. Start GraphQL Codegens (in terminal window 3)

(Make sure that the Nhost backend in step 2 has started and is available)

```
npm run codegen -- -w
```
