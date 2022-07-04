# Sign up and sign in users with Webauthn using strong authenticator

User can sign up with webauthn only if email verification is disabled. When email verification is enabled, user must verify it's email, login via password, magic link or ther credentials and then add webauthn authenticator via `/user/webauthn/add` endpoint instead. After that user can sign in using the webauthn authenticator.

## Sign up

```mermaid
sequenceDiagram
	autonumber
	actor U as User
	participant A as Hasura Auth
	participant G as Face ID/Fingerprint/Other
	U->>+A: HTTP POST /signup/webauthn
    opt No user found
		A->>A: Create user
	end
    opt Email verification
		A->>A: Send email verification if required
	end
    opt Check disabled
        A->>A: Check if user is disabled
    end
    alt User exists, email not verified or user disabled
        A->>U: HTTP ERROR response
    else 
        A->>-U: HTTP OK response
        Note left of A: Challenge
    end
    opt Verify user
        U->>+G: Sign Challenge
        G->>-G: Verfiy user 
        G->>U: 
        Note left of G: Signed Challenge 
    end
    U->>+A: HTTP POST /signup/webauthn/verify
    Note left of A: Signed challenge
    A->>A: Verify Signed challenge
    opt New authenticator
		A->>A: Save authenticator
	end
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

## Adding authenticator to user

Users can add multiple authenticators, for example when they need to login from multiple devices or browsers. To do that, they should have a valid session.

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