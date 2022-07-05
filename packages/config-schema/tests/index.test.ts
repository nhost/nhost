import fs from 'fs'
import path from 'path'
import yaml from 'yaml'
import Ajv from 'ajv'

import draft6MetaSchema from 'ajv/dist/refs/json-schema-draft-06.json'

const ajv = new Ajv()
ajv.addMetaSchema(draft6MetaSchema)

const schema = JSON.parse(fs.readFileSync('schema.json', 'utf8'))

describe('test valid schemas', () => {
  const basePath = path.join(__dirname, 'valid')
  fs.readdirSync(basePath).forEach((file) => {
    it(`${file} should be valid`, () => {
      const contents = yaml.parse(fs.readFileSync(path.join(basePath, file), 'utf8'))
      const validation = ajv.validate(schema, contents)
      expect(validation).toBe(true)
    })
  })
})

describe('test invalid schemas', () => {
  const basePath = path.join(__dirname, 'invalid')
  fs.readdirSync(basePath).forEach((file) => {
    it(`${file} should be valid`, () => {
      const contents = yaml.parse(fs.readFileSync(path.join(basePath, file), 'utf8'))
      const validation = ajv.validate(schema, contents)
      expect(validation).toBe(false)
    })
  })
})
