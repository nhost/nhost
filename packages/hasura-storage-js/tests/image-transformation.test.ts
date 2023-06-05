import FormData from 'form-data'
import fs from 'fs'
import jpeg from 'jpeg-js'
import pixelmatch from 'pixelmatch'
import { beforeAll, describe, expect, it } from 'vitest'
import { storage } from './utils/helpers'

const downloadJpeg = async (url: string) =>
  jpeg.decode(Buffer.from(await fetch(url).then((res) => res.arrayBuffer())))

describe('Image transformation', () => {
  let fileId: string
  beforeAll(async () => {
    const fd = new FormData()
    fd.append('file', fs.createReadStream('./tests/assets/image.jpeg'))

    const { fileMetadata } = await storage.upload({
      formData: fd
    })

    if (!fileMetadata) {
      throw new Error('fileMetadata is missing')
    }

    fileId =
      'processedFiles' in fileMetadata
        ? fileMetadata.processedFiles[0]?.id
        : (fileMetadata.id as string)
  })

  it('should be able to change the image width in a public url', async () => {
    const image = await downloadJpeg(
      storage.getPublicUrl({
        fileId,
        width: 100
      })
    )

    expect(image.width).toBe(100)

    const baseline = jpeg.decode(fs.readFileSync('./tests/assets/transformations/width.jpeg'))

    expect(
      pixelmatch(image.data, baseline.data, null, baseline.width, baseline.height, {
        threshold: 0.1
      })
    ).toEqual(0)
  })

  it('should be able to change the image height in a public url', async () => {
    const image = await downloadJpeg(
      storage.getPublicUrl({
        fileId,
        height: 100
      })
    )

    expect(image.height).toBe(100)

    const baseline = jpeg.decode(fs.readFileSync('./tests/assets/transformations/height.jpeg'))

    expect(
      pixelmatch(image.data, baseline.data, null, baseline.width, baseline.height, {
        threshold: 0.1
      })
    ).toEqual(0)
  })

  it('should be able to change the image blur in a public url', async () => {
    const image = await downloadJpeg(
      storage.getPublicUrl({
        fileId,
        blur: 50
      })
    )

    const baseline = jpeg.decode(fs.readFileSync('./tests/assets/transformations/blur.jpeg'))

    expect(
      pixelmatch(image.data, baseline.data, null, baseline.width, baseline.height, {
        threshold: 0.1
      })
    ).toEqual(0)
  })

  // TODO implement radius and quality tests
  // TODO implement pressigned url tests when implemented in hasura-storage
})
