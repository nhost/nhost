# Scope: docs

What a page under `docs/src/content/docs/**` requires, on top of the shared
rules in `.claude/docs/writing-rules.md`. The docs are four sections:
`getting-started/` (quickstart, local-development, tutorials), `products/`
(one per product), `platform/` (cli, cloud, self-hosting) and `reference/`
(hand-written only under `reference/graphql/**`, the rest generated). A blog
post is not a docs page; it resolves to the `blog` scope. The site is Astro
with Starlight; pages are MDX. The voice is `nhost-docs`
(`.claude/docs/writing-voices/nhost-docs.md`). The page exemplar is
`products/auth/sign-in-magic-link.mdx`: short, one feature, code before
prose, callouts in Markdown syntax, a UI path in bold. Its UI path line
predates DOCS-06 and DOCS-07: the path is now **Auth → Settings → Sign-In
Methods → Magic Link**, written with `→` and followed by the deep link.

- **DOCS-01** Every page is one of four types and follows its skeleton.
  The section sets the type; where it allows two, the page's job decides.
  - *quickstart* (`getting-started/quickstart/**` and `tutorials/**`):
    opening (who, what they build), prerequisites, numbered steps that each
    end in something the reader can run or see, a final step that shows the
    result; no concept sections.
  - *how-to* (`products/**`, `platform/**`, `local-development/**`): opening
    (who, what they will have done), a requirements callout only when the
    task has prerequisites, one task per `##` section in the order the
    reader performs them, each with the dashboard, config or SDK code that
    does it; limitations, if any, last, before related resources.
  - *concept* (the page a `products/**` or `platform/**` section opens on):
    opening (what the thing is, in one sentence), how it works, when to use
    it and when not to, where it is configured; links to the how-to pages
    that act on it.
  - *reference* (`reference/graphql/**` only): one entity per `##` section
    (option, field, endpoint, command), each with type, default and a
    one-sentence description; a table when entries share a shape.
- **DOCS-02** A page starts from a brief that carries, in this order:
  audience; page type; source paths the claims are checked against; the one
  running example, with the names used in code; dashboard paths; caveats
  the dashboard does not surface; screenshots wanted. A writer never guesses
  a missing field: it asks for what the repository cannot settle, usually
  the outcomes and the running example, and drafts the rest from the
  repository, page and type included, for the user to confirm. The audience
  is always developers and LLMs. A diff is an input to the brief, never the
  brief.
- **DOCS-03** Frontmatter is the schema below, taken from
  `getting-started/quickstart/reactnative.mdx`. `title` is the H1; `head`
  sets the browser title; `sidebar.label` is the short sidebar name when the
  title is long; `keywords` is a list.

  ```yaml
  ---
  title: Get up and running with Nhost and React Native
  description: "Build a React Native app with Nhost and Expo in minutes: set up the SDK, run GraphQL queries, and add mobile authentication."
  keywords: ["React Native", "quickstart", "Expo", "mobile development", "Nhost SDK", "GraphQL"]
  head:
    - tag: title
      content: "React Native Mobile Backend Quickstart | Nhost Docs"
  sidebar:
    label: React Native
  ---
  ```

- **DOCS-04** Callouts use the Markdown syntax `:::note`, `:::tip` or
  `:::caution`, never the `<Aside>` component. A callout that states a
  requirement or an availability caveat carries a `[Title]` on the opening
  line; any other callout may be untitled. A comparison of cases (Cloud and
  local, plan tiers, options that differ by a property) is a table with one
  row per property.
  `<Tabs>` is kept for parallel sets of instructions, such as the same step
  in the dashboard and in `nhost.toml`, or the same code in two languages.
  Vale-enforced: `Nhost.Aside`.

  ```mdx
  :::caution[Requirements]
  - A project on Nhost Cloud or a local project run with `nhost up`.
  :::
  ```

- **DOCS-05** An availability caveat (a feature a plan, a service or a
  version does not support) gets its own titled `:::note` that says why and
  links to the page section where it is explained, and is not repeated in a
  later list. A requirements callout holds only what the reader must have
  before starting.
- **DOCS-06** A path through the dashboard is written in bold with
  `→` (U+2192) between segments, `**Auth → Settings → Sign-In Methods →
  Magic Link**`, matching the labels in the sidebar and tabs. Never `->` or
  `>`. Vale-enforced: `Nhost.UIPathArrow`, `Nhost.NavPaths`.
- **DOCS-07** Every dashboard UI path is followed by the deep-link
  snippet below, verbatim, pointing at
  `https://app.nhost.io/orgs/_/projects/_/<route>`; `_` lets the dashboard
  substitute the reader's organisation and project. The page imports `Icon`
  once. Vale-enforced: `Nhost.RawDashboardURL`, `Nhost.DeepLinkRel`.

  ```mdx
  import { Icon } from '@astrojs/starlight/components';

  open **Database → Native Queries** <a href="https://app.nhost.io/orgs/_/projects/_/database/native-queries/default" target="_blank" rel="noopener noreferrer"><span class="not-content" style="display:inline-block;vertical-align:-0.1em"><Icon name="external" size="0.85em" /></span></a>.
  ```

- **DOCS-08** Images live at `/images/<section>/<page>/<name>.png` under
  `docs/public/`, with alt text naming what is shown. A screenshot of a
  numbered step sits inside that `<Steps>` item; any other image sits
  directly beside the paragraph or code block it illustrates, never grouped
  at the end. Every `SCREENSHOT:` placeholder is replaced before merge.
  Vale-enforced: `Nhost.ScreenshotPlaceholder`.
- **DOCS-09** Grounding is blocking for docs. A page with an unsourced
  product-behaviour claim or a `VERIFY:` marker does not merge, and a judge
  scores it as failing regardless of its other dimensions. Sources are the
  dashboard routes and features, the CLI, service code and `nhost.toml`
  configuration, named by repo-relative path in the brief.

## Page structure

Starlight renders `title` as the H1, so the body starts with a paragraph and
the first heading is `##`. Sections are `##`, substeps `###`. A procedure of
more than two steps that the reader performs in the dashboard is a
`<Steps>` list, imported from `@astrojs/starlight/components`; a procedure
in code is a sequence of fenced blocks with a sentence before each. Mermaid
diagrams (`sequenceDiagram`) are used for request flows, after the code they
explain.

## Screenshot handoff

A writer without dashboard access leaves one `SCREENSHOT:` placeholder per
capture, at the point in the page where the image belongs, with the final
path and a description of what the capture must show in the running
example. Whoever captures the images saves them under `docs/public` at those
paths and replaces each placeholder with `![alt](/images/...)`.

## Brief template

```markdown
# Brief: <page title>

- Scope: docs
- Page type: quickstart | how-to | concept | reference
- Page: docs/src/content/docs/<section>/<page>.mdx

## Audience
Developers and LLMs; note only what they must already know.

## What the reader must be able to do
One bullet per outcome; order is the writer's call unless stated.

## Running example
The one example used in every code block and screenshot, with its names.

## Dashboard paths
Each path the page refers to, with its route under /orgs/_/projects/_/.

## Caveats the dashboard does not surface
Versions, plans, unsupported engines, what a change writes to disk.

## Screenshots wanted
One per dashboard step, in the running example.

## Sources
Repo-relative paths every claim is checked against.
```
