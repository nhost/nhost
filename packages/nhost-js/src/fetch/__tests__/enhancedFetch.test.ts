import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { type ChainFunction, createEnhancedFetch } from "../index";

const mockFetch = jest.fn();

global.fetch = mockFetch as unknown as typeof global.fetch;

describe("Enhanced Fetch", () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockFetch.mockReset();
    // Default mock implementation returns a successful response
    mockFetch.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ data: "test" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
  });

  test("should call fetch with original parameters when no chain functions are provided", async () => {
    const enhancedFetch = createEnhancedFetch();
    const url = "https://api.example.com";
    const options = { method: "GET" };

    await enhancedFetch(url, options);

    expect(mockFetch).toHaveBeenCalledWith(url, options);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("should apply a single chain function correctly", async () => {
    const addHeader: ChainFunction =
      (next) =>
      async (url, options = {}) => {
        const newOptions = {
          ...options,
          headers: {
            ...options.headers,
            "X-Test-Header": "test-value",
          },
        };
        return next(url, newOptions);
      };

    const enhancedFetch = createEnhancedFetch([addHeader]);
    const url = "https://api.example.com";

    await enhancedFetch(url);

    expect(mockFetch).toHaveBeenCalledWith(url, {
      headers: { "X-Test-Header": "test-value" },
    });
  });

  test("should apply multiple chain functions in the correct order", async () => {
    const executionOrder: string[] = [];

    const firstMiddleware: ChainFunction =
      (next) =>
      async (url, options = {}) => {
        executionOrder.push("first-before");
        const response = await next(url, options);
        executionOrder.push("first-after");
        return response;
      };

    const secondMiddleware: ChainFunction =
      (next) =>
      async (url, options = {}) => {
        executionOrder.push("second-before");
        const response = await next(url, options);
        executionOrder.push("second-after");
        return response;
      };

    const enhancedFetch = createEnhancedFetch([
      firstMiddleware,
      secondMiddleware,
    ]);
    const url = "https://api.example.com";

    await enhancedFetch(url);

    expect(executionOrder).toEqual([
      "first-before",
      "second-before",
      "second-after",
      "first-after",
    ]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("should allow chain functions to modify request parameters", async () => {
    const addHeader: ChainFunction =
      (next) =>
      async (url, options = {}) => {
        const newOptions = {
          ...options,
          headers: {
            ...options.headers,
            "X-Test-Header": "test-value",
          },
        };
        return next(url, newOptions);
      };

    const changeMethod: ChainFunction =
      (next) =>
      async (url, options = {}) => {
        const newOptions = {
          ...options,
          method: "POST",
        };
        return next(url, newOptions);
      };

    const enhancedFetch = createEnhancedFetch([addHeader, changeMethod]);
    const url = "https://api.example.com";

    await enhancedFetch(url, {
      headers: {
        Authorization: "Bearer token123",
      },
    });

    expect(mockFetch).toHaveBeenCalledWith(url, {
      headers: {
        "X-Test-Header": "test-value",
        Authorization: "Bearer token123",
      },
      method: "POST",
    });
  });

  test("should allow chain functions to modify the response", async () => {
    // Mock a specific response
    mockFetch.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ original: "data" }), {
          status: 200,
        }),
      ),
    );

    const modifyResponse: ChainFunction =
      (next) =>
      async (url, options = {}) => {
        const originalResponse = await next(url, options);

        // Create a modified response
        const originalData = (await originalResponse.json()) as object;
        const modifiedData = { ...originalData, modified: true };

        return new Response(JSON.stringify(modifiedData), {
          status: originalResponse.status,
          headers: originalResponse.headers,
        });
      };

    const enhancedFetch = createEnhancedFetch([modifyResponse]);
    const response = await enhancedFetch("https://api.example.com");
    const data = (await response.json()) as object;

    expect(data).toEqual({ original: "data", modified: true });
  });

  test("errors in middleware should propagate", async () => {
    const errorMiddleware: ChainFunction = () => async () => {
      throw new Error("Middleware error");
    };

    const enhancedFetch = createEnhancedFetch([errorMiddleware]);

    await expect(enhancedFetch("https://api.example.com")).rejects.toThrow(
      "Middleware error",
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("should allow chain functions to handle fetch errors", async () => {
    // Mock fetch to throw an error
    mockFetch.mockImplementation(() =>
      Promise.reject(new Error("Network error")),
    );

    const errorHandler: ChainFunction =
      (next) =>
      async (url, options = {}) => {
        try {
          return await next(url, options);
        } catch {
          // Return a fallback response
          return new Response(
            JSON.stringify({ error: "Handled error", fallback: true }),
            {
              status: 503,
            },
          );
        }
      };

    const enhancedFetch = createEnhancedFetch([errorHandler]);
    const response = await enhancedFetch("https://api.example.com");
    const data = (await response.json()) as object;

    expect(response.status).toBe(503);
    expect(data).toEqual({ error: "Handled error", fallback: true });
  });

  test("should allow chain functions to modify the URL", async () => {
    const urlModifier: ChainFunction =
      (next) =>
      async (url, options = {}) => {
        const newUrl = `${url}/additional/path`;
        return next(newUrl, options);
      };

    const enhancedFetch = createEnhancedFetch([urlModifier]);
    const baseUrl = "https://api.example.com";

    await enhancedFetch(baseUrl);

    expect(mockFetch).toHaveBeenCalledWith(
      `${baseUrl}/additional/path`,
      expect.any(Object),
    );
  });
});
