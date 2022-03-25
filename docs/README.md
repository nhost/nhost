# Nhost Documentation

## Get started

From the **root** of the `nhost/nhost` repository:

```bash
pnpm run clean:all
pnpm i
cd docs
pnpm run dev
```


## Structure

The `order.ts` file contains the main order for the entire structure of `posts`. The keys are `categories` and the values are `subcategories` in which contains the order the posts.

```
export const orderTwo = {
  'get-started': {
    'quick-start': ['index', 'schema', 'javascript-client', 'permissions'],
    authentication: ['index'],
    'cli-workflow': ['index', 'workflow-setup', 'install-cli', 'local-changes', 'metadata-and-serverless-functions'],
    upgrade: ['index']
  },
  platform: {
    database: ['index', 'permissions', 'graphql'],
    authentication: ['index', 'user-management', 'sign-in-methods', 'social-login', 'email-templates'],
    storage: ['index'],
    'serverless-functions': ['index', 'event-triggers'],
    nhost: ['index', 'environment-variables', 'github-integration', 'local-development']
  },
  reference: {
    sdk: ['index', 'graphql', 'authentication', 'storage', 'functions'],
    cli: ['index'],
    'supporting-libraries': ['react-apollo', 'react-auth']
  }
};
```

Metadata such as the `title` of the file that appears on the nav is on the frontmatter of each markdown file. The file name becomes the final url. Each top-level folder appears on the header as main navigation, each subfolder becomes a main subcategory of the nav and posts are included under each subcategory.

In order to create a new file you place it its proper subcategory and modify the category on the `order.ts` file such as `sdk: ["javascript-sdk", "react-auth", "react-apollo"],` -> `sdk: ["javascript-sdk", "react-auth", "vue"]`

Each subCategory e.g. `reference` or `tutorials` has an `index.mdx` file. If a new subcategory is added, a file has to be created for it.
