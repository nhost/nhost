# A Next.js / Nhost / React-Query Starter Kit

> This is a **Starter Kit** to help you get started with **Next.js** and **Nhost** using **React-Query** library

## Included in this Starter Kit

1. Type System with [Typescript](https://www.typescriptlang.org/)
2. Linting with [Eslint](https://eslint.org/) & [Prettier](https://prettier.io)
3. Code Analysis with [Github super-linter](https://github.com/github/super-linter)
4. Ui Library [Chakra UI](https://chakra-ui.com)
5. Pre-commit hooks with [Pretty Quic](https://github.com/azz/pretty-quic) & [Husky](https://typicode.github.io/husk)
6. Unit Testing with [Jest](https://jestjs.io/) & [Texting Library](https://testing-library.com/)
7. E2E Testing with [Cypress](https://cypress.io)
8. CI/CD with [Github Actions](https://github.com/features/actions)
9. Backend with [Nhost](https://nhost.io)
10. Data layer with [react-query](https://react-query.tanstack.com/)

## Getting Started

You can use this **Starter Kit** in a couple of different ways.

1. You can use this starter kit as an example for **NextJs**
   `yarn create next-app my-app --example https://github.com/alveshelio/nhost-react-query`
2. You can generate a new Repo from this one with
   [github.com/alveshelio/nhost-react-query](https://github.com/alveshelio/nhost-react-query)
3. You can clone this repo
   `git clone https://github.com/alveshelio/nhost-react-query my-app`
4. `cd my-app`
5. Install dependencies `yarn install`
6. Start the server `yarn dev`
7. Rename `.env.example` to `.env.local` and change `NEXT_PUBLIC_GRAPHQL_ENDPOINT`, `NEXT_PUBLIC_BACKEND_ENDPOINT` 
   and `NEXT_PUBLIC_HASURA_SECRET` pointing it to your **Nhost** project
8. Hit the ground running with Next.js, TypeScript & Chakra UI

### Local Development with Nhost
1. Install Nhost Cli: `npm install -g nhost`
2. Init **Nhost** in your project root `nhost init`
3. Once your project has been set up, `nhost dev`

Please refer to the respective docs (linked above) in order to learn about these technologies.

## Documentation

### Backend (Nhost)
**Nhost** allows you to build apps fast without the need to manage infrastructure.
Completely open-source, **Nhost** provides you with a **database** (postgresql), **GraphQL** engine (Hasura), **User 
Authentication** and **Storage**.

### CI/CD

This starter kit is using Github Actions to handle the **CI / CD**. Whenever we commit to a branch or main we are
going to run the linter, unit tests and e2e tests. And when we push to main we are going to publish the site to
Amazon S3.
If you are using a different **CI / CD** you'll need to remove all the files in directory `.github/workflows`

#### How to remove code linting with Github super-linter?

If you don't wish to analyse your code with super-linter you can simply remove file `.github/workflows/linter.yml`

#### How to remove code linting with Github super-linter?

You're not using NextJS as a Static Site Generator (SSG)
First you need to change the script `build` in `package.json` to
`"build": "next build"`. <br />
Then you need to remove file `.github/workflows/deploy.yml`

#### I'm deploying my site to another provider other than **Vercel**

The Github action configured in this starter kit will deploy a static site to an Amazon S3 bucket, if you want to
deploy to another provider, in that case you need to updated
file `. github/workflows/deploy.yml` to suite your platform needs.

## Notes

I recommend you use [n](https://github.com/tj/n) to manage your Node and Yarn versions.

## License

MIT
