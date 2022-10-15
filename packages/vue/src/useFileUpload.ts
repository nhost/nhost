import { ? } from 'vue'

import {
    //Are the below imports correct for fileupload in vue?
    createFileUploadMachine,
    FileItemRef,
    FileUploadMachine,
    FileUploadState,
    StorageUploadFileParams,
    UploadFileHandlerResult,
    uploadFilePromise
} from '@nhost/hasura-storage-js'
import { useInterpret, useSelector } from '@xstate/react'

import { useNhostClient } from './useNhostClient'

