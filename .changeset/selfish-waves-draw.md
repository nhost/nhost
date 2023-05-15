---
'hasura-auth': minor
---

chore: migrate `refresh_token` column to `id`

⚠️ **Warning**: This is a breaking change.

We've renamed the `refresh_token` column to `id`. While this change will improve the functionality of Hasura Auth, it may cause issues for any permissions or relationships that were using the old `refresh_token` column.

Please note that any permissions or relationships that were using the `refresh_token` column will be affected by this change. If you're using the `refresh_token` column in any way, you'll need to update your code to use the new `id` column and ensure that your app works as expected.
