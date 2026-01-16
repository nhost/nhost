/**
 * This is the main module to interact with Nhost's Auth service.
 * Typically you would use this module via the main [Nhost client](main#createclient)
 * but you can also use it directly if you have a specific use case.
 *
 * ## Import
 *
 * You can import and use this package with:
 *
 * ```ts
 * import { createClient } from "@nhost/nhost-js/auth";
 * ```
 *
 * ## Usage
 *
 * {@includeCode ./__tests__/docstrings.test.ts:2,4,12-20}
 *
 * ## Error handling
 *
 * The SDK will throw errors in most operations if the request returns a status >=300 or
 * if the request fails entirely (i.e., due to network errors). The type of the error
 * will be a `FetchError<ErrorResponse>`:
 *
 * {@includeCode ./__tests__/docstrings.test.ts:2-4,27-37,39-59,67}
 *
 * This type extends the standard `Error` type so if you want to just log the error you can
 * do so like this:
 *
 * {@includeCode ./__tests__/docstrings.test.ts:2-4,74-84,86-92,95}
 *
 * @module auth
 * @packageDocumentation
 */

export * from './client';
