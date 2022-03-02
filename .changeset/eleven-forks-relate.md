---
'@nhost/react-auth': patch
---

Correct Nhost context type
`const { user } = useNhostAuth()`: user type was `null`. It is now `User | null`.
