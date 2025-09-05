/**
 * This is the main module to interact with Nhost's GraphQL service.
 * Typically you would use this module via the main [Nhost client](main#createclient)
 * but you can also use it directly if you have a specific use case.
 *
 * ## Import
 *
 * ```ts
 * import { createClient } from "@nhost/nhost-js/graphql";
 * ```
 *
 * ## Usage
 *
 *  The `request` method provides type-safe GraphQL operations with full TypeScript support.
 *  You can leverage generics to type your responses and use GraphQL document nodes for better
 *  integration with third-party libraries.
 *
 * ### Basic Usage
 *
 * {@includeCode ./__tests__/docstrings.test.ts:2,6,11-25}
 *
 * ### Using String Queries with Type Generics
 *
 * You can type your GraphQL queries and responses using TypeScript generics:
 *
 * {@includeCode ./__tests__/docstrings.test.ts:2,6,97-123}
 *
 * ### Using GraphQL Document Nodes
 *
 * For better integration with third-party libraries like Apollo Client or The Guild's GraphQL
 * Code Generator, you can use GraphQL document nodes created with `gql` template literal tags:
 *
 * {@includeCode ./__tests__/docstrings.test.ts:2,5,6,195-223}
 *
 * Using document nodes enables:
 * - Better IDE support with syntax highlighting and validation
 * - Integration with code generation tools
 * - Compatibility with Apollo Client and other GraphQL libraries
 *
 * ## Error handling
 *
 * The SDK will throw errors in GraphQL operations that respond with an errors attribute
 * with length > 0. The error will be an instance of `FetchError<GraphQLResponse>` and will
 * contain the response body with the errors.
 *
 * {@includeCode ./__tests__/docstrings.test.ts:2-4,6,294-334,348}
 *
 * This type extends the standard `Error` type so if you want to just log the error you can
 * do so like this:
 *
 * {@includeCode ./__tests__/docstrings.test.ts:2-4,6,352-375,380}
 *
 * @module graphql
 * @packageDocumentation
 */

export * from "./client";
