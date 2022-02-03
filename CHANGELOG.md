# [0.2.0](https://github.com/nhost/hasura-auth/compare/v0.1.0...v0.2.0) (2022-02-03)


### Bug Fixes

* allow redirect urls in Oauth that starts with the one defined in the server ([c00bff8](https://github.com/nhost/hasura-auth/commit/c00bff8283a657c38fce3b5cbfb7c56cb17f82ab))
* **email-templates:** fallback to the default template when the requested template doesn't exist ([6a70c10](https://github.com/nhost/hasura-auth/commit/6a70c103dff19b6c3f6e9e93b0cbfa0dabbdc01a))
* **email-templates:** use the locale given as an option, then the existing user locale, then default ([31d4a89](https://github.com/nhost/hasura-auth/commit/31d4a89d58d5571c920d93839638daa07ec018ff))
* **metadata:** show column values when the column name is the same as the graphql field name ([a595941](https://github.com/nhost/hasura-auth/commit/a5959413322415a23012d67773ca65387235503d)), closes [#76](https://github.com/nhost/hasura-auth/issues/76)
* **passwordless:** don't send passwordless email when the user is disabled ([3ec9c76](https://github.com/nhost/hasura-auth/commit/3ec9c763f1b1abbda62a5b9d4c01b475a62c460b))
* remove email-templates endpoint ([5c6dbf5](https://github.com/nhost/hasura-auth/commit/5c6dbf503ff729ef928f9df105998d740c5c75e8)), closes [#75](https://github.com/nhost/hasura-auth/issues/75)


### Features

* custom claims ([01c0207](https://github.com/nhost/hasura-auth/commit/01c0207fd13446d37375e261772ee4a5ca27d108)), closes [#49](https://github.com/nhost/hasura-auth/issues/49)
* custom json object user property ([ee43fe3](https://github.com/nhost/hasura-auth/commit/ee43fe374f46135e126f02d2841ad275815ebbb3)), closes [#31](https://github.com/nhost/hasura-auth/issues/31)
* implement remote email templates with AUTH_EMAIL_TEMPLATE_FETCH_URL ([2458651](https://github.com/nhost/hasura-auth/commit/2458651a415f43e01a8917f0f8aaa75bdae11897))
* simplify email templates context ([b94cdf2](https://github.com/nhost/hasura-auth/commit/b94cdf20973b22601705a0ed0395bfc9e2699309)), closes [#64](https://github.com/nhost/hasura-auth/issues/64)
* use array custom JWT claims ([53a286a](https://github.com/nhost/hasura-auth/commit/53a286a74f74d315282c6a92b679f490a3d7336e))


### BREAKING CHANGES

* deactivate the `/email-templates` endpoint

# [0.1.0](https://github.com/nhost/hasura-auth/compare/v0.0.1-canary.0...v0.1.0) (2022-01-18)

### Bug Fixes

- Update README.md ([#27](https://github.com/nhost/hasura-auth/issues/27)) ([f51bb26](https://github.com/nhost/hasura-auth/commit/f51bb26490273215543e0905e19eeab96a7fb50c))
- better error message for redirectTo ([#59](https://github.com/nhost/hasura-auth/issues/59)) ([0b76425](https://github.com/nhost/hasura-auth/commit/0b764255e02f0f0c3a72f19863f947403dbef56d))
- everything ([da8c954](https://github.com/nhost/hasura-auth/commit/da8c954ffd4990d599b6db5b7e77d604450225fd))
- keep .env for dev in repo and updated hasura version to m1 supported image ([#60](https://github.com/nhost/hasura-auth/issues/60)) ([394d4ae](https://github.com/nhost/hasura-auth/commit/394d4ae5e2fd9d4d87575f168ea15da675f9743a))
- **password:** validate password on change ([#58](https://github.com/nhost/hasura-auth/issues/58)) ([994af31](https://github.com/nhost/hasura-auth/commit/994af3193511a594f6d659b80e92ec568b6d63b0))
- **user:** fix user schemas ([#52](https://github.com/nhost/hasura-auth/issues/52)) ([c7eb721](https://github.com/nhost/hasura-auth/commit/c7eb721f1193f487ae094e5b29aa5f4c97b0ff69))

### Features

- **emails:** translate email templates to french ([#63](https://github.com/nhost/hasura-auth/issues/63)) ([109695f](https://github.com/nhost/hasura-auth/commit/109695f0da65d9af3ad913a56300bd7ed6df5496))

### Performance Improvements

- reduce docker image from 477MB to 176MB ([5f4d2b2](https://github.com/nhost/hasura-auth/commit/5f4d2b2415e83ad4e589d3c12a23df4938ea0c14))
