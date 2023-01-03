---
'@nhost/hasura-storage-js': minor
---

Image transformation parameters

It is now possible to pass on image transformation parameters in `nhost.storage.getPublicUrl()`.
Available parameters:

- height
- width
- blur

For instance:

```ts
const url = nhost.storage.getPublicUrl({
  fileId: 'cd8eaca3-30a9-460e-b4d7-b4b7afc759c1',
  width: 800,
  blur: 20
})
```
