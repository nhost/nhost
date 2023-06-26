import fs from 'fs'
import fetch from 'node-fetch'
import { v4 as uuidv4 } from 'uuid'
import { createClient } from './client.mjs'

const client = createClient()

export async function uploadFile() {
  console.info('Uploading Using File...')

  try {
    // Download image from remote URL
    const response = await fetch(
      'https://hips.hearstapps.com/hmg-prod/images/cute-cat-photos-1593441022.jpg?crop=1.00xw:0.753xh;0,0.153xh&resize=1200:*'
    )

    if (!response.ok) {
      console.error(`[file]`, 'Image not found!')

      return
    }

    const arrayBuffer = await response.arrayBuffer()

    const fileBuffer = Buffer.from(arrayBuffer)
    const fileName = 'cat.jpg'

    fs.writeFile(fileName, fileBuffer, async (err) => {
      if (err) {
        console.error(`[file]`, err)
        return
      }

      const file = fs.createReadStream(fileName)
      const customFileId = uuidv4()

      const { error: uploadError, fileMetadata } = await client.storage.upload({
        file,
        id: customFileId
      })

      if (uploadError) {
        console.error(`[file]`, uploadError)

        return
      }

      console.info(`[file]`, `File has been uploaded successfully!`)

      const uploadedFile =
        'processedFiles' in fileMetadata ? fileMetadata.processedFiles[0] : fileMetadata

      console.info(`[file]`, `ID: ${uploadedFile?.id}`)

      // Generate a presigned URL for the uploaded file
      const { error: presignError, presignedUrl: blurredImage } =
        await client.storage.getPresignedUrl({ fileId: uploadedFile.id })

      if (presignError) {
        console.error(`[file]`, presignError)
        return
      }

      console.info(`[file]`, `Presigned URL: ${blurredImage.url}`)
    })

    // Upload file to Nhost Storage
  } catch (error) {
    console.error(`[file]`, error.message)
  }
}
