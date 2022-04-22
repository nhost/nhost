# DocGen

Generate markdown documentation automatically for Docusaurus using [TypeDoc](https://typedoc.org/) output.

DocGen is an opinionated tool that works the best with Nhost's own codebase.

## CLI options

| Option        | Required | Notes                                                          |
| :------------ | :------: | :------------------------------------------------------------- |
| -p, --path    |    ✔️    | Path to TypeDoc output JSON file                               |
| -o, --output  |    ✔️    | Path to the output directory                                   |
| -r, --root    |    ✔️    | Root folder of generated documents relative to Docusaurus root |
| -t, --title   |          | Title of the root sidebar menu                                 |
| -c, --cleanup |          | Cleanup the output directory before generating docs            |
| -v, --verbose |          | Verbose mode                                                   |
| -h, --help    |          | Display help for command                                       |

## Install

```bash
$ pnpm install
```

## Run locally

```bash
$ pnpm dev -- --path <path/to/typedoc/output> --output <path/to/docusaurus/docs>
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
$ pnpm start -- --path <path/to/typedoc/output> --output <path/to/docusaurus/docs>
```
