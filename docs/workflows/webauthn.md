# Security Keys with WebAuthn

Hasura-auth implements the WebAuthn protocol to sign in with security keys, also referred as authenticators in the WebAuthn protocol.

A user needs first to sign up with another method, for instance email+password, passwordless email or Oauth, then to add their security key to their account.

Once the security key is added, it is then possible to sign in with it, using the email as a username.

## Add a security key

Users can add multiple security keys, for example when they need to login from multiple devices or browsers. Only authenticated users are allowed to add security keys.

```mermaid
sequenceDiagram
	autonumber
	actor U as User
	participant A as Hasura Auth
	participant G as Face ID/Fingerprint/Other
	U->>+A: HTTP POST /user/webauthn/add
    Note left of A: Passing Bearer token
    A->>-U: HTTP OK response
    Note left of A: Challenge
    opt Sign challenge
        U->>+G: Sign Challenge
        G->>-G: Verfiy user
        G->>U:
        Note left of G: Signed Challenge
    end
    U->>+A: HTTP POST /user/webauthn/verify
    Note left of A: Signed challenge
    A->>A: Verify Signed challenge
	A->>A: Add authenticator
    A->>-U: HTTP OK response
    Note left of A: Refresh token + access token
```

## Sign in

```mermaid
sequenceDiagram
	autonumber
	actor U as User
	participant A as Hasura Auth
	participant G as Face ID/Fingerprint/Other
	U->>+A: HTTP POST /signin/webauthn
    alt Email not verified or user disabled
        A->>U: HTTP ERROR response
    else Email verified and user not disabled
        A->>-U: HTTP OK response
        Note left of A: Challenge
    end
    opt Verify user
        U->>+G: Sign Challenge
        G->>-G: Verfiy user
        G->>U:
        Note left of G: Signed Challenge
    end
    U->>+A: HTTP POST /signin/webauthn/verify
    Note left of A: Signed challenge
    A->>A: Check if email is verified
    A->>A: Check if user is disabled
    alt Email not verified or user disabled
        A->>U: HTTP ERROR response
    else Email verified and user not disabled
        A->>A: Verify Signed challenge
        opt
            A->>A: Update authenticator
        end
        A->>-U: HTTP OK response
        Note left of A: Refresh token + access token
    end
```
