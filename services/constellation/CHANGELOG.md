## [constellation@0.6.0] - 2026-06-08

### 🚀 Features

- *(constellation)* Support typed remote schema presets (#4459)
- *(constellation)* Align SQLite LIKE and constraints (#4464)
- *(constellation)* Accept permission columns wildcard shorthand (#4470)


### 🐛 Bug Fixes

- *(constellation)* Expose smallint as scalar (#4447)
- *(constellation)* Hide unsupported introspection directives (#4448)
- *(constellation)* Harden WebSocket transport liveness (#4449)
- *(constellation)* Handle phantom field alias collisions in remote relationships (#4465)
- *(constellation)* Preserve remote schema env headers and ints (#4475)
- *(constellation)* Qualify non-public table roots (#4474)
- *(constellation)* Preserve remote schema header env refs (#4477)
- *(constellation)* Qualify root field routing by operation (#4478)
- *(constellation)* Align subscription cohort variables (#4483)
- *(constellation)* Use raw HMAC JWT secrets (#4484)

## [constellation@0.5.0] - 2026-06-03

### 🚀 Features

- *(constellation)* Support aggregate relationship order_by (#4403)
- *(constellation)* Reject bad distinct_on & negative limit/offset (#4405)
- *(constellation)* Cap GraphQL request bodies (#4418)
- *(constellation)* Expire JWT WebSocket sessions (#4416)


### 🐛 Bug Fixes

- *(constellation)* Treat null top-level `where` as no filter, matching Hasura (#4382)
- *(constellation)* Run insert-check after INSERT when payload omits referenced cols (#4384)
- *(constellation)* Partition multi-parent nested array inserts per parent CTE (#4389)
- *(constellation)* Apply defaults in mixed multi-row inserts (#4388)
- *(constellation)* Partition multi-parent object-rel nested inserts per parent (#4392)
- *(constellation)* Resolve where variables (#4398)
- *(constellation)* Preserve x-hasura literals in subscriptions (#4399)
- *(constellation)* Harden JWT and admin-secret authentication (#4400)
- *(constellation)* Honor field aliases at every aggregate scope (#4407)
- *(constellation)* Support function default args (#4404)
- *(constellation)* Partition object-rel nested inserts per parent (#4401)
- *(constellation)* Resolve nested returning relationships from insert CTEs (#4414)
- *(constellation)* Apply remote-schema presets under non-default root types (#4415)
- *(constellation)* Preserve x-hasura literals in subscriptions (#4422)
- *(constellation)* Resolve where variables (#4423)
- *(constellation)* Enforce upsert update permissions (#4419)
- *(constellation)* Honor @skip/@include and root fragments/__typename (#4434)
- *(constellation)* Emit enum types for mutation-only inputs (#4438)
- *(constellation)* Harden stream cursors and introspection responses (#4439)


### ⚙️ Miscellaneous Tasks

- *(nixops)* Drop nix-filter input in favor of pkgs.lib.fileset (#4377)
- *(nixops)* Fix repo after bumping nixpkgs (#4394)

## [constellation@0.4.0] - 2026-05-27

### 🚀 Features

- *(constellation)* Support wildcard origins in CORS allow-list (#4373)


### 🐛 Bug Fixes

- *(constellation)* Accept Content-Type variants on POST /graphql and default to application/json (#4374)

## [constellation@0.3.1] - 2026-05-26

### 🐛 Bug Fixes

- *(constellation)* Nested array inserts with parent-referencing perms (#4370)

## [constellation@0.3.0] - 2026-05-26

### 🚀 Features

- *(constellation)* Support multi-row nested array-relationship inserts (#4362)


### ⚙️ Miscellaneous Tasks

- *(constellation)* Update README.md instructions (#4363)

## [constellation@0.2.0] - 2026-05-26

### 🚀 Features

- *(cli)* Port schema tooling to the CLI from constellation (#4348)


### 🐛 Bug Fixes

- *(constellation)* Only introspect what's needed to avoid permission errors (#4349)
- *(constellation)* Resolve __typename correctly on aggregate queries (#4354)
- *(constellation)* Support composite keys on relationships (#4355)
- *(constellation)* Emit enum type for PK args referencing enum tables (#4357)

## [constellation@0.1.0] - 2026-05-25

### 🚀 Features

- *(constellation)* Tolerate partial metadata failures via inconsistency collector (#4342)


### 🐛 Bug Fixes

- *(constellation)* Prefix env vars with CONSTELLATION_ (#4340)

## [constellation@0.0.1] - 2026-05-21

First version
