---
'@nhost/hasura-auth-js': patch
---

remove `nhost.auth.verifyEmail`
Theres's a /verify endpoint in hasura-auth, but the sdk is not even using it as 
1. the user follows the /verify link in the email
2. hasura-auth validates the link, attaches the token and redirects to the frontend
3. the sdk gets the refresh token from the url
4. the sdk consumes the refresh token
