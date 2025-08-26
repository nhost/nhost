# GraphQL Code Generator Example with React and Apollo Client

Todo app to show how to use:

- [Nhost](https://nhost.io/)
- [React](https://reactjs.org/)
- [TypeScript](https://www.typescriptlang.org/)
- [GraphQL Code Generator](https://the-guild.dev/graphql/codegen)
- [Apollo Client](https://www.apollographql.com/docs/react/)

This repo is a reference repo for the blog post: [How to use GraphQL Code Generator with React and Apollo](https://nhost.io/blog/how-to-use-graphql-code-generator-with-react-and-apollo).

## Get Started

1. Clone the repository

```sh
git clone https://github.com/nhost/nhost
cd nhost
```

2. Install and build dependencies

```sh
pnpm install
pnpm run build
```

3. Go to the example folder

```sh
cd examples/codegen-react-urql
```

4. Terminal 1: Start Nhost

```sh
nhost up -d
```

5. Terminal 2: Start the React application

```sh
pnpm run dev
```

## GraphQL Code Generators

To re-run the GraphQL Code Generators, run the following:

```
pnpm codegen -w
```

> `-w` runs [codegen in watch mode](https://www.the-guild.dev/graphql/codegen/docs/getting-started/development-workflow#watch-mode).
