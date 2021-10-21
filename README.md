<div align="center">
  <h1>Nhost CLI</h1>
  <a href="https://docs.nhost.io/cli">Website</a>
    <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://nhost.io/blog">Blog</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="docs/">Command Docs</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://discord.com/invite/9V7Qb2U">Support</a>
  <br />
  <br />
</div>

<div align="center">

Launch Blazingly Fast Development Environments For Your Nhost Stack

[![Build](https://github.com/nhost/cli/actions/workflows/build.yaml/badge.svg)](https://github.com/nhost/cli/actions/workflows/build.yaml)
[![Release](https://github.com/nhost/cli/actions/workflows/release.yaml/badge.svg)](https://github.com/nhost/cli/actions/workflows/release.yaml)
[![Go Report Card](https://goreportcard.com/badge/github.com/nhost/cli)](https://goreportcard.com/report/github.com/nhost/cli)
  <a href="https://twitter.com/nhostio" target="_blank" rel="noopener noreferrer">
      <img src="https://img.shields.io/twitter/follow/nhostio?style=social" />
    </a>

  <br />

</div>



# Contents

- [Design](#design)
- [Installation](#installation)
  * [Installing On Windows](#installing-on-windows)
  * [Installing Using Go](#installing-using-go)
  * [OS & Platform Support](#os--platform-support)
      * [Apple Silicon (M1)](#apple-silicon-m1)
- [Getting Started](#getting-started)
- [Usage](#usage)
  * [Blank Local app](#blank-local-app)
  * [Existing Remote app](#existing-remote-app)
  * [Debugging](#debugging)
- [Functions](#functions)
- [Migration](#migration)
- [Dependencies](#dependencies)
- [Community](#community)

## Documentation

- [Command Docs](/docs)
- [Changelog](CHANGELOG.md)
- [Contributing](CONTRIBUTING.md)
- [Conduct](CONDUCT.md)

<br>

# Design

To properly understand the design philosophy adopted by Nhost for this CLI, [read this](https://github.com/nhost/cli/wiki/Design-Philosophy).

## All-powerful `nhost` command

CLI `v0.5.0` automates everything and launches the entire development environment locally using just a single command:

    nhost

This will do the following in specific order:

1. Intialize the current working directory as an Nhost app.
2. Offer you the option of cloning pre-configured Nhost compatible frontend templates for the framework of your choice in the `web/` directory of your app root.
3. Launch the local development environment.

If you use just the `nhost` command in an already initialized app directory, then it will directly launch the development environment for that app. Same as `nhost dev` command.

## Frontend Support

The all-powerful single `nhost` command will offer you the option of cloning frontend templates for framework of your choice (NuxtJs, NextJs, ReactJs, etc.) in the `web/` directory of your app root which will be preinstalled with all the Nhost libraries and plugins required to allow you to immediately start developing your frontend app. 

This is an **optional** choice, and you can refuse to clone these frontend templates if you wish to manually install the required Nhost plugins and libraries for your frontend app.

# Installation

Installing the CLI is easy.

- Check your current CLI version by running `nhost version`
- If you version is less than `v0.5.0`, then download the latest version by executing the following in your terminal:

```
sudo curl -L https://raw.githubusercontent.com/nhost/cli/main/get.sh | bash
```

This will autoatically detect your **operating system** and **platform/architecture**, and download it's equivalent binary in `/usr/local/bin` directory. 

<br>

If your installed version is >= `v0.5.0`, then your CLI version already supports the `upgrade` command to automatically check the latest available version of the CLI and install it depending on your operating system and architecture. To use this, run the following:

    sudo nhost upgrade

## Installing On Windows

If you have `curl` and `Windows Subsytem for Linux` in your windows environment, you can safely use the above command, and it should download the `.exe` variant of the binary in your current working directory.

However, if you do not have the above dependencies, then you can manually download the [latest release](https://github.com/nhost/cli/releases) binary depending on your platform architecture from [here](https://github.com/nhost/cli/releases).

## Installing Using Go

If you have go installed in your system, and would like to download using that,
please use the following command:

    go get -u github.com/nhost/cli

This command will install the `nhost` executable binary
along with its dependencies.

## OS & Platform Support

- [x] Linux
- [x] MacOS
- [x] Windows

### Apple Silicon (M1)

You can use the CLI binary without any issues on M1 chip, except after your app is initialized, then change the `hasura` GraphQL Engine image in your `{app_root}/nhost/config.yaml` to `fedormelexin/graphql-engine-arm64`.

This is because Hasura has still not released an M1 optimized version for their GraphQL engine image, and the current one has some issues running natively on M1.

The `fedormelexin/graphql-engine-arm64` will temporarily resolve the issue and run Hasura GraphQL engine using Rosetta on your machine, until Hasura launches an M1 optimized image.

This will not cause any issues/changes in your app's production environment since the `nhost/config.yaml` file is only used for local development. This workaround is only to ease out the pain in your local development experience.

# Getting Started

To get the list of all the commands supported by the CLI, use:

    nhost --help

Complete documentation for all commands is available [here](/docs).

# Usage

Just one command:

    nhost

On first run in an empty directory, since the directory is not initialized for an Nhost app, it will do so, and launch the development environment.

From second run onward, since the directory already contains an Nhost app, it will directly launch the development environment for that app.

You can also execute the aforementioned actions using their specific commands:

1. `nhost init` - to intialize a blank local app in current working directory. Or `nhost init --remote` to clone an existing app from Nhost console.
2. `nhost dev` - to launch the development environment for your app.

## **Blank Local app**

If you do not have an already existing app on Nhost console, and you wish to create a new app on Nhost console and link it automatically to the local environment, then use:

    nhost link

Note: ability to create new apps on Nhost console directly from your local environment is only available in CLI `v0.5.0` or above.

If you have CLI version less than `v0.5.0`, then you need to have an already existing app on Nhost console.

> To upgrade your CLI to latest version, check [this](#installing) out.

## **Existing Remote app**

If you already have a remote app for which you would like to setup a local development environment for, use the following:

    nhost init --remote

This will present you with a list of apps, across all the workspaces, available on [Nhost console](https://console.nhost.io), and you can select any one of those to set up a local environment for.

Subsequently run the initialized local development environment with:

    nhost

## Debugging

If you wish to trace the output and check debug logs for any command, use the global flag `--debug` or `-d`

Example:

    nhost dev -d

This will print the debug logs along with the standard information, warning and error logs while the `dev` command is under execution.

### ProTip 1

Supplying the global `-f` or `--log-file` flag to `nhost dev` will automatically append the logs of all service containers to your supplied file before exiting the command.

### ProTip 2

You can also parallely run `nhost logs` to check real time logs of any service container of your choice, while your local environment is already running. And you can also save it's output, again, by using `f` or `--log-file` flag.

<br>

# Functions

All functions must be stored inside the `{app_root}/functions` directory.

When you launch the development environment using `nhost` or `nhost dev`, it will automatically also start your functions server, and display the URL on your terminal, in the following format:

    http://localhost:1337/v1/functions

## Runtimes

Nhost CLI currently supports following runtimes:

1. NodeJS (Both Javascript and Typescript)
2. Golang

You need to have the run-time installed for the language in which you are writing functions.

For example, if you are writing your functions in Golang, you need to have golang installed in your system to run those functions.

## Examples

When you first initialize your app, using `nhost` (not `nhost init`), the CLI will offer to clone ready-made hello-world templates for the functions.

You can also manually download our hello-world templates for your runtime of choice, [from here](https://github.com/nhost/nhost/templates/functions).

## Route Parsing Logic

Your file names, and file tree structure inside `{app_root}/functions` directory is used to generate dynamic routes for your functions.

Example:

```
functions/

		index.js --> served at /
		hello.go --> served at /hello

		sub/
				hello.go --> served at /sub/hello
				index.js --> served at /sub

				/sub-sub
								hello.js --> served at /sub/sub-sub/hello
								index.go --> served at /sub/sub-sub
```

Therefore, if you want to call your `functions/hello.go` function, you can call the following route:

    http://localhost:1337/v1/functions/hello

Similarly, for `functions/sub/index.js`, you will call:

    http://localhost:1337/v1/functions/sub

## Dynamic Route Generation

You can write new functions, or edit them, while keeping your development environment running (using `nhost dev`).

You DO NOT need to restart your environment, if you have edited any function, or created a new one.

Your environment will automatically pick up the edited/created function and map it to it's equivalent route dynamically.

## Barebone Functions Server

If you simply want to test a function, that doesn't necessarily need the rest of your Nhost environment/services running, you can serve ONLY your functions using `nhost functions`.

This command is very helpful for quick testing and prototyping.

<br>

# Migration

CLI (>= v0.5.0) produces the `nhost/config.yaml` file in your app root in a different format than the legacy CLI, and not to mention reads the same during `nhost dev` command.

Now, if you already have existing Nhost apps initialized in multiple directories, and you upgrade to CLI `v0.5.0` globally, the new CLI may not be able to read the `nhost/config.yaml` files saved in older formats, hence breaking your local development environment.

### How do I migrate permanently to new version?

It's easy. Follow the steps:

1. Change to a new blank directory.
2. Initialize a new app using `nhost init`.
3. Copy-paste your migrations and other relevant data to the new app.
4. Link this new app with your existing one using `nhost link`, and add the git remote, as well.
5. Start your environment using `nhost dev` and ascertain whether the app is working fine.

# Dependencies

For versions >= `v0.5.0`:

- [Docker](https://www.docker.com/get-started)
- [Git](https://git-scm.com/downloads)

For versions less than `v0.5.0`:

- [Hasura CLI](https://hasura.io/docs/latest/graphql/core/hasura-cli/install-hasura-cli.html#install-hasura-cli)
- [Docker](https://www.docker.com/get-started)
- [Docker Compose](https://docs.docker.com/compose/install/)
- [curl](https://curl.se/)
- [Git](https://git-scm.com/downloads)
