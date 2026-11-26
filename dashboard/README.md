# Nhost Dashboard

This is the Nhost Dashboard, a web application that allows you to manage your Nhost projects.
To get started, you need to have an Nhost project. If you don't have one, you can [create a project here](https://app.nhost.io).

From the repository root, install the dependencies:

```bash
pnpm install
```

The dashboard depends on `@nhost/nhost-js`, which it imports from that package's build output. The root workspace has no `build` script. Build the SDK with:

```bash
pnpm build:nhost-js
```

Then start the development server:

```bash
pnpm dev:dashboard
```

`pnpm dev` from `dashboard/` starts the same server. Open [http://localhost:3000](http://localhost:3000) to see the result in your browser.

Run the remaining commands in this README from `dashboard/`, and create the `.env.*` files described below, including `.env.test`, in that directory.

## Environment

### Setup Environment Variables

Depending on the environment you wish to target you can configure environment variables in `.env.<target_environment>.local`.

- `.env.development`: This file is used if you run `nhost up`
- `.env.development.local`: This file is used if you run `pnpm dev`. It takes precedence over `.env.local` if available.
- `.env.production.local`: This file is used if you run `pnpm build`. It takes precedence over `.env.local` if available.
- `.env.local`: This file is used if you run either `pnpm dev` or `pnpm build`.

These files are added to `.gitignore`, so you don't need to worry about committing them. It's important that you make sure you change environment variables in `.env` files ending with `.local`.

### Enable Local Development

You can connect the Nhost Dashboard to your **locally running** Nhost backend in a few steps. Make sure you have the [Nhost CLI installed](https://docs.nhost.io/platform/cli/local-development).

First, you need to run the following command to start your backend locally:

```bash
cd <your_nhost_project> && nhost up
```

You can connect the Nhost Dashboard to your locally running backend by setting the following environment variables in `.env.development.local`:

```bash
NEXT_PUBLIC_ENV=dev
NEXT_PUBLIC_NHOST_PLATFORM=false
NEXT_PUBLIC_NHOST_AUTH_URL=https://local.auth.local.nhost.run/v1
NEXT_PUBLIC_NHOST_FUNCTIONS_URL=https://local.functions.local.nhost.run/v1
NEXT_PUBLIC_NHOST_GRAPHQL_URL=https://local.graphql.local.nhost.run/v1
NEXT_PUBLIC_NHOST_STORAGE_URL=https://local.storage.local.nhost.run/v1
NEXT_PUBLIC_NHOST_HASURA_CONSOLE_URL=https://local.hasura.local.nhost.run
NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL=https://local.hasura.local.nhost.run/v1/migrations
NEXT_PUBLIC_NHOST_HASURA_API_URL=https://local.hasura.local.nhost.run
```

This will connect the Nhost Dashboard to your locally running Nhost backend.

### General Environment Variables

| Name                             | Description                                                                                                                                                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_ENV`                | `dev`, `staging` or `prod`. This should be set to `dev` in most cases.                                                                                                                                               |
| `NEXT_PUBLIC_NHOST_ADMIN_SECRET` | Admin secret for Hasura. Default: `nhost-admin-secret`                                                                                                                                                               |
| `NEXT_PUBLIC_NHOST_PLATFORM`     | This should be set to `false` to connect the Nhost Dashboard to a locally running or a self-hosted Nhost backend. Setting this to `true` will connect the Nhost Dashboard to the cloud environment. Default: `false` |

### Environment Variables for Local Development and Self-Hosting

| Name                                          | Description                                                                                                                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_NHOST_AUTH_URL`                  | The URL of the Auth service. When working locally, point it to the Auth service started by the CLI. When self-hosting, point it to the self-hosted Auth service.                                       |
| `NEXT_PUBLIC_NHOST_FUNCTIONS_URL`             | The URL of the Functions service. When working locally, point it to the Functions service started by the CLI. When self-hosting, point it to the self-hosted Functions service.                        |
| `NEXT_PUBLIC_NHOST_GRAPHQL_URL`               | The URL of the GraphQL service. When working locally, point it to the GraphQL service started by the CLI. When self-hosting, point it to the self-hosted GraphQL service.                              |
| `NEXT_PUBLIC_NHOST_STORAGE_URL`               | The URL of the Storage service. When working locally, point it to the Storage service started by the CLI. When self-hosting, point it to the self-hosted Storage service.                              |
| `NEXT_PUBLIC_NHOST_HASURA_CONSOLE_URL`        | The URL of the Hasura Console. When working locally, point it to the Hasura Console started by the CLI. When self-hosting, point it to the self-hosted Hasura Console.                                 |
| `NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL` | The URL of Hasura's Migrations service. When working locally, point it to the Migrations service started by the CLI.                                                                                   |
| `NEXT_PUBLIC_NHOST_HASURA_API_URL`            | The URL of Hasura's Schema and Metadata API. When working locally, point it to the Schema and Metadata API started by the CLI. When self-hosting, point it to the self-hosted Schema and Metadata API. |

### Content Security Policy (CSP) Configuration

The dashboard supports build-time CSP configuration to enable self-hosted deployments on custom domains.

| Name         | Description                                                                                                                                                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CSP_MODE`   | Controls CSP behavior. Options: `nhost` (default, uses Nhost Cloud CSP), `disabled` (no CSP headers), `custom` (use custom CSP via `CSP_HEADER`). For self-hosted deployments on custom domains, set to `disabled` or `custom`.          |
| `CSP_HEADER` | Custom Content Security Policy header value. Only used when `CSP_MODE=custom`. Should be a complete CSP string (e.g., `default-src 'self'; script-src 'self' 'unsafe-eval'; ...`).                                                       |

### Other Environment Variables

| Name                                    | Description                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_STRIPE_PK`                 | Stripe public key. This is only used if `NEXT_PUBLIC_NHOST_PLATFORM` is `true`.             |
| `NEXT_PUBLIC_GITHUB_APP_INSTALL_URL`    | URL of the GitHub application. This is only used if `NEXT_PUBLIC_NHOST_PLATFORM` is `true`. |
| `NEXT_PUBLIC_ANALYTICS_WRITE_KEY`       | Analytics key. This is only used if `NEXT_PUBLIC_NHOST_PLATFORM` is `true`.                 |
| `NEXT_PUBLIC_NHOST_BRAGI_WEBSOCKET`     | URL of the Bragi websocket. This is only used if `NEXT_PUBLIC_NHOST_PLATFORM` is `true`.    |

## Native support

The platform dashboard includes a native support workspace:

- `/support`: the public support hub, with links to the docs, Discord, GitHub issues, and the ticket queue. It needs no session, so signed-out visitors can reach it too.
- `/support/tickets`: organization-visible customer tickets, or the global queue for support agents. Switch between open, closed, and all tickets, filter by status, search by title, project, organization, or ticket number, and paginate results. Agents can also show only the tickets assigned to them.
- `/support/ticket`: create a ticket for one of your organizations, optionally tied to a current project. The form collects title, severity, affected services, and description.
- `/support/tickets/[ticketId]`: public conversation and activity, with status transitions, self-assignment, unassignment, and severity changes restricted to support agents. Customers can view ticket details and reply, but cannot update ticket fields. Agents can reopen resolved tickets; closed tickets are final and read-only.

This uses the existing dashboard Nhost session and GraphQL endpoint. There is **no separate support login, OAuth client, admin secret, or Zendesk credential**. The old `/api/support/create-ticket` route is removed; clients must use the native GraphQL API instead. Existing Zendesk tickets are not imported.

Before deploying the dashboard, deploy the console-next `support` schema migration and metadata. Grant staff the native `support` allowed role while retaining `user`, then renew their session. A role cannot be granted by browser metadata or a UI toggle. Customers use the same live organization-membership permissions as application visibility; agents use the backend's explicit read permissions for the global queue and its organization, project, and plan context. Creating a ticket still requires current membership, even for staff.

Support is available only with `NEXT_PUBLIC_NHOST_PLATFORM=true`. Keep normal platform Auth/GraphQL/Storage URLs pointed at console-next. Do not point the support workspace at an arbitrary customer project's backend. GraphQL documents live in `src/gql/support/`; regenerate types with `pnpm codegen` against a migrated console-next endpoint.

Queues, conversations, and attachments update live and after writes: open tickets and queues hold a GraphQL subscription to a small change signal (a ticket's `updatedAt` and attachment IDs, or a queue's count and latest update) and refetch only when it changes. Nothing polls; data also refreshes when the tab regains focus or the connection is re-established. Status, severity, and assignment updates use the ticket version to detect conflicts. Severity is recorded as submitted, not used to promise an SLA. Email intake/notifications, private notes, automated SLAs, and historical Zendesk migration are not implemented by this frontend; follow replies in the dashboard. Backend email notifications can be deployed independently.

Severity choices come from the selected organization's `plan.supportAllowedSeverities`, not hard-coded plan names or tiers. Disallowed choices stay visible but greyed out, for both new tickets and agent severity changes. On the new-ticket form, a disallowed choice lists the public plans whose `supportAllowedSeverities` include it, or says that no plan includes it. New tickets start at `low` where allowed, otherwise the first permitted severity; changing organizations or refreshing a plan resets an invalid selection. Empty or unreadable entitlements block creation and severity changes, not replies, status, or assignment. Existing ticket severities remain unchanged after plan changes, and the backend remains authoritative.

### Markdown and attachments

- Descriptions and replies support GitHub-flavored Markdown, including tables, task lists, and fenced code. The form has formatting buttons. Markdown is stored as text and rendered with [`react-markdown`](https://github.com/remarkjs/react-markdown) and [`remark-gfm`](https://github.com/remarkjs/remark-gfm), maintained by the unified collective. Raw HTML and remote images are disabled; external links use the renderer's safe URL handling and open with `noopener noreferrer`. The insert action beside each attachment download adds a file link or image at the editor selection. Private `attachment:<file-id>` references are stored in the Markdown, without public URLs or credentials. References are checked against the current ticket or draft before fetching authenticated bytes. PNG, JPEG, GIF, WebP, and AVIF images with matching response MIME types show as thumbnails that open full size; other types, including SVG and HTML, remain downloads. Preview blob URLs are revoked when no longer used.
- Drop files onto the description or reply text area to upload and insert file links or images automatically. Temporary upload markers keep their position while you continue editing; only confirmed uploads become links. Failed-upload markers are removed. You can also select files with the accessible file picker and insert them using the attachment buttons. There is no separate upload button; failed uploads have an explicit retry action. Attach files while composing a new ticket, or from ticket details afterward. New-ticket uploads use a private attachment draft created on the first upload, not a placeholder ticket. The draft contains only upload ownership; title and description remain in the form until submission. Uploading does not send a comment, change workflow, or trigger notifications.
- The ticket attachment list and the attachments in the editor show image thumbnails and file-type icons for other files. On the new-ticket form, completed uploads appear in the editor. The list below it shows failed, pending, and unfinished uploads with retry and remove actions, and completed uploads the description no longer links to, with insert and remove actions. Thumbnails use Nhost Storage resizing (`w=128&h=128&q=75&f=webp`) with authenticated, no-store reads rather than downloading original images. They load near the viewport and fall back to an icon if the transform fails or the browser cannot decode the image. Draft thumbnails always use the `user` role. Download buttons still retrieve the original file.
- Deploy console-next's attachment admission and draft migrations and metadata first, including `supportAttachmentDrafts`, `supportAttachmentUploads`, and the private `support_tickets_attachments` bucket. Storage must point at the same console-next backend as the support GraphQL API.
- Each file must contain 1–5,000,000 bytes. There is no additional frontend MIME restriction or attachment-count limit. Files upload sequentially, each with a fresh server reservation and matching native `user` / `support` role. Successful files remain attached if another upload fails. Failed attempts use new reservations on retry; check the refreshed list first when completion could not be confirmed.
- Draft creation, reservation, Storage uploads/downloads, and final submission all use `user`, including for agents creating tickets in their own organizations. The draft is immutable and creator/role-private. There is no age-based expiry or cancellation API; automatic 24-hour cleanup remains backend follow-up work. Upload or remove every selected file before submission, and insert or remove every completed upload the description doesn't link to, because submission publishes the whole draft; retries discard failed reservations before obtaining new IDs, and recover confirmed uploads instead of uploading them twice. Retained reservations and completed-file lists are fetched in full using 100-row pages so hidden unfinished reservations cannot be overlooked. Both ticket and draft `attachments` relationships read reservations directly, not a completed-files view; queries explicitly require `discardedAt IS NULL`, the support bucket, and `file.isUploaded = true`.
- Changing organization requires discarding all retained reservations and confirming that the draft is still unsubmitted and empty. This clears the local attachment queue, not the immutable server draft or Storage bytes; discard timestamps come from the server. Partial failures retain the draft so remaining reservations can be retried. Text is kept when clearing attachments, but reloading or leaving the form does not persist the form or restore its draft. No automatic cleanup is installed.
- Ticket creation sends `attachmentDraftID`, atomically transfers all reservations to the ticket, and deletes the draft. Discarded reservations remain hidden tombstones. The ticket retains the immutable, unique `attachmentDraftID` submission token, not a draft relationship. After an uncertain response, the dashboard looks up tickets by that original token before retrying; it never replaces an uncertain submission with a fresh draft. A missing draft and empty ticket lookup can also mean lost access, not failed submission. After an uncertain submission, keep the original token: clearing/replacing the draft stays blocked, and the form offers a submission check or retry with the same token. The reference is shown for recovery. Published files use normal ticket visibility, independent of the deleted draft. Attachments belong to the ticket, not a specific reply.
- Current ticket viewers can download files, including on closed tickets. Upload controls are hidden after closure. Downloads fetch authenticated bytes with `cache: no-store` and save an octet-stream blob; no public/signed URLs, client replacements, or client deletions are used. Image previews use the same authenticated, no-store reads and do not change closed-ticket state. Membership and closed-state rules remain enforced by the backend.

The dashboard's existing Nix package and CI checks include these routes, generated types, and tests; no separate support service or frontend deployment is needed.

## Biome Linting Rules

This project uses [Biome](https://biomejs.dev/) for linting. The rules are configured in `biome.jsonc`.

| Name                          | Level | Description                                                                                           |
| ----------------------------- | ----- | ----------------------------------------------------------------------------------------------------- |
| `useLiteralKeys`              | off   | Disabled to allow computed property access where appropriate.                                         |
| `noBannedTypes`               | off   | Disabled to allow usage of types like `{}` and `object` where needed.                                 |
| `useOptionalChain`            | error | Enforces optional chain wherever possible. For example: `user?.name` instead of `user && user.name`.  |
| `noNonNullAssertion`          | off   | Disabled to allow non-null assertions (`!`) where appropriate.                                        |
| `useThrowOnlyError`           | error | Enforces throwing only `Error` objects.                                                               |
| `noUselessElse`               | error | Disallows unnecessary `else` blocks after `return` statements.                                        |
| `noParameterAssign`           | error | Disallows reassigning function parameters.                                                            |
| `useBlockStatements`          | error | Enforces curly braces for all control flow statements.                                                |
| `noExtraNonNullAssertion`     | off   | Disabled to allow extra non-null assertions where needed.                                             |
| `noConsole`                   | error | Disallows `console` usage except for `console.error`, `warn`, and `info`.                             |
| `noExplicitAny`               | error | Disallows explicit `any` type usage.                                                                  |
| `noInnerDeclarations`         | error | Disallows function or variable declarations in blocks.                                                |
| `noUnusedImports`             | error | Reports unused imports with auto-fix enabled.                                                         |
| `noUnusedVariables`           | off   | Disabled (handled by TypeScript compiler).                                                            |
| `noUnusedFunctionParameters`  | off   | Disabled (handled by TypeScript compiler).                                                            |
| `noImportCycles`              | error | Prevents circular dependency errors.                                                                  |
| `noShadow`                    | error | Disallows variable declarations that shadow variables declared in outer scopes.                       |
| `noAccumulatingSpread`        | off   | Remove this rule once we have time to refactor the code that causes the warning.                      |

### Unit Tests

Unit tests are written using [Vitest](https://vitest.dev/). To run the tests, run the following command:

```bash
pnpm test
```

### End-to-End Tests

Most of the end-to-end tests require access to an Nhost test user and a live project. You can register a user and create a test project on the [Nhost Dashboard](https://app.nhost.io/).

Next, you need to create a project. Create a `.env.test` file with the following variables:

```
NHOST_TEST_DASHBOARD_URL=<test_dashboard_url>
NHOST_TEST_USER_EMAIL=<test_user_email>
NHOST_TEST_USER_PASSWORD=<test_user_password>
NHOST_TEST_ORGANIZATION_NAME=<test_organization_name>
NHOST_TEST_ORGANIZATION_SLUG=<test_organization_slug>
NHOST_TEST_PERSONAL_ORG_SLUG=<test_personal_org_slug>
NHOST_TEST_PROJECT_NAME=<test_project_name>
NHOST_TEST_PROJECT_SUBDOMAIN=<test_project_subdomain>
NHOST_TEST_PROJECT_ADMIN_SECRET=<test_project_admin_secret>
```

**Required Variables**:

- `NHOST_TEST_DASHBOARD_URL`: The URL to run the tests against (e.g: http://localhost:3000 or https://staging.app.nhost.io)
- `NHOST_TEST_USER_EMAIL`: Email address of the test user that owns the test project
- `NHOST_TEST_USER_PASSWORD`: Password of the test user that owns the test project
- `NHOST_TEST_ORGANIZATION_NAME`: Name of the organization that contains the test project
- `NHOST_TEST_ORGANIZATION_SLUG`: Slug of the organization that contains the test project
- `NHOST_TEST_PERSONAL_ORG_SLUG`: Slug of the personal organization that contains the test project
- `NHOST_TEST_PROJECT_NAME`: Name of the test project
- `NHOST_TEST_PROJECT_SUBDOMAIN`: Subdomain of the test project
- `NHOST_TEST_PROJECT_REMOTE_SCHEMA_NAME`: Name of the remote schema for the test project
- `NHOST_TEST_PROJECT_ADMIN_SECRET`: Admin secret of the test project

Make sure to copy the organization and project information from the [Nhost Dashboard](https://app.nhost.io/).

End-to-end tests are written using [Playwright](https://playwright.dev/). To run the tests, run the following command:

```bash
pnpm e2e
```
