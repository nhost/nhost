#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import glob from 'glob'
import yaml from 'yaml'
import findWorkspaceRoot from '@pnpm/find-workspace-dir'

import { set } from 'object-path'

interface NhostCloudConfig {
  hasura: string
  auth: string
  storage: string
}

const main = async () => {
  const root = await findWorkspaceRoot(process.cwd())

  const { hasura, auth, storage }: NhostCloudConfig = yaml.parse(
    fs.readFileSync(path.join(root!, 'nhost-cloud.yaml'), 'utf-8')
  )

  const nhostConfigs = glob.sync('**/nhost/config.yaml', {
    cwd: root,
    absolute: true,
    realpath: true
  })
  for (const file of nhostConfigs) {
    const rawInitial = fs.readFileSync(file, 'utf8')
    const doc = yaml.parse(rawInitial)

    set(doc, 'services.hasura.version', hasura)
    set(doc, 'services.auth.version', auth)
    set(doc, 'services.storage.version', storage)
    const rawModified = yaml.stringify(doc, { singleQuote: true })
    fs.writeFileSync(file, rawModified)
    if (rawInitial !== rawModified) {
      console.log(`Updated ${file}`)
    }
  }
}

main()
