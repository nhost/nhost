import { expect, test } from "@jest/globals";
import { createClient } from "@nhost/nhost-js";
import { FetchError } from "@nhost/nhost-js/fetch";

test("basic", async () => {
  const subdomain = "local";
  const region = "local";

  const nhost = createClient({
    subdomain,
    region,
  });

  const funcResp = await nhost.functions.post("/helloworld", {
    message: "Hello, World!",
  });
  console.log(JSON.stringify(funcResp.body, null, 2));
  // {
  //   "message": "Hello, World!"
  // }

  expect(funcResp.status).toBe(200);
  expect(funcResp.body).toEqual({ message: "Hello, World!" });
});

test("fetch", async () => {
  const subdomain = "local";
  const region = "local";

  const nhost = createClient({
    subdomain,
    region,
  });

  const funcResp = await nhost.functions.fetch("/helloworld", {
    method: "GET",
    headers: {
      Accept: "text/plain",
      ContentType: "application/json",
    },
  });
  console.log(funcResp.body);
  // "Hello, World!"

  expect(funcResp.status).toBe(200);
  expect(funcResp.body).toBe("Hello, World!");
});

test("error handling for functions", async () => {
  const subdomain = "local";
  const region = "local";

  const nhost = createClient({
    subdomain,
    region,
  });

  try {
    await nhost.functions.fetch("/helloworld", {
      method: "GET",
      headers: {
        Accept: "application/octet-stream",
      },
    });

    expect(true).toBe(false); // This line should not be reached
  } catch (error) {
    if (!(error instanceof FetchError)) {
      throw error; // Re-throw if it's not a FetchError
    }

    console.log("Error:", JSON.stringify(error, null, 2));
    // Error: {
    //   "body": "Unsupported Accept Header",
    //   "status": 400,
    //   "headers": {...}
    // }
    //
    // error handling...

    expect(error.status).toBe(400);
    expect(error.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(error.body).toBe("Unsupported Accept Header");
  }
});

test("error handling for functions error type", async () => {
  const subdomain = "local";
  const region = "local";

  const nhost = createClient({
    subdomain,
    region,
  });

  try {
    await nhost.functions.fetch("/helloworld", {
      method: "GET",
      headers: {
        Accept: "application/octet-stream",
      },
    });

    expect(true).toBe(false); // This line should not be reached
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error; // Re-throw if it's not a FetchError
    }

    console.log("Error:", error.message);
    // Error: Unsupported Accept Header
    // error handling...

    expect(error.message).toBe("Unsupported Accept Header");
  }
});
