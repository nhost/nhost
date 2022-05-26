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
  Card
} from '@mantine/core'
import { Dropzone, DropzoneStatus } from '@mantine/dropzone'
import React from 'react'
import { useFileUpload, useMultipleFilesUpload, useFilesListItem } from '@nhost/react'
import { FaCloudUploadAlt, FaCheckCircle } from 'react-icons/fa'
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
    progress: number
  }>
> = ({ status, theme, success, progress, children }) => (
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
  const [actor] = useFilesListItem(fileRef)
  return (
    <tr>
      <td>{actor.context.file?.name}</td>
      <td>{actor.context.progress && <Progress value={actor.context.progress} />}</td>
    </tr>
  )
}

export const StoragePage: React.FC = () => {
  const { upload, progress, isUploaded, isUploading } = useFileUpload()
  const {
    add,
    upload: uploadAll,
    progress: progressAll,
    isUploaded: uploadedAll,
    isUploading: uploadingAll,
    list
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
            >
              {isUploaded ? (
                <Text size="xl">Successfully uploaded</Text>
              ) : isUploading ? (
                <Text size="xl">Uploading...</Text>
              ) : (
                <Text size="xl">Drag files here or click to select</Text>
              )}
            </DropzoneChildren>
          )}
        </Dropzone>
      </Card>
      <Card shadow="sm" p="lg" m="sm">
        <Title order={2}>Upload multiple files</Title>

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
              progress={progressAll || 0}
            >
              {uploadedAll ? (
                <Text size="xl">Successfully uploaded</Text>
              ) : uploadingAll ? (
                <Text size="xl">Uploading...</Text>
              ) : (
                <Text size="xl">Drag files here or click to select</Text>
              )}
            </DropzoneChildren>
          )}
        </Dropzone>
        <Table verticalSpacing="xs">
          <thead>
            <tr>
              <th>Name</th>
              <th>Progress</th>
            </tr>
          </thead>
          <tbody>
            {list.map((ref) => (
              <ListItem key={ref.id} fileRef={ref} />
            ))}
          </tbody>
        </Table>
        <Button
          leftIcon={<FaCloudUploadAlt size={14} />}
          onClick={() => uploadAll()}
          loading={isUploading}
        >
          Upload
        </Button>
      </Card>
    </Container>
  )
}
