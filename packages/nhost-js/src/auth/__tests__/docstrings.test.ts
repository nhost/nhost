import { test, expect } from "@jest/globals";
import { createClient } from "@nhost/nhost-js";
import { FetchError } from "@nhost/nhost-js/fetch";

const subdomain = "local";
const region = "local";

test("usage", async () => {
  const email = `test-${Date.now()}@example.com`;
  const password = "password123";

  const nhost = createClient({
    subdomain,
    region,
  });

  await nhost.auth.signUpEmailPassword({
    email,
    password,
  });
});

test("error handling for auth", async () => {
  const email = `test-${Date.now()}@example.com`;
  const password = "password123";

  const nhost = createClient({
    subdomain,
    region,
  });

  try {
    await nhost.auth.signInEmailPassword({
      email,
      password,
    });

    expect(true).toBe(false); // This should not be reached
  } catch (err) {
    if (!(err instanceof FetchError)) {
      throw err; // Re-throw if it's not a FetchError
    }

    console.log("Error:", err);
    // Error: {
    //   body: {
    //     error: 'invalid-email-password',
    //     message: 'Incorrect email or password',
    //     status: 401
    //   },
    //   status: 401,
    //   headers: {
    //     'content-length': '88',
    //     'content-type': 'application/json',
    //     date: 'Mon, 12 May 2025 08:08:28 GMT'
    //   }
    // }

    // error handling...

    expect(err.status).toBe(401);
    expect(err.body).toStrictEqual({
      error: "invalid-email-password",
      message: "Incorrect email or password",
      status: 401,
    });
  }
});

test("error handling for auth error type", async () => {
  const email = `test-${Date.now()}@example.com`;
  const password = "password123";

  const nhost = createClient({
    subdomain,
    region,
  });

  try {
    await nhost.auth.signInEmailPassword({
      email,
      password,
    });

    expect(true).toBe(false); // This should not be reached
  } catch (err) {
    if (!(err instanceof Error)) {
      throw err; // Re-throw if it's not an Error
    }

    console.log("Error:", err.message);
    // Error: Incorrect email or password

    expect(err.message).toBe("Incorrect email or password");
  }
});
