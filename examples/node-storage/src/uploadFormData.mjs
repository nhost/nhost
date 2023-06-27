import FormData from 'form-data'
import fetch from 'node-fetch'
import { v4 as uuidv4 } from 'uuid'
import { createClient } from './client.mjs'

const client = createClient()

export async function uploadFormData() {
  console.info('Uploading 2 Files via Form Data...')

  try {
    // Download image from remote URL
    const response = await fetch(
      'https://hips.hearstapps.com/hmg-prod/images/cute-cat-photos-1593441022.jpg?crop=1.00xw:0.753xh;0,0.153xh&resize=1200:*'
    )

    if (!response.ok) {
      console.error(`[form-data]`, 'Image not found!')

      return
    }

    const arrayBuffer = await response.arrayBuffer()

    const customValues = [
      {
        id: uuidv4(),
        name: 'cat1.jpg'
      },
      {
        id: uuidv4(),
        name: 'cat2.jpg'
      }
    ]

    const formData = new FormData()

    formData.append('file[]', Buffer.from(arrayBuffer), customValues[0].name)
    formData.append('metadata[]', JSON.stringify({ id: customValues[0].id }))
    formData.append('file[]', Buffer.from(arrayBuffer), customValues[1].name)
    formData.append('metadata[]', JSON.stringify({ id: customValues[1].id }))

    // Upload files to Nhost Storage
    const { error: uploadError, fileMetadata } = await client.storage.upload({
      formData,
      headers: { ...formData.getHeaders() }
    })

    if (uploadError) {
      console.error(`[form-data]`, uploadError)

      return
    }

    if (fileMetadata.processedFiles.length !== 2) {
      console.error(
        `[form-data]`,
        `Expected 2 files to be uploaded, but got ${fileMetadata.processedFiles.length}`
      )

      return
    }

    await Promise.all(
      fileMetadata?.processedFiles.map(async (processedFile, index) => {
        console.info(`[form-data]`, `File has been uploaded successfully!`)

        console.info(`[form-data]`, `ID: ${processedFile.id}`)
        console.info(
          `[form-data]`,
          `Matches custom ID: ${customValues.some(({ id }) => processedFile.id === id)}`
        )

        // Generate a presigned URL for the uploaded file
        const { error: presignError, presignedUrl: image } = await client.storage.getPresignedUrl({
          fileId: processedFile.id
        })

        if (presignError) {
          console.error(`[form-data]`, presignError)
          return
        }

        console.info(`[form-data]`, `Presigned URL: ${image.url}`)
      })
    )
  } catch (error) {
    console.error(`[form-data]`, error.message)
  }
}
