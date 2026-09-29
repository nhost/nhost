/**
 * This file is auto-generated. Do not edit manually.
 */

import type { ChainFunction, FetchResponse } from "../fetch";
import { createEnhancedFetch, FetchError } from "../fetch";

/**
 * 
 @property name (`string`) - */
export interface Item {
  /**
   * 
   */
  name: string,
};

/**
 * Parameters for the createItem method.
    @property filter (string) - */
export interface CreateItemParams {
  /**
   * 
   */
  filter: string;
}


export interface Client {
  baseURL: string;

  /** Add a middleware function to the fetch chain
   * @param chainFunction - The middleware function to add
   */
  pushChainFunction(chainFunction: ChainFunction): void;
    /**
     

     This method may return different T based on the response code:
     - 204: void
     */
  createItem(
    body: Item | undefined,
    params: CreateItemParams,
    options?: RequestInit,
  ): Promise<FetchResponse<void>>;
};


export const createAPIClient = (
  baseURL: string,
  chainFunctions: ChainFunction[] = [],
): Client => {
  let fetch = createEnhancedFetch(chainFunctions);

  const pushChainFunction = (chainFunction: ChainFunction) => {
    chainFunctions.push(chainFunction);
    fetch = createEnhancedFetch(chainFunctions);
  };
    const  createItem = async (
    body: Item | undefined,
    params: CreateItemParams,
    options?: RequestInit,
  ): Promise<FetchResponse<void>> => {
  const encodedParameters =
    params &&
    Object.entries(params)
      .flatMap(([key, value]) => {
        if (value === null || value === undefined) {
          return []
        }
        // Default handling (scalars or explode: false)
        const stringValue = Array.isArray(value)
          ? value.join(',')
          : typeof value === 'object' && value !== null
          ? JSON.stringify(value)
          : String(value)
        return [`${key}=${encodeURIComponent(stringValue)}`]
      })
      .join('&')

    const url =
     encodedParameters
        ? `${ baseURL }/items?${encodedParameters}`
        : `${ baseURL }/items`;
    const res = await fetch(url, {
      ...options,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }
    
    const payload: undefined = undefined;
    

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<void>;

  };


  return {
    baseURL,
    pushChainFunction,
      createItem,
  };
};
