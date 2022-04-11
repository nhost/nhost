---
title: 'Nhost CLI'
slug: /reference/cli
---

Run `nhost help` in your terminal to get a detailed listing of all available commands.

---

## `nhost`

Run the Nhost development environment. If the current directory has not been initialized as an Nhost app, `nhost` will run you through the initialization.

```bash
nhost
```

### Frontend templates

The `nhost` command will offer you the option of cloning frontend templates for framework of your choice (Nuxt, Next.js, React).

The frontend template will be cloned in the `web/` directory of your app root. It will have the Nhost SDK preinstalled and configured.

---

## `nhost dev`

Launch the development environment for your app.

```bash
nhost dev
```

To trace all output and debug issues, run `nhost dev --debug`.

```bash
nhost dev --debug
```

---

## `nhost init`

Intialize a blank local app in current working directory:

```bash
nhost init
```

Or clone an existing app from [nhost.io](https://nhost.io):

```bash
nhost init --remote
```

---

## `nhost link`

Link the local Nhost app in your working directory to [nhost.io](https://nhost.io).

```bash
nhost link
```

---

## `nhost logs`

Check real-time logs of any service container

You can run this command in parallel, while your local environment is already running. Use `-f` to save output to a file.

```bash
nhost logs
```

---

## Global flags

Turn on debug output.

#### `--debug`, `-d`

```bash
nhost dev --debug
nhost init -d
```

#### `--log-file`, `-f`

Save output to a given file.

```bash
nhost dev -d --log-file some-file.txt
nhost logs -f some-file.txt
```
