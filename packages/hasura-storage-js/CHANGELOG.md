# @nhost/hasura-storage-js

## 2.7.0

### Minor Changes

- 5c6ff6e: fix: correct StorageErrorPayload TypeScript typing

## 2.6.0

### Minor Changes

- 4148964: fix: stack overflow on storage client getHeaders method call

## 2.5.1

### Patch Changes

- 8512a7f: fix: fix types StorageGetUrlParams and StorageGetPresignedUrlParams to include missing StorageHeadersParam

## 2.5.0

### Minor Changes

- 304065a: feat: add `setHeaders` method enabling global configuration of storage, graphql, and functions client headers, alongside added support for passing specific headers with individual calls

## 2.4.0

### Minor Changes

- 2505b2e: fix: fix headers sent with getPresignedUrl

## 2.3.0

### Minor Changes

- d3d1424: feat: Add support for authenticated download of files

### Patch Changes

- e5bab6a: chore: update dependencies

## 2.2.6

### Patch Changes

- 8d91f71: chore: update deps and enable pnpm audit

## 2.2.5

### Patch Changes

- 4fe4a1696: - accept FormData exported from [`form-data`](https://www.npmjs.com/package/form-data) as LegacyFormData
  - accept native FormData available on node18 and above
  - call native fetch available on node18 and above when running on [EdgeRuntime](https://edge-runtime.vercel.app/)

## 2.2.4

### Patch Changes

- 83fee5446: fix(hasura-storage-js): swap fetch when running on edge runtime

## 2.2.3

### Patch Changes

- 39de0063b: fix(hasura-storage-js): fix upload response status code check

## 2.2.2

### Patch Changes

- 300e3f49e: fix(hasura-storage-js): fix file upload formData field

## 2.2.1

### Patch Changes

- d54e4cdd4: fix(buckets): allow using custom buckets for upload

## 2.2.0

### Minor Changes

- 2cdb13b3e: fix(upload): allow specifying `id` and `name` only when not using `form-data`

## 2.1.6

### Patch Changes

- 1d04ad630: chore(deps): use `fetch-ponyfill` instead of `isomorphic-unfetch`

## 2.1.5

### Patch Changes

- 4c00a796e: fix(upload): don't break upload in Node 18

## 2.1.4

### Patch Changes

- aa3c62989: chore(cli): bump Nhost CLI version to v1.0

## 2.1.3

### Patch Changes

- 7fea29a8: fix: update `types` config and fix the exposed React components

## 2.1.2

### Patch Changes

- da03bf39: chore(build): change build target to ES2019

## 2.1.1

### Patch Changes

- 90c60311: chore(deps): add `types` to `package.json`

## 2.1.0

### Minor Changes

- a0e093d7: fix(exports): don't use conflicting names in exports

### Patch Changes

- bb8803a1: fix(presigned-url): don't alter URL when no transformation params were provided

## 2.0.5

### Patch Changes

- 43c86fef: chore: improve presignedUrl test

## 2.0.4

### Patch Changes

- 614f213e: fix(hasura-storage-js): allow image transformation parameters in `getPresignedUrl`

## 2.0.3

### Patch Changes

- 889ee658: added tests
- 850a049c: chore(deps): update docker/build-push-action action to v4

## 2.0.2

### Patch Changes

- 4bf40995: chore(deps): bump `typescript` to `4.9.5`
- 8bb097c9: chore(deps): bump `vitest`
- 35d52aab: chore(deps): replace `cross-fetch` with `isomorphic-unfetch`

## 2.0.1

### Patch Changes

- 445d8ef4: fix(hasura-storage-js): fix forbidden error when uploading

## 2.0.0

### Major Changes

- 19b11d40: Remove the deprecated `nhost.storage.getUrl` method

  Use `nhost.storage.getPublicUrl` instead.

- 80bbd3a1: Replace `axios` by `cross-fetch`

  `@nhost/hasura-storage-js` now uses `cross-fetch` instead of `axios`.
  When in a browser, it uploads files using `XMLHttpRequest` to be able to track upload progress (feature available in React and Vue)

  **Breaking Changes**

  The error returned in `const { error } = nhost.storage.upload()` is not a JavaScript `Error`, but an object of type `{ error: string; status: number; message: string}`.

## 1.13.2

### Patch Changes

- 5013213b: chore(deps): update dependency @nhost/docgen to 0.1.6

## 1.13.1

### Patch Changes

- 200e9f77: chore(deps): update dependency @types/react-dom to v18.0.10

## 1.13.0

### Minor Changes

- 83e0a4d3: Image transformation parameters

  It is now possible to pass on image transformation parameters in `nhost.storage.getPublicUrl()`.
  Available parameters:

  - height
  - width
  - blur
  - quality

  For instance:

  ```ts
  const url = nhost.storage.getPublicUrl({
    fileId: 'cd8eaca3-30a9-460e-b4d7-b4b7afc759c1',
    width: 800,
    blur: 20
  })
  ```

### Patch Changes

- 13876ed5: Convert non ISO-8859-1 file names

  It is now possible to upload files with names that are not ISO-8859-1 compliant.
  In that case, file names will be converted using `encodeURIComponent`.

## 1.12.1

### Patch Changes

- 85683547: Allow `useFileUpload` to be reused
  Once a file were uploaded with `useFileUpload`, it was not possible to reuse it as the returned file id were kept in memory and sent again to hasura-storage, leading to a conflict error.
  File upload now makes sure to clear the metadata information from the first file before uploading the second file.

## 1.12.0

### Patch Changes

- b21222b3: chore(deps): update dependency @types/node to v16

## 0.8.0

### Minor Changes

- 57db5b83: Refactor: remove dependency to `@nhost/core`

## 0.7.4

### Patch Changes

- 66b4f3d0: Bump axios to v1.2.0
- Updated dependencies [66b4f3d0]
- Updated dependencies [2e6923dc]
  - @nhost/core@0.9.4

## 0.7.3

### Patch Changes

- Updated dependencies [f2aaff05]
  - @nhost/core@0.9.3

## 0.7.2

### Patch Changes

- 996e8016: Bump Axios to v1.1.3
- Updated dependencies [996e8016]
- Updated dependencies [996e8016]
- Updated dependencies [869e7253]
- Updated dependencies [996e8016]
  - @nhost/core@0.9.2

## 0.7.1

### Patch Changes

- Updated dependencies [6b9d163e]
  - @nhost/core@0.9.1

## 0.7.0

### Patch Changes

- ba785da1: Bump dependencies versions
- Updated dependencies [13c41fe6] [ba785da1] [3ced63ab]
- Updated dependencies
  - @nhost/core@0.9.0

## 0.6.2

### Patch Changes

- Updated dependencies [8e4d790b]
  - @nhost/core@0.8.0

## 0.6.1

### Patch Changes

- Updated dependencies [9eb78e06]
  - @nhost/core@0.7.7

## 0.6.0

### Minor Changes

- 607c457f: nhost.storage.upload() now works in NodeJS (server) using FormData.

## 0.5.3

### Patch Changes

- 10beea72: Fix React Native build: Export `package.json` for all npm packages.
- Updated dependencies [747aa969]
- Updated dependencies [10beea72]
  - @nhost/core@0.7.6

## 0.5.2

### Patch Changes

- Updated dependencies [197d1d5c]
  - @nhost/core@0.7.5

## 0.5.1

### Patch Changes

- Updated dependencies [6eaa5c79]
  - @nhost/core@0.7.4

## 0.5.0

### Minor Changes

- 4f928756: Extend file upload parameters

  - `bucketId` is available everywhere as an option
  - It is possible to pass files as a parameter on a multiple `upload`, making the `add` action optional.
  - The `add` and `upload` actions of multiple file upload accepts both a `File`, an array of `File` items, and a `FileList`

## 0.4.0

### Minor Changes

- f9854b15: Upload multiple files with `useMultipleFilesUpload`
- f9854b15: `useFileUpload`: keep track of upload progress and cancel upload

### Patch Changes

- Updated dependencies [f9854b15]
- Updated dependencies [f9854b15]
  - @nhost/core@0.7.3

## 0.3.4

### Patch Changes

- dbc10e62: fixed `exports` field to support imports in a server-side environment

## 0.3.3

### Patch Changes

- ebad0936: reverted ESM related changes

## 0.3.2

### Patch Changes

- 1b37b9f6: fix: ESM import path fixes

## 0.3.1

### Patch Changes

- 78341491: fix: Next.js and React issues with ESM packages
  chore: Updated output bundle names

## 0.3.0

### Minor Changes

- 858014e4: New `adminSecret` option
  It is now possible to add a new adminSecret when creating a Nhost client. When set, it is sent as an `x-hasura-admin-secret` header for all GraphQL, Storage, and Serverless Functions requests.

### Patch Changes

- bc11c9e5: chore: Changed copy script to support Windows
  fix: Fixed warnings about unknown globals occurring while building the packages
- 2b2f8e91: fix: ESM related issues in Node environments
  chore: Improved the way different formats are exposed via `exports` field in package.js

## 0.2.2

### Patch Changes

- e094e68: chore: bump axios from 0.26.0 to 0.27.2
  fix: add Content-Type to file upload request headers

## 0.2.1

### Patch Changes

- 584976d: - publishable directory structure changes (ESM, CJS and UMD included in the output)
  - build system improvements
  - fixed some bundling concerns (https://github.com/nhost/nhost/issues/428)

## 0.2.0

### Minor Changes

- 744fd69: Unify vanilla, react and next APIs so they can work together
  React and NextJS libraries now works together with `@nhost/nhost-js`. It also means the Nhost client needs to be initiated before passing it to the React provider.
  See the [React](https://docs.nhost.io/reference/react#configuration) and [NextJS](https://docs.nhost.io/reference/nextjs/configuration) configuration documentation for additional information.

## 0.1.0

### Minor Changes

- ff7ae21: Introducing `setAdminSecret` to allow users of the SDK to use `x-hasura-admin-secret` request header in storage related functions

## 0.0.12

### Patch Changes

- 8f7643a: Change target ES module build target to es2019
  Some systems based on older versions of Webpack or Babel don't support the current esbuild configuration e.g, [this issue](https://github.com/nhost/nhost/issues/275).

## 0.0.11

### Patch Changes

- 35f0ee7: Rename `storage.getUrl` to `storage.getPublicUrl`
  It aims to make a clear distinction between `storage.getPublicUrl` and `storage.getPresginedUrl`
  `storage.getUrl` is now deprecated.

## 0.0.10

### Patch Changes

- c8f2488: build npm package with esbuild instead of vite. Vite does not build isomorphic packages correctly, in particular the dependency to axios

## 0.0.9

### Patch Changes

- 2e1c055: Axios causes some trouble when used NodeJS / CommonJS. Any code importing `axios` now does so in using the `require()` syntax

## 0.0.8

### Patch Changes

- 03562af: Build in CommonJS and ESM instead of UMD and ESM as the UMD bundle generated by the default Vite lib build mode doesn't work with NodeJS

## 0.0.7

### Patch Changes

- 7c3a7be: Remove http timeout options (fix[#157](https://github.com/nhost/nhost/issues/157))
  This new release also comes up with both ESM and CommonJS distributions and solves [#151](https://github.com/nhost/nhost/issues/151)
