import type { ISandboxDirectory, ISandboxFile } from 'codesandbox-import-util-types'
import { getParameters, IFiles } from 'codesandbox-import-utils/lib/api/define'
import normalize from 'codesandbox-import-utils/lib/utils/files/normalize'

/**
 * rename the `directory_shortid` property name fetched from the `https://codesandbox.io/api/v1/sandboxes/github` API endpoint
 * to `directoryShortid`, that will then will work with `codesandbox-import-utils/lib/utils/files/normalize`
 */
const correctDirectoryShortIdProperty = <T>(arr: Array<T & { directory_shortid: string }>) =>
  arr.map(({ directory_shortid, ...rest }) => ({
    ...rest,
    directoryShortid: directory_shortid
  }))

interface CommonOptions {
  /**
   * Files to add or to override in the sandbox.
   */
  files?: IFiles
}

/**
 * Create parameters for the CodeSandbox Define API, with optional additional files
 * @param githubUrl full github url
 * @returns parameters to use with the CodeSandbox Define API
 * @example
 * ```js
 * const parameters = await createGitHubCodeSandBoxParameters(
 *   'https://github.com/nhost/nhost/tree/main/examples/react-apollo',
 *   {
 *     files: {
 *        "example.md": { content: '# A file not part of the GitHub repo, but added to the sandbox' }
 *     }
 *    })
 * ```
 * @see {@link https://codesandbox.io/docs/importing#define-api}
 */
export const createGitHubCodeSandBoxParameters = async (
  githubUrl: string,
  { files }: CommonOptions | undefined = {}
) => {
  const url = githubUrl.replace(
    'https://github.com',
    'https://codesandbox.io/api/v1/sandboxes/github'
  )
  const {
    data: { modules, directories }
  } = await fetch(url).then((response) => response.json())
  const originalFiles = normalize(
    correctDirectoryShortIdProperty<ISandboxFile>(modules),
    correctDirectoryShortIdProperty<ISandboxDirectory>(directories)
  ) as IFiles
  return getParameters({
    files: {
      ...originalFiles,
      ...files
    }
  })
}

interface OpenGitHubCodeSandBoxOptions extends CommonOptions {
  /**
   * HTML <form> target attribute
   * @defaultValue '_blank'
   * @see {@link https://www.w3schools.com/tags/att_form_target.asp}
   */
  target?: '_self' | '_blank' | '_parent' | '_top'
}

/**
 * Open a CodeSandbox in a new window, with optional additional files
 * @param githubUrl full github url
 * @example
 * ```js
 * openGitHubCodeSandBox(
 *   'https://github.com/nhost/nhost/tree/main/examples/react-apollo',
 *   {
 *     files: {
 *        "example.md": { content: '# A file not part of the GitHub repo, but added to the sandbox' }
 *     }
 *    })
 * ```
 */
export const openGitHubCodeSandBox = async (
  githubUrl: string,
  { files, target = '_blank' }: OpenGitHubCodeSandBoxOptions | undefined = {
    target: '_blank'
  }
) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw Error('openGitHubCodeSandBox can only be used in a browser')
  }
  const parameters = await createGitHubCodeSandBoxParameters(githubUrl, { files })
  const form = document.createElement('form')
  form.setAttribute('method', 'post')
  form.setAttribute('action', 'https://codesandbox.io/api/v1/sandboxes/define')
  form.setAttribute('target', target)
  const hiddenField = document.createElement('input')
  hiddenField.setAttribute('type', 'hidden')
  hiddenField.setAttribute('name', 'parameters')
  hiddenField.setAttribute('value', parameters)
  form.appendChild(hiddenField)

  document.body.appendChild(form)
  form.submit()
  document.body.removeChild(form)
}

/**
 * Transform a plain JavaScript object into a string formatted as a `.env` key-value file
 */
export const objectToDotEnv = (obj: Record<string, number | boolean | string>) =>
  Object.entries(obj)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
