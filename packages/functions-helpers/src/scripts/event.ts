import path from 'path'

import args from 'command-line-args'
import fs from 'fs-extra'

const { path: dirPath, name } = args([
  { name: 'path', alias: 'p', type: String, defaultValue: 'functions/events' },
  { name: 'name', alias: 'n', type: String }
])

if (!name) {
  console.log('no name')
  process.exit(1)
}
const event = 'TODO'
const template = `import { eventFunction } from '@nhost/functions-helpers'

// Describe the event payload in the generic type <{}>
export default eventFunction<{}>('${event}', (req, res) => {
  // Insert your code here
})

`

async function main() {
  //   1. Check Hasura is running
  //   2. Look for the Hasura metadata event(s) - the one with the name, or get them all and prompt the user to choose?
  //   3. Create the file

  const filePath = path.join(dirPath, `${name}.ts`)
  await fs.ensureDir(dirPath)
  if (await fs.pathExists(filePath)) {
    console.log(`File already exists: ${filePath}`)
    process.exit(1)
  }
  await fs.writeFile(filePath, template)
}

main()
