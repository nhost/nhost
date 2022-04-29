---
title: 'Quickstart: Next.js'
sidebar_position: 2
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Quickstart: Next.js

## Introduction

This quickstart guide provides the steps you need to build a simple Next.js app
powered by Nhost for the backend. It includes:

- Database: [PostgreSQL](https://www.postgresql.org/)
- Instant GraphQL API: [Hasura](https://hasura.io/)
- Authentication: [Hasura Auth](https://github.com/nhost/hasura-auth/)
- Storage: [Hasura Storage](https://hub.docker.com/r/nhost/hasura-storage)
- [Nhost CLI](https://docs.nhost.io/reference/cli) for local development

By the end of this guide, you'll have a full-stack app that allows users to log
in to access a protected dashboard and update their profile information.

## Prerequisites

Before getting started, let’s make sure that your development environment is
ready.

- You’ll need **Node.js** version 10.13 or later.
  [Install it from here](https://nodejs.org/en/).
- You’ll need the **Nhost CLI** and **Docker**. View the
  [installation instructions](https://docs.nhost.io/platform/overview/get-started-with-nhost-cli).
- You’ll need a **Github repository**. Create a
  [new repository](https://github.com/new).

## Project setup

### Create a new Nhost app

First things first, we need to create a new Nhost project.

So, log in to your Nhost dashboard and click the **Create your first app**
button.

![nhost-first-app](https://user-images.githubusercontent.com/4352286/165812976-4a738a9b-e710-4461-8f39-43e0103c3f38.png)

Next, give your new Nhost app a name, select a geographic region for your Nhost
services and click **Create App**.

![nhost-new-app](https://user-images.githubusercontent.com/4352286/165812980-a12a9fd1-7fdd-4756-87c8-949b53ff7589.png)

After a few seconds, you should get a PostgreSQL database, a GraphQL API with
Hasura, file storage, and authentication already set up.

### Connect Github repository

The next step consists of connecting your Github repository to your Nhost
project. Doing so will enable Nhost to deploy new versions of your project when
you push automatically commits to your connected Git repository.

1. From your project workspace, click **Connect to Github**.

![connect-to-github](https://user-images.githubusercontent.com/4352286/165812951-ab7c3276-b4ae-42a7-9359-47c18fcaec8b.png)

2. **Install the Nhost app** on your Github account.

![install-nhost-github-app](https://user-images.githubusercontent.com/4352286/165812967-b5a4054e-c8ea-436e-a2bf-562d962b7c42.png)

3. **Connect** your Github repository.

![connect-github-repository](https://user-images.githubusercontent.com/4352286/165812931-567546b1-20ca-4810-bd73-181a84d8f8fe.png)

## Initialize the app

### Create a Next.js app

The simplest way to create a new Next.js application is by using the tool called
`create-next-app`, which bootstraps a Next.js app for you without the hassle of
configuring everything yourself.

So, open your terminal, and run the following command:

```bash
npx create-next-app my-nhost-app --use-npm --example "https://github.com/gdangelo/nhost-quickstart-nextjs"
```

:::info
This command uses an [existing template](https://github.com/gdangelo/nhost-quickstart-nextjs), through the `--example` flag, which already contains the React components and pages we'll use for this guide.
:::

You can now `cd` into your project directory:

```bash
cd my-nhost-app
```

And run the development server with the following command:

```bash
npm run dev
```

If everything is working fine, your Next.js development server should be running
on port 3000. Open [http://localhost:3000](http://localhost:3000) from your
browser to check this out.

### Initialize a local Nhost app

Now we are going to initialize our Nhost app locally using **Nhost CLI**.

The CLI provides Docker containers to run the backend services that match our
production application in a local environment. That way, we can make changes and
test our code locally before deploying those changes to production.

So, open your terminal, and run the following command:

```bash
nhost init --remote
```

It will prompt you to choose the remote app you'd like to use to initialize your
local Nhost development environment.

<img
  width="613"
  alt="nhost-init-remote"
  src="https://user-images.githubusercontent.com/4352286/165812979-3f55bde9-8771-4c06-bc4a-23e7ae8f67b9.png"
/>

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

### Start a local development environment

To start a local development environment for your Nhost app, run the following
command:

```bash
nhost dev
```

:::caution
Make sure [Docker](https://www.docker.com/get-started) is up and running. It’s required for Nhost to work.
:::

Running this command will start up all the backend services provided by Nhost
locally.

### Configure Nhost with Next.js

To work with Nhost from within our Next.js app, we'll use the
[Next.js SDK](https://github.com/nhost/nhost/tree/main/packages/nextjs) provided
by Nhost. It's a wrapper around the
[Nhost React SDK](https://github.com/nhost/nhost/tree/main/packages/react) which
gives us a way to interact with our Nhost backend using React hooks.

You can install the Nhost Next.js SDK with:

```bash
npm i @nhost/react @nhost/nextjs
```

Next, open your `_app.js` file as we'll now configure Nhost inside our app.

The Nhost Next.js SDK comes with a React provider named `NhostNextProvider` that
makes the authentication state and all the provided React hooks available in our
application.

Use the following code to instantiate a new Nhost client and link it to your
Nhost backend:

```jsx title="pages/_app.js"
import { NhostNextProvider } from '@nhost/nextjs';
import { NhostClient } from '@nhost/nextjs';

const nhost = new NhostClient({
  backendUrl: process.env.NEXT_PUBLIC_NHOST_BACKEND_URL || '',
});

function MyApp({ Component, pageProps }) {
  return (
    <NhostNextProvider nhost={nhost} initial={pageProps.nhostSession}>
      {/* ... */}
    </NhostNextProvider>
  );
}
```

Finally, make sure to create an environment variable named
`NEXT_PUBLIC_NHOST_BACKEND_URL` to store your Nhost backend URL:

```yaml title=".env.development"
NEXT_PUBLIC_NHOST_BACKEND_URL=YOUR_NHOST_URL
```

Don't forget to restart your Next.js server after saving your `.env.development`
file to load your new environment variable.

## Build the app

### Add authentication

#### 1. Sign-up

The next step is to allow our users to authentication into our application.
Let's start with implementing the sign-up process.

For that, we'll use the `useSignUpEmailPassword` hook provided by the Nhost
Next.js SDK within our `SignUp` component.

So, open up the corresponding file from your project, and use the following
code:

```jsx title="components/SignUp.js"
import { useState } from 'react';
import { useRouter } from 'next/router';
import { useSignUpEmailPassword } from '@nhost/nextjs';
import Link from 'next/link';
import Image from 'next/image';
import Input from './Input';
import Spinner from './Spinner';

const SignUp = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const router = useRouter();

  const {
    signUpEmailPassword,
    isLoading,
    isSuccess,
    needsEmailVerification,
    isError,
    error,
  } = useSignUpEmailPassword({
    displayName: `${firstName} ${lastName}`.trim(),
    metadata: {
      firstName,
      lastName,
    },
  });

  const handleOnSubmit = (e) => {
    e.preventDefault();
    signUpEmailPassword(email, password);
  };

  if (isSuccess) {
    router.push('/');
    return null;
  }

  const disableForm = isLoading || needsEmailVerification;

  return (
    <div className="w-full max-w-lg">
      <div className="sm:rounded-xl sm:shadow-md sm:border border-opacity-50 sm:bg-white px-4 sm:px-8 py-12 flex flex-col items-center">
        <div className="relative h-14 w-full">
          <Image src="/logo.svg" alt="logo" layout="fill" objectFit="contain" />
        </div>

        {needsEmailVerification ? (
          <p className="mt-12 text-center">
            Please check your mailbox and follow the verification link to verify
            your email.
          </p>
        ) : (
          <form onSubmit={handleOnSubmit} className="w-full">
            <div className="mt-12 flex flex-col items-center space-y-6">
              <div className="w-full flex gap-6">
                <Input
                  label="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={disableForm}
                  required
                />
                <Input
                  label="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={disableForm}
                  required
                />
              </div>
              <Input
                type="email"
                label="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={disableForm}
                required
              />
              <Input
                type="password"
                label="Create password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={disableForm}
                required
              />
            </div>

            <button
              type="submit"
              disabled={disableForm}
              className="mt-6 w-full font-medium inline-flex justify-center items-center rounded-md p-3 text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed  disabled:hover:bg-blue-600 disabled:hover:border-bg-600 transition-colors"
            >
              {isLoading ? <Spinner size="sm" /> : 'Create account'}
            </button>

            {isError ? (
              <p className="mt-4 text-red-500 text-center">{error?.message}</p>
            ) : null}
          </form>
        )}
      </div>

      <p className="sm:mt-8 text-gray-500 text-center">
        Already have an account?{' '}
        <Link href="/sign-in">
          <a className="text-blue-600 hover:text-blue-500 hover:underline hover:underline-offset-1 transition">
            Sign in
          </a>
        </Link>
      </p>
    </div>
  );
};

export default SignUp;
```

By default, the user must verify his email address before fully signing up. You can change this setting from your Nhost config file, `nhost/config.yaml`.

#### 2. Sign-in

Now that new users can sign up for our application, let's see how to allow
existing users to sign in with email and password.

For that, we will use the Nhost hook named `useSignInEmailPassword` inside our
`SignIn` component the same way we did with our `SignUp` component. So, here's
what your component should look like after applying the changes for the sign-in
logic:

```jsx title="components/SignIn.js"
import { useState } from 'react';
import { useRouter } from 'next/router';
import { useSignInEmailPassword } from '@nhost/nextjs';
import Link from 'next/link';
import Image from 'next/image';
import Input from './Input';
import Spinner from './Spinner';

const SignIn = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const router = useRouter();

  const {
    signInEmailPassword,
    isLoading,
    isSuccess,
    needsEmailVerification,
    isError,
    error,
  } = useSignInEmailPassword();

  const handleOnSubmit = (e) => {
    e.preventDefault();
    signInEmailPassword(email, password);
  };

  if (isSuccess) {
    router.push('/');
    return null;
  }

  const disableForm = isLoading || needsEmailVerification;

  return (
    <div className="w-full max-w-lg">
      <div className="sm:rounded-xl sm:shadow-md sm:border border-opacity-50 sm:bg-white px-4 sm:px-8 py-12 flex flex-col items-center">
        <div className="relative h-14 w-full">
          <Image src="/logo.svg" alt="logo" layout="fill" objectFit="contain" />
        </div>

        {needsEmailVerification ? (
          <p className="mt-12 text-center">
            Please check your mailbox and follow the verification link to verify
            your email.
          </p>
        ) : (
          <>
            <form onSubmit={handleOnSubmit} className="w-full">
              <div className="mt-12 w-full flex flex-col items-center space-y-6">
                <Input
                  type="email"
                  label="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={disableForm}
                  required
                />
                <Input
                  type="password"
                  label="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={disableForm}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={disableForm}
                className="mt-6 w-full font-medium inline-flex justify-center items-center rounded-md p-3 text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed  disabled:hover:bg-blue-600 disabled:hover:border-bg-600 transition-colors"
              >
                {isLoading ? <Spinner size="sm" /> : 'Sign in'}
              </button>

              {isError ? (
                <p className="mt-4 text-red-500 text-center">
                  {error?.message}
                </p>
              ) : null}
            </form>
          </>
        )}
      </div>

      <p className="sm:mt-8 text-gray-500 text-center">
        No account yet?{' '}
        <Link href="/sign-up">
          <a className="text-blue-600 hover:text-blue-500 hover:underline hover:underline-offset-1 transition">
            Sign up
          </a>
        </Link>
      </p>
    </div>
  );
};

export default SignIn;
```

#### 3. Sign-out

Finally, to allow the users to sign out from the app, we can use the Nhost
`useSignOut` hook:

```jsx title="components/Layout.js"
import { useSignOut } from '@nhost/nextjs';

const Layout = ({ children = null }) => {
  const { signOut } = useSignOut();

  const menuItems = [
    //..
    {
      label: 'Logout',
      onClick: signOut,
      icon: LogoutIcon,
    },
  ];

  //...
};
```

### Protect routes

Now that we have implemented authentication, we can easily decide who can access
certain parts of our application.

In our case, we'll only allow authenticated users to have access to the `/` and
`/profile` routes. All the other users should be redirected to the `/sign-in`
page if they try to access those routes.

To do so, we can check the authentication status of the current user using the
Nhost SDK by creating a
[high-order component](https://reactjs.org/docs/higher-order-components.html):

```jsx title="withAuth.js"
import { useRouter } from 'next/router';
import { useAuthenticationStatus } from '@nhost/nextjs';
import Spinner from './components/Spinner';

export default function withAuth(Component) {
  return function (props) {
    const router = useRouter();
    const { isLoading, isAuthenticated } = useAuthenticationStatus();

    if (isLoading) {
      return (
        <div className="h-screen flex items-center justify-center">
          <Spinner />
        </div>
      );
    }

    if (!isAuthenticated) {
      router.push('/sign-in');
      return null;
    }

    return <Component {...props} />;
  };
}
```

Then, wrap our Next.js pages, `index.js` and `profile.js`, with it:

<Tabs
defaultValue="index"
values={[
  {label: 'index.js', value: 'index'},
  {label: 'profile.js', value: 'profile'},
]}>
<TabItem value="index">

```js
import withAuth from '../withAuth';

const Home = () => {
  //...
};

export default withAuth(Home);
```

</TabItem>
<TabItem value="profile">

```js
import withAuth from '../withAuth';

const Profile = () => {
  //...
};

export default withAuth(Profile);
```

</TabItem>
</Tabs>

### Retrieve user data

Finally, let's display the information of the authenticated user throughout his
dashboard to make the app more personalized.

Getting the current authenticated user data is actually quite easy. Indeed, we
can use the `useUserData` hook provided by Nhost to do it.

So, open the `components/Layout.js`, `pages/index.js`, and `pages/profile.js`
files and use this hook like so:

```js
import { useUserData } from '@nhost/nextjs';

const Layout = () => {
  const user = useUserData();
  //...
};
```

That's it! The JSX code for rendering the user data (email, display name, etc.)
is already included in your components as part of the example repository you've
bootstraped at the beginning of this guide.

### Update user data

Nhost provides a GraphQL API through Hasura so that we can query and mutate our
data instantly.

In this tutorial, we'll use the
[Apollo GraphQL client](https://www.apollographql.com/) for interacting with
this GraphQL API.

So, start by installing the following dependencies:

```bash
npm install @nhost/react-apollo @apollo/client
```

Then, add the `NhostApolloProvider` from `@nhost/react-apollo` into your
`_app_.js` file.

```jsx title="pages/_app.js"
import { NhostApolloProvider } from '@nhost/react-apollo';

function MyApp({ Component, pageProps }) {
  return (
    <NhostNextProvider nhost={nhost} initial={pageProps.nhostSession}>
      <NhostApolloProvider nhost={nhost}>{/* ... */}</NhostApolloProvider>
    </NhostNextProvider>
  );
}
```

From there, we can construct our GraphQL query and use the Apollo `useMutation`
hook to execute that query when the user submits the form from the profile page:

```js title="pages/profile.js"
import { gql, useMutation } from '@apollo/client';
import { toast } from 'react-hot-toast';

const UPDATE_USER_MUTATION = gql`
  mutation ($id: uuid!, $displayName: String!, $metadata: jsonb) {
    updateUser(
      pk_columns: { id: $id }
      _set: { displayName: $displayName, metadata: $metadata }
    ) {
      displayName
    }
  }
`;

const Profile = () => {
  const [mutateUser, { loading: updatingProfile }] =
    useMutation(UPDATE_USER_MUTATION);

  const updateUserProfile = async (e) => {
    e.preventDefault();

    try {
      await mutateUser({
        variables: {
          id: user.id,
          displayName: `${firstName} ${lastName}`.trim(),
          metadata: {
            firstName,
            lastName,
          },
        },
      });
      toast.success('Updated successfully', { id: 'updateProfile' });
    } catch (error) {
      toast.error('Unable to update profile', { id: 'updateProfile' });
    }
  };

  //...
};
```

Finally, since Hasura has an **allow nothing by default** policy, and we haven't
set any permissions yet, our mutation queries would failed.

So, open the Hasura console from [http://localhost:1337](http://localhost:1337),
go to the **permissions** tab for the `users` table, type in `user` in the role
cell, and click the edit icon on the `select` operation:

![hasura-users-permissions](https://user-images.githubusercontent.com/4352286/165812965-86ed3585-1e32-4ae5-a51b-c19fd3e7a269.png)

To restrict the user to read his own data only, specify a condition with the
user's ID and the `X-Hasura-User-ID` session variable, which is passed with each
requests.

<img
  width="1142"
  alt="hasura-custom-check"
  src="https://user-images.githubusercontent.com/4352286/165812960-4498ced4-d494-41f7-aa8b-60e6c0a2a939.png"
/>

Finally, select the columns you'd like the users to have access to, and click
**Save Permissions**.

<img
  width="1134"
  alt="hasura-column-permissions"
  src="https://user-images.githubusercontent.com/4352286/165812956-6795254e-4341-4254-b1e7-880c83fb527a.png"
/>

Repeat the same steps on the `update` operation for the `user` role to allow
users to update their `displayName` and `metadata` only.

Once done, you are ready to deploy your changes to production!

## Deploy your app

To deploy your Nhost app to production, you only need to commit and push your
changes to Github. As a result, Nhost will automatically pick up the changes in
your repository and apply them to your associated remote Nhost project.

:::caution
Make sure to [connect your Github repository](#2-connect-github-repository) to your Nhost project first.
:::

```bash
git add -A
git commit -m "commit message"
git push
```

To check out your deployment, head over to the **Deployments** tab in your
[Nhost dashboard](https://app.nhost.io).

![nhost-deployments](https://user-images.githubusercontent.com/4352286/165812973-e263c17d-b018-43c2-9fb8-a37e216a4a81.png)
