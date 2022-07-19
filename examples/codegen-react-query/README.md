# GraphQL Code Generator Example Repo

This is an example repo for how to use GraphQL Code Generator together with:

- [TypeScript](https://www.typescriptlang.org/)
- [React](https://reactjs.org/)
- [React Query](https://react-query-v3.tanstack.com/)
- [Nhost](http://nhost.io/)

## Get Started

### Run npm Packages in Dev Mode

In the root of the `nhost/nhost` monorepo:

Install dependencies with `pnpm`:

> It's important that you're using `pnpm` because our repo are using [PNPM Workspaces](https://pnpm.io/workspaces).

```
pnpm install
```

```
pnpm run dev
```

All other commands should run inside this example.

### Run Nhost

```
nhost up
```

### Run GraphQL Code Generator

Run once:

```
pnpm codegen
```

Run in watch mode:

```
pnpm codegen -w
```

### Run React App

```
pnpm run dev
```
