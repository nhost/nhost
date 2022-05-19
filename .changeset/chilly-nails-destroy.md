---
'@nhost/core': patch
---

Move the event payload validation away from the state, but into services and context
Field validation was reflected in a substate in the auth machine. It did not bring clear added value as information about errors were already stored in the machine context, while it complexified the machine definition.
The `error` state is now childless, while field validation occurs in the corresponding services.
