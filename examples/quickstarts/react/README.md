# Nhost React Quickstart

This quickstart demonstrates how to build a simple movie database app with React and Nhost's GraphQL API.

## What This Example Shows

- Setting up the Nhost client with React
- Connecting to a local Nhost backend
- Fetching data using GraphQL queries
- Displaying data in a responsive table

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
- `src/App.jsx` - Main app component with GraphQL query
- Uses React hooks (`useState`, `useEffect`) for state management

## Learn More

- [Nhost React Documentation](https://docs.nhost.io/getting-started/quickstart/react)
- [Nhost GraphQL Documentation](https://docs.nhost.io/graphql)
- [React Documentation](https://react.dev)

This example is part of the Nhost quickstart collection demonstrating different frontend frameworks.