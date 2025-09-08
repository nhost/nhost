# Nhost Next.js Quickstart

This quickstart demonstrates how to build a simple movie database app with Next.js and Nhost's GraphQL API using server-side rendering.

## What This Example Shows

- Setting up the Nhost client with Next.js
- Connecting to a local Nhost backend
- Fetching data using GraphQL queries with server-side rendering
- Displaying data in a responsive table using React Server Components

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

3. **Open your browser** to [http://localhost:3000](http://localhost:3000)

## Key Files

- `src/lib/nhost.js` - Nhost client configuration
- `src/app/page.js` - Main page component with server-side GraphQL query
- Uses Next.js App Router with React Server Components

## Learn More

- [Nhost Next.js Documentation](https://docs.nhost.io/getting-started/quickstart/nextjs)
- [Nhost GraphQL Documentation](https://docs.nhost.io/graphql)
- [Next.js Documentation](https://nextjs.org/docs)

This example is part of the Nhost quickstart collection demonstrating different frontend frameworks.
