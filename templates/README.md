# Nhost starter templates

The directories here are what `nhost init --template <name>` lays over a
project. They are compiled into the CLI binary, so a released CLI always
scaffolds the template it shipped with and nothing is fetched at init time.

This document is for maintainers. A template's own `frontend/README.md` is for
the people who scaffold it.

## How a template is structured

A template is a directory whose top-level entries are copied over the project
root, next to the `nhost/` folder `init` writes:

```
templates/nextjs/
├── frontend/              the app; its own lockfile, Biome config and pnpm workspace
├── AGENTS.md              agent context, byte-identical to CLAUDE.md
├── CLAUDE.md
├── SKILLS.md              every workflow in one file...
└── .claude/skills/<name>/SKILL.md   ...and one directory per workflow for Claude Code
```

Everything a user gets is in that tree. There is no backend half: a template
must work against the plain backend `nhost init` writes, with at most a
configuration change (see `configure` in `cli/cmd/project/template.go`).
Migrations, metadata and functions are the user's to add.

`frontend/` is deliberately **outside** the pnpm workspace. It ships its own
`pnpm-workspace.yaml`, lockfile and `biome.json`, so it resolves published
package versions exactly like a user's scaffolded project would. Manage its
lockfile with a plain `pnpm install` from inside `frontend/`, never with
`--ignore-workspace`.

## Available templates

| name | stack | what it shows |
| --- | --- | --- |
| `nextjs` | Next.js 16 (App Router), Tailwind v4, plain components or shadcn/ui | the sign-in methods you choose, a session shared by server and browser, one protected route. No schema. |
| `react` | React 19 on Vite, Tailwind v4, plain components or shadcn/ui | the same app with no server: a browser-held session the SDK refreshes, routes found by glob, one protected route. No schema. |

## Develop and test a template locally

From the template's `frontend/`:

```sh
pnpm install
pnpm lint && pnpm test && pnpm build
```

To try the whole flow the way a user does, build the CLI and run it in a
scratch directory:

```sh
go build -o /tmp/nhost ./cli
mkdir /tmp/try && cd /tmp/try
/tmp/nhost init --template nextjs
nhost up
cd frontend && pnpm install && pnpm dev
```

The two guards below run in CI; run them before pushing:

```sh
./templates/check-agent-context.sh
./templates/check-ci-matrix.sh
```

## Maintainer invariants

- **Sign-in methods are isolated.** Each is one directory under
  `frontend/src/app/auth/` plus one entry in `frontend/src/app/signin/methods.ts`,
  which has no imports. A method imports only from `@/lib/nhost/*`,
  `@/components/*` and `@/app/signin/destination`; nothing shared imports from
  a method. The `delete-method` job in
  [`templates_checks.yaml`](../.github/workflows/templates_checks.yaml) removes
  each method the documented way and builds, so a leak fails CI. `--auth-methods`
  depends on the same isolation: it skips the directories of the methods that
  were not asked for.
- **Shipped Markdown is rewritten for the chosen package manager.** Commands in
  the template's own docs are written as `pnpm <script>`, and `retargetDocs`
  turns them into the chosen manager's form at scaffold time - which is not a
  substitution, since npm needs `run` in front of a script and yarn installs
  with no subcommand. `TestEveryDocumentedScriptIsRewritten` walks every `.md`
  a template ships and fails if any `pnpm` survives the rewrite, so a command
  written in a form the table does not know about is caught here rather than by
  a user running it.
- **Where a template keeps things is the template's own business.** The
  catalogue entry in `cli/cmd/project/template.go` names its `authDir`,
  `methodsFile` and `componentsUI`, because a framework decides its own layout:
  `frontend/src/app/auth` is the App Router's answer, not every template's. The
  same entry carries the template's `uiSystems`, since a component library is
  written for one framework and the shadcn ports for Vue and Svelte are
  different packages. `--ui` lists the union of every template's options in its
  help, because that help is built before a template is chosen, and refuses a
  name the chosen template does not offer with that template's own list.
- **UI systems swap behind one directory.** Everything in the app imports
  `@/components/ui/*` and nothing imports past it, so a UI system is the set of
  modules behind that path. `frontend/` holds the shadcn/ui set, because that is
  the one with dependencies to resolve and a lockfile to keep honest; the
  alternatives live one directory each under `templates/<name>/ui/`, carrying
  only the modules that differ. Note that `frontend/` is therefore **not** the
  default scaffold - `none` is - so the common path is the one the `ui-system`
  job builds rather than the `frontend` job. `ui/` is deliberately outside
  `frontend/`, which means nothing typechecks it where it sits: the `ui-system`
  job scaffolds each one with the CLI, outside the repository, then installs
  and builds the result. That is the only thing standing between a drifted
  module, or an import of a package the UI system drops, and a scaffolded
  project.
  `TestUINoneCoversEveryModuleWithADependency` fails when a module grows an
  import a UI system drops but has no replacement.
- **A UI system that changes dependencies drops the lockfile too.** `pnpm-lock.yaml`
  describes `frontend/package.json` as the template ships it, so a scaffold that
  removes packages from that file invalidates it. Shipping it anyway passes
  `pnpm install` and fails `pnpm install --frozen-lockfile`, which is what CI
  runs; the first install writes a correct one instead.
- **`methods.ts` is generated at scaffold time and checked in.** The catalogue in
  `cli/cmd/project/authmethod.go` owns the href, title and description of every
  method, and `renderSignInMethods` writes the file for whatever selection was
  asked for. The committed copy is what the template's own `frontend` CI job
  lints, tests and builds, so it has to equal the whole-catalogue render;
  `TestRenderSignInMethodsMatchesTemplate` fails when the two drift. Edit the
  Go catalogue and copy the render out, not the TypeScript on its own.
- **The proxy is the only token refresher.** `frontend/src/proxy.ts` rotates
  the refresh token; `frontend/src/lib/nhost/client.ts` is built without the
  SDK's auto-refresh middleware. Two rotators race on a single-use token and
  the loser's failure deletes the session.
- **The agent bundle is mandatory and duplicated.** `AGENTS.md` and `CLAUDE.md`
  are byte-identical; each `.claude/skills/<name>/SKILL.md` body equals its
  `## <Title>` section of `SKILLS.md` once the frontmatter and `# Title` line
  are stripped and `##` is demoted to `###`.
  [`check-agent-context.sh`](check-agent-context.sh) requires all of it from
  every directory that ships `frontend/package.json`, and fails on a template
  that ships none rather than passing with nothing checked.
- **Embedding is explicit.** `templates/embed.go` names each top-level entry of
  a template instead of embedding the directory, because a developer who ran
  `pnpm install` in it has a `node_modules` there. `templates/embed_test.go`
  compares the embedded set to disk and fails on any entry that is on disk but
  not in the directives. The Nix fileset in `cli/project.nix` cuts
  `node_modules` and `.next` out for the same reason.
- **The CI matrix is checked.** `frontend`, `delete-method` and `ui-system`
  take what they run from their own `strategy.matrix`; a template, method
  directory or `ui/` directory with no matching combination runs zero times
  there. [`check-ci-matrix.sh`](check-ci-matrix.sh) expands each literal
  matrix by GitHub's documented `exclude:` and `include:` rules and fails the
  build on a combination that is missing or names something not on disk. A
  matrix built from an expression such as `fromJSON` fails the check rather
  than being guessed at.
- **`frontend/.gitignore` keeps `.env*` ignored with a `!.env.example`
  negation.** Narrowing it to `.env*.local` leaves `.env` and
  `.env.production` - both loaded by Next.js - tracked.
- **The CLI installs nothing.** `nhost init` has never run a package manager;
  the next steps it prints say what to run. Shipped Markdown writes commands
  as `pnpm <script>`.

## Adding a template

1. Create `templates/<name>/` with a `frontend/` app and the agent bundle. Copy
   `AGENTS.md`, `CLAUDE.md`, `SKILLS.md` and `.claude/skills/` from an existing
   template and retarget the paths they name. Keep the two copies identical;
   `check-agent-context.sh` fails if they drift.
2. Generate the lockfile: `cd templates/<name>/frontend && pnpm install`.
3. Add the template to the catalogue in `cli/cmd/project/template.go`, naming
   its `authDir`, `methodsFile`, `componentsUI` and `uiSystems`. It needs the
   same four sign-in method directories under `authDir`, since the method
   catalogue in `cli/cmd/project/authmethod.go` is shared by every template and
   carries the configuration each method needs on a fresh backend. A React
   template takes `reactUISystems()`; another framework needs its own, with a
   `none` entry, which is what `--ui` defaults to.
4. Add `//go:embed` directives for its top-level entries in
   `templates/embed.go`. `go test ./templates/...` tells you what is missing.
5. Add it to the source fileset in `cli/project.nix`, cutting out its
   `node_modules` and build output the way the other templates do. A plain
   `go build` sees the whole working tree and passes without this, so the
   first thing that notices is the Nix build in CI, and what it reports is the
   `//go:embed` directive from step 4 failing on a directory that is not there.
6. Add the name to `matrix.template` in the `frontend`, `delete-method` and
   `ui-system` jobs of `.github/workflows/templates_checks.yaml`, the method
   directories to `matrix.method`, and the `ui/` directories to `matrix.ui`.
7. Add a row to [Available templates](#available-templates).
8. Regenerate the CLI reference if the flag's help changed:
   `go run ./cli gen-docs > docs/src/content/docs/reference/cli/commands.mdx`.

## How templates are delivered

`templates/embed.go` compiles every template into the CLI with `go:embed`.
`nhost init --template <name>` reads the named directory out of that filesystem
and writes its entries into the project root, refusing first if any of them is
already there. Agent context is the exception: a project that already has its
own `AGENTS.md`, `CLAUDE.md`, `SKILLS.md` or `.claude/` keeps it, and the CLI
names the template's copies it skipped. A new agent-context entry has to be
added to `isAgentContext` in `cli/cmd/project/template.go`, or it refuses like
any other. A bare `--template` lists the catalogue in a picker.
