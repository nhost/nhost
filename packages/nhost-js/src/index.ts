/**
 * Main entry point for the Nhost JavaScript SDK.
 *
 * This package provides a unified client for interacting with Nhost services:
 * - Authentication
 * - Storage
 * - GraphQL
 * - Functions
 *
 * ## Import
 *
 * ```ts
 * import { createClient } from "@nhost/nhost-js";
 * ```
 *
 * ## Usage
 *
 * Create a client instance to interact with Nhost services:
 *
 * {@includeCode ./__tests__/docstrings.test.ts:11-115}
 *
 * ### Creating an admin client
 *
 * You can also create an admin client if needed. This client will have admin access to the database
 * and will bypass permissions. Additionally, it can impersonate users and set any role or session
 * variable.
 *
 * IMPORTANT!!! Keep your admin secret safe and never expose it in client-side code.
 *
 * {@includeCode ./__tests__/docstrings.test.ts:138-195}
 *
 * @packageDocumentation
 */

export {
  createAdminClient,
  createClient,
  createCustomClient,
  createServerClient,
  type NhostClient,
  type NhostClientOptions,
  type NhostServerClientOptions,
} from "./nhost";

/**
 * Generates a base URL for a Nhost service based on configuration
 *
 * @param serviceType - Type of service (auth, storage, graphql, functions)
 * @param subdomain - Nhost project subdomain
 * @param region - Nhost region
 * @param customUrl - Custom URL override if provided
 * @returns The base URL for the service
 */
export const generateServiceUrl = (
  serviceType: "auth" | "storage" | "graphql" | "functions",
  subdomain?: string,
  region?: string,
  customUrl?: string,
): string => {
  if (customUrl) {
    return customUrl;
  } else if (subdomain && region) {
    return `https://${subdomain}.${serviceType}.${region}.nhost.run/v1`;
  } else {
    return `https://local.${serviceType}.local.nhost.run/v1`;
  }
};
