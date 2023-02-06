---
'@nhost/hasura-auth-js': patch
---

Set limits to refreshing the token on error

When starting, the client was trying to refresh the token five times every second, then indefinitely every five seconds.
It is now limited to 5 attempts at the following intervals: 1, 2, 4, 8, and 16 seconds. If all these attempts fail, the user state is signed out.

Similarly, when refreshing the token failed, the client was attempting to refresh the token every second.
It is now limited to 5 attempts at the following intervals: 1, 2, 4, 8, and 16 seconds.
