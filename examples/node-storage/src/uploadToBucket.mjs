import fs from 'fs'
import fetch from 'node-fetch'
import { createClient } from './client.mjs'

const client = createClient()

export async function uploadToBucket() {
  console.info('Uploading a Single File to a custom bucket...')

  try {
    // Download image from remote URL
    const response = await fetch(
      'https://hips.hearstapps.com/hmg-prod/images/cute-cat-photos-1593441022.jpg?crop=1.00xw:0.753xh;0,0.153xh&resize=1200:*'
    )

    if (!response.ok) {
      console.error(`[file-to-bucket]`, 'Image not found!')

      return
    }

    const arrayBuffer = await response.arrayBuffer()

    const fileBuffer = Buffer.from(arrayBuffer)
    const fileName = 'cat.jpg'

    fs.writeFile(fileName, fileBuffer, async (err) => {
      if (err) {
        console.error(`[file-to-bucket]`, err)
        return
      }

      const file = fs.createReadStream(fileName)

      const { error: uploadError, fileMetadata } = await client.storage.upload({
        file,
        bucketId: 'custom'
      })

      if (uploadError) {
        console.error(`[file-to-bucket]`, uploadError)

        return
      }

      console.info(`[file-to-bucket]`, `File has been uploaded successfully!`)
      console.info(`[file-to-bucket]`, `ID: ${fileMetadata?.id}`)

      console.log(fileMetadata.bucketId)

      // Generate a presigned URL for the uploaded file
      const { error: presignError, presignedUrl: image } = await client.storage.getPresignedUrl({
        fileId: fileMetadata.id
      })

      if (presignError) {
        console.error(`[file-to-bucket]`, presignError)
        return
      }

      console.info(`[file-to-bucket]`, `Presigned URL: ${image.url}`)
    })

    // Upload file to Nhost Storage
  } catch (error) {
    console.error(`[file-to-bucket]`, error.message)
  }
}
