import fs from 'fs'
import { describe, expect, it } from 'vitest'
import fetch from 'cross-fetch'

import { storage } from './helpers'
import FormData from 'form-data'

describe('test upload', () => {
  it('should upload a file from the file system', async () => {
    const fd = new FormData()
    fd.append('file', fs.createReadStream('./tests/assets/sample.pdf'), 'logo.png')

    const { error } = await storage.upload({
      file: fd
    })
    expect(error).toBeNull()
  })

  it('should upload a file using blob from fetch', async () => {
    const logo = await fetch('http://nodejs.org/images/logo.png')

    let blob = await logo.blob()

    // create form data
    const fd = new FormData()
    fd.append('file', blob.stream(), 'logo.png')

    const { error } = await storage.upload({
      file: fd
    })

    expect(error).toBeNull()
  })
})
