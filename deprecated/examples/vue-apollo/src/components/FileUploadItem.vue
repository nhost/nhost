<script lang="ts" setup>
import { FileItemRef } from '@nhost/nhost-js'
import { useFileUploadItem } from '@nhost/vue'

const { file } = defineProps<{ file: FileItemRef }>()

const { name, progress } = useFileUploadItem(file)
</script>

<template>
  <div class="container">
    <span class="file_name">{{ name }}</span>
    <v-progress-linear v-model="progress" color="green">
      {{ progress }}
    </v-progress-linear>
  </div>
</template>

<style lang="css" scoped>
.container {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 0 1rem;
}

.file_name {
  margin-right: 1rem;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  width: 40%;
}
</style>
