---
'@nhost/core': patch
---

Fix invalid password and email errors on sign up
When signin up, an invalid password was returning the `invalid-email` error, and an invalid email was returning `invalid-password`.
This is now in order.
