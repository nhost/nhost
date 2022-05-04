# `@nhost/docgen`

Generate markdown documentation automatically for Docusaurus using the output of [TypeDoc](https://typedoc.org/).

DocGen is an opinionated tool that works the best with Nhost's own codebase.

## CLI options

| Option          | Type      | Required | Notes                                                                                              |
| :-------------- | :-------- | :------: | :------------------------------------------------------------------------------------------------- |
| -p, --path      | `string`  |    ✔️    | Path to TypeDoc output JSON.                                                                       |
| -o, --output    | `string`  |    ✔️    | Path to the output folder where generated documentation should be copied.                          |
| -r, --root      | `string`  |    ✔️    | Root folder of generated documents relative to Docusaurus.                                         |
| -t, --title     | `string`  |          | Title of the sidebar menu where generated documentation is copied.                                 |
| -s, --slug      | `string`  |          | Base slug to use for generating documentation.                                                     |
| --sidebarConfig | `string`  |          | Name of the Docusaurus sidebar configuration to display (see `sidebars.js`).                       |
| -v, --verbose   | `boolean` |          | Whether or not to run the CLI in verbose mode.                                                     |
| -c, --cleanup   | `boolean` |          | Whether or not to cleanup the output directory before generating docs.                             |
| --config        | `string`  |          | DocGen confgiuration file (see [Sample config](#sample-config)). Overrides command line arguments. |
| -h, --help      | `n/a`     |          | Display help menu.                                                                                 |

## Sample config

`packages/hasura-auth-json/auth.docgen.json`:

```json
{
  "path": "./.docgen/auth.json",
  "output": "../../docs/docs/reference/docgen/javascript/auth",
  "root": "reference/docgen/javascript/auth",
  "title": "Auth",
  "slug": "/reference/javascript/auth",
  "sidebarConfig": "referenceSidebar",
  "cleanup": true
}
```

## Install

```bash
$ pnpm install
```

## Run locally

```bash
$ pnpm dev -- --config ./docgen.json
```

## Lint

```bash
$ pnpm lint
```

## Run tests

```bash
$ pnpm test
```

## Format using Prettier

```bash
$ pnpm format
```

## Build

```bash
$ pnpm build
```

## Run the built version

```bash
$ pnpm start -- --config ./docgen.json
```
