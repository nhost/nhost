# Nhost with SvelteKit Example

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

3. Go to the SvelteKit example folder

   ```sh
   cd examples/sveltekit
   ```

4. Create a `.env` file and set the subdomain and region of your Nhost project. When running locally with the CLI, set the subdomain to `local`.

   ```sh
   PUBLIC_NHOST_SUBDOMAIN=
   PUBLIC_NHOST_REGION=
   ```

5. Terminal 1: Start Nhost

   > Make sure you have the [Nhost CLI installed](https://docs.nhost.io/platform/cli).

   ```sh
   nhost up
   ```

6. Terminal 2: Start the SvelteKit dev server

   ```sh
   pnpm dev
   ```
