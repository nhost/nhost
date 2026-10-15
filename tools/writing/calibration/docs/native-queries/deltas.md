# Deltas: native queries

What a human changed between the unedited LLM draft (`draft.mdx`, `d145a65938`)
and the approved page (`final.mdx`, `87e663c83a`) in PR #5173. Each row
proposes the ID of the rule the change should produce and one line stating what
that rule must say. The rules doc and the docs target define every proposed ID
in the same PR.

Numbers follow the order in which each family's rules are listed for the
rules doc and the docs target, so a gap is a rule that this pair does not
exercise. Deltas 2 and 3 are the two factual corrections; `brief.md` does not
contain either.

| # | Draft | Final | Proposed ID | The rule must state |
| --- | --- | --- | --- | --- |
| 1 | Unrelated examples: the SQL selects from `public.customers` with `where country = {{country}}`, the GraphQL calls `customers_by_country`, and the relationship query nests an `order_totals` field that no SQL defines | One running example end to end: the `post_summary` model, the `popular_posts` query with a `min_views` argument and a second query, `post_stats_query`, defined in SQL before the relationship uses it; connective sentences such as "In our example, we have" and "In the example, that is `stats`, `post_stats_query`" | WR-CONTENT-03 | A page uses exactly one running example in every code block and screenshot, introduced once and carried through with sentences that tie each step back to it. |
| 2 | "Check and change the version under **Settings -> Hasura**." | "Check and change the version under **GraphQL → Settings → Engine**", followed by a deep link to `graphql/settings?tab=engine` | WR-ANTI-02 | A UI location is never written from memory; every path is checked against the dashboard routes and components it names, or marked for verification. |
| 3 | Local changes "land as a migration file under `nhost/migrations/` along with the metadata change", so "a local experiment leaves migration files behind" | Local changes are "written to `nhost/metadata/`. No migration file is created, because these changes run no SQL" | WR-ANTI-03 | A side effect of an action (files written, state changed, data kept) is never inferred from an API's name; it is stated only when the source shows it. |
| 4 | `import { Aside, Steps, Tabs, TabItem }`; requirements in `<Aside type="caution" title="Requirements">`; Cloud and local behaviour in two `<TabItem>`s | `:::caution[Requirements]` and `:::note[...]` callouts; Cloud and local compared in one table with a row per property | TGT-DOCS-04 | Callouts use `:::note`, `:::tip` or `:::caution` with a `[Title]`, never `<Aside>`; a comparison of cases is a table, and `<Tabs>` is kept for parallel sets of instructions. |
| 5 | Bold UI paths with no link, for example "open **Database -> Native Queries**" | Each dashboard path is followed by the house deep link: `<a href="https://app.nhost.io/orgs/_/projects/_/..." target="_blank" rel="noopener noreferrer">` wrapping a `not-content` span with `<Icon name="external" size="0.85em" />` | TGT-DOCS-07 | Every dashboard UI path is followed by the deep-link snippet verbatim, pointing at `https://app.nhost.io/orgs/_/projects/_/<route>`. |
| 6 | Nine `{/* SCREENSHOT: /images/products/database/native-queries/<name>.png ... */}` placeholders, each describing a capture | 14 PNGs under `/images/products/database/native-queries/`: four inside the `<Steps>` items they illustrate, ten beside the paragraph or code block they illustrate; the placeholders are gone | TGT-DOCS-08 | Images live at `/images/<section>/<page>/<name>.png`, sit inside the `<Steps>` item or next to the paragraph they illustrate, and replace every `SCREENSHOT:` placeholder before merge. |
| 7 | Headings "How the pieces fit together", "Field kinds", "Query it", "Local projects and version control" | "Native Query Concepts", "The `Kind` Field", "Run a native query", "Cloud and local projects" | WR-CONTENT-02 | Headings name the task the reader performs or the thing they work with, not a narrative phrase, and cover every case the section covers. |
| 8 | A "The URL follows the project's other database pages" paragraph with a fenced `/orgs/{org}/projects/{project}/database/native-queries/default` block | Removed; the location is the bold UI path plus its deep link | WR-ANTI-07 | Raw dashboard URL patterns are not documented as content; the reader gets the UI path and a deep link instead. |
| 9 | Constellation is the third bullet of the Requirements aside and the last bullet of Limitations, with no explanation | Its own `:::note[Not yet supported by Constellation]` saying why the root fields are absent, linking to the Constellation page section on what still runs on Hasura; dropped from Limitations | TGT-DOCS-05 | An availability caveat gets its own titled callout that says why and links to where it is explained, and is not repeated in a later list; a requirements callout holds only what the reader must have. |

## Smaller edits not counted as deltas

These changed between the two files but are mechanical or local wording, so
they do not get a row. Later rules or Vale checks may cover them.

- UI path separators changed from `->` to `→` throughout.
- The command palette mention gained its shortcut (`⌘K` on Mac, `Ctrl+K` on
  Windows/Linux).
- The JavaScript SDK link moved from `/reference/javascript` to
  `/reference/javascript/nhost-js/graphql`.
- "GraphQL explorer" became "GraphQL Playground", with the navigation path
  **GraphQL → Playground**.
- The interpolation and alias rules moved from bullets after the steps, and
  the `args` rule from a paragraph, into `_Note: ..._` lines beside the code
  they explain.
- Sentence-level rewording, for example "Use one when" became "Native queries
  are useful when", and "Limitations" gained a lead-in sentence.
