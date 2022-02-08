# Documentations Nhost V2.0

## Get started

1. Install dependencies: `yarn`
2. Start dev server: `yarn dev`

## NOTES;

The content is copied from the main `nhost/nhost` repo. This repo is only to modify styles/react components.

## Structure

The `order.ts` file contains the main order for the entire structure of `posts`. The keys are `categories` and the values are `subcategories` in which contains the order the posts.

```
export const orderTwo = {
  "get-started": {
    "quick-start": ["introduction", "nhost-app", "todos-table", "javascript-app"],
    upgrade: ["upgrade-from-v1-to-v2"],
  },
  platform: {
    data: ["database", "graphql", "permissions", "event-triggers"],
    auth: ["overview", "sign-in-methods", "users"],
    storage: ["overview"],
    cli: ["overview"],
    nhost: ["environment-variables", "serverless-functions"],
  },
  tutorials: {
    "frontend-templates": ["react"],
    templates: ["nhost"],
  },
  reference: {
    cli: ["nhost-cli"],
    sdk: ["javascript-sdk", "react-auth", "react-apollo"],
  },
};
```

Metadata such as the `title` of the file that appears on the nav is on the frontmatter of each markdown file. The file name becomes the final url. Each top-level folder appears on the header as main navigation, each subfolder becomes a main subcategory of the nav and posts are included under each subcategory.

In order to create a new file you place it its proper subcategory and modify the category on the `order.ts` file such as `sdk: ["javascript-sdk", "react-auth", "react-apollo"],` -> `sdk: ["javascript-sdk", "react-auth", "vue"]`

Each subCategory e.g. `reference` or `tutorials` has an `index.mdx` file. If a new subcategory is added, a file has to be created for it.
