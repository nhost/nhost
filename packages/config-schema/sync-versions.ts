import chalk from 'chalk'
import { readJson, writeJson } from 'fs-extra'
import type { JSONSchema4 } from 'json-schema'

const findVersion = (versions: JSONSchema4, version: string) =>
  versions.oneOf?.find((cursor) =>
    cursor.allOf?.some((versionItem) => versionItem.properties?.version.const === version)
  )

const addVersion = (versions: JSONSchema4, version: string) => ({
  ...versions,
  oneOf: [
    ...(versions?.oneOf || []),
    {
      allOf: [
        {
          properties: {
            version: {
              const: version
            }
          }
        },
        {
          $ref: `https://raw.githubusercontent.com/nhost/nhost/@nhost/config-schema@${version}/packages/config-schema/schema.json`
        }
      ]
    }
  ]
})

const main = async () => {
  const versions: JSONSchema4 = await readJson('versions.json')
  const { version }: { version: string } = await readJson('package.json')
  console.info(chalk.blue`📝 Package,json version is ${version}`)
  console.info(chalk.blue`📝 Looking for version inm${chalk.italic('versions.json')}...`)
  if (findVersion(versions, version)) {
    console.info(chalk.green`\n✅ Version ${version} already synced.`)
  } else {
    console.log('Add version', version)
    await writeJson('versions.json', addVersion(versions, version), { spaces: 2 })
    console.info(chalk.green`\n✅ Added version to ${chalk.italic('versions.json')}.`)
  }
}

main()
