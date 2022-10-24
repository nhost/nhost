# GraphQL Code Generator Example with React and React Query

This is an example repo for how to use GraphQL Code Generator together with:

- [TypeScript](https://www.typescriptlang.org/)
- [React](https://reactjs.org/)
- [React Query](https://tanstack.com/query/v4/)
- [Nhost](http://nhost.io/)

This repo is a reference repo for the blog post: [How to use GraphQL Code Generator with React and React Query](https://nhost.io/blog/how-to-use-graphql-code-generator-with-react-query).

## Get started

1. Clone the repository

```
git clone https://github.com/nhost/nhost
cd nhost
```

2. Install and build dependencies

```
pnpm install
pnpm build
```

3. Go to the Codegen React Query example folder

```
cd examples/codegen-react-query
```

4. Terminal 1: Start Nhost

> Make sure you have the [Nhost CLI installed](https://docs.nhost.io/platform/cli).

```sh
nhost up
```

5. Terminal 2: Run GraphQL Codegen

```
pnpm codegen -w
```

> `-w` runs [codegen in watch mode](https://www.the-guild.dev/graphql/codegen/docs/getting-started/development-workflow#watch-mode).

6. Terminal 3: Start the React application

```sh
pnpm dev
```
