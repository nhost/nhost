# GraphQL Code Generator Example with React and React Query

This is an example repo for how to use GraphQL Code Generator together with:

- [TypeScript](https://www.typescriptlang.org/)
- [React](https://reactjs.org/)
- [React Query](https://tanstack.com/query/v4/)
- [Nhost](http://nhost.io/)

## Get Started

### Run npm Packages in Dev Mode

In the root of the `nhost/nhost` monorepo:

Install dependencies with `pnpm`:

> It's important that you're using `pnpm` because our repo is using [PNPM Workspaces](https://pnpm.io/workspaces).

```
pnpm install
```

```
pnpm run dev
```

The following commands should be run inside this folder.

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
