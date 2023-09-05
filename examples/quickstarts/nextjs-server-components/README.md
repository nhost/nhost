# Nhost with Next.js Server Components

## Get Started

1. Clone the repository

```sh
git clone https://github.com/nhost/nhost
cd nhost
```

2. Install and build dependencies

```sh
pnpm install
pnpm build
```

3. Terminal 1: Start the Nhost Backend

> Make sure you have the [Nhost CLI installed](https://docs.nhost.io/platform/cli).

```sh
cd examples/quickstarts/nhost-backend
nhost up
```

5. Terminal 2: Start the Next.js application

```sh
cd examples/quickstarts/nextjs-server-components
pnpm dev
```
