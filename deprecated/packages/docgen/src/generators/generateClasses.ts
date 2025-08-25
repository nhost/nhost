import chalk from 'chalk'
import fs from 'fs/promises'
import kebabCase from 'just-kebab-case'
import { snapshot } from 'valtio'

import { appState } from '../state'
import { ClassSignature, Signature } from '../types'
import generateFunctions from './generateFunctions'

/**
 * Generates the documentation for classes from the auto-generated JSON file.
 *
 * @param parsedContent - Content of the auto-generated JSON file.
 * @param outputPath - Path to the output directory.
 * @returns Results of the generation.
 */
export async function generateClasses(parsedContent: Array<ClassSignature>, outputPath: string) {
  const { ClassTemplate } = await import('../templates')
  const { baseSlug, verbose } = snapshot(appState)

  const classesAndSubpages: Array<{
    name: string
    index: string
    subPages: Array<Signature>
    slug?: string
  }> = (parsedContent || [])
    .filter((document) => document.kindString === 'Class')
    .map((props: ClassSignature) => {
      const alias = props.comment?.tags?.find(({ tag }) => tag === 'alias')?.text?.toLowerCase()
      const slugEnding = kebabCase(alias || props.name).replace(/\n/gi, '')
      const slugRegExp = new RegExp(`/${slugEnding}$`, 'gi')
      const slug = baseSlug
        ? slugRegExp.test(baseSlug)
          ? baseSlug
          : `${baseSlug}/${slugEnding}`
        : undefined

      return {
        name: props.name,
        index: ClassTemplate(props, parsedContent as Array<Signature>),
        subPages: props.children || [],
        slug
      }
    })

  const results = await Promise.allSettled(
    classesAndSubpages.map(async ({ name, index, subPages, slug }) => {
      //const outputDirectory = `${outputPath}/${kebabCase(name)}`

      // we are creating the folder for the class
      try {
        await fs.mkdir(outputPath, { recursive: true })
      } catch {
        if (verbose) {
          console.info(chalk.blue`⏭️  Skipping: Class folder already exists.\n`)
        }
      }

      // create index.mdx for the class
      await fs.writeFile(`${outputPath}/${kebabCase(name)}.mdx`, index, 'utf-8')

      await generateFunctions(subPages, outputPath, {
        originalDocument: parsedContent,
        classSlug: slug
      })

      return { name, fileOutput: outputPath }
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
        chalk.green`✅ Generated ${chalk.bold(result.value.name)}\n    ${chalk.italic.gray(
          `(Output: ${result.value.fileOutput})`
        )}`
      )
    }
  })
}

export default generateClasses
