/**
 * This is the main module to interact with Nhost's Storage service.
 * Typically you would use this module via the main [Nhost client](main#createclient)
 * but you can also use it directly if you have a specific use case.
 *
 * ## Import
 *
 * You can import and use this package with:
 *
 * ```ts
 * import { createClient } from "@nhost/nhost-js/storage";
 * ```
 *
 * ## Usage
 *
 * You can use this library to upload files, download files, and delete files:
 *
 * {@includeCode ./__tests__/docstrings.test.ts:2,5,10-58}
 *
 * ## Error handling
 *
 * The SDK will throw errors in most operations if the request returns a status >=300 or
 * if the request fails entirely (i.e., due to network errors). The type of the error
 * will be a `FetchError<ErrorResponse>`:
 *
 * {@includeCode ./__tests__/docstrings.test.ts:2-5,70-78,81-94,102}
 *
 * This type extends the standard `Error` type so if you want to just log the error you can
 * do so like this:
 *
 * {@includeCode ./__tests__/docstrings.test.ts:2-5,109-117,120-127,130}
 *
 * @module storage
 * @packageDocumentation
 */

export * from './client'
