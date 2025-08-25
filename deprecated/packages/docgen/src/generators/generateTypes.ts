import chalk from 'chalk'
import fs from 'fs/promises'
import kebabCase from 'just-kebab-case'
import { snapshot } from 'valtio'

import { appState } from '../state'
import { GeneratorOptions, Parameter, Signature } from '../types'

/**
 * Generates the documentation for types from the auto-generated JSON file.
 *
 * @param parsedContent - Content of the auto-generated JSON file.
 * @param outputPath - Path to the output directory.
 * @param options - Additional options.
 * @returns Results of the generation.
 */
export async function generateTypes(
  parsedContent: Array<Signature>,
  outputPath: string,
  {
    sameLevel = false,
    skipSidebarConfiguration = false,
    originalDocument = null
  }: GeneratorOptions = {}
) {
  const { verbose, docsRoot } = snapshot(appState)
  const { TypeTemplate } = await import('../templates')
  const finalOutputPath = sameLevel ? outputPath : `${outputPath}/types`

  const types: Array<{ name: string; content: string }> = (parsedContent || [])
    .filter((document) => ['Type alias', 'Interface'].includes(document.kindString))
    .map((props) => ({
      name: props.name,
      content: TypeTemplate(props as Parameter, originalDocument || parsedContent)
    }))

  const results = await Promise.allSettled(
    types.map(async ({ name, content }) => {
      const fileName = `${kebabCase(name)}.mdx`
      const fileOutput = `${finalOutputPath}/${fileName}`

      // we are creating the folder for types
      try {
        await fs.mkdir(finalOutputPath)
      } catch {
        if (verbose) {
          console.info(chalk.blue`⏭️  Skipping: Types folder already exists.\n`)
        }
      }

      if (!skipSidebarConfiguration) {
        // we are removing sidebar configuration if it already exists
        try {
          await fs.rm(`${finalOutputPath}/_category_.json`)
        } catch {
          if (verbose) {
            console.info(chalk.blue`⏭️  Skipping: Sidebar configuration doesn't exist yet.\n`)
          }
        }

        // we are preparing the sidebar configuration
        await fs.writeFile(
          `${finalOutputPath}/_category_.json`,
          JSON.stringify(
            {
              label: 'Types',
              position: 1,
              className: 'hidden',
              link: {
                type: 'generated-index',
                slug: `${
                  docsRoot ? (docsRoot.startsWith('/') ? docsRoot : `/${docsRoot}`) : ''
                }/types`
              }
            },
            null,
            2
          )
        )
      }

      // we are removing the file if it already exists
      try {
        await fs.rm(fileOutput)
      } catch {
        if (verbose) {
          console.info(chalk.blue`⏭️  Skipping: Type doesn't exist yet.\n`)
        }
      }

      // we are writing the documentation file
      await fs.writeFile(fileOutput, content, 'utf-8')

      return { fileName, fileOutput }
    })
  )

  results.forEach((result) => {
    if (result.status === 'rejected') {
      return console.error(
        chalk.red`🔴 ${result.reason.message}`,
        chalk.gray`\n${result.reason.stack}`
      )
    }

    if (verbose) {
      console.info(
        chalk.green`✅ Generated ${chalk.bold(result.value.fileName)}\n    ${chalk.italic.gray(
          `(Output: ${result.value.fileOutput})`
        )}`
      )
    }
  })

  return results
}

export default generateTypes
