import dotenv from 'dotenv'
import FormData from 'form-data'
import fetch from 'node-fetch'
import { createClient } from './client.mjs'

dotenv.config()

const client = createClient()

async function uploadImage() {
  try {
    // Download image from remote URL
    const response = await fetch(
      'https://hips.hearstapps.com/hmg-prod/images/cute-cat-photos-1593441022.jpg?crop=1.00xw:0.753xh;0,0.153xh&resize=1200:*'
    )

    if (!response.ok) {
      console.error('Image not found!')

      return
    }

    const arrayBuffer = await response.arrayBuffer()

    const formData = new FormData()
    formData.append('file[]', Buffer.from(arrayBuffer), 'cat.jpg')

    // Upload file to Nhost Storage
    const { error: uploadError, fileMetadata } = await client.storage.upload({
      formData,
      headers: { ...formData.getHeaders() }
    })

    if (uploadError) {
      console.error(uploadError)

      return
    }

    console.info(`File has been uploaded successfully!`)

    const uploadedFile =
      'processedFiles' in fileMetadata ? fileMetadata.processedFiles[0] : fileMetadata

    console.info(`ID: ${uploadedFile?.id}`)

    // Generate a presigned URL for the uploaded file
    const { error: presignError, presignedUrl: blurredImage } =
      await client.storage.getPresignedUrl({ fileId: uploadedFile.id })

    if (presignError) {
      console.error(presignError)
      return
    }

    console.info(`Presigned URL: ${blurredImage.url}`)
  } catch (error) {
    console.error(error.message)
  }
}

uploadImage()
