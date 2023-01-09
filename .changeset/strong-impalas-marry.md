---
'hasura-auth': patch
---

Improve the logging of SMTP errors

When an email could not be sent, the logs where too limited. As a result, it was not possible to know the reason why emails could not be sent, nor knowing why hasura-auth was returning an HTTP 500 error.

When an email can't be sent, hasura-auth now adds two more lines to the logs before the standard http log row:

```json
{"address":"127.0.0.1","code":"ESOCKET","command":"CONN","errno":-61,"level":"warn","message":"SMTP error","port":1026,"syscall":"connect"}
{"level":"warn","message":"SMTP error context","template":"email-verify","to":"bob@sponge.com"}
{"latencyInNs":271000000,"level":"error","message":"POST /signup/email-password 500 271ms","method":"POST","statusCode":500,"url":"/signup/email-password"}
```
