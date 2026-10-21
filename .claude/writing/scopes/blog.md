# Scope: blog

What a post under `landing/src/pages/blog/**` requires, on top of the shared
rules in `.claude/writing/rules.md`. The blog is Next.js MDX, one file
per post. The voice comes from the post's byline or the brief's `author:`, as
the resolution table in the rules doc decides; `nhost-blog` is the house
voice. Every count below is measured over the 86 posts at `79bfe1016b`, so
this file describes the blog as it is rather than importing docs habits.
Where the corpus and the shared rules disagree, the rules win, whether or not
the case is named below.

The mechanical half of this scope is enforced by Vale through
`landing/.vale.ini`, which runs the shared `Nhost` style and the blog-only
`NhostBlog` style from `.vale/styles/`. The rule that enforces an ID is named
on its line below; the tiers and their counts are in `.vale/styles/README.md`.
The rest of this file is checked by reading.

- **BLOG-01** Every post is one of five types and follows its shape.
  - *announcement* (`Product` is the most used tag, 47 posts): the first
    paragraph names what shipped and who can use it; then what it does, how
    to use it, its limits or plan, and a closing call to action.
  - *technical explainer*: opens on a concrete problem or example, explains
    the idea before the code, then builds it; caveats sit beside the step
    they qualify.
  - *tutorial* (`Guide`, 8 posts): a goal, prerequisites, numbered steps
    that each end in something the reader can run, and the result.
  - *newsletter*: one `##` section per item, each a short paragraph and a
    link.
  - *comparison*: a summary table first, then one section per deciding
    factor, fair to both sides, ending in when to choose which.
- **BLOG-02** A post starts from a brief that carries, in this order: the
  byline, the person the post is by; `author:`, a voice slug (the byline's
  own profile when there is one, else `nhost-blog`); post type; thesis, the
  one claim or announcement the post makes; the takeaway, what the reader
  leaves knowing or doing; three to six key points; material from the
  author that the repository cannot supply (experience, a customer's story,
  numbers, an external service), each piece with its source; links; the
  call to action; the sources its product claims are checked against. The
  audience is developers and LLMs, plus anyone the brief names. A writer
  asks for the byline first, then interviews the author until the thesis,
  the takeaway, the key points and the outside material are settled; it
  never guesses a missing field or invents material. A diff alone is never
  a brief.
- **BLOG-03** The first paragraph states the thesis. Every section
  supports it, and a key point from the brief that has no section is missing
  from the post.
- **BLOG-04** The file opens with the imports, then
  `export const article = {...}`, then the default export, as every post
  does (86 of 86); this is `point-in-time-recovery.mdx`:

  ```mdx
  import { BlogPostLayout } from '@/components/blog/BlogPostLayout'

  export const article = {
    title: 'Protect Your Data with Point-in-Time Recovery',
    description:
      'Restore your database to any moment in time with our new Point-in-Time Recovery (PITR) feature',
    image: '/images/blog/og-pitr.png',
    date: '2025-03-11',
    seoTitle: 'Point-in-Time Recovery for Postgres',
    seoDescription: 'Nhost Point-in-Time Recovery lets you restore your Postgres database to any moment in a 7-day window and import backups across projects.',
    authors: [
      {
        name: 'Nuno Pato',
        title: 'CEO',
        avatarUrl: '/images/avatars/nuno.jpeg',
        url: 'https://twitter.com/nunopato',
      },
    ],
    tags: ['Product', 'Database', 'Backup'],
  }

  export default (props) => <BlogPostLayout article={article} {...props} />
  ```

  `title`, `image`, `date`, `seoTitle`, `seoDescription`, `authors` and
  `tags` appear in all 86 posts and `description` in 84; a post carries all of them. `date` is
  `YYYY-MM-DD`. An author's `name` is the byline the voice resolves from.
- **BLOG-05** The layout renders the title, so the body starts with a
  paragraph and uses `##` and `###` only; the 7 posts with a `#` heading in
  the body are the exception. There are no `:::` callouts on the blog (0 of
  86); a caveat is a sentence beside what it qualifies. Vale-enforced:
  `NhostBlog.BodyHeading`, `NhostBlog.Callout`.
- **BLOG-06** Links are plain Markdown, as 555 of the 570 links outside
  code blocks are. `<a target="_blank">` is used only when a new tab is
  wanted, and then always with `rel="noopener noreferrer"`, as all 15 such
  links have. Product pages link as `https://nhost.io/product/<name>`, docs
  pages as `https://docs.nhost.io/<path>`, under one of the four docs
  sections. Vale-enforced: `NhostBlog.NewTabRel`, `NhostBlog.DocsLinkPath`,
  `NhostBlog.LegacyHost`, `NhostBlog.InsecureLink`.
- **BLOG-07** A post's images live in its own folder,
  `landing/public/images/blog/<slug>/`, referenced as
  `/images/blog/<slug>/<name>.<ext>` and shown with `next/image` (imported
  by 46 posts) or Markdown image syntax. The `image:` social image is
  usually `/images/blog/<slug>/banner.png` (48 posts); 18 older posts use a
  flat `/images/blog/og-<name>.png`, which new posts do not. A missing image
  is a `SCREENSHOT:` placeholder at its path, as under "Placeholders" in the
  rules doc. Vale-enforced: `NhostBlog.ImageFolder`,
  `Nhost.ScreenshotPlaceholder`.
- **BLOG-08** A post ends on a closing paragraph with the brief's call
  to action: a link to the docs, to Discord or X, or to sign up. Most posts
  in the corpus (67 of 86) end without one; the call to action is the
  standard for new posts. A post never ends on a "Conclusion", "Wrap up" or
  "Summary" section, though 27 posts do: the shared rule against filler
  sections wins. Vale-enforced: `NhostBlog.ClosingHeading`,
  `Nhost.FillerHeadings`.
- **BLOG-09** Blog-specific tells of generated text, described by
  pattern:
  - an anecdote, customer, quote or number the brief and the sources do not
    supply;
  - a subhead that promises what a term "actually means" (1 post has one),
    Vale-enforced by `NhostBlog.ActuallyMeans`;
  - the thesis set alone in bold as a paragraph of its own, Vale-enforced by
    `NhostBlog.BoldParagraph`, which cannot tell it from a bold pseudo-heading
    and so only suggests;
  - a framing paragraph about the industry, the times or the reader's
    journey before the post reaches its thesis.
- **BLOG-10** Product claims in a post (availability, plans, limits,
  defaults, what a feature does) are grounded as in the docs: checked
  against the dashboard, the CLI, the services, or nhost-be's console
  metadata for Nhost Cloud behaviour, or marked `VERIFY:`. A post with an
  unsourced product claim does not merge. Brief fidelity is blocking: a post
  that drops the thesis or a key point does not merge either. Vale-enforced,
  for the marker only: `Nhost.VerifyMarker`.

## Brief template

```markdown
# Brief: <post title>

- Scope: blog
- Byline: <the person the post is by>
- author: <voice slug: nhost-blog, nuno-pato, david-barroso, max-serdiukov>
- Post type: announcement | technical explainer | tutorial | newsletter | comparison
- Post: landing/src/pages/blog/<slug>.mdx
- Tags: <from the existing tags, Product first for an announcement>

## Thesis
The one claim or announcement, in one sentence.

## Takeaway
What the reader leaves knowing or doing.

## Key points
Three to six, in order.

## Material from the author
Experience, stories, numbers or external services the repository cannot
supply, each with its source or link. None, if the post needs none.

## Links
Docs pages, product pages and repositories the post points to.

## Call to action
What the reader does after the last paragraph.

## Sources
Repo-relative paths every product claim is checked against.
```
