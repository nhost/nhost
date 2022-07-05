import fs from 'fs'
import path from 'path'
import yaml from 'yaml'
import Ajv from 'ajv'
import glob from 'glob'
import findWorkspaceRoot from '@pnpm/find-workspace-dir'
import draft6MetaSchema from 'ajv/dist/refs/json-schema-draft-06.json'

const ajv = new Ajv()
ajv.addMetaSchema(draft6MetaSchema)

const schema = JSON.parse(fs.readFileSync('schema.json', 'utf8'))

describe('test valid schemas', () => {
  const validList = ['base']
  validList
    .map((name) => path.join(__dirname, 'valid', `${name}.yaml`))
    .forEach((file) => {
      it(`${file} should be valid`, () => {
        const contents = yaml.parse(fs.readFileSync(file, 'utf8'))
        const validation = ajv.validate(schema, contents)
        expect(validation).toBe(true)
      })
    })
})

describe('test invalid schemas', () => {
  const invalidList = ['cli']
  invalidList
    .map((name) => path.join(__dirname, 'invalid', `${name}.yaml`))
    .forEach((file) => {
      it(`${file} should be invalid`, () => {
        const contents = yaml.parse(fs.readFileSync(file, 'utf8'))
        const validation = ajv.validate(schema, contents)
        expect(validation).toBe(false)
      })
    })
})

describe('test configurations from the monorepo', async () => {
  const root = await findWorkspaceRoot(process.cwd())
  const nhostConfigs = glob.sync('**/nhost/config.yaml', {
    cwd: root,
    absolute: true,
    realpath: true
  })
  for (const file of nhostConfigs) {
    it(`${file} should be valid`, () => {
      const contents = yaml.parse(fs.readFileSync(file, 'utf8'))
      const validation = ajv.validate(schema, contents)
      expect(validation).toBe(true)
    })
  }
})
