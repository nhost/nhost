# @nhost/dashboard

## 0.9.4

### Patch Changes

- dbd3ded5: fix(dashboard): workspaces creation, new form, correct redirects.

## 0.9.3

### Patch Changes

- 85f0f943: fix(dashboard): don't break the table creation process

## 0.9.2

### Patch Changes

- Updated dependencies [d42c27ae]
- Updated dependencies [927be4a2]
  - @nhost/nextjs@1.13.1
  - @nhost/react-apollo@4.13.1

## 0.9.1

### Patch Changes

- d0f80811: fix(dashboard): don't show error when signing out the user

## 0.9.0

### Minor Changes

- d92891b2: feat(dashboard): add Permission Editor to the Database section

### Patch Changes

- 3d379128: fix(dashboard): create new user
  - @nhost/react-apollo@4.13.0
  - @nhost/nextjs@1.13.0

## 0.8.1

### Patch Changes

- 7cadd944: fix(dashboard): display Twitter provider settings

## 0.8.0

### Minor Changes

- 9a1aa7bb: add functions to the log dashboard
- f29abe62: feat(dashboard): Users Management v2

### Patch Changes

- 7766624b: feat(dashboard): add JWT secret editor modal
  - @nhost/react-apollo@4.12.1
  - @nhost/nextjs@1.12.1

## 0.7.13

### Patch Changes

- dd0738d5: fix(dashboard): provisioning status polling

## 0.7.12

### Patch Changes

- b21222b3: chore(deps): update dependency @types/node to v16
- 9e0486a3: fix(dashboard): close modals when navigating
- Updated dependencies [b21222b3]
- Updated dependencies [65687bee]
- Updated dependencies [54df0df4]
  - @nhost/nextjs@1.12.0
  - @nhost/react-apollo@4.12.0

## 0.7.11

### Patch Changes

- d6527122: fix(dashboard): use correct service URLs

## 0.7.10

### Patch Changes

- Updated dependencies [57db5b83]
  - @nhost/nextjs@1.11.0
  - @nhost/nhost-js@1.7.0
  - @nhost/react@0.17.0
  - @nhost/react-apollo@4.11.0

## 0.7.9

### Patch Changes

- a6d31dc2: fix(dashboard): don't break the UI when project is not loaded yet

## 0.7.8

### Patch Changes

- 7f251111: Use `NhostProvider` instead of `NhostReactProvider` and `NhostNextProvider`

  `NhostReactProvider` and `NhostNextProvider` are now deprecated

- f4d70f88: fix(dashboard): do not break when region is nullish
- 4a9471cc: Windows Live Provider displayed link updated to match backend url
- 594488e4: fix(dashboard): do not show error when submitting Apple provider settings
- Updated dependencies [7f251111]
  - @nhost/nextjs@1.10.0
  - @nhost/react@0.16.0
  - @nhost/react-apollo@4.10.0

## 0.7.7

### Patch Changes

- 80b604ad: fix(dashboard): use correct Hasura slug

## 0.7.6

### Patch Changes

- 2d2beb53: fix(dashboard): prevent error on GraphQL page
- ac8efcbd: chore(dashboard): deprecate old DNS name

## 0.7.5

### Patch Changes

- 132a4f4b: chore(dashboard): remove unused dependencies
- 132a4f4b: chore(deps): synchronize @types/react-dom and @types/react versions
- db57572f: fix(dashboard): correct section paddings when no env vars
- Updated dependencies [132a4f4b]
  - @nhost/react@0.15.2
  - @nhost/react-apollo@4.9.2
  - @nhost/nextjs@1.9.3

## 0.7.4

### Patch Changes

- 34d85e54: chore(deps): update dependency critters to ^0.0.16
- 9b93cf95: chore(deps): update dependency @netlify/functions to ^0.11.0
- e0439030: chore(deps): update dependency @types/react-dom to v18.0.9
- Updated dependencies [82124329]
  - @nhost/nextjs@1.9.2

## 0.7.3

### Patch Changes

- a1193da4: fix(dashboard): remove character limit from env var inputs

## 0.7.2

### Patch Changes

- 44f13f62: chore(dashboard): cleanup unused files

## 0.7.1

### Patch Changes

- e01cb2ed: chore(dashboard): change settings sidebar menu item density

## 0.7.0

### Minor Changes

- db342f45: chore(dashboard): refactor Roles and Permissions settings sections
- 8b9fa0b1: feat(dashboard): add Environment Variables page

### Patch Changes

- Updated dependencies [66b4f3d0]
- Updated dependencies [2e6923dc]
- Updated dependencies [ef117c28]
- Updated dependencies [aebb8225]
  - @nhost/core@0.9.4
  - @nhost/nhost-js@1.6.2
  - @nhost/nextjs@1.9.1
  - @nhost/react@0.15.1
  - @nhost/react-apollo@4.9.1

## 0.6.0

### Minor Changes

- eef9c914: feat(dashboard): add Roles and Permissions page

## 0.5.0

### Minor Changes

- a48dd5bf: feat(dashboard): make backend port configurable

## 0.4.3

### Patch Changes

- 5de965d9: fix(dashboard): alphabetic ordering of providers
- b9087a4a: fix(dashboard): console -> dashboard terminology
- ca012d79: docs(workos): WorkOS Docs

## 0.4.2

### Patch Changes

- 89bd37bc: fix(dashboard): correct redirect URL input opacity
- Updated dependencies [4601d84e]
- Updated dependencies [843087cb]
  - @nhost/react@0.15.0
  - @nhost/nextjs@1.9.0
  - @nhost/react-apollo@4.9.0

## 0.4.1

### Patch Changes

- 766cb612: fix(dashboard): correct redirect URL for oauth providers
- Updated dependencies [53bdc294]
- Updated dependencies [f2aaff05]
  - @nhost/nextjs@1.8.3
  - @nhost/core@0.9.3
  - @nhost/react@0.14.3
  - @nhost/nhost-js@1.6.1
  - @nhost/react-apollo@4.8.3

## 0.4.0

### Minor Changes

- 9211743d: feat(dashboard): migrate Settings page features

## 0.3.0

### Minor Changes

- 73da6a67: fix(dashboard): avoid using BACKEND_URL locally

## 0.2.0

### Minor Changes

- db118f97: feat(dashboard): generate Docker image
