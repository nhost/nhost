# Sign up and sign in users with Webauthn using strong authenticator

## Sign up

**User can sign up multiple times with same email but with different authenticators.
Authenticators can be different devices (Smartphone, Laptop, Browser) or different strong authenticators (Fingerprint, Face ID, Yubi key, etc) on same device.**

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