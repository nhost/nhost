---
'@nhost/client': minor
---

## Stable authentication state

Until now, the Nhost SDK authentication state and its context (access Token, refresh token...) was not held with a reliable system, ending in unconsistencies e.g. [#189](https://github.com/nhost/nhost/issues/189), [#202](https://github.com/nhost/nhost/issues/202), [#186](https://github.com/nhost/nhost/issues/186), [#195](https://github.com/nhost/nhost/issues/195).
The `@nhost/client` handles authentication state as a finite state machine with [xstate](https://github.com/statelyai/xstate). Xstate is framework agnostic and the authentication state will be easily plugable in most reactive frameworks such as React, Vue and Svelte.
