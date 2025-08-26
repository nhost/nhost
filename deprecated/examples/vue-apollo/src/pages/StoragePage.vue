<template>
  <div className="d-flex align-center flex-column">
    <h1>Storage</h1>
    <v-card width="400" class="singleFileUpload" tile>
      <v-card-title>Upload a single file</v-card-title>
      <v-card-text>
        <FileDropZone @on-drop="onDropSingleFile" />
        <span v-if="isUploading" class="upload_status">Uploading...</span>
        <span v-if="isUploaded" class="upload_status upload_success">Upload Succeeded</span>
        <span v-if="isError" class="upload_status upload_error">Upload Failed</span>
        <div v-if="fileToUpload" class="file_progress">
          <span class="file_progress_name">{{ fileToUpload.name }}</span>
          <v-progress-linear v-model="progress" color="green">
            {{ progress }}
          </v-progress-linear>
          <button class="clearButton" @click="clearFile">Clear</button>
        </div>
      </v-card-text>
    </v-card>

    <v-card width="400" tile class="relative">
      <v-card-title>Upload multiple files</v-card-title>
      <v-card-text class="footer">
        <FileDropZone :multiple="true" @on-drop="onDropMultipleFiles" />
        <span v-if="isUploadingAll" class="upload_status">Uploading...</span>
        <span v-if="isUploadedAll" class="upload_status upload_success">Upload Succeeded</span>
        <span v-if="isErrorAll" class="upload_status upload_error">Upload Failed</span>
      </v-card-text>

      <div v-for="(file, index) of files" :key="index">
        <FileUploadItem :file="file" />
      </div>

      <div class="relative buttonsContainer">
        <v-btn
          class="mb-2 text-white w-100"
          :disabled="!files.length"
          variant="elevated"
          color="green"
          @click="uploadAll"
        >
          Upload
        </v-btn>
        <v-btn class="w-100" @click="clear"> Clear </v-btn>
      </div>
    </v-card>
  </div>
</template>

<script lang="ts" setup>
import { useFileUpload, useMultipleFilesUpload } from '@nhost/vue'
import { ref } from 'vue'
import FileDropZone from '../components/FileDropZone.vue'
import FileUploadItem from '../components/FileUploadItem.vue'

const fileToUpload = ref<File | null>(null)

const { upload, progress, isUploaded, isUploading, isError } = useFileUpload()

const onDropSingleFile = async ([file]: File[]) => {
  fileToUpload.value = file
  upload({ file })
}

const clearFile = () => {
  fileToUpload.value = null
  isUploaded.value = false
}

const {
  add,
  upload: uploadAll,
  isUploaded: isUploadedAll,
  isUploading: isUploadingAll,
  isError: isErrorAll,
  files,
  clear
} = useMultipleFilesUpload()

const onDropMultipleFiles = (files: File[]) => {
  add({ files })
}
</script>

<style lang="css" scoped>
.buttonsContainer {
  padding: 1rem;
}

.upload_success {
  color: 'green';
}

.upload_error {
  color: 'red';
}

.file_progress {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.file_progress_name {
  margin-right: 1rem;
}

.upload_status {
  display: block;
  margin: 1rem 0;
}

.singleFileUpload {
  margin-bottom: 1rem;
}

.clearButton {
  margin-left: 1rem;
  background: red;
  color: #fff;
  padding: 5px 10px;
  border-radius: 8px;
  cursor: pointer;
}

.relative {
  position: relative;
}
</style>
