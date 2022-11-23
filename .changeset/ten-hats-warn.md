---
'hasura-auth': patch
---

Don't fail WorkOS transformation when the user profile is incorrect

When not configuring WorkOS correctly, the `raw_attributes` of the user profile could be null. This fix avoids returning an error when accessing properties of this object that would be null.
