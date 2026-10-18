# Brief: Native queries and logical models

Written from issue #4575, the title and description of PR #5173 and the
dashboard source under `dashboard/src/features/orgs/projects/database/native-queries/`.
It is what a writer would have been handed before any draft existed.

## Scope and page type

- Scope: `docs`
- Page type: how-to
- Page: `docs/src/content/docs/products/database/native-queries.mdx`, in the
  Database sidebar group

## Audience

Developers with an Nhost project who need a read query that the generated
GraphQL schema cannot express (aggregates, grouping, computed columns) and want
it exposed as a typed root field with role-based permissions, without writing
a Postgres view or function. They know SQL and GraphQL and have used the
Database and GraphQL areas of the dashboard.

## What the reader must be able to do

In no particular order; the page structure is the writer's call.

- Grant a role access to a native query's results.
- Expose a SQL query that takes an argument as a GraphQL root field, and call
  it.
- Describe the shape of the rows a query returns as a logical model.
- Return nested results by relating two native queries.
- Work with the feature on a Cloud project and on a local project run with
  `nhost up`.
- Edit and delete native queries and logical models, and know what blocks a
  delete.

The one ordering constraint: a native query cannot be created without a
logical model for it to return.

## Running example

Use one example throughout, in every code block and screenshot: a blog
database with a `posts` table that has a view count. A `post_summary` logical
model describes a summary row per post, and a `popular_posts` native query
returns `post_summary` rows for posts above a `min_views` argument. Add a
second native query only where the relationships part needs a target.

The SQL for `popular_posts` must show two rules readers get wrong:

- arguments are interpolated as `{{min_views}}`, not as positional `$1`
  parameters;
- a computed column needs an alias that matches the logical model field name.

## Dashboard paths

- Native Queries tab of the Database area:
  `/orgs/_/projects/_/database/native-queries/default`
- Logical model detail: `/orgs/_/projects/_/database/native-queries/default/models/<model>`
- Native query detail: `/orgs/_/projects/_/database/native-queries/default/queries/<query>`
- The sidebar has **New logical model** and **New native query** buttons. With
  no logical models the tab shows "Create your first logical model".
- Native query form fields: **Root field name**, **Description**, **Returns
  logical model**, arguments (name, type, nullable) and the SQL editor.
- Relationship dialog fields: **Relationship Name**, **Target Native Query**,
  **Relationship Type** (object or array), source and target field mappings.

## Caveats the dashboard does not surface

- Requires Hasura engine v2.33.0 or later. Tell readers how to check and change
  the engine version. Source: `dashboard/src/pages/`.
- Postgres sources only; the dashboard only serves the `default` database.
- Not supported by Constellation.
- Permissions are set on the logical model, not on the native query, and only
  `select` is available. The SQL runs first; the row filter applies to its
  result.
- Relationships can only connect a native query to another native query.
- Deleting a logical model that a native query returns or another logical
  model references, or a native query that another native query's
  relationship points at, may be rejected. The delete dialogs list those
  dependents and warn before the reader confirms.
- Cloud projects change through the metadata API. Local projects change
  through the CLI. State how a local change is persisted in the project's
  `nhost/` directory. Source: `cli/dockercompose/` and the dashboard feature.

## Screenshots wanted

One per step a reader performs in the dashboard, in the running example. In
no particular order:

- Native Queries tab with no logical models
- Create logical model drawer filled for `post_summary`
- Create native query drawer filled for `popular_posts`, SQL visible
- Native query detail after saving
- Logical model permissions for a role, with a row filter
- Create relationship dialog
- A delete dialog listing dependents

## Sources

Take every dashboard location and every statement about what a change
writes to disk from the listed sources.

- Dashboard feature: `dashboard/src/features/orgs/projects/database/native-queries/`
- Dashboard routes: `dashboard/src/pages/orgs/[orgSlug]/projects/[appSubdomain]/database/native-queries/`
- Dashboard settings routes under `dashboard/src/pages/orgs/[orgSlug]/projects/[appSubdomain]/`
- Local development services: `cli/dockercompose/`
