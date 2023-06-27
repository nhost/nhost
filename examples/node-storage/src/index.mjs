import { uploadFile } from './uploadFile.mjs'
import { uploadFormData } from './uploadFormData.mjs'

async function uploadFiles() {
  await uploadFormData()

  console.info('-----')

  await uploadFile()
}

uploadFiles()
