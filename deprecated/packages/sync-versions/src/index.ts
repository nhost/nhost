#!/usr/bin/env node
import { findWorkspaceDir } from '@pnpm/find-workspace-dir'
import fs from 'fs'
import { globSync } from 'glob'
import { set } from 'object-path'
import path from 'path'
import yaml from 'yaml'

interface NhostCloudConfig {
  hasura: string
  auth: string
  storage: string
}

const main = async () => {
  const root = await findWorkspaceDir(process.cwd())

  const { hasura, auth, storage }: NhostCloudConfig = yaml.parse(
    fs.readFileSync(path.join(root!, 'nhost-cloud.yaml'), 'utf-8')
  )

  const nhostConfigs = globSync('**/nhost/config.yaml', {
    cwd: root,
    absolute: true,
    realpath: true
  })
  let updated = 0
  for (const file of nhostConfigs) {
    const rawInitial = fs.readFileSync(file, 'utf8')
    const doc = yaml.parse(rawInitial)

    set(doc, 'services.hasura.image', `hasura/graphql-engine:${hasura}`)
    set(doc, 'services.auth.image', `nhost/hasura-auth:${auth}`)
    set(doc, 'services.storage.image', `nhost/hasura-storage:${storage}`)
    const rawModified = yaml.stringify(doc, { singleQuote: true })
    fs.writeFileSync(file, rawModified)
    if (rawInitial !== rawModified) {
      updated++
      console.log(`Updated ${file}`)
    }
  }
  if (updated) {
    console.log(`Updated ${updated} nhost config files`)
  } else {
    console.log('All the Nhost config files are already up-to-date.')
  }
}

main()
