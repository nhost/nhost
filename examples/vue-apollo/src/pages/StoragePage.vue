<template>
  <div className="d-flex align-center flex-column">
    <h1>Storage</h1>
    <v-card width="400" tile>
      <v-card-title>Upload a single file</v-card-title>
      <v-card-text>
        <FileUpload @onDrop="onDropSingleFile" />
        <span v-if="isUploading">Uploading...</span>
        <span v-if="isUploaded" class="upload_success">Upload Succeeded</span>
        <span v-if="isError" class="upload_error">Upload Failed</span>
        <!-- <v-progress-circular :size="100" :width="15" :model-value="progress" color="primary">
          {{ progress }}
        </v-progress-circular> -->
      </v-card-text>
    </v-card>

    <v-card width="400" tile>
      <v-card-title>Upload multiple files</v-card-title>
      <v-card-text class="footer">
        <FileUpload :multiple="true" />
      </v-card-text>
      <div class="buttonsContainer">
        <v-btn> Upload </v-btn>
        <v-btn> Cancel </v-btn>
      </div>
    </v-card>
  </div>
</template>

<script lang="ts" setup>
import { useFileUpload } from '@nhost/vue'
import FileUpload from '../components/FileUpload.vue'

const { upload, isUploaded, isUploading, isError } = useFileUpload()

console.log({
  isUploaded,
  isUploading,
  isError
})

// const {
//   add,
//   upload: uploadAll,
//   progress: progressAll,
//   isUploaded: uploadedAll,
//   isUploading: uploadingAll,
//   isError: isErrorAll,
//   files,
//   clear,
//   cancel
// } = useMultipleFilesUpload()

const onDropSingleFile = async ([file]: File[]) => upload({ file })
</script>

<style lang="css" scoped>
.buttonsContainer {
  margin-top: 1rem;
  padding: 1rem;
}

.upload_success {
  color: 'green';
}

.upload_error {
  color: 'red';
}
</style>
