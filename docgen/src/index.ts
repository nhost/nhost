import { proxy } from 'valtio'

import { Signature } from './types'

/**
 * General app state such as whether the app is in verbose mode or not.
 */
export const appState = proxy({ verbose: false })

/**
 * Generates the class, function and type documentation for a module.
 *
 * @param parsedContent - Auto-generated JSON file content
 * @param output - Output directory
 * @param name - Name of the module
 */
async function generateModuleDocumentation(
  parsedContent: Array<any>,
  output: string,
  name?: string
) {
  const { verbose } = appState
  const { default: chalk } = await import('chalk')
  const { generateClasses, generateFunctions, generateTypes } = await import('./generators')

  if (name) {
    console.info(chalk.blue`\n📝 Generating module documentation for ${name}...`)
  }

  if (verbose) {
    console.info(chalk.blue`\n📝 Generating class documentations...`)
  }

  await generateClasses(parsedContent, output)

  if (verbose) {
    console.info(chalk.blue`\n📝 Generating function documentations...`)
  }

  await generateFunctions(parsedContent, output)

  if (verbose) {
    console.info(chalk.blue`\n📝 Generating type documentations...`)
  }

  await generateTypes(parsedContent, output)
}

/**
 * Generates the documentation from the auto-generated JSON file.
 */
async function parser() {
  const { program } = await import('commander')
  const command = program
    .option('-p, --path <path>', 'Path to the auto-generated JSON file')
    .option('-o, --output <output>', 'Path to the output directory')
    .option('-t, --title <title>', 'Title of the root sidebar menu')
    .option('-v, --verbose', 'Verbose mode')
    .option('-c, --cleanup', 'Cleanup the output directory before generating docs')
    .parse()

  const { path, output, title, cleanup, verbose } = command.opts()

  appState.verbose = verbose

  try {
    if (!path) {
      throw new Error(`Please specify path to the auto-generated JSON file. (See -p or --path)`)
    }

    if (!output) {
      throw new Error(`Please specify path to the output directory. (See -o or --output)`)
    }

    const { default: chalk } = await import('chalk')
    const fs = await import('fs/promises')

    console.info(chalk.blue`📁 Parsing file: ${path}`)

    const file = await fs.readFile(path, 'utf8')
    const { name, children: parsedContent } = JSON.parse(file)

    if (cleanup) {
      try {
        await fs.rm(output, { recursive: true })

        console.info(chalk.blue`\n🗑  Output directory cleaned up.`)
      } catch {
        // TODO: verbose logging
      }
    }

    // create output directory if it doesn't exist
    try {
      await fs.readdir(output)
    } catch {
      await fs.mkdir(output, { recursive: true })
    }

    if (title) {
      await fs.writeFile(
        `${output}/_category_.json`,
        JSON.stringify(
          {
            label: title
          },
          null,
          2
        ),
        'utf-8'
      )
    }

    if (verbose) {
      console.info(chalk.blue`\n📝 Generating ${title || name} docs...`)
    }

    if (parsedContent?.every(({ kindString }: Signature) => kindString === 'Module')) {
      await Promise.all(
        parsedContent.map(({ name, children }: Signature) =>
          generateModuleDocumentation(children || [], output, name)
        )
      )
    } else {
      await generateModuleDocumentation(parsedContent, output)
    }

    console.info()

    console.info(chalk.bgBlueBright.black`🎉 Successfully generated docs! 🎉`)
  } catch (error) {
    const { default: chalk } = await import('chalk')

    console.error(
      chalk.red`🔴 ${(error as Error).message}`,
      chalk.gray`\n${(error as Error).stack}`
    )
  }
}

parser()
