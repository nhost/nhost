<script setup lang="ts">
import { ref, toRaw, unref, type Ref } from 'vue'
import { useDropzone, type FileRejectReason } from 'vue3-dropzone'

const { multiple } = defineProps({
  multiple: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['onDrop'])

const files: Ref<File[]> = ref([])
const errors: Ref<FileRejectReason[]> = ref([])

const { getRootProps, getInputProps, isDragActive } = useDropzone({
  onDrop,
  multiple
})

function onDrop(acceptFiles: File[], rejectReasons: FileRejectReason[]) {
  files.value = acceptFiles
  errors.value = rejectReasons

  emit('onDrop', toRaw(unref(files)))
}
</script>

<template>
  <div>
    <div class="dropzone" v-bind="getRootProps()">
      <div
        class="border"
        :class="{
          isDragActive
        }"
      >
        <input v-bind="getInputProps()" />
        <p v-if="isDragActive">Drop here ...</p>
        <p v-else>Drag and drop here, or Click to select</p>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.dropzone,
.files {
  width: 100%;
  margin: 0 auto;
  padding: 10px;
  border-radius: 8px;
  box-shadow: rgba(60, 64, 67, 0.3) 0px 1px 2px 0px, rgba(60, 64, 67, 0.15) 0px 1px 3px 1px;
  font-size: 12px;
  line-height: 1.5;
}

.border {
  border: 2px dashed #ccc;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  transition: all 0.3s ease;
  background: #fff;

  &.isDragActive {
    border: 2px dashed #ffb300;
    background: rgb(255 167 18 / 20%);
  }
}

.file-item {
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgb(255 167 18 / 20%);
  padding: 7px;
  padding-left: 15px;
  margin-top: 10px;

  &:first-child {
    margin-top: 0;
  }

  .delete-file {
    background: red;
    color: #fff;
    padding: 5px 10px;
    border-radius: 8px;
    cursor: pointer;
  }
}
</style>
