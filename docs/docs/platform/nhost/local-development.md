---
title: 'Nhost CLI'
sidebar_position: 3
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Nhost CLI lets you run Nhost's development environment locally on macOS, Linux and Windows.

---

## Installation

Download and install Nhost CLI for your platform by running this command in your terminal:

```bash
sudo curl -L https://raw.githubusercontent.com/nhost/cli/main/get.sh | bash
```

### Dependencies

- [Git](https://git-scm.com/downloads) must be installed on your system
- [Docker](https://www.docker.com/get-started) must be installed and running when using Nhost CLI

### Function runtimes

To run serverless functions locally, you must have the appropriate runtimes installed on your machine:

- JavaScript and TypeScript functions: `Node.js 14.*`

For Node.js, you will also need to have [express](https://www.npmjs.com/package/express) installed in your repository:

<Tabs>
  <TabItem value="npm" label="npm" default>

```bash
npm install --save-dev express @types/express
```

  </TabItem>
  <TabItem value="yarn" label="Yarn">

```bash
yarn add -D express @types/express
```

  </TabItem>
</Tabs>

[Read more about runtimes](/platform/serverless-functions)

---

## Windows support

If you have Windows Subsystem for Linux and `curl` in your Windows environment, you run the command following the instructions above. It will download the `.exe` binary to your current working directory.

If you do not have the above dependencies, download and install the latest release manually from [GitHub releases](https://github.com/nhost/cli/releases).

---

## Apple silicon (M1)

As of late 2021, Hasura does not yet have an M1 optimized version for their GraphQL engine, which Nhost depends on.

If you have a MacBook with an M1 chip, the CLI will automatically change the image used in `nhost/config.yaml` of your app:

```yml
services:
  hasura:
    image: fedormelexin/graphql-engine-arm64
```

This will run the Hasura GraphQL engine using Rosetta on your machine until an M1 optimized image is launched.

---

## Upgrading

If you already Nhost CLI installed, you can upgrade your installation:

```bash
# sudo permissions needed
sudo nhost upgrade
```

The `upgrade` command was added in `0.5.0`.
