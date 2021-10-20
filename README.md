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

[![Build](https://github.com/nhost/cli-go/actions/workflows/build.yaml/badge.svg)](https://github.com/nhost/cli-go/actions/workflows/build.yaml)
[![Release](https://github.com/nhost/cli-go/actions/workflows/release.yaml/badge.svg)](https://github.com/nhost/cli-go/actions/workflows/release.yaml)
[![Go Report Card](https://goreportcard.com/badge/github.com/nhost/cli-go)](https://goreportcard.com/report/github.com/nhost/cli-go)
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
  * [Blank Local Project](#blank-local-project)
  * [Existing Remote Project](#existing-remote-project)
  * [Debugging](#debugging)
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

To properly understand the design philosophy adopted by Nhost for this CLI, [read this](https://github.com/nhost/cli-go/wiki/Design-Philosophy).

## All-powerful `nhost` command

CLI `v1.0.0` automates everything and launches the entire development environment locally using just a single command:

    nhost

This will do the following in specific order:

1. Intialize the current working directory as an Nhost project.
2. Offer you the option of cloning pre-configured Nhost compatible frontend templates for the framework of your choice in the `web/` directory of your project root.
3. Launch the local development environment.

If you use just the `nhost` command in an already initialized project directory, then it will directly launch the development environment for that project. Same as `nhost dev` command.

## Frontend Support

The all-powerful single `nhost` command will offer you the option of cloning frontend templates for framework of your choice (NuxtJs, NextJs, ReactJs, etc.) in the `web/` directory of your project root which will be preinstalled with all the Nhost libraries and plugins required to allow you to immediately start developing your frontend project with the Nhost stack to be launched in your development environment. 

This is an **optional** choice, and you can refuse to clone these frontend templates if you wish to manually install the required Nhost plugins and libraries for your frontend project.

Should you choose to skip this prompt, and wish to clone these templates afterwards manually in your project, you can use the following command:

    nhost templates

Example with flag:

    nhost templates --framework nuxt

This will clone the Nhost compatible template for NuxtJs framework in the `web/` directory of your project root.

# Installation

Installing the CLI is easy.

- Check your current CLI version by running `nhost version`
- If you version is less than `v1.0.0`, then download the latest version by executing the following in your terminal:

```
curl -L https://raw.githubusercontent.com/nhost/cli-go/main/get.sh | bash
```

This will autoatically detect your **operating system** and **platform/architecture**, and download it's equivalent binary in `/usr/local/bin` directory. 

<br>

If your installed version is >= `v1.0.0`, then your CLI version already supports the `upgrade` command to automatically check the latest available version of the CLI and install it depending on your operating system and architecture. To use this, run the following:

    nhost upgrade

## Installing On Windows

If you have `curl` and `Windows Subsytem for Linux` in your windows environment, you can safely use the above command, and it should download the `.exe` variant of the binary in your current working directory.

However, if you do not have the above dependencies, then you can manually download the [latest release](https://github.com/nhost/cli-go/releases) binary depending on your platform architecture from [here](https://github.com/nhost/cli-go/releases).

## Installing Using Go

If you have go installed in your system, and would like to download using that,
please use the following command:

    go get -u github.com/nhost/cli-go

This command will install the `nhost` executable binary
along with its dependencies.

## OS & Platform Support

- [x] Linux
- [x] MacOS
- [x] Windows

### Apple Silicon (M1)

You can use the CLI binary without any issues on M1 chip, except after your project is initialized, then change the `hasura` GraphQL Engine image in your `{project_root}/nhost/config.yaml` to `fedormelexin/graphql-engine-arm64`.

This is because Hasura has still not released an M1 optimized version for their GraphQL engine image, and the current one has some issues running natively on M1.

The `fedormelexin/graphql-engine-arm64` will temporarily resolve the issue and run Hasura GraphQL engine using Rosetta on your machine, until Hasura launches an M1 optimized image.

This will not cause any issues/changes in your project's production environment since the `nhost/config.yaml` file is only used for local development. This workaround is only to ease out the pain in your local development experience.

# Getting Started

To get the list of all the commands supported by the CLI, use:

    nhost --help

Complete documentation for all commands is available [here](/docs).

# Usage

Just one command:

    nhost

On first run in an empty directory, since the directory is not initialized for an Nhost project, it will do so, and launch the development environment.

From second run onwards, since the directory already contains an Nhost project, it will directly launch the development environment for that project.

You can also execute the aforementioned actions using their specific commands:

1. `nhost init` - to intialize a blank local project in current working directory. Or `nhost init --remote --project <remote_project_name>` to clone an existing project from Nhost console.
2. `nhost dev` - to launch the development environment for your initialized project.

## **Blank Local Project**

If you do not have an already existing project on Nhost console, and you wish to create a new project on Nhost console and link it automatically to the local environment, then use:

    nhost link

Note: ability to create new projects on Nhost console directly from your local environment is only available in CLI `v1.0.0` or above.

If you have CLI version less than `v1.0.0`, then you need to have an already existing project on Nhost console.

> To upgrade your CLI to latest version, check [this](#installing) out.

## **Existing Remote Project**

If you already have a remote project for which you would like to setup a local development environment for, use the following:

    nhost init --remote

This will present you with a list of both your personal and team projects available on [Nhost console](https://console.nhost.io), and you can select any one of those to set up a local environment for.

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

# Migration

There are genuine reasons why we advise you AGAINST installing the new CLI `v1.0.0` permanently in your $HOME path.

First and the foremost one is that the new CLI produces the `nhost/config.yaml` file in your project root in a different format than the last CLI, and not to mention reads the same during `nhost dev` command.

Now, if you already have existing Nhost projects initialized in multiple directories, and you upgrade to CLI `v1.0.0` globally, the new CLI may not be able to read the `nhost/config.yaml` files saved in older formats, hence breaking your local development environment.

### How do I migrate permanently to new version?

It's easy. Just backup all your existing Nhost projects in their respective remote repositories. Then simply move the new downloaded CLI in current working directory to your $HOME path.

To find out your $HOME path, use the following in your terminal:

    echo $HOME
  
To check whether the CLI has been installed globally properly, use the following from any directory in your system:

    nhost version

# Dependencies

For versions less than `v1.0.0`:

- [Hasura CLI](https://hasura.io/docs/latest/graphql/core/hasura-cli/install-hasura-cli.html#install-hasura-cli)
- [Docker](https://www.docker.com/get-started)
- [Docker Compose](https://docs.docker.com/compose/install/)
- [curl](https://curl.se/)
- [Git](https://git-scm.com/downloads)

For versions >= `v1.0.0`:

- [Docker](https://www.docker.com/get-started)
- [Git](https://git-scm.com/downloads)
