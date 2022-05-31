import {
  Container,
  Progress,
  Title,
  Text,
  MantineTheme,
  useMantineTheme,
  Table,
  Button,
  RingProgress,
  Center,
  ThemeIcon,
  Grid,
  Card,
  Group,
  ActionIcon,
  SimpleGrid
} from '@mantine/core'
import { Dropzone, DropzoneStatus } from '@mantine/dropzone'
import React from 'react'
import { useFileUpload, useMultipleFilesUpload, useFileUploadItem } from '@nhost/react'
import {
  FaCloudUploadAlt,
  FaCheckCircle,
  FaCheck,
  FaMinus,
  FaExclamationTriangle
} from 'react-icons/fa'
import { FileItemRef } from '@nhost/core'

function getIconColor(status: DropzoneStatus, theme: MantineTheme) {
  return status.accepted
    ? theme.colors[theme.primaryColor][theme.colorScheme === 'dark' ? 4 : 6]
    : status.rejected
    ? theme.colors.red[theme.colorScheme === 'dark' ? 4 : 6]
    : theme.colorScheme === 'dark'
    ? theme.colors.dark[0]
    : theme.colors.gray[7]
}

export const DropzoneChildren: React.FC<
  React.PropsWithChildren<{
    status: DropzoneStatus
    theme: MantineTheme
    success: boolean
    error: boolean
    progress: number
  }>
> = ({ status, theme, success, progress, error, children }) => (
  <Grid style={{ pointerEvents: 'none' }} align="center">
    <Grid.Col span={4}>
      {success ? (
        <RingProgress
          sections={[{ value: 100, color: 'teal' }]}
          label={
            <Center>
              <ThemeIcon color="teal" variant="light" radius="xl" size="xl">
                <FaCheckCircle size={22} />
              </ThemeIcon>
            </Center>
          }
        />
      ) : error ? (
        <Center>
          <FaExclamationTriangle style={{ color: 'red', maxWidth: '80px' }} size={80} />
        </Center>
      ) : progress ? (
        <RingProgress
          sections={[{ value: progress, color: 'blue' }]}
          label={
            <Center>
              <Text color="blue" weight={700} size="xl">
                {progress}%
              </Text>
            </Center>
          }
        />
      ) : (
        <Center>
          <FaCloudUploadAlt
            style={{ color: getIconColor(status, theme), maxWidth: '80px' }}
            size={80}
          />
        </Center>
      )}
    </Grid.Col>
    <Grid.Col span={8}>
      <Center>{children}</Center>
    </Grid.Col>
  </Grid>
)

const ListItem: React.FC<React.PropsWithChildren<{ fileRef: FileItemRef }>> = ({ fileRef }) => {
  const { progress, isUploaded, name, isError, destroy } = useFileUploadItem(fileRef)
  return (
    <tr>
      <td>
        {name} {isError && <FaExclamationTriangle color="red" />}
      </td>
      <td>{progress && <Progress value={progress} />}</td>
      <td>
        <ActionIcon onClick={destroy}>
          {isUploaded ? <FaCheck color="teal" /> : <FaMinus />}
        </ActionIcon>
      </td>
    </tr>
  )
}

export const StoragePage: React.FC = () => {
  const { upload, progress, isUploaded, isUploading, isError } = useFileUpload()
  const {
    add,
    upload: uploadAll,
    progress: progressAll,
    isUploaded: uploadedAll,
    isUploading: uploadingAll,
    hasError,
    list,
    clear,
    cancel
  } = useMultipleFilesUpload()
  const theme = useMantineTheme()

  return (
    <Container>
      <Title>Storage</Title>
      <Card shadow="sm" p="lg" m="sm">
        <Title order={2}>Upload a single file</Title>

        <Dropzone
          onDrop={(files) => {
            console.log('accepted files', files)
            upload(files[0])
          }}
          onReject={(files) => console.log('rejected files', files)}
          multiple={false}
        >
          {(status) => (
            <DropzoneChildren
              status={status}
              theme={theme}
              success={isUploaded}
              progress={progress || 0}
              error={isError}
            >
              {isUploaded ? (
                <Text size="xl">Successfully uploaded</Text>
              ) : isUploading ? (
                <Text size="xl">Uploading...</Text>
              ) : isError ? (
                <Text size="xl">Error uploading the file</Text>
              ) : (
                <Text size="xl">Drag a file here or click to select</Text>
              )}
            </DropzoneChildren>
          )}
        </Dropzone>
      </Card>
      <Card shadow="sm" p="lg" m="sm">
        <Title order={2}>Upload multiple files</Title>
        <SimpleGrid cols={1}>
          <Dropzone
            onDrop={(files) => {
              add(files)
            }}
            onReject={(files) => console.log('rejected files', files)}
          >
            {(status) => (
              <DropzoneChildren
                status={status}
                theme={theme}
                success={uploadedAll}
                error={hasError}
                progress={progressAll || 0}
              >
                {uploadedAll ? (
                  <Text size="xl">Successfully uploaded</Text>
                ) : uploadingAll ? (
                  <Text size="xl">Uploading...</Text>
                ) : hasError ? (
                  <div>Error uploading some files</div>
                ) : (
                  <Text size="xl">Drag files here or click to select</Text>
                )}
              </DropzoneChildren>
            )}
          </Dropzone>
          <Table style={{ width: '100%', maxWidth: '100%' }}>
            <colgroup>
              <col />
              <col width="20%" />
              <col />
            </colgroup>
            <tbody>
              {list.map((ref) => (
                <ListItem key={ref.id} fileRef={ref} />
              ))}
            </tbody>
          </Table>
          <Group grow>
            <Button
              leftIcon={<FaCloudUploadAlt size={14} />}
              onClick={() => uploadAll()}
              loading={uploadingAll}
            >
              Upload
            </Button>
            {uploadingAll ? (
              <Button onClick={cancel}>Cancel</Button>
            ) : (
              <Button leftIcon={<FaCloudUploadAlt size={14} />} onClick={() => clear()}>
                Clear
              </Button>
            )}
          </Group>
        </SimpleGrid>
      </Card>
    </Container>
  )
}
