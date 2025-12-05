import { describe, expect, it } from "@jest/globals";
import {
  createAPIClient,
  type ErrorResponse,
  type SignUpEmailPasswordRequest,
} from "@nhost/nhost-js/auth";
import type { FetchError } from "@nhost/nhost-js/fetch";

describe("Nhost Auth - Sign Up with Email and Password", () => {
  const nhostAuth = createAPIClient("https://local.auth.nhost.run/v1");

  // Create a unique email for each test run to avoid conflicts
  const uniqueEmail = `test-${Date.now()}@example.com`;
  const password = "password123";

  it("should sign up a user with email and password", async () => {
    // Create request payload with unique email
    const signUpRequest: SignUpEmailPasswordRequest = {
      email: uniqueEmail,
      password,
      options: {
        displayName: "Test User",
        locale: "en",
        defaultRole: "user",
        allowedRoles: ["user"],
        metadata: {
          source: "test",
        },
      },
    };

    // Make an actual API call
    const response = await nhostAuth.signUpEmailPassword(signUpRequest);

    // Verify structure of response
    expect(response.body.session).toBeDefined();
    expect(response.body.session?.accessToken).toBeDefined();
    expect(response.body.session?.refreshToken).toBeDefined();
    expect(response.body.session?.user).toBeDefined();
  });

  it("should sign in a user with email and password", async () => {
    // Make an actual API call
    const response = await nhostAuth.signInEmailPassword({
      email: uniqueEmail,
      password,
    });

    // Verify structure of response
    expect(response.body.session).toBeDefined();
    expect(response.body.session?.accessToken).toBeDefined();
    expect(response.body.session?.refreshToken).toBeDefined();
    expect(response.body.session?.user).toBeDefined();
  });

  it("should fail sign in a user with email and password", async () => {
    // Make an actual API call with incorrect password
    try {
      await nhostAuth.signInEmailPassword({
        email: uniqueEmail,
        password: "wrongpassword",
      });

      expect(true).toBe(false); // This should not be reached
    } catch (error) {
      const err = error as FetchError<ErrorResponse>;
      expect(err.status).toBe(401);
      expect(err.body).toStrictEqual({
        error: "invalid-email-password",
        message: "Incorrect email or password",
        status: 401,
      });
    }
  });

  it("should get a valid url for provider sign in with empty parameters", () => {
    const url = nhostAuth.signInProviderURL("google");

    expect(url).toBe(`https://local.auth.nhost.run/v1/signin/provider/google`);
  });

  it("workos with custom parameters", () => {
    const url = nhostAuth.signInProviderURL("workos", {
      providerSpecificParams: {
        connection: "example-connection",
      },
    });

    expect(url).toBe(
      `https://local.auth.nhost.run/v1/signin/provider/workos?connection=example-connection`,
    );

    const url2 = nhostAuth.signInProviderURL("workos", {
      allowedRoles: ["user", "me"],
      defaultRole: "user",
      displayName: "Test User",
      locale: "en",
      metadata: {
        source: "test",
        boolean: true,
        number: 123,
      },
      redirectTo: "https://example.com/callback",
      providerSpecificParams: {
        connection: "example-connection",
        organization: "example-org",
      },
    });

    expect(url2).toBe(
      `https://local.auth.nhost.run/v1/signin/provider/workos?allowedRoles=user%2Cme&defaultRole=user&displayName=Test%20User&locale=en&metadata=%7B%22source%22%3A%22test%22%2C%22boolean%22%3Atrue%2C%22number%22%3A123%7D&redirectTo=https%3A%2F%2Fexample.com%2Fcallback&connection=example-connection&organization=example-org`,
    );
  });

  it("should get a valid url for provider sign in with complex parameters", () => {
    const url = nhostAuth.signInProviderURL("google", {
      allowedRoles: ["user", "me"],
      defaultRole: "user",
      displayName: "Test User",
      locale: "en",
      metadata: {
        source: "test",
        boolean: true,
        number: 123,
      },
      redirectTo: "https://example.com/callback",
    });

    expect(url).toBe(
      `https://local.auth.nhost.run/v1/signin/provider/google?allowedRoles=user%2Cme&defaultRole=user&displayName=Test%20User&locale=en&metadata=%7B%22source%22%3A%22test%22%2C%22boolean%22%3Atrue%2C%22number%22%3A123%7D&redirectTo=https%3A%2F%2Fexample.com%2Fcallback`,
    );
  });
});
