# Change password

```mermaid
sequenceDiagram
	autonumber
	actor U as User
	participant A as Hasura Auth
    opt Authenticated user
    	U-->A: Sign in
	    U->>+A: HTTP POST /user/password
	    Note right of U: new password
	    A->>-U: HTTP POST OK (no data)
    end
    opt Using ticket
	    U->>+A: HTTP POST /user/password
	    Note right of U: new password with ticket
	    A->>-U: HTTP POST OK (no data)
    end
```
