# Differences in the SDK

- There is no auto login feature in the new a SDK, users need to implement it now
- the old sdk used graphql.request the new one uses graphql.post
- signin/signup with webauthn used to be one method
- when signup returns an empty response it means the user needs to verify its email this information was hidden from users who used the `@nhost/react package`
- need to sync session between tabs
- session.user has no activeMfaType property
- the methods on the new sdk throw errors instead of returning them
- methods on the new sdk returns the whole response not just the data in the body
