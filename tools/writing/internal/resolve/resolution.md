| Input | Scope | Voice |
| --- | --- | --- |
| `--scope <docs|blog>` given | the flag | continue with the voice rows below; a path is optional |
| no `--scope`, path under `docs/src/content/docs/**` | `docs` | continue |
| no `--scope`, path under `landing/src/pages/blog/**` | `blog` | continue |
| no `--scope`, any other path or no path | error | error |
| path matches the generated-page exclusion list | `docs`, `excluded: true` | callers skip the document |
| `--voice <slug>` given and a profile with that `slug:` exists | as above | the flag; `--voice nhost-blog` is how an announcement or any post gets the neutral house voice over a byline match |
| scope `blog`, frontmatter lists exactly one author whose byline matches a profile's `byline:` | `blog` | that profile |
| scope `blog`, frontmatter lists exactly one author with no matching profile | `blog` | `nhost-blog`, `reason: unprofiled author` |
| scope `blog`, zero or several authors | `blog` | error: `--voice` required |
| scope `docs` | `docs` | `nhost-docs` |
