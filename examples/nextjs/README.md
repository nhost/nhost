## Nhost & Next.js example (WIP)

This demo is a work in progress, further improvements are to come

### Installation

First, clone this repo. Then run the commands:

```sh
cd examples/nextjs
yarn
yarn dev
```

If you want to use this demo with your own cloud instance:

- modify the `BACKEND_URL` value in `src/helpers/index.ts`
- don't forget to change the client URL in the Nhost console so email verification will work: `Users -> Login Settings -> Client login URLs`: `http://localhost:4000`

If you want to use a local Nhost instance, start the CLI in parallel to Nextjs:

```sh
# Inside examples/nextjs
nhost -d
```
