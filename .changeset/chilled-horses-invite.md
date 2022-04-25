---
'@nhost/react': patch
'@nhost/nextjs': patch
---

Remove filtering of `useLayoutEffect` from logs
The `suppressConsoleMessage` method was meant to suppress incorrect `useLayoutEffect` messages raised on Nextjs server-side renderings. Its implementation had an impact on the normal functionning of logging (see [#447](https://github.com/nhost/nhost/issues/447)).
This filtering was necessary when using former versions of xstate and can now be removed.
