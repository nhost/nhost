import { uploadFile } from './uploadFile.mjs'
import { uploadFormData } from './uploadFormData.mjs'
import { uploadToBucket } from './uploadToBucket.mjs'

async function uploadFiles() {
  await uploadFormData()

  console.info('-----')

  await uploadFile()

  console.info('-----')

  await uploadToBucket()
}

uploadFiles()
