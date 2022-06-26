# nhost/codesandbox

Create a sandbox on CodeSandBox from a GitHub repository, with additional files.

It supports custom branch names as well as projects located in a sub-directory of the repository.

## Installation

```sh
# npm
npm install @nhost/codesandbox

# yarn
yarn add nhost/codesandbox

# pnpm
pnpm install nhost/codesandbox
```

## Open a sandbox

```js
import { openGitHubCodeSandBox, objectToDotEnv } from '@nhost/codesandbox'

const envVars = {
  VITE_NHOST_URL: 'http://myapp.nhost.app'
}

const open = () => {
  openGitHubCodeSandBox(
    'https://github.com/nhost/nhost/tree/main/examples/react-apollo',
    {
      files: {
        '.env': { content: objectToDotEnv(envVars) }
        'example.md': {
            content: `# Example
            Here is a markdown file added to your sandbox`
        }
      },
      target: '_blank' // default value
    }
  )
}

```

The `open` method will load a sandbox in a new tab.

## Use the Define API

See CodeSandBox's [documentation](https://codesandbox.io/docs/importing#define-api) for more information about the Define API.

```js
import { getParameters } from 'codesandbox/lib/api/define'
import { createGitHubCodeSandBoxParameters } from '@nhost/codesandbox'

const parameters = createGitHubCodeSandBoxParameters(
  'https://github.com/nhost/nhost/tree/main/examples/react-apollo',
  {
    files: {
      'example.md': {
        content: `# Example
            Here is a markdown file added to your sandbox`
      }
    }
  }
)

const url = `https://codesandbox.io/api/v1/sandboxes/define?parameters=${parameters}`
```

Note: using the `GET` define API won't accept large sandboxes as its contents is sent as a query parameter.
It is then better to create the sandbox through a `POST` request, as per the official documentation.
