/**
 * This file is auto-generated. Do not edit manually.
 */

import type { ChainFunction, FetchResponse } from "../fetch";
import { createEnhancedFetch, FetchError } from "../fetch";

/**
 * Enumeration of possible status values.
 */
export type StatusEnum = "active" | "inactive" | "pending";


/**
 * Status of the object.
 */
export type SimpleObjectStatus = "active" | "inactive" | "pending";


/**
 * Status code of the object.
 */
export type SimpleObjectStatusCode = 0 | 1 | 2;


/**
 * Some people just want to see the world burn.
 */
export type SimpleObjectStatusMixed = 0 | "One" | true;


/**
 * Nested object containing additional properties.
 @property nestedId (`string`) - Unique identifier for the nested object.
    *    Example - `"nested123"`
 @property nestedData? (`string`) - Data associated with the nested object.
    *    Example - `"Nested data"`*/
export interface SimpleObjectNested {
  /**
   * Unique identifier for the nested object.
    *    Example - `"nested123"`
   */
  nestedId: string,
  /**
   * Data associated with the nested object.
    *    Example - `"Nested data"`
   */
  nestedData?: string,
};


/**
 * This is a simple object schema.
 @property id (`string`) - Unique identifier for the object.
    *    Example - `"abc123"`
 @property active (`boolean`) - Indicates if the object is active.
    *    Example - `true`
 @property age (`number`) - Age of the object in years.
    *    Example - `5`
 @property createdAt (`string`) - Timestamp when the file was created.
    *    Example - `"2023-01-15T12:34:56Z"`
    *    Format - date-time
 @property metadata (`Record<string, unknown>`) - Custom metadata associated with the file.
    *    Example - `{"alt":"Profile picture","category":"avatar"}`
 @property data (`Blob`) - Base64 encoded data of the file.
    *    Format - binary
 @property tags? (`string[]`) - List of tags associated with the object.
 @property status? (`SimpleObjectStatus`) - Status of the object.
    *    Example - `"active"`
 @property statusCode? (`SimpleObjectStatusCode`) - Status code of the object.
    *    Example - `0`
 @property statusMixed? (`SimpleObjectStatusMixed`) - Some people just want to see the world burn.
    *    Example - `0`
 @property statusRef? (`StatusEnum`) - Enumeration of possible status values.
 @property nested? (`SimpleObjectNested`) - Nested object containing additional properties.*/
export interface SimpleObject {
  /**
   * Unique identifier for the object.
    *    Example - `"abc123"`
   */
  id: string,
  /**
   * Indicates if the object is active.
    *    Example - `true`
   */
  active: boolean,
  /**
   * Age of the object in years.
    *    Example - `5`
   */
  age: number,
  /**
   * Timestamp when the file was created.
    *    Example - `"2023-01-15T12:34:56Z"`
    *    Format - date-time
   */
  createdAt: string,
  /**
   * Custom metadata associated with the file.
    *    Example - `{"alt":"Profile picture","category":"avatar"}`
   */
  metadata: Record<string, unknown>,
  /**
   * Base64 encoded data of the file.
    *    Format - binary
   */
  data: Blob,
  /**
   * List of tags associated with the object.
   */
  tags?: string[],
  /**
   * Status of the object.
    *    Example - `"active"`
   */
  status?: SimpleObjectStatus,
  /**
   * Status code of the object.
    *    Example - `0`
   */
  statusCode?: SimpleObjectStatusCode,
  /**
   * Some people just want to see the world burn.
    *    Example - `0`
   */
  statusMixed?: SimpleObjectStatusMixed,
  /**
   * Enumeration of possible status values.
   */
  statusRef?: StatusEnum,
  /**
   * Nested object containing additional properties.
   */
  nested?: SimpleObjectNested,
};



export interface Client {
  baseURL: string;
  pushChainFunction(chainFunction: ChainFunction): void;};


export const createAPIClient = (
  baseURL: string,
  chainFunctions: ChainFunction[] = [],
): Client => {
  let fetch = createEnhancedFetch(chainFunctions);

  const pushChainFunction = (chainFunction: ChainFunction) => {
    chainFunctions.push(chainFunction);
    fetch = createEnhancedFetch(chainFunctions);
  };

  return {
    baseURL,
    pushChainFunction,
  };
};
