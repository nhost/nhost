## Nhost & Next.js example (WIP)

This demo is a work in progress, further improvements are to come

## Get started

1. Clone the repository

```sh
git clone https://github.com/nhost/nhost
cd nhost
```

2. Install dependencies

```sh
cd examples/nextjs
pnpm install
```

3. Terminal 1: Start Nhost

```sh
nhost dev
```

4. Terminal 2: Start React App

```sh
pnpm run dev
```

If you want to use this demo with your own cloud instance:

- modify the `BACKEND_URL` value in `src/helpers/index.ts`
- don't forget to change the client URL in the Nhost console so email verification will work: `Users -> Login Settings -> Client login URLs`: `http://localhost:4000`

If you want to use a local Nhost instance, start the CLI in parallel to Nextjs:
