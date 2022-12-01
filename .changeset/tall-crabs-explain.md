---
'hasura-auth': patch
---

Ability to set test phone numbers for phone auth

This can be used without any provider set. When sign in via phone auth using a test phone number is invoked **the SMS message with the verification code will be available trough the logs**. 
This way you can also test your SMS templates.