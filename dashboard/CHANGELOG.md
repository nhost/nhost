# @nhost/dashboard

## 2.17.0

### Minor Changes

- fd59918: fix: redirect to 404 with nhost cli dashboard

## 2.16.0

### Minor Changes

- f8e6b61: fix: can add rule groups in table permissions
- 9e404c8: fix: not redirect to 404 page if using local Nhost backend
- ac4aa01: fix: can delete column in database page
- 4385524: fix: update url to check service health in local dashboard

### Patch Changes

- @nhost/react-apollo@16.0.1
- @nhost/nextjs@2.2.2

## 2.15.0

### Minor Changes

- f1052a8: fix: improve stability of the dashboard when pausing projects
- 30daa41: fix: update links to docs in overview page
- 7537237: feat: add image preview toggle in storage

## 2.14.0

### Minor Changes

- d43931e: fix: invalid organization slug/project subdomain doesn't open 404 page
- 5df6fa2: feat: add unencrypted disk warning in storage capacity settings

### Patch Changes

- 44c1e17: chore: update `msw` to v1.3.5 to fix vulnerabilities
  - @nhost/react-apollo@16.0.0
  - @nhost/nextjs@2.2.1

## 2.13.0

### Minor Changes

- 21e90da: chore: remove restrictions on SMTP sender so My Name <name@acme.com> can be added
- 865dd93: fix: duplicate Run placeholders when there is an error in the backend
- 6902a36: fix: can remove resources if postgres capacity is higher than 10
- a535aa3: fix: fetch user roles locally in auth section
- 0c50816: fix: allow decimal numbers in database row insert
- aea6d18: chore: add warning when pausing a project about losing Run services persistent volume data
- d3b4fc3: feat: allow to change postgres settings if project is paused
- 29d27e1: chore: update `next` to v14.2.22 to fix vulnerabilities
- c9dca09: feat: add reset password form
- b3bcacb: fix: paused project banner cannot read null project name

### Patch Changes

- Updated dependencies [46fc520]
- Updated dependencies [29d27e1]
  - @nhost/nextjs@2.2.0
  - @nhost/react-apollo@15.0.1

## 2.12.0

### Minor Changes

- eb95562: fix: show all available permission variables in permission dropdown select

### Patch Changes

- 8b5c4a0: chore: cleanup layout and add disable duplicate atom key checking in development mode

## 2.11.3

### Patch Changes

- 714dffa: fix: improve project polling logic and unify usage across components

## 2.11.2

### Patch Changes

- 6a34f89: fix: improve project polling logic and unify usage across components

## 2.11.1

### Patch Changes

- 0f6ce52: fix: consolidate useProject hook and fix jwt expired error

## 2.11.0

### Minor Changes

- cea3ef5: Feat: add org and project placeholders

## 2.10.0

### Minor Changes

- 86ecf27: feat: add support for additional metrics in overview
- 21708be: feat: dashboard: add support for storage buckets to AI assistants

## 1.30.0

### Minor Changes

- 50441a8: feat: add ui for project autoscaler settings and run services autoscaler settings

## 1.29.0

### Minor Changes

- 55d8bb5: feat: integrate turnstile for signup verification
- 2a2e54c: fix: update docs url in run services form tooltip
- 18f942f: fix: display long error messages in error toast without overflow

### Patch Changes

- @nhost/react-apollo@13.0.0
- @nhost/nextjs@2.1.22

## 1.28.2

### Patch Changes

- 52a38fe: chore: update dependencies to address security vulnerabilities
- Updated dependencies [52a38fe]
  - @nhost/nextjs@2.1.21

## 1.28.1

### Patch Changes

- 9735fa2: chore: remove broken link

## 1.28.0

### Minor Changes

- 526183a: feat: allow filtering users in "make request as" in graphql section
- be3b85b: feat: add conceal errors toggle on auth settings page

### Patch Changes

- 35a2f12: fix: prevent run service details from opening when attempting to delete
  - @nhost/react-apollo@12.0.6
  - @nhost/nextjs@2.1.20

## 1.27.0

### Minor Changes

- a7cd02c: fix: resolve rate limit query

## 1.26.0

### Minor Changes

- 3773ad7: chore: update pricing information
- b63250d: fix: not allow run service creation form resubmission while creating a run service
- a44a1d4: feat: add rate limits settings page

### Patch Changes

- @nhost/react-apollo@12.0.5
- @nhost/nextjs@2.1.19

## 1.25.0

### Minor Changes

- d1ceede: feat: add setting to migrate postgres major and/or minor versions
- e5d3d1a: fix: allow manually typing column for custom check in database row permissions

### Patch Changes

- @nhost/react-apollo@12.0.4
- @nhost/nextjs@2.1.18

## 1.24.1

### Patch Changes

- 49f2e55: fix: use service subdomain in service form and service details dialog
- 598b988: fix: use current project subdomain in ServiceDetailsDialog component

## 1.24.0

### Minor Changes

- abb24af: chore: add redirect to support page when project is locked
- 18a6455: feat: show contact us info and locked reason when project is locked

### Patch Changes

- e31eefa: fix: include ingresses field when updating run services

## 1.23.0

### Minor Changes

- 33284d3: fix: don't show double scrollbar in configuration editor

### Patch Changes

- @nhost/react-apollo@12.0.3
- @nhost/nextjs@2.1.17

## 1.22.0

### Minor Changes

- 998c037: fix: align drop-down list in select component
- 807b8c0: fix: show city name in region selection for project creation

## 1.21.0

### Minor Changes

- a2efeed: fix: improve project health error handling, add unknown state and polling interval for health state

## 1.20.0

### Minor Changes

- 8ea4210: fix: error toasts can be closed individually, instead of dismissing all toasts at once
- 58919ba: chore: add blink animation when project health service is updating

## 1.19.0

### Minor Changes

- b519862: fix: get configuration in configuration editor using local development environment

## 1.18.0

### Minor Changes

- 502abad: feat: add services health checks indicators to the overview page
- b3ff6ad: chore: update title text on service status modal
- dbadf59: feat: add project configuration TOML editor to the settings page

## 1.17.0

### Minor Changes

- 77fba27: fix: postgres version validation when activating ai in ai settings page
- ac6d1b6: feat: use name instead of awsName

## 1.16.3

### Patch Changes

- 87a37cf: fix: remove unnecessary isPlatform check from verify button disable logic on custom domains
  - @nhost/react-apollo@12.0.2
  - @nhost/nextjs@2.1.16

## 1.16.2

### Patch Changes

- a9413af: fix: update `GetAllWorkspacesAndProjects` query polling to use exponential backoff
  - @nhost/react-apollo@12.0.1
  - @nhost/nextjs@2.1.15

## 1.16.1

### Patch Changes

- @nhost/react-apollo@12.0.0
- @nhost/nextjs@2.1.14

## 1.16.0

### Minor Changes

- c6d5c5c: feat: add toggle switch to enable/disable public access in the database settings

## 1.15.2

### Patch Changes

- @nhost/react-apollo@11.0.4
- @nhost/nextjs@2.1.13

## 1.15.1

### Patch Changes

- @nhost/react-apollo@11.0.3
- @nhost/nextjs@2.1.12

## 1.15.0

### Minor Changes

- a7bde37: feat: send metadata in the edit form

### Patch Changes

- 1bc615b: feat: improve error message handling in `ErrorToast` component
  - @nhost/react-apollo@11.0.2
  - @nhost/nextjs@2.1.11

## 1.14.0

### Minor Changes

- a448d7d: feat: allow configuring postmark and delete SMTP settings

## 1.13.3

### Patch Changes

- 5924bc3: fix: include password in `GetSmtpSettings` query
- c5ad634: fix: resolved an issue where one-click install links were broken on Safari
- 7278991: fix: update graphql auto-embeddings configuration to use String type for model field

## 1.13.2

### Patch Changes

- 026f84f: fix: use configuration server URL from environment variable

## 1.13.1

### Patch Changes

- 7e9a2ce: fix: resolve issue where run services form fails to open

## 1.13.0

### Minor Changes

- dd5d262: feat: add model field to the auto-embeddings form
- 09962be: feat: enable settings and run services when running the dashboard locally
- 9cdecb6: feat: enable users to update their email address from the account settings page

## 1.12.2

### Patch Changes

- c195c51: fix: send email upon signin for unverified users

## 1.12.1

### Patch Changes

- 93ebdf8: fix: use service urls when initilizaing NhostClient running local dashboard
  - @nhost/react-apollo@11.0.1
  - @nhost/nextjs@2.1.10

## 1.12.0

### Minor Changes

- f242e4b: feat: add connect with github to the user's account settings
- 768ca17: chore: update dependencies
- d62bd0f: fix: "Track this" option within the SQL editor now correctly updates the metadata
- 91c2bb6: feat: refactor sign-in and sign-up pages to enforce email verification

### Patch Changes

- 943831f: fix: resolve an error toast issue when unpausing a project
- Updated dependencies [768ca17]
  - @nhost/react-apollo@11.0.0
  - @nhost/nextjs@2.1.9

## 1.11.2

### Patch Changes

- @nhost/react-apollo@10.0.2
- @nhost/nextjs@2.1.8

## 1.11.1

### Patch Changes

- 981404f: fix: set default value for healthCheck field validation

## 1.11.0

### Minor Changes

- 7789469: chore: upgrade dependency `@graphql-codegen/cli` to `5.0.2` to address vulnerability
- 6c11b75: feat: add update user displayName section in account settings

### Patch Changes

- @nhost/react-apollo@10.0.1
- @nhost/nextjs@2.1.7

## 1.10.0

### Minor Changes

- 49a80c2: chore: update dependencies
- 150c04a: feat: add healthcheck config to run services

### Patch Changes

- e03f141: fix: allow insert, update and delete on tables in `auth` and `storage` schemas
- 28676f4: feat: add min postgres version check to enable the ai service
- Updated dependencies [49a80c2]
  - @nhost/react-apollo@10.0.0
  - @nhost/nextjs@2.1.6

## 1.9.0

### Minor Changes

- d86e5c9: feat: add support for filtering the logs using a RegExp

## 1.8.3

### Patch Changes

- @nhost/react-apollo@9.0.3
- @nhost/nextjs@2.1.5

## 1.8.2

### Patch Changes

- 6df4f02: fix: use custom error toast and show correct message when sending an invite

## 1.8.1

### Patch Changes

- @nhost/react-apollo@9.0.2
- @nhost/nextjs@2.1.4

## 1.8.0

### Minor Changes

- 713d53c: feat: add catch-all route for workspace/project - useful for documentation

### Patch Changes

- 3db2999: fix: refresh table list after running SQL using the editor
- 3c4dd55: fix: handle `Error` objects properly in the `ErrorToast` component
- 92b434e: fix: resolve an issue where the checkbox in the data-grid header did not select all rows
  - @nhost/react-apollo@9.0.1
  - @nhost/nextjs@2.1.3

## 1.7.0

### Minor Changes

- 0d8d0eb: Update docs and dashboard references

## 1.6.9

### Patch Changes

- @nhost/react-apollo@9.0.0
- @nhost/nextjs@2.1.2

## 1.6.8

### Patch Changes

- @nhost/react-apollo@8.0.1
- @nhost/nextjs@2.1.1

## 1.6.7

### Patch Changes

- 5ef5189: fix: update `@apollo/client` to `3.9.4` to fix a cache bug

## 1.6.6

### Patch Changes

- 3ba485e: fix: added discord.com to connect-src
- e5bab6a: chore: update dependencies
- Updated dependencies [b19ffed]
- Updated dependencies [e5bab6a]
  - @nhost/nextjs@2.1.0
  - @nhost/react-apollo@8.0.0

## 1.6.5

### Patch Changes

- ba73bb4: fix: update ErrorToast component to show the internal graphql error
- d5337ff: fix: utilize accumulator in the creation of validation schema within data grid utils

## 1.6.4

### Patch Changes

- 7c2a1c2: feat: show error and debug info in the error toast

## 1.6.3

### Patch Changes

- 6b8aad5: fix: add bare nhost.run to CSP

## 1.6.2

### Patch Changes

- b18edc0: feat: added CSP and X-Frame-Options

## 1.6.1

### Patch Changes

- 8d91f71: chore: update deps and enable pnpm audit
- 3b8473b: chore: update turbo to `1.11.3` and pnpm to `8.10.5` in Dockerfile
- Updated dependencies [8d91f71]
  - @nhost/react-apollo@7.0.2
  - @nhost/nextjs@2.0.2

## 1.6.0

### Minor Changes

- 3ff1c2b53: fix: show upgrade option for pro projects

## 1.5.0

### Minor Changes

- c2ef17c0a: feat: add support for new Team plan

## 1.4.0

### Minor Changes

- 7883bbcbd: feat: don't show deprecated plans
- 44be6dc0a: feat: set redirectTo during sign-in to support preview environments

### Patch Changes

- 3c3594898: fix: allow access to graphite when configured running in local dashboard
- 32c246b7a: chore: update docs icon

## 1.3.2

### Patch Changes

- 174b4165b: chore: use env variables when running graphql codegen
- 7c977e714: chore: change `Allowed Roles` to `Default Allowed Roles`
- 46f028b9f: fix: remove hardcoded ai version setting

## 1.3.1

### Patch Changes

- af33c21d1: chore: remove backendUrl deprecation notice and remove all references to `providersUpdated`

## 1.3.0

### Minor Changes

- 04784d880: Fix graphite's default version

## 1.2.0

### Minor Changes

- 5733162ed: feat: add settings and ui for graphite

## 1.1.0

### Minor Changes

- e2b79b5ec: chore: remove sharp from deps

## 1.0.1

### Patch Changes

- @nhost/react-apollo@7.0.1
- @nhost/nextjs@2.0.1

## 1.0.0

### Major Changes

- bc9eff6e4: chore: remove support for using backendUrl when instantiating the Nhost client

### Patch Changes

- Updated dependencies [bc9eff6e4]
  - @nhost/nextjs@2.0.0
  - @nhost/react-apollo@7.0.0

## 0.21.1

### Patch Changes

- 97ced73a3: fix(dashboard): prevent dashboard from resolving secrets

## 0.21.0

### Minor Changes

- ed1a8d458: Update alert message on increasing PostgreSQL's volume capacity
- 2e2248fd4: feat(dashboard): add SQL editor

## 0.20.28

### Patch Changes

- 7c2c31082: feat: add support for users to delete their account
  - @nhost/react-apollo@6.0.1
  - @nhost/nextjs@1.13.40

## 0.20.27

### Patch Changes

- fa79b7709: chore(dashboard): tweaks and fixes to the service form and dialog
- 8df84d782: fix(dashboard): allow resetting custom domains
  - @nhost/react-apollo@6.0.0
  - @nhost/nextjs@1.13.39

## 0.20.26

### Patch Changes

- 331ba0376: feat(dashboard): add postgres storage capacity modifier in the settings
- b7f801874: feat(dashboard): add new settings page for custom domains

## 0.20.25

### Patch Changes

- @nhost/react-apollo@5.0.38

## 0.20.24

### Patch Changes

- e10389ecf: fix(dashboard): disable run tab when developing locally
  - @nhost/react-apollo@5.0.37

## 0.20.23

### Patch Changes

- c01568a7d: chore(dashboard): show alert to update oauth providers

## 0.20.22

### Patch Changes

- c3efb7ec8: feat(dashboard): query latest announcement from platform

## 0.20.21

### Patch Changes

- 3e46d3873: chore: update link to node18 announcement

## 0.20.20

### Patch Changes

- @nhost/react-apollo@5.0.36
- @nhost/nextjs@1.13.38

## 0.20.19

### Patch Changes

- 75c4c8ae3: feat(dashboard): make env value input multiline

## 0.20.18

### Patch Changes

- 425d485f8: fix(dashboard): make sure dedicated resources pricing follows total resources

## 0.20.17

### Patch Changes

- ae324f67f: fix(dashboard): remove unused graphql fields

## 0.20.16

### Patch Changes

- df5b4302c: chore(dashboard): remove run feature flag
- bf4a1f6c2: feat(dashboard): fetch auth, postgres, hasura and storage versions from dashboard
- 34fc08ca7: fix(dashboard/run): show correct private registry in service details
- 885d10620: chore(dashboard): change feedback to contact us

## 0.20.15

### Patch Changes

- ed16c8b5d: feat(run): add a confirmation dialog when deleting a run service
- 216990888: fix(run): center loading indicator when selecting a project

## 0.20.14

### Patch Changes

- 9fbea9787: feat: add node18 announcement

## 0.20.13

### Patch Changes

- e84acf469: fix(run): handle subdomain undefined error when creating a new service

## 0.20.12

### Patch Changes

- b7c799d62: feat(run): add dialog to copy registry and URLs

## 0.20.11

### Patch Changes

- 8903e6abd: fix(dashboard): show correct egress limit in usage stats

## 0.20.10

### Patch Changes

- 666a75a23: feat(dashboard): add functions execution time and egress volume to usage stats

## 0.20.9

### Patch Changes

- 5e1e80aa8: fix(dashboard): show correct locales in user details
  - @nhost/react-apollo@5.0.35
  - @nhost/nextjs@1.13.37

## 0.20.8

### Patch Changes

- @nhost/react-apollo@5.0.34
- @nhost/nextjs@1.13.36

## 0.20.7

### Patch Changes

- 4a7ede11e: fix: distinguish files that were not uploaded
- 202b64723: feat(nhost-run): add support for one-click-install run services
- 074a0fa11: feat(dashboard): add settings toggle to enable/disable antivirus
  - @nhost/react-apollo@5.0.33
  - @nhost/nextjs@1.13.35

## 0.20.6

### Patch Changes

- b20761e97: feat(services): add pricing info and confirmation dialog
- 90df6d81d: fix(services): handle null values when editing a service
- aa8508467: fix: query service logs correctly
  feat: enable multiline support for environment value input

## 0.20.5

### Patch Changes

- 8d7f84b8d: fix: make announcement adapt to theme

## 0.20.4

### Patch Changes

- 3b75bfce2: fix: make announcement close properly
- f49819075: fix: show correct values when dedicated resources are disabled

## 0.20.3

### Patch Changes

- e643bd362: fix(services): fix errors when config is null
- bcdab66bf: feat: add annoucement for nhost run
- f967a2e59: added note about storage not being able to be downsized
- 311c7756d: chore(services): consistent naming for compute

## 0.20.2

### Patch Changes

- 9073182d5: chore(dashboard): bump `turbo` to 1.10.11
- ece717d6e: feat(logs): show services in the logs page
- 82b335311: feat(metrics): change grafana link to point to the dashboards
- b135ef695: fix(services): set command as optional and set min replicas to 0

## 0.20.1

### Patch Changes

- 3d5c34f4c: fix(auth): fix users pagination limit

## 0.20.0

### Minor Changes

- c99d117d1: feat(services): add support for custom services

## 0.19.2

### Patch Changes

- face99ccd: chore(deps): bump turbo version
- cfe527307: style: tweak pull config warning in dark mode
- a9d7da8af: chore(deps): update dependency @types/pluralize to ^0.0.30
- 9aa4371ef: chore: add hasura-auth version 0.21.2
- d14e112bf: chore(deps): update dependency prettier-plugin-tailwindcss to ^0.4.0
- d3e8bb94a: chore(deps): update dependency vite-plugin-dts to v3

## 0.19.1

### Patch Changes

- @nhost/react-apollo@5.0.32
- @nhost/nextjs@1.13.34

## 0.19.0

### Minor Changes

- 9c61c69a7: chore(dashboard):add postgres 14.6-20230705-1 to the version selector

### Patch Changes

- 47bda15ff: feat(settings): add warning to pull config

## 0.18.0

### Minor Changes

- ee0b9b8ed: chore(dashboard):add hasura v2.28.2 and v2.29.0 to the version selector

## 0.17.20

### Patch Changes

- @nhost/react-apollo@5.0.31
- @nhost/nextjs@1.13.33

## 0.17.19

### Patch Changes

- f866120a6: fix(users): use the password length from the config

## 0.17.18

### Patch Changes

- @nhost/react-apollo@5.0.30
- @nhost/nextjs@1.13.32

## 0.17.17

### Patch Changes

- ea7b102c0: fix(pat): highlight expired tokens

## 0.17.16

### Patch Changes

- b3b64a3b7: chore(deps): bump `@types/react` to `v18.2.14` and `@types/react-dom` to `v18.2.6`
- 32b221f94: chore(deps): bump `graphiql` to `v3`
- 3a56c12df: chore(deps): bump `turbo` to `v1.10.6`
- Updated dependencies [b3b64a3b7]
  - @nhost/react-apollo@5.0.29
  - @nhost/nextjs@1.13.31

## 0.17.15

### Patch Changes

- f41fdc12a: chore(deps): bump `turbo` to `1.10.5`
- 6199c1c55: fix(projects): don't redirect to 404 page
- Updated dependencies [07a45fde0]
  - @nhost/react-apollo@5.0.28
  - @nhost/nextjs@1.13.30

## 0.17.14

### Patch Changes

- 80b22724d: chore(deps): bump `@types/react` to `v18.2.13`, `@types/react-dom` to `v18.2.6` and `@storybook/testing-library` to `v0.2.0`

## 0.17.13

### Patch Changes

- cc02902cb: chore(docs): update environment variable documentation

## 0.17.12

### Patch Changes

- 660d339e1: fix(storybook): don't break storybook
- 660d339e1: fix(tests): prevent warnings during tests
  - @nhost/react-apollo@5.0.27
  - @nhost/nextjs@1.13.29

## 0.17.11

### Patch Changes

- bd4d0c270: chore(dashboard):add postgres 14.6-20230613-1 to the version selector

## 0.17.10

### Patch Changes

- c8c2a10b2: fix(database): don't break the password reset flow
- e70b45498: chore(deps): bump `@types/react` to `v18.2.12` and `@types/react-dom` to `v18.2.5`

## 0.17.9

### Patch Changes

- 842055099: chore(deps): bump `turbo` to `v1.10.3` and `pnpm` to `v8.6.2`
- fd12aa0a8: chore(projects): remove the postgres password input from the project creation screen
- 022b76e78: chore(deps): bump `@types/react` to `v18.2.11`
- 3555ab2b7: chore(deps): bump `vitest` monorepo to `v0.32.0`
- c43e54922: feat(backups): add download button to backups

## 0.17.8

### Patch Changes

- d0457fe5c: feat(settings): improve the dashboard and config parity
  - @nhost/react-apollo@5.0.26
  - @nhost/nextjs@1.13.28

## 0.17.7

### Patch Changes

- 4f0368b95: fix(account): don't break account settings page

## 0.17.6

### Patch Changes

- 64a8f41d0: chore(resources): lower the maximum allowed resources per service

## 0.17.5

### Patch Changes

- @nhost/react-apollo@5.0.25
- @nhost/nextjs@1.13.27

## 0.17.4

### Patch Changes

- 9b1d0f7a5: fix(deployments): use correct timestamp for deployment details
- 6d2963ffa: chore(deps): bump `@types/react` to `v18.2.8`
- 8871267b9: chore(deps): downgrade `pnpm` to `v8.5.1` because of no Turborepo support

## 0.17.3

### Patch Changes

- 01eeef9de: chore(misc): under the hood improvements
- 21e13db05: chore(deps): bump `@types/react` to `v18.2.7` and `turbo` to `v1.10.1`
- f16433ae6: chore(secrets): allow empty secrets and environment variables
- aa3c62989: chore(cli): bump Nhost CLI version to v1.0
  - @nhost/react-apollo@5.0.24
  - @nhost/nextjs@1.13.26

## 0.17.2

### Patch Changes

- 88a4983f: chore(misc): under the hood improvements

## 0.17.1

### Patch Changes

- 9b0d4dde: feat(secrets): enable secrets

## 0.17.0

### Minor Changes

- 15d84a19: Add postgres 14.6-20230525

## 0.16.14

### Patch Changes

- 4c626174: chore: updated import paths, improved directory structure
- cc047b71: chore(deps): bump `@fontsource` monorepo to `v5.0.0`
- 99edd012: feat(account): add support for personal access tokens

## 0.16.13

### Patch Changes

- 78c7109c: feat(settings): allow selecting service versions

## 0.16.12

### Patch Changes

- 399009d6: fix(gql): don't enter an infinite loop when fetching remote app data
- 329e5a91: fix(deployments): use the same sorting of deployments everywhere
- 6d559d6e: chore(settings): add under the hood improvements to the settings page
- 12eb236c: chore(deps): bump `prettier-plugin-tailwindcss` to `v0.3.0`
- f9b81a2a: chore(deps): bump `turbo` to `v1.9.8`
- 1345741b: fix(projects): don't redirect to 404 on project creation
- Updated dependencies [7fea29a8]
  - @nhost/react-apollo@5.0.23
  - @nhost/nextjs@1.13.25

## 0.16.11

### Patch Changes

- 1230b722: fix(projects): don't redirect to 404 on when the project is renamed
  - @nhost/react-apollo@5.0.22
  - @nhost/nextjs@1.13.24

## 0.16.10

### Patch Changes

- Updated dependencies [da03bf39]
  - @nhost/react-apollo@5.0.21
  - @nhost/nextjs@1.13.23

## 0.16.9

### Patch Changes

- 349aac36: fix(settings): use region domain when constructing the postgres connection string

## 0.16.8

### Patch Changes

- 20fb69fa: chore(projects): change the way how API URLs are constructed

## 0.16.7

### Patch Changes

- 49f9b837: chore(docker): bump `pnpm` to `v8.4.0` and `turbo` to `v1.9.3`
- 3f478a4e: chore(deps): bump `vitest` to `v0.31.0`, `@types/react` to `v18.2.6` and `@types/react-dom` to `v18.2.4`

## 0.16.6

### Patch Changes

- d926f156: fix(projects): redirect to 404 when an invalid project is opened
- 49b99728: fix(projects): disable features for non-owner members of workspaces

## 0.16.5

### Patch Changes

- 12e2855f: chore(deps): bump `jsdom` to v22
- e4972b83: feat(metrics): add Grafana page

## 0.16.4

### Patch Changes

- 3f396a9e: fix(projects): unpause after upgrading a paused project to pro
- 3f396a9e: fix(projects): don't redirect to 404 page after project creation

## 0.16.3

### Patch Changes

- Updated dependencies [90c60311]
  - @nhost/react-apollo@5.0.20
  - @nhost/nextjs@1.13.22

## 0.16.2

### Patch Changes

- 0f34f0c6: fix(projects): disallow downgrading to free plan
- 8da291ad: chore(deps): bump `@types/react` to v18.2.0 and `@types/react-dom` to v18.2.1

## 0.16.1

### Patch Changes

- adc828a5: fix(gql): don't enter an infinite loop when fetching remote app data

## 0.16.0

### Minor Changes

- 2fb1145f: feat(compute): add support for replicas

### Patch Changes

- d8ceccec: chore(env): remove deprecated `NHOST_BACKEND_URL` environment variable

## 0.15.2

### Patch Changes

- 84b84ab7: fix(projects): filter projects by workspace

## 0.15.1

### Patch Changes

- 2faf7907: chore(deps): bump `graphql-request` to v6
- f1b5a944: chore(deps): bump `@vitejs/plugin-react` to v4
- 7f1785ac: chore(deps): bump `@types/react` to v18.0.37
  - @nhost/react-apollo@5.0.19

## 0.15.0

### Minor Changes

- 85889ee8: feat(dashboard): add Compute management to the settings

## 0.14.8

### Patch Changes

- 668c8771: chore(dialogs): unify dialog management of payment dialogs

## 0.14.7

### Patch Changes

- d4ccc656: chore: cleanup unused code
  - @nhost/react-apollo@5.0.18
  - @nhost/nextjs@1.13.21

## 0.14.6

### Patch Changes

- b299cfc9: chore(deps): bump `vitest` to v0.30.0
- 411cb65b: chore(projects): refactor workspace and project hooks
- 43b1b144: chore(deps): bump `@types/react` to v18.0.34 and `@types/react-dom` to v18.0.11
- Updated dependencies [43b1b144]
  - @nhost/react-apollo@5.0.17
  - @nhost/nextjs@1.13.20

## 0.14.5

### Patch Changes

- ba0d57ee: fix(i18n): revert i18n library
- 3328ed05: feat(projects): improve overview when there is an error

## 0.14.4

### Patch Changes

- 5e0920ba: chore(deps): bump `next-seo` to v6
- 706c9dc3: chore(deps): bump `@types/react` to 18.0.33
- 99f8f6b3: feat(metrics): show metrics on the overview

## 0.14.3

### Patch Changes

- @nhost/react-apollo@5.0.16

## 0.14.2

### Patch Changes

- 3cb67300: fix(logs): don't break UI when clearing time picker
- 7453bf3b: feat(projects): show project creator info
- c166dad0: chore(tests): improve auth page tests
- 6a290bb2: chore(deps): bump `@types/react` to 18.0.32

## 0.14.1

### Patch Changes

- @nhost/react-apollo@5.0.15
- @nhost/nextjs@1.13.19

## 0.14.0

### Minor Changes

- 6e1f03ea: feat(dashboard): add support for the Azure AD provider

### Patch Changes

- 1bd2c373: chore(deps): bump `turbo` to 1.8.6
- d329b621: chore(deps): bump `@types/react` to 18.0.30
- cb248f0d: fix(tests): avoid name collision in database tests
- 867c8076: chore(deps): bump `@types/react` to 18.0.29

## 0.13.10

### Patch Changes

- e93b06ab: fix(dashboard): remove left margin from workspace list on mobile
- 1c4806bf: chore(deps): bump `sharp` to 0.32.0
  - @nhost/react-apollo@5.0.14
  - @nhost/nextjs@1.13.18

## 0.13.9

### Patch Changes

- 912ed76c: chore(dashboard): bump `@apollo/client` to 3.7.10
- Updated dependencies [912ed76c]
  - @nhost/react-apollo@5.0.13

## 0.13.8

### Patch Changes

- 7c127372: chore(dashboard): bump `react-error-boundary` to v4

## 0.13.7

### Patch Changes

- 9130ab12: chore(dashboard): bump `yup` to v1 and `@hookform/resolvers` to v3

## 0.13.6

### Patch Changes

- 253dd235: using new mutation to create projects + refactor Create Project page.

## 0.13.5

### Patch Changes

- @nhost/react-apollo@5.0.12
- @nhost/nextjs@1.13.17

## 0.13.4

### Patch Changes

- b48bc034: fix(dashboard): disable new users
- 798e591b: fix(dashboard): show correct date in data grid

## 0.13.3

### Patch Changes

- bfb4c1a6: chore(dashboard): remove `useAxios` property
- d8d8394b: Dashboard: allow to override hasura admin secret in docker
- Updated dependencies [ce1ee40d]
  - @nhost/nextjs@1.13.16
  - @nhost/react-apollo@5.0.11

## 0.13.2

### Patch Changes

- beed2eba: Fix docker entrypoint for dashboard
- 2c8559a3: fix(dashboard): refresh project list after deleting a project
- 4329d048: chore(dashboard): bump `graphiql` dependencies

## 0.13.1

### Patch Changes

- cbb1fc5b: chore(dashboard): cleanup GraphQL operations

## 0.13.0

### Minor Changes

- 088584e7: feat(dashboard): add support for custom local subdomains

### Patch Changes

- 2ac90dfd: fix(dashboard): improve mobile responsive layout
- Updated dependencies [f375eacc]
  - @nhost/nextjs@1.13.15
  - @nhost/react-apollo@5.0.10

## 0.12.4

### Patch Changes

- @nhost/react-apollo@5.0.9
- @nhost/nextjs@1.13.14

## 0.12.3

### Patch Changes

- 2b1338f7: chore(dashboard): bump `turbo` to 1.8.3
- 5223ee93: fix(dashboard): show correct deployment status on the main page
- 850a049c: chore(deps): update docker/build-push-action action to v4
- Updated dependencies [850a049c]
  - @nhost/nextjs@1.13.13
  - @nhost/react-apollo@5.0.8

## 0.12.2

### Patch Changes

- 4bf40995: chore(deps): bump `typescript` to `4.9.5`
- 8bb097c9: chore(deps): bump `vitest`
- 35d52aab: chore(deps): replace `cross-fetch` with `isomorphic-unfetch`
- Updated dependencies [4bf40995]
- Updated dependencies [8bb097c9]
- Updated dependencies [35d52aab]
  - @nhost/react-apollo@5.0.7
  - @nhost/nextjs@1.13.12

## 0.12.1

### Patch Changes

- c96d7ccd: fix(dashboard): fix docker builds

## 0.12.0

### Minor Changes

- d1671210: feat(dashboard): use mimir to manage project configuration

### Patch Changes

- f65e4de9: chore(deps): bump @graphql-codegen monorepo to v3

## 0.11.20

### Patch Changes

- 4b4f0d01: chore(dashboard): improve dialog management

## 0.11.19

### Patch Changes

- @nhost/react-apollo@5.0.6
- @nhost/nextjs@1.13.11

## 0.11.18

### Patch Changes

- 01318860: fix(nhost-js): use correct URL for functions requests
- Updated dependencies [01318860]
  - @nhost/react-apollo@5.0.5
  - @nhost/nextjs@1.13.10

## 0.11.17

### Patch Changes

- f673adea: fix(dashboard): set correct Content-Type for user creation
- 445d8ef4: chore(deps): bump `@nhost/react-apollo` to 5.0.4
- 445d8ef4: chore(deps): bump `@nhost/nextjs` to 1.13.9
- 0368663d: fix(dashboard): allow permission editing for auth and storage schemas
- Updated dependencies [445d8ef4]
- Updated dependencies [445d8ef4]
  - @nhost/react-apollo@5.0.4
  - @nhost/nextjs@1.13.9

## 0.11.16

### Patch Changes

- b755e908: fix(dashboard): use correct date for last seen
- 2d9145f9: chore(deps): revert GraphQL client
- 1ddf704c: fix(dashboard): don't show false positive message for failed user creation
  - @nhost/react-apollo@5.0.3
  - @nhost/nextjs@1.13.8

## 0.11.15

### Patch Changes

- @nhost/react-apollo@5.0.2
- @nhost/nextjs@1.13.7

## 0.11.14

### Patch Changes

- 2cc18dcb: fix(dashboard): prevent permission editor dropdown from being always open

## 0.11.13

### Patch Changes

- 3343a363: chore(dashboard): bump `@testing-library/react` to v14 and `@testing-library/dom` to v9
  - @nhost/react-apollo@5.0.1
  - @nhost/nextjs@1.13.6

## 0.11.12

### Patch Changes

- 87eda76e: chore(dashboard): bump `@types/react` to v18.0.28 and `@types/react-dom` to v18.0.11
- 6f0ac570: feat(dashboard): show dashboard version in account menu

## 0.11.11

### Patch Changes

- bf1e4071: chore(dashboard): bump `react-is` version to `18.2.0`
- Updated dependencies [bf1e4071]
- Updated dependencies [5013213b]
  - @nhost/nextjs@1.13.5
  - @nhost/react-apollo@4.13.5

## 0.11.10

### Patch Changes

- a37a430b: fix(dashboard): don't break UI when deployments are unavailable
  - @nhost/react-apollo@4.13.4
  - @nhost/nextjs@1.13.4

## 0.11.9

### Patch Changes

- 7b970e68: fix(dashboard): fix header link color

## 0.11.8

### Patch Changes

- f33242f2: feat(dashboard): add new sign up, sign in and reset password pages

## 0.11.7

### Patch Changes

- e9c8909c: fix(dashboard): use correct theme color in dark mode

## 0.11.6

### Patch Changes

- 902f486b: fix(dashboard): re-enable Hasura on logs page

## 0.11.5

### Patch Changes

- 1f9720fa: fix(dashboard): apply select permissions properly

## 0.11.4

### Patch Changes

- deb14b51: fix(dashboard): don't break billing form

## 0.11.3

### Patch Changes

- @nhost/react-apollo@4.13.3
- @nhost/nextjs@1.13.3

## 0.11.2

### Patch Changes

- f143e51d: chore(dashboard): pin Turborepo to 1.6.3

## 0.11.1

### Patch Changes

- c2b5a41a: chore(dashboard): select system colors by default

## 0.11.0

### Minor Changes

- 1ebaf429: feat(dashboard): introduce Dark Mode 🌚

### Patch Changes

- 63b445c4: fixed duplicated logs bug and made to date count during live mode

## 0.10.1

### Patch Changes

- e146d32e: chore(deps): update dependency @types/react to v18.0.27
- 59347fcd: correct allowed role name
- 5b65cac9: updated authentication documentation
- 963f9b5e: feat(dashboard): include project info in feedback

## 0.10.0

### Minor Changes

- ed4c7801: chore(dashboard): remove Functions section

## 0.9.10

### Patch Changes

- 4e2f8ccd: fix(dashboard): don't break Auth page in local mode

## 0.9.9

### Patch Changes

- 31abbe5f: fix(dashboard): enable toggle when settings are filled in

## 0.9.8

### Patch Changes

- 5bdd31ad: chore(dashboard): list fewer images per page on the Storage page
- 5121851c: fix(dashboard): don't throw validation error for valid permission rules

## 0.9.7

### Patch Changes

- c126b20d: fix(dashboard): correct redeployment button

## 0.9.6

### Patch Changes

- 36c3519c: feat(dashboard): retrigger deployments

## 0.9.5

### Patch Changes

- 200e9f77: chore(deps): update dependency @types/react-dom to v18.0.10
- Updated dependencies [200e9f77]
  - @nhost/nextjs@1.13.2
  - @nhost/react-apollo@4.13.2

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
