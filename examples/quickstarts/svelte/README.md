# Nhost Svelte Quickstart

This quickstart demonstrates how to build a simple movie database app with Svelte and Nhost's GraphQL API.

## What This Example Shows

- Setting up the Nhost client with Svelte
- Connecting to a local Nhost backend
- Fetching data using GraphQL queries
- Displaying data in a responsive table using Svelte's reactive stores

## Getting Started

1. **Start the Nhost backend** (from the `backend/` directory):
   ```bash
   cd ../backend
   cp .secrets.example .secrets
   nhost up
   ```

2. **Install dependencies and run the app**:
   ```bash
   npm install
   npm run dev
   ```

3. **Open your browser** to [http://localhost:5173](http://localhost:5173)

## Key Files

- `src/lib/nhost.js` - Nhost client configuration
- `src/App.svelte` - Main app component with GraphQL query
- Uses Svelte's `onMount` lifecycle and reactive statements

## Learn More

- [Nhost SvelteKit Documentation](https://docs.nhost.io/getting-started/quickstart/sveltekit)
- [Nhost GraphQL Documentation](https://docs.nhost.io/graphql)
- [Svelte Documentation](https://svelte.dev)

This example is part of the Nhost quickstart collection demonstrating different frontend frameworks.