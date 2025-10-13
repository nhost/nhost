# Sign up and sign in users with email and password

## Sign up

```mermaid
sequenceDiagram
	autonumber
	actor U as User
	participant A as Hasura Auth
	participant E as SMTP server
	participant F as Frontend
	U->>+A: HTTP POST /signup/email-password
	A->>A: Create user
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
		opt
			U->>+A: HTTP POST /token
			A->>-U: HTTP OK response
			Note left of A: Refresh token + access token
		end
	end
```

## Sign in

```mermaid
sequenceDiagram
	autonumber
	actor U as User
	participant A as Hasura Auth
	participant G as Authenticator/Authy
	U->>+A: HTTP POST /signin/email-password
	alt No MFA
		A->>U: HTTP OK response
		Note left of A: Refresh + access tokens
	else User activated MFA
		A->>-U: HTTP OK response
		Note left of A: MFA code
		U->>+G: Ask for a TOTP code
		G->>-U: &nbsp;
		U->>+A: HTTP POST /signin/mfa/totp
		Note right of U: TOTP code
		A->>-U: HTTP OK reponse
		Note left of A: Refresh token + access token
	end
```

## Activate Multi-Factor Authentication

It is possible to add a step to authentication with email and password authentication. Once users registered, they can activate MFA TOTP:

1. Users generate a QR Code, that is then scanned in an authentication app such as [Authy](https://authy.com/) or [Google Authenticator](https://en.wikipedia.org/wiki/Google_Authenticator).
2. They then send the TOTP code to Hasura Auth. MFA is now activated
3. Next time they authenticate, Hasura Auth will first expect their email and password, but then, instead of completing authentication, Hasura Auth will expect the TOTP in order to return the refresh and the access tokens.

In order for users to be able to activate MFA TOTP, the `AUTH_MFA_ENABLED` environment variable must be set to `true`.

```mermaid
sequenceDiagram
	autonumber
	actor U as User
	participant A as Hasura Auth
	participant G as Authenticator/Authy
	U-->A: Sign in
	U->>+A: HTTP GET /mfa/totp/generate
	A->>-U: HTTP OK response
	Note left of A: QR code as Data URL + TOTP secret
	U->>+G: Add account
	G->>-U: TOTP code
	U->>+A: HTTP POST /user/mfa
	Note right of U: TOTP code
	A->>A: Activate MFA
	A->>-U: HTTP OK response
```
