# Security Keys with WebAuthn

Auth implements the WebAuthn protocol to sign in with security keys, also referred as authenticators in the WebAuthn protocol.

A user needs first to sign up with another method, for instance email+password, passwordless email or Oauth, then to add their security key to their account.

Once the security key is added, it is then possible to sign in with it, using the email as a username.

## Sign up

The overall WebAuthn sign up workflow is similar to the email + password sign up workflow: after the user completed the registration of their email and security key, it will return the session, unless the email needs to be verified first. In this latter case, a verification email is sent, and the user is finally able to sign up once the email link is clicked and processed.

```mermaid
sequenceDiagram
	autonumber
	actor U as User
	participant A as Hasura Auth
	participant E as SMTP server
	participant G as Face ID/Fingerprint/Other
	participant F as Frontend
	U->>A: HTTP POST /signup/webauthn
    activate A
	A->>A: Create a tentative user
    A->>U: HTTP OK response
    deactivate A
    Note left of A: Challenge

    U->>G: Sign Challenge
    activate G
    G->>G: Sign
    G->>U: Success
    deactivate G
    Note left of G: Signed Challenge
    U->>A: HTTP POST /user/webauthn/verify
    activate A
    Note left of A: Signed challenge
    A->>A: Verify Signed challenge
	A->>A: Add security key
	A->>A: Set user data

	alt No email verification
    	A->>U: HTTP OK response
		Note left of A: Refresh token + access token
	else Email needs to be verified
		A->>A: Generate ticket
		A-)E: Send verification email
		A->>-U: HTTP OK response (no data)
		E-)U: Receive email
		U->>+A: HTTP GET /verify
		Note right of U: Follow email link
		A->>A: Flag user email as verified
		A->>-F: HTTP redirect with refresh token
		activate F
		F->>-U: HTTP OK response
        Note left of A: Refresh token + access token
	end
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
    U->>+G: Sign Challenge
    G->>G: Sign
    G->>-U: Success
    Note left of G: Signed Challenge
    U->>+A: HTTP POST /signin/webauthn/verify
    Note left of A: Signed challenge
    A->>A: Check if email is verified
    A->>A: Check if user is enabled
    alt Email not verified or user disabled
        A->>U: HTTP ERROR response
    else Email verified and user enabled
        A->>A: Verify Signed challenge
        opt
            A->>A: Update security key
        end
        A->>-U: HTTP OK response
        Note left of A: Refresh token + access token
    end
```

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
    U->>+G: Sign Challenge
    G->>G: Sign
    G->>-U: Success
    Note left of G: Signed Challenge
    U->>+A: HTTP POST /user/webauthn/verify
    Note left of A: Signed challenge
    A->>A: Verify Signed challenge
	A->>A: Add security key
    A->>-U: HTTP OK response
    Note left of A: Refresh token + access token
```
