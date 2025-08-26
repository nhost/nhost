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
 * @packageDocumentation
 */

export {
  type NhostClient,
  type NhostClientOptions,
  createClient,
  type NhostServerClientOptions,
  createServerClient,
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
