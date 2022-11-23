---
'hasura-auth': patch
---

Try the first characters of the Oauth user profile's locale

Some Oauth providers returns locales. But it can be `en-GB` whereas hasura-auth only accepts locales coded in two characters.
It now tries to validate the two first characters of the user profile locale against the list of allowed locales.
