# Reset password

```mermaid
sequenceDiagram
	autonumber
	actor U as User
	participant A as Hasura Auth
	participant E as SMTP server
	participant F as Frontend
	U->>+A: HTTP POST /user/password/reset
	Note right of U: new email
	A->>A: Generate ticket
	A-)E: Send verification email
	A->>-U: HTTP POST OK (no data)
	E-)U: Receive email
	U->>+A: HTTP GET /verify
	Note right of U: Follow email link
	A->>+F: HTTP redirect
	deactivate A
	F->>-U: HTTP OK response
	Note left of A: Refresh token + access token
```
