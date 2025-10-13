# Passwordless with emails (magic links)

```mermaid
sequenceDiagram
	autonumber
	actor U as User
	participant A as Hasura Auth
	participant E as SMTP server
	participant F as Frontend
	U->>+A: HTTP POST /signin/passwordless/email
	opt No user found
		A->>A: Create user
	end
	A->>A: Generate ticket
	A-)E: Send verification email
	A->>-U: HTTP POST OK (no data)
	E-)U: Receive email
	U->>+A: HTTP GET /verify
	Note right of U: Follow email link
	A->>A: Flag user email as verified
	A->>+F: HTTP redirect with refresh token
	deactivate A
	F->>-U: HTTP OK response
	opt
		U->>+A: HTTP POST /token
		A->>-U: HTTP OK response
		Note left of A: Refresh token + access token
	end
```
