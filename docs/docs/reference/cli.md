---
title: 'CLI'
sidebar_position: 4
---

This section is a reference for the command available in the [Nhost CLI](/platform/cli).

## init

Intialize a local Nhost app in the current working directory.

```
nhost init
```

If you already have a Nhost app in Nhost Cloud you can use that app as a starting point by appending `--remote` to the command.

This will pull the database migrations and Hasura metadata from the Nhost Cloud app locally for you to use as a starting point.

```
nhost init --remote
```

## dev

Launch the development environment for your app. Once the environment is up, the command will:

- Apply database migrations.
- Apply the Hasura metadata.
- Apply seed data.

```bash
nhost dev
```

## purge

Delete all containers created by `nhost dev`

```bash
nhost purge
```

To delete all containers **and the local database**, append `--data` to the command.

```bash
nhost purge --data
```

## link

Link the local Nhost app in your working directory to an app in Nhost Cloud.

```bash
nhost link
```

## login

Authenticate the CLI with your Nhost user.

```bash
nhost login
```

## logout

Remove authentication for the CLI.

```bash
nhost logout
```

## logs

Output logs of any service container

```bash
nhost logs
```

## Global flags

Turn on debug output.

### `--debug`, `-d`

```bash
nhost dev --debug
nhost init -d
```

### `--log-file`, `-f`

Save output to a given file.

```bash
nhost dev -d --log-file some-file.txt
nhost logs -f some-file.txt
```
