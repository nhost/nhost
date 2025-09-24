# Nhost Vue Quickstart

This quickstart demonstrates how to build a simple movie database app with Vue 3 and Nhost's GraphQL API.

## What This Example Shows

- Setting up the Nhost client with Vue 3
- Connecting to a local Nhost backend
- Fetching data using GraphQL queries
- Displaying data in a responsive table using Vue's Composition API

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
- `src/App.vue` - Main app component with GraphQL query
- Uses Vue 3 Composition API with `<script setup>` syntax

## Learn More

- [Nhost Vue Documentation](https://docs.nhost.io/getting-started/quickstart/vue)
- [Nhost GraphQL Documentation](https://docs.nhost.io/graphql)
- [Vue 3 Documentation](https://vuejs.org)

This example is part of the Nhost quickstart collection demonstrating different frontend frameworks.