## Change password

```mermaid
sequenceDiagram
	autonumber
	actor U as User
	participant A as Hasura Auth
	U-->A: Sign in
	U->>+A: HTTP POST /user/password
	Note right of U: new password
	A->>-U: HTTP POST OK (no data)
```
