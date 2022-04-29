---
title: 'Get Started with Nhost CLI'
sidebar_position: 2
---

# Get started with Nhost CLI

Nhost's command-line interface (CLI) lets you run a complete Nhost development
environment locally with the following services: PostgreSQL database, Hasura,
Authentication, Storage (MinIO), Serverless Functions, and Emails (Mailhog).

## Installation

### Install the binary globally

To install **Nhost CLI**, run this command from any directory in your terminal:

```bash
sudo curl -L https://raw.githubusercontent.com/nhost/cli/main/get.sh | bash
```

On **MacOS and Linux**, this will install the **Nhost CLI** in `/usr/local/bin`.

If you'd prefer to install to a different location other than `/usr/local/bin`,
set the `INSTALL_PATH` variable accordingly:

```bash
sudo curl -L https://raw.githubusercontent.com/nhost/cli/main/get.sh | INSTALL_PATH=$HOME/bin bash
```

On **Windows**, this will download and extract the binary `nhost.exe` available
under `Assets` of the latest release from the GitHub release page:
https://github.com/nhost/cli/releases.

You can move the executable to a different location and add the path to the
environment variable `PATH` to make `nhost` accessible globally.

Finally, you can check that everything has been successfully installed by
typing:

```bash
nhost version
```

<img width="577" alt="nhost-cli-version" src="https://user-images.githubusercontent.com/4352286/165720580-1747cbed-a5d9-4cd4-8a18-3b82d0d1fadf.png" />

### (Optional) Add shell completion

To add command auto completion in the shell, you can run the following command:

```bash
nhost completion [shell]
```

This will generate the autocompletion script for `nhost` for the specified shell
(bash, fish, powershell, or zsh).

## Prerequisites

### Dependencies

Before using the **Nhost CLI**, make sure you have the following dependencies
installed on your local machine:

- [Git](https://git-scm.com/downloads)
- [Docker](https://www.docker.com/get-started)

:::caution
Docker must be running while using Nhost CLI.
:::

### Nhost CLI login

After installing **Nhost CLI**, you can log in to your Nhost account by running
the following command:

```bash
nhost login
```

This will display a prompt for you to enter your Nhost account credentials
(email/password).

:::info
You can create a Nhost account here: [https://app.nhost.io](https://app.nhost.io/).
:::

<img width="577" alt="nhost-login" src="https://user-images.githubusercontent.com/4352286/165720791-facdf9a4-96e8-4b0d-a767-6e7688d28b7e.png" />

After successfully logging in, you are authorized to manage your Nhost projects
using the Nhost CLI.

You can also log out at any time by running:

```bash
nhost logout
```

## Set up your project

### 1. Create a new Nhost app

First things first, we need to create a new Nhost project.

So, log in to your Nhost dashboard and click the **Create your first app**
button.

![nhost-first-app](https://user-images.githubusercontent.com/4352286/165720772-80e9c9dd-cf13-4d76-aac5-b8557a8b2876.png)

Next, give your new Nhost app a name, select a geographic region for your Nhost
services and click **Create App**.

![nhost-new-app](https://user-images.githubusercontent.com/4352286/165720793-db0c25af-37d1-410e-b9df-28f3977ae68a.png)

After a few seconds, you should get a PostgreSQL database, a GraphQL API with
Hasura, file storage, and authentication set up.

### 2. Create a new GitHub Repository

A typical workflow would also include creating a Github repository for your
Nhost project. It will facilitate your development workflow since Nhost can
integrate with Github to enable continuous deployment.

So, go to your Github account and
[create a new repository](https://github.com/new). You can make your repository
either public or private.

<img width="905" alt="create-github-repo" src="https://user-images.githubusercontent.com/4352286/165720792-1518eeb9-edf1-431e-bd48-4c6565d14166.png" />

### 3. Connect Nhost project to Github

Finally, connect your Github repository to your Nhost project. Doing so will
enable Nhost to deploy new versions of your project when you push automatically
commits to your connected Git repository.

1. From your project workspace, click **Connect to Github**.

![connect-to-github](https://user-images.githubusercontent.com/4352286/165720795-291e2ffa-e1b7-40f2-a1bf-539716f2edce.png)

2. **Install the Nhost app** on your Github account.

![install-nhost-github-app](https://user-images.githubusercontent.com/4352286/165720798-c0f4c46e-9cc2-43ce-ac93-853abf45df7b.png)

3. **Connect** your Github repository.

![connect-github-repository](https://user-images.githubusercontent.com/4352286/165720803-81105729-0fb7-4e94-8eeb-464466e8b59f.png)

## Develop locally

## 1. Initialize your Nhost app

**Nhost CLI** brings the functionality of your Nhost production environment
directly to your local machine.

It provides Docker containers to run the backend services that match your
production application in a local environment. That way, you can make changes
and test your code locally before deploying those changes to production.

You can either initialize a blank Nhost app locally to start from scratch by
running the following command:

```bash
nhost init -n my-nhost-app
```

And then link it to a remote app from your Nhost workspace in `app.nhost.io` by
running the `link` command and selecting the corresponding app from the prompt:

```bash
nhost link
```

Or you can directly initialize a local Nhost app from one of your existing
production apps by specifying the `--remote` flag:

```bash
nhost init --remote -n my-nhost-app
```

It will also prompt you to choose the remote app you'd like to use to initialize
your local Nhost development environment.

<img width="613" alt="nhost-init-remote" src="https://user-images.githubusercontent.com/4352286/165720808-e6ed06a5-e2c4-4ae6-9e36-41e7c6fff07a.png" />

The `init` command creates the Nhost app inside your current working directory
within a `nhost/` folder.

```
my-nhost-app/
  └─ nhost/
      ├─ config.yaml
      ├─ emails/
      ├─ metadata/
      ├─ migrations/
      └─ seeds/
```

Finally, make sure to link your current working directory to your GitHub
repository:

```bash
echo "# my-nhost-app" >> README.md
git init
git add README.md
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/[github-username]/my-nhost-app.git
git push -u origin main
```

## 2. Start a local development environment

To start a local development environment for your Nhost app, run the following
command:

```bash
nhost dev
```

:::caution
Make sure [Docker](https://www.docker.com/get-started) is up and running. It’s required for Nhost to work.
:::

Running this command will start up all the backend services provided by Nhost.

It also runs a web server to serve the Hasura console for the GraphQL engine so
you can manage the database and try out the API.

The Hasura console should open automatically at
[http://localhost:1337](http://localhost:1337/).

![hasura-console](https://user-images.githubusercontent.com/4352286/165720810-adf42058-4d1e-470f-b23f-8bc7acf42c0e.png)

## 3. Make changes

There are three things the Nhost CLI and the GitHub integration track and apply
to production:

- Database migrations
- Hasura Metadata
- Serverless Functions

### Database migrations

Database changes are tracked and managed through migrations.

:::tip
It's important that you use the Hasura console to make database changes. Indeed, with the Hasura console, DB migration files are generated incrementally to track changes automatically for you.
:::

To demonstrate how to make database changes, let's create a new table called
`messages`, with the following columns:

- `id` (type UUID and default `gen_random_uuid()`),
- `text` (type Text),
- `authorId` (type UUID),
- `createdAt` (type Timestamp and default `now()`)

In the Hasura console, head over to the **data** tab section and click on the
PostgreSQL database (from the left side navigation) that Nhost provides us.

Click on the **public** schema and the **Create Table** button.

![create-new-table-1](https://user-images.githubusercontent.com/4352286/165720814-be5b9e3b-2a11-42c0-b5c8-e8f4e0296cb4.png)

Then, enter the values for creating the `messages` table as mentioned above.
Also, specify the `id` column as the primary key of the table, and link the
`authorId` column to the `users.id` column using a foreign key to link the
`users` and `messages` tables together.

![create-new-table-2](https://user-images.githubusercontent.com/4352286/165720816-1aa9caf2-7d5a-4265-a413-cbdb577639f8.png)

Next, click on the **Add Table** button to create the table.

Finally, check out the `migrations/` folder in your project directory. A
migration file has been created automatically to reflect our database changes
and track the new table creation.

The migration was created under `nhost/migrations/default`:

```bash
$ ls -la nhost/migrations/default
total 0
drwxr-xr-x  3 gdangelo  staff   96 Apr 27 17:06 .
drwxr-xr-x  3 gdangelo  staff   96 Apr 27 17:06 ..
drwxr-xr-x  4 gdangelo  staff  128 Apr 27 17:06 1651071963431_create_table_public_messages
```

However, note that this database migration has only been applied locally. In
other words, the `messages` table does not (yet) exists in production.

To apply the local changes to production, check out the
[Deploy your project](#deploy-your-project) section below.

### Hasura metadata

In addition to database schema changes, Nhost also tracks Hasura metadata.

The Hasura metadata track all the actions performed on the console, like
tracking tables/views/functions, creating relationships, configuring
permissions, creating event triggers, and remote schemas.

To demonstrate it, let's add a new permission to our `messages` table for the
`user` role on the `insert` operation. That permission will allow users to
create new messages.

So, open the permissions tab for the `messages` table, type in `user` in the
role cell, and click the edit icon on the `insert` operation:

![insert-permissions](https://user-images.githubusercontent.com/4352286/165720821-faeb7043-6c6d-4ac7-b481-b305ff95e3c3.png)

To restrict the users to create new messages only for themselves, specify an
`_eq` condition between the `authorId` and the `X-Hasura-User-ID` session
variable, which is passed with each request.

<img width="1110" alt="hasura-insert-condition" src="https://user-images.githubusercontent.com/4352286/165720775-e2b570c8-590d-48f6-a6cc-77c1989abf98.png" />

Then, select the columns the users can define through the GraphQL API, set the
value for the `authorId` column to be equal to the `X-Hasura-User-ID` session
variable, and click **Save Permissions**.

<img width="919" alt="hasura-insert-columns" src="https://user-images.githubusercontent.com/4352286/165720779-d55d8c7e-6a88-46f2-9c52-5811a965cf5a.png" />

Finally, check out the `metadata/` folder in your project directory to confirm
that the permission changes we did were tracked locally in your git repository.

In our case, those changes should be tracked in
`nhost/metadata/databases/default/tables/public_messages.yaml`:

```yaml title="nhost/metadata/databases/default/tables/public_messages.yaml"
table:
  name: messages
  schema: public
insert_permissions:
  - permission:
      backend_only: false
      check:
        authorId:
          _eq: X-Hasura-User-Id
      columns:
        - text
      set:
        authorId: x-hasura-User-Id
    role: user
```

### Serverless functions

Now let's create a serverless function before we push all changes to GitHub so
Nhost can deploy them to production.

For this guide, let's create a simple serverless function that will return the
current date-time when called.

First, make sure to install `express`, which is required for serverless
functions to work.

```bash
npm install express
npm install -d @types/node @types/express
```

Then, create a new file named `time.ts` inside the `functions/` folder of your
working directory, and paste the following code:

```ts title="functions/time.ts"
import { Request, Response } from 'express';

export default (req: Request, res: Response) => {
  return res
    .status(200)
    .send(`Hello ${req.query.name}! It's now: ${new Date().toUTCString()}`);
};
```

Every JavaScript and TypeScript file inside the `functions/` folder become an
API endpoint.

Locally, the base URL for the serverless functions is
`http://localhost:1337/v1/functions`. Then, the endpoint for each function is
determined by its filename or the name of its dedicated parent directory.

For example, the endpoint for our function is
`http://localhost:1337/v1/functions/time`.

```bash
curl http://localhost:1337/v1/functions/time\?name\=Greg
Hello Greg! It's now: Wed, 27 Apr 2022 18:52:12 GMT
```

## Deploy your project

To deploy your local changes to production, you can commit and push them to
GitHub. As a result, Nhost will automatically pick up the changes in your
repository and apply them to your associated remote Nhost project.

:::caution
Make sure to [connect your Github repository](#3-connect-nhost-project-to-Github) to your Nhost project first.
:::

```bash
git add -A
git commit -m "commit message"
git push
```

To check out your deployment, head over to the **Deployments** tab in your
[Nhost dashboard](https://app.nhost.io).

![nhost-deployments](https://user-images.githubusercontent.com/4352286/165720825-9ff2f704-befd-4ebe-9fd7-80c46082f147.png)

## Get help

To get usage tips and learn more about available commands from within Nhost CLI,
run the following:

```shell
nhost help
```

For more information about a specific command, run the command with the `--help`
flag:

```
nhost init --help
```

If you have additional questions or ideas for new features, you can
[start an issue](https://github.com/nhost/cli/issues) or
[a new discussion](https://github.com/nhost/cli/discussions/new) on Nhost CLI’s
open-source repository. You can also
[chat with our team](https://discord.com/invite/9V7Qb2U) on Discord.

We’d love to hear from you!
