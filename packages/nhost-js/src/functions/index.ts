/**
 * This is the main module to interact with Nhost's Functions service.
 * Typically you would use this module via the main [Nhost client](main#createclient)
 * but you can also use it directly if you have a specific use case.
 *
 * ## Import
 *
 * You can import and use this package with:
 *
 * ```ts
 * import { createClient } from "@nhost/nhost-js/functions";
 * ```
 *
 * ## Usage
 *
 * You can use this library by passing the path to the function you want to call and any body
 * or fetch options you want to apply (optional):
 *
 * {@includeCode ./__tests__/docstrings.test.ts:2,4,9-20}
 *
 * The post method above is a convenience method for executing a POST request with a JSON body.
 * For more generic requests, you can use the `fetch` method instead:
 *
 * {@includeCode ./__tests__/docstrings.test.ts:2,4,30-43}
 *
 * ## Error handling
 *
 * The SDK will throw errors in most operations if the request returns a status >=300 or
 * if the request fails entirely (i.e., due to network errors). The type of the error
 * will be a `FetchError<T>`:
 *
 * {@includeCode ./__tests__/docstrings.test.ts:2-4,53-64,67-79,84}
 *
 * This type extends the standard `Error` type so if you want to just log the error you can
 * do so like this:
 *
 * {@includeCode ./__tests__/docstrings.test.ts:2-4,91-102,105-112,115}
 *
 * @module functions
 * @packageDocumentation
 */

export * from './client'
